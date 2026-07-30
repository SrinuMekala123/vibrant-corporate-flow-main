import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Filter, Loader2, Upload, X, Info, User, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { complaintService } from "@/services/complaintService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import browserImageCompression from "browser-image-compression";
import { notificationService } from "@/services/notificationService";
import { clearOfflineDraft } from '@/lib/offlineStorage';
import { useDebounce } from "@/hooks/useDebounce";

const ComplaintEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isRole } = useAuth();
  const isNew = !id;
  const isCustomer = isRole("customer");
  const isAdminOrSupervisor = isRole("admin", "supervisor");
  const isAdmin = isRole("admin");

  const fetchProfileByName = async (name: string) => {
    if (!name) return null;
    const trimmedName = name.trim();
    try {
      if (trimmedName.includes('@')) {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .ilike('email', trimmedName)
          .maybeSingle();
        if (data) return data;
      }
      const { data: exactMatch } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('full_name', trimmedName)
        .maybeSingle();
      if (exactMatch) return exactMatch;

      const { data: partialMatch } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .ilike('full_name', `%${trimmedName}%`)
        .limit(1);
      return partialMatch?.[0] || null;
    } catch (e) {
      console.warn("Failed to fetch profile by name:", e);
      return null;
    }
  };

  const { data: existingComplaint, isLoading: isFetching } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintService.getById(id!),
    enabled: !!id && !!user,
  });

  const { data: customers, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'customer');
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrSupervisor,
  });

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, phone, expertise, available').eq('role', 'supervisor');
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        id: s.id || "",
        full_name: s.full_name || "",
        email: s.email || "",
        phone: s.phone || "",
        expertise: s.expertise || "",
        available: s.available ?? true,
        employeeId: s.employee_id || s.employeeId || s.employee_code || s.employeeCode || "",
        employee_id: s.employee_id || s.employeeId || s.employee_code || s.employeeCode || "",
        employeeCode: s.employee_code || s.employeeCode || "",
        department: s.department || s.expertise || "",
      }));
    },
    enabled: isAdminOrSupervisor,
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, phone, expertise, available').eq('role', 'technician');
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        id: t.id || "",
        full_name: t.full_name || "",
        email: t.email || "",
        phone: t.phone || "",
        expertise: t.expertise || "",
        available: t.available ?? true,
        employeeId: t.employee_id || t.employeeId || t.employee_code || t.employeeCode || "",
        employee_id: t.employee_id || t.employeeId || t.employee_code || t.employeeCode || "",
        employeeCode: t.employee_code || t.employeeCode || "",
        department: t.department || t.expertise || "",
      }));
    },
    enabled: isAdminOrSupervisor,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('full_name, phone, email').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isCustomer,
  });

  const [form, setForm] = useState({
    title: "",
    customerId: "",
    customerName: "",
    customerPhone: "",
    location: "",
    fieldOfWork: "",
    status: "unassigned",
    severity: "minor" as const,
    assignedSupervisor: "",
    assignedTechnician: "",
    description: "",
    resolution: "",
    customerLat: null as number | null,
    customerLng: null as number | null,
  });

  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [currentUserFullName, setCurrentUserFullName] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationHelp, setLocationHelp] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isManuallyTyping, setIsManuallyTyping] = useState(false);
  const debouncedLocation = useDebounce(form.location, 800);

  useEffect(() => {
    if (!debouncedLocation || debouncedLocation.length < 3 || !isManuallyTyping) return;
    const fetchCoordinates = async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedLocation)}&format=json&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data && data.length > 0) {
          setForm(prev => ({
            ...prev,
            customerLat: parseFloat(data[0].lat),
            customerLng: parseFloat(data[0].lon),
          }));
        }
      } catch (e) {
        console.warn("Forward geocoding failed:", e);
      }
    };
    fetchCoordinates();
  }, [debouncedLocation, isManuallyTyping]);

  useEffect(() => {
    // Note: Geolocation APIs are restricted to Secure Contexts (HTTPS or localhost).
    // In local development over a LAN IP (e.g. HTTP), isSecureContext is false. This is expected.
    if (!window.isSecureContext) {
      setLocationHelp("Location services require HTTPS. Please enter your address manually.");
    }
    const fetchPreviousLocations = async () => {
      try {
        const complaints = await complaintService.getAll();
        const locations = complaints
          .map(c => c.location)
          .filter((loc): loc is string => typeof loc === "string" && loc.trim().length > 0);
        
        const defaultLocations = [
          "Hyderabad, Telangana",
          "Madhapur, Hyderabad",
          "Gachibowli, Hyderabad",
          "Jubilee Hills, Hyderabad",
          "Banjara Hills, Hyderabad",
          "Bengaluru, Karnataka",
          "Whitefield, Bengaluru",
          "Chennai, Tamil Nadu",
          "Mumbai, Maharashtra",
          "Pune, Maharashtra",
          "New Delhi, Delhi"
        ];
        
        const uniqueLocations = Array.from(new Set([...locations, ...defaultLocations]));
        setLocationSuggestions(uniqueLocations);
      } catch (e) {
        console.warn("Failed to load previous locations for suggestions:", e);
      }
    };
    fetchPreviousLocations();
  }, []);

  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => {
          const name = (data as any)?.full_name || 'User';
          setCurrentUserFullName(name);
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (existingComplaint) {
      setForm({
        title: existingComplaint.title || "",
        customerId: existingComplaint.customer_id || "",
        customerName: existingComplaint.customer_name || "",
        customerPhone: existingComplaint.customer_phone || "",
        location: existingComplaint.location || "",
        fieldOfWork: existingComplaint.field_of_work || "",
        status: existingComplaint.status || "unassigned",
        severity: existingComplaint.severity || "minor",
        assignedSupervisor: existingComplaint.assigned_supervisor || "",
        assignedTechnician: existingComplaint.assigned_technician || "",
        description: existingComplaint.description || "",
        resolution: existingComplaint.resolution || "",
        customerLat: existingComplaint.customer_lat || null,
        customerLng: existingComplaint.customer_lng || null,
      });
      // ✅ FIXED: Load complaint_images instead of evidence_urls
      setEvidenceUrls(existingComplaint.complaint_images || []);
    }
  }, [existingComplaint]);

  useEffect(() => {
    if (supervisors && form.assignedSupervisor) {
      const match = supervisors.find((s: any) => s.full_name === form.assignedSupervisor);
      if (match) {
        setSelectedSupervisorId(match.id);
      } else {
        setSelectedSupervisorId("");
      }
    } else {
      setSelectedSupervisorId("");
    }
  }, [supervisors, form.assignedSupervisor]);

  useEffect(() => {
    if (technicians && form.assignedTechnician) {
      const match = technicians.find((t: any) => t.full_name === form.assignedTechnician);
      if (match) {
        setSelectedTechnicianId(match.id);
      } else {
        setSelectedTechnicianId("");
      }
    } else {
      setSelectedTechnicianId("");
    }
  }, [technicians, form.assignedTechnician]);

  useEffect(() => {
    if (isNew && isCustomer && userProfile && user) {
      setForm(prev => ({
        ...prev,
        customerId: user.id!,
        customerName: userProfile.full_name || "",
        customerPhone: userProfile.phone || "",
      }));
    }
  }, [isNew, isCustomer, userProfile, user]);

  useEffect(() => {
    if (!isNew && !isCustomer && form.customerId && customers) {
      const selectedCustomer = customers.find((c: any) => c.id === form.customerId);
      if (selectedCustomer) {
        setForm(prev => ({
          ...prev,
          customerName: selectedCustomer.full_name || "",
          customerPhone: selectedCustomer.phone || "",
        }));
      }
    }
  }, [form.customerId, customers, isNew, isCustomer]);

  const matchingTechnicians = useMemo(() => {
    if (!form.fieldOfWork || !technicians) return technicians || [];
    return technicians.filter((t: any) => t.expertise?.toLowerCase().includes(form.fieldOfWork.toLowerCase()));
  }, [form.fieldOfWork, technicians]);

  const nonMatchingTechnicians = useMemo(() => {
    if (!technicians) return [];
    return technicians.filter((t: any) => !matchingTechnicians.includes(t));
  }, [technicians, matchingTechnicians]);

  const matchingSupervisors = useMemo(() => {
    if (!form.fieldOfWork || !supervisors) return supervisors || [];
    return supervisors.filter((s: any) => s.expertise?.toLowerCase().includes(form.fieldOfWork.toLowerCase()));
  }, [form.fieldOfWork, supervisors]);

  const nonMatchingSupervisors = useMemo(() => {
    if (!supervisors) return [];
    return supervisors.filter((s: any) => !matchingSupervisors.includes(s));
  }, [supervisors, matchingSupervisors]);

  const handleGetCurrentLocation = () => {
    setIsManuallyTyping(false);
    setIsLocating(true);
    if (!window.isSecureContext) {
      const msg = "Location services require HTTPS. Please use the manual address entry.";
      toast.error(msg);
      setLocationHelp(msg);
      setIsLocating(false);
      return;
    }
    if (!navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser. Please type your address manually.";
      toast.error(msg);
      setLocationHelp(msg);
      setIsLocating(false);
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setForm(prev => ({
            ...prev,
            customerLat: lat,
            customerLng: lng
          }));

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&t=${Date.now()}`);
            const data = await res.json();
            if (data && data.display_name) {
              setForm(prev => ({
                ...prev,
                location: data.display_name
              }));
              toast.success("Location auto-filled successfully");
              setLocationHelp("");
            } else {
              throw new Error("No display_name in response");
            }
          } catch (e) {
            const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setForm(prev => ({
              ...prev,
              location: fallback
            }));
            toast.warning("Location captured. Address lookup failed, using coordinates.");
            setLocationHelp(`GPS: ${fallback}`);
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          console.error("Browser Geolocation failed:", error);
          let errorMsg = "Unable to detect location. Please check your GPS or enter the address manually.";
          if (error.code === 1) {
            errorMsg = "Location access denied. Please enable location services in your browser or enter the address manually.";
          } else if (error.code === 2 || error.code === 3) {
            errorMsg = "Unable to detect location. Please check your GPS or enter the address manually.";
          }
          toast.error(errorMsg);
          setLocationHelp(errorMsg);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (e) {
      console.error("Unexpected geolocation trigger error:", e);
      const errorMsg = "Unable to detect location. Please check your GPS or enter the address manually.";
      toast.error(errorMsg);
      setLocationHelp(errorMsg);
      setIsLocating(false);
    }
  };

  const sendNotification = async (email: string, subject: string, message: string, ticketId?: string) => {
    try {
      if (import.meta.env.DEV) {
        console.log("📧 Sending email to:", email, "| Subject:", subject);
      }
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: { email, subject, message, ticketId },
      });
      if (error) {
        console.error("❌ Email send error:", error);
      } else {
        if (import.meta.env.DEV) {
        console.log("✅ Email sent successfully!");
      }
      }
    } catch (err) {
      console.error("Failed to invoke function:", err);
    }
  };

  const fetchEmailByName = async (name: string): Promise<string | null> => {
    if (!name) return null;
    const trimmedName = name.trim();
    try {
      // 1. Try matching by email directly if it looks like an email
      if (trimmedName.includes('@')) {
        const { data } = await supabase
          .from('profiles')
          .select('email')
          .ilike('email', trimmedName)
          .maybeSingle();
        if (data?.email) return data.email;
      }

      // 2. Try exact full_name match
      const { data: exactMatch } = await supabase
        .from('profiles')
        .select('email')
        .eq('full_name', trimmedName)
        .maybeSingle();
      if (exactMatch?.email) return exactMatch.email;

      // 3. Try case-insensitive full_name match
      const { data: caseInsensitiveMatch } = await supabase
        .from('profiles')
        .select('email')
        .ilike('full_name', trimmedName)
        .maybeSingle();
      return caseInsensitiveMatch?.email || null;
    } catch (e) {
      console.error("Error fetching email by name:", e);
      return null;
    }
  };

  const uploadToSupabase = async (file: File, folder: string): Promise<string> => {
    setIsUploading(true);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await browserImageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true });
        } catch (err) {
          console.warn('Image compression failed, using original:', err);
        }
      }
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('complaint-media').upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('complaint-media').getPublicUrl(fileName);
      return publicUrl;
    } catch (error: any) {
      console.error('Detailed Upload error in Edit page:', error);
      const errorMsg = error.message || error.error_description || 'Unknown error occurred during upload.';
      toast.error(`Upload failed: ${errorMsg}. (Ensure the 'complaint-media' storage bucket exists and policies allow uploads to folder '${folder}/')`);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in");
      return;
    }
    
    // Strict validations
    if (!form.title || form.title.trim() === "") {
      toast.error("Please provide a title for the issue");
      return;
    }
    
    if (!form.customerId) {
      toast.error("Please select a customer");
      return;
    }
    
    if (!form.fieldOfWork || form.fieldOfWork.trim() === "") {
      toast.error("Please select a Field of Work");
      return;
    }
    
    if (!form.description || form.description.trim() === "") {
      toast.error("Please provide a problem description");
      return;
    }

    if (!form.location && !(form.customerLat && form.customerLng)) {
      toast.error("Please provide a location by typing or using GPS");
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        let status = "unassigned";
        let phase = 1;
        if (form.assignedSupervisor && !isCustomer) {
          status = "assigned";
          phase = 2;
        }
        if (form.assignedTechnician && !isCustomer) {
          status = "dispatched";
          phase = 3;
        }

        const newComplaint = await complaintService.create({
          customer_id: form.customerId,
          customer_name: form.customerName || null,
          customer_phone: form.customerPhone || null,
          created_by_name: currentUserFullName || "User",
          title: form.title,
          description: form.description,
          status: status,
          assigned_supervisor: isCustomer ? null : (form.assignedSupervisor || null),
          assigned_technician: isCustomer ? null : (form.assignedTechnician || null),
          location: form.location || null,
          field_of_work: form.fieldOfWork || null,
          severity: form.severity || null,
          current_phase: phase,
          resolution: null,
          complaint_images: evidenceUrls.length > 0 ? evidenceUrls : null, // ✅ CORRECT
          customer_lat: form.customerLat,
          customer_lng: form.customerLng,
        } as any);
        if (import.meta.env.DEV) {
        console.log("✅ Complaint created ID:", newComplaint.id);
      }
        // Invalidate queries so lists/dashboards update immediately
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
        
        // Notify based on who created the complaint
        if (isCustomer) {
          // 1. Customer creates a complaint: Notify: All Admins.
          const adminIds = await notificationService.getAdminUserIds();
          await notificationService.insertNotification(
            adminIds,
            newComplaint.id,
            'info',
            '🔔 New Complaint Registered',
            `New complaint registered by ${form.customerName || "Customer"}. Ticket #${newComplaint.id.slice(0, 8)} requires assignment.`,
            1,
            undefined,
            user?.id
          );
        } else {
          // If Admin/Supervisor created it
          // 2. Admin/Supervisor assigns a Supervisor:
          if (form.assignedSupervisor) {
            const supervisorProfile = await fetchProfileByName(form.assignedSupervisor);
            if (supervisorProfile) {
              await notificationService.insertNotification(
                supervisorProfile.id,
                newComplaint.id,
                'assignment',
                '📋 Ticket Assigned',
                `You have been assigned to Ticket #${newComplaint.id.slice(0, 8)} for telephonic triage.`,
                1,
                undefined,
                user?.id
              );
            }
          }

          // 3. Admin creates complaint & assigns Technician directly (Direct Dispatch):
          if (form.assignedTechnician) {
            const technicianProfile = await fetchProfileByName(form.assignedTechnician);
            if (technicianProfile) {
              await notificationService.insertNotification(
                technicianProfile.id,
                newComplaint.id,
                'assignment',
                '🔧 Direct Dispatch',
                `Directly assigned to Ticket #${newComplaint.id.slice(0, 8)}. Proceed to site.`,
                3,
                undefined,
                user?.id
              );
            }
            if (form.customerId) {
              await notificationService.insertNotification(
                form.customerId,
                newComplaint.id,
                'info',
                '🚐 Technician Dispatched',
                `A technician has been dispatched to your location for Ticket #${newComplaint.id.slice(0, 8)}.`,
                3,
                undefined,
                user?.id
              );
            }
          }
        }

        if (isCustomer) {
          toast.success("Complaint submitted! Our team will contact you soon.");
          navigate("/dashboard");
        } else {
          toast.success("Complaint created successfully!");
          navigate("/complaints");
        }
      } else {
        let nextPhase = existingComplaint?.current_phase || 1;
        let nextStatus = form.status;

        // 🔥 If supervisor is assigned and we're in Phase 1, move to Phase 2 (status: 'assigned')
        if (form.assignedSupervisor && !isCustomer) {
          if (existingComplaint?.current_phase === 1) {
            nextPhase = 2;
            nextStatus = "assigned";
            console.log("🚀 Auto-advancing to Phase 2 (Triage)");
            toast.success("Supervisor assigned! Moving to Phase 2: Triage");
          }
        } else if (!form.assignedSupervisor && !isCustomer) {
          if (existingComplaint?.current_phase === 2) {
            nextPhase = 1;
            nextStatus = "unassigned";
            console.log("🚀 Auto-reverting to Phase 1 (Unassigned)");
            toast.success("Supervisor unassigned! Reverting to Phase 1");
          }
        }

        // 🔥 If technician is assigned and we're in Phase 2 or 3, move to Phase 3 (status: 'dispatched')
        if (form.assignedTechnician && !isCustomer) {
          if (existingComplaint?.current_phase === 2 || existingComplaint?.current_phase === 3) {
            nextPhase = 3;
            nextStatus = "dispatched";
            console.log("🚀 Auto-advancing to Phase 3 (Dispatch)");
            toast.success("Technician assigned! Moving to Phase 3: Dispatch");
          }
        }
        
        const supervisorChanged = form.assignedSupervisor && form.assignedSupervisor !== existingComplaint?.assigned_supervisor;
        const technicianChanged = form.assignedTechnician && form.assignedTechnician !== existingComplaint?.assigned_technician;

        await complaintService.update(id!, {
          title: form.title,
          description: form.description,
          location: form.location || null,
          field_of_work: form.fieldOfWork || null,
          severity: form.severity || null,
          status: nextStatus,
          assigned_supervisor: form.assignedSupervisor || null,
          assigned_technician: form.assignedTechnician || null,
          resolution: form.resolution || null,
          complaint_images: evidenceUrls.length > 0 ? evidenceUrls : null, // ✅ FIXED: Changed from evidence_urls
          current_phase: nextPhase,
          customer_lat: form.customerLat,
          customer_lng: form.customerLng,
        } as any);
        if (!isNew && id) {
          await clearOfflineDraft(id);
        }

        if (supervisorChanged) {
          const supervisorProfile = await fetchProfileByName(form.assignedSupervisor);
          if (supervisorProfile) {
            await notificationService.insertNotification(
              supervisorProfile.id,
              id!,
              'assignment',
              '📋 Ticket Assigned',
              `You have been assigned to Ticket #${id?.slice(0, 8)} for telephonic triage.`,
              1,
              undefined,
              user?.id
            );
          }
        }

        if (technicianChanged) {
          const technicianProfile = await fetchProfileByName(form.assignedTechnician);
          if (technicianProfile) {
            await notificationService.insertNotification(
              technicianProfile.id,
              id!,
              'assignment',
              '🔧 Job Assigned',
              `You have been assigned to Ticket #${id?.slice(0, 8)} at ${form.location || 'site'}.`,
              3,
              undefined,
              user?.id
            );
          }
          if (form.customerId) {
            await notificationService.insertNotification(
              form.customerId,
              id!,
              'info',
              '🔧 Technician Assigned',
              `Technician ${form.assignedTechnician} has been assigned to your Ticket #${id?.slice(0, 8)}.`,
              3,
              undefined,
              user?.id
            );
          }
        }

        // Invalidate queries so lists/dashboards/details update immediately
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['complaint', id] });

        toast.success("Complaint updated!");
        navigate("/complaints");
      }
    } catch (error: any) {
      console.error("❌ Error:", error);
      toast.error(error.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSuggestions = locationSuggestions.filter(loc => 
    loc.toLowerCase().includes((form.location || "").toLowerCase())
  ).slice(0, 8);

  if (isFetching && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading complaint details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center" disabled={isSaving}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold">
          {isNew ? (isCustomer ? "Submit New Complaint" : "New Complaint") : "Edit Complaint"}
        </h1>
      </div>

      {isCustomer && isNew && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Submitting a Service Request</p>
              <p className="text-xs text-muted-foreground mt-1">Your complaint will be reviewed within 24 hours. A supervisor will contact you to assess the issue.</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.form initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSave} className="glass-card rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Issue Title <span className="text-destructive">*</span></label>
              <span className="text-xs text-muted-foreground">
                {(form.title || "").length}/250
              </span>
            </div>
            <Input 
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
              placeholder="Brief description of the problem..." 
              required 
              disabled={isSaving || (!isNew && isRole("supervisor"))} 
              maxLength={250} 
            />
          </div>

          {isCustomer ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name</label>
                <Input value={form.customerName} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Phone <span className="text-destructive">*</span></label>
                <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="+91 9876543210" required disabled={isSaving || (!isNew && isRole("supervisor"))} />
              </div>
            </>
          ) : (
            <>
              {isCustomersLoading && !isNew ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer</label>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading customers...
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Customer <span className="text-destructive">*</span></label>
                    <Select value={form.customerId} onValueChange={(v) => {
                      const selectedCustomer = customers?.find((c: any) => c.id === v);
                      setForm({ ...form, customerId: v, customerName: selectedCustomer?.full_name || "", customerPhone: selectedCustomer?.phone || "" });
                    }} disabled={isSaving || !customers || (!isNew && isRole("supervisor"))}>
                      <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                      <SelectContent>
                        {customers?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.email})</SelectItem>
                        ))}
                        {(!customers || customers.length === 0) && (<SelectItem value="none" disabled>No customers found</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="+91 ..." disabled={isSaving || (!isNew && isRole("supervisor"))} />
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Location <span className="text-destructive">*</span></label>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Input 
                  value={form.location} 
                  onChange={(e) => {
                    setForm({ ...form, location: e.target.value });
                    setShowLocationSuggestions(true);
                    setIsManuallyTyping(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowLocationSuggestions(false), 200);
                  }}
                  placeholder="Site address..." 
                  required 
                  disabled={isSaving || (!isNew && isRole("supervisor"))} 
                  className="w-full" 
                />
                
                {showLocationSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-popover text-popover-foreground border shadow-lg rounded-xl p-1 max-h-60 overflow-y-auto w-full">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, location: suggestion });
                          setShowLocationSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors truncate"
                        disabled={!isNew && isRole("supervisor")}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isNew && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating || isSaving || isManuallyTyping}
                  className="flex-shrink-0 w-full md:w-auto"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Detecting location...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2 text-primary" />
                      Use Current Location
                    </>
                  )}
                </Button>
              )}
            </div>
            {form.customerLat && form.customerLng && (
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                GPS Coordinates Captured: {form.customerLat.toFixed(6)}, {form.customerLng.toFixed(6)}
              </p>
            )}
            {isManuallyTyping && (
              <p className="text-xs text-muted-foreground mt-1">
                Use current location button if you are physically at the field.
              </p>
            )}
            {locationHelp && (
              <p className="text-xs text-amber-500 mt-1 font-medium">{locationHelp}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Field of Work <span className="text-destructive">*</span></label>
            <Select value={form.fieldOfWork} onValueChange={(v) => setForm({ ...form, fieldOfWork: v })} disabled={isSaving || (!isNew && isRole("supervisor"))}>
              <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Solar PV">Solar PV</SelectItem>
                <SelectItem value="Networking">Networking</SelectItem>
                <SelectItem value="Security Systems">Security Systems</SelectItem>
                <SelectItem value="Power Systems">Power Systems</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Severity Level <span className="text-destructive">*</span></label>
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })} disabled={isSaving || (!isNew && isRole("supervisor"))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor - Low priority</SelectItem>
                <SelectItem value="moderate">Moderate - Needs attention</SelectItem>
                <SelectItem value="major">Major - Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdminOrSupervisor && !isNew && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} disabled={isSaving || (!isNew && isRole("supervisor"))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {((isAdminOrSupervisor && !isNew) || (isAdmin && isNew)) && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-primary" />
                Assigned Supervisor
                {form.fieldOfWork && (
                  <span className="text-xs font-normal text-muted-foreground">
                    — Filtered by "{form.fieldOfWork}" expertise
                  </span>
                )}
              </label>
              <Select 
                value={selectedSupervisorId || "clear_unassigned"} 
                onValueChange={(v) => {
                  const actualVal = v === "clear_unassigned" ? "" : v;
                  if (!actualVal) {
                    setSelectedSupervisorId("");
                    let updatedStatus = form.status;
                    if (form.status === "assigned") {
                      updatedStatus = "unassigned";
                    }
                    setForm({ ...form, assignedSupervisor: "", status: updatedStatus });
                  } else {
                    const match = supervisors?.find((s: any) => s.id === actualVal);
                    if (match) {
                      setSelectedSupervisorId(match.id);
                      let updatedStatus = form.status;
                      if (form.status === "unassigned") {
                        updatedStatus = "assigned";
                      }
                      setForm({ ...form, assignedSupervisor: match.full_name, status: updatedStatus });
                    }
                  }
                }} 
                disabled={isSaving || !supervisors || !isAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign supervisor">{form.assignedSupervisor && <span className="truncate">{form.assignedSupervisor}</span>}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear_unassigned">None (Unassign)</SelectItem>
                  {matchingSupervisors.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">Matching Expertise {form.fieldOfWork && `(${form.fieldOfWork})`}</div>
                       {matchingSupervisors.map((s: any) => (
                         <SelectItem key={s.id} value={s.id}>
                           <div className="flex flex-col text-left py-0.5">
                             <span className="font-semibold truncate">{s.full_name}</span>
                             <span className="text-xs text-muted-foreground truncate">{s.phone || ''}</span>
                             <span className="text-xs text-muted-foreground">{s.expertise || ''}</span>
                           </div>
                         </SelectItem>
                       ))}
                    </>
                  )}
                  {nonMatchingSupervisors.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">Other Supervisors</div>
                     {nonMatchingSupervisors.map((s: any) => (
                       <SelectItem key={s.id} value={s.id}>
                         <div className="flex flex-col text-left py-0.5">
                           <span className="font-semibold text-muted-foreground truncate">{s.full_name}</span>
                           <span className="text-xs text-muted-foreground truncate">{s.phone || ''}</span>
                           <span className="text-xs text-muted-foreground">{s.expertise || ''}</span>
                         </div>
                       </SelectItem>
                     ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAdminOrSupervisor && !isNew && (isRole("supervisor") || (isRole("admin") && !!existingComplaint?.assigned_technician)) && (
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-primary" />
                Assigned Technician
                {form.fieldOfWork && (<span className="text-xs font-normal text-muted-foreground">— Filtered by "{form.fieldOfWork}" expertise</span>)}
              </label>
              <Select 
                value={selectedTechnicianId || "clear_unassigned"} 
                onValueChange={(v) => {
                  const actualVal = v === "clear_unassigned" ? "" : v;
                  if (!actualVal) {
                    setSelectedTechnicianId("");
                    setForm({ ...form, assignedTechnician: "" });
                  } else {
                    const match = technicians?.find((t: any) => t.id === actualVal);
                    if (match) {
                      setSelectedTechnicianId(match.id);
                      setForm({ ...form, assignedTechnician: match.full_name });
                    }
                  }
                }} 
                disabled={isSaving || !technicians || isAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign technician">{form.assignedTechnician && <span className="truncate">{form.assignedTechnician}</span>}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear_unassigned">None (Unassign)</SelectItem>
                  {matchingTechnicians.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">Matching Expertise {form.fieldOfWork && `(${form.fieldOfWork})`}</div>
                       {matchingTechnicians.map((t: any) => (
                         <SelectItem key={t.id} value={t.id}>
                           <div className="flex flex-col text-left py-0.5">
                             <div className="flex items-center gap-2">
                               <span className="font-semibold truncate">{t.full_name}</span>
                               <span className={`w-1.5 h-1.5 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
                               <span className="text-[9px] text-muted-foreground">{t.available ? "Available" : "Busy"}</span>
                             </div>
                             <span className="text-xs text-muted-foreground truncate">{t.phone || ''}</span>
                             <span className="text-xs text-muted-foreground">{t.expertise || ''}</span>
                           </div>
                         </SelectItem>
                       ))}
                    </>
                  )}
                  {nonMatchingTechnicians.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">Other Technicians</div>
                     {nonMatchingTechnicians.map((t: any) => (
                       <SelectItem key={t.id} value={t.id}>
                         <div className="flex flex-col text-left py-0.5">
                           <div className="flex items-center gap-2">
                             <span className="font-medium text-muted-foreground truncate">{t.full_name}</span>
                             <span className={`w-1.5 h-1.5 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
                           </div>
                           <span className="text-xs text-muted-foreground truncate">{t.phone || ''}</span>
                           <span className="text-xs text-muted-foreground">{t.expertise || ''}</span>
                         </div>
                       </SelectItem>
                     ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium">Problem Description <span className="text-destructive">*</span></label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder={isCustomer ? "Describe the issue in detail. What happened? When did it start?" : "Describe the issue..."} required disabled={isSaving || (!isNew && isRole("supervisor"))} />
          </div>

          {isAdminOrSupervisor && !isNew && (
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} rows={3} placeholder="Resolution details..." disabled={isSaving} />
            </div>
          )}

          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Evidence (Photos/Videos) - Optional
            </label>
            <input type="file" multiple accept="image/*,video/*,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.mkv" onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              const urls: string[] = [];
              for (const file of files) {
                try {
                  const url = await uploadToSupabase(file, 'evidence');
                  urls.push(url);
                } catch (err) {
                  toast.error(`Failed to upload ${file.name}`);
                }
              }
              setEvidenceUrls(prev => [...prev, ...urls]);
              if (urls.length > 0) toast.success(`${urls.length} file(s) uploaded`);
            }} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isSaving || isUploading || (!isNew && isRole("supervisor"))} />
            {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
            {evidenceUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {evidenceUrls.map((url, i) => {
                  const filename = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `File ${i + 1}`);
                  return (
                    <div key={i} className="relative group">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline bg-primary/10 px-2 py-1.5 rounded inline-flex items-center gap-1 max-w-[180px] truncate">{filename}</a>
                      {!(!isNew && isRole("supervisor")) && (
                        <button type="button" onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90" disabled={isSaving}>
            {isSaving ? (<span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving...</span>) : (
              <><Save className="w-4 h-4 mr-2" />{isNew ? (isCustomer ? "Submit Complaint" : "Create Complaint") : "Save Changes"}</>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
};

export default ComplaintEdit;
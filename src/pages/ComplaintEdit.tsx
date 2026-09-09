import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Filter, Loader2, Upload, X, Info, User, MapPin, ShieldCheck, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SeverityTier } from "@/data/mockData";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { complaintService } from "@/services/complaintService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import browserImageCompression from "browser-image-compression";
import { notificationService } from "@/services/notificationService";

const formatDateTimeLocal = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const ComplaintEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isRole } = useAuth();
  const isNew = !id;
  const isCustomer = isRole("customer");
  const isAdminOrSupervisor = isRole("admin", "supervisor");
  const isAdmin = isRole("admin");
  const isSupervisor = isRole("supervisor");

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
    severity: "minor" as SeverityTier,
    assignedSupervisor: "",
    assignedTechnician: "",
    description: "",
    supervisor_notes: "",
    targetEndTime: "",
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
  const [availableCategories, setAvailableCategories] = useState<string[]>(['Solar', 'Networking', 'Electrical', 'CCTV', 'Other']);
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [customerAssets, setCustomerAssets] = useState<any[]>([]);
  const [availableFieldOfWork, setAvailableFieldOfWork] = useState<string[]>([]);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!user?.id) return;

      if (isCustomer) {
        setIsAssetsLoading(true);
        try {
          // Get from customers table where user_id = auth.uid()
          const { data: customerRecord, error: custError } = await supabase
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (custError) {
            console.error("Error fetching customer profile:", custError);
            setAvailableCategories([]);
            return;
          }

          if (customerRecord) {
            const { data: assets, error: assetsError } = await supabase
              .from('customer_assets')
              .select('category')
              .eq('customer_id', customerRecord.id)
              .order('category', { ascending: true });

            if (assetsError) {
              console.error("Error fetching customer assets:", assetsError);
              setAvailableCategories([]);
              return;
            }

            if (assets) {
              const uniqueCategories = [...new Set(assets.map((a: any) => a.category).filter(Boolean))] as string[];
              setAvailableCategories(uniqueCategories);
            } else {
              setAvailableCategories([]);
            }
          } else {
            setAvailableCategories([]);
          }
        } catch (err) {
          console.error("Error in fetchCategories:", err);
          setAvailableCategories([]);
        } finally {
          setIsAssetsLoading(false);
        }
      } else {
        // For admin/supervisor/technician, show all categories
        setAvailableCategories(['Solar', 'Networking', 'Electrical', 'CCTV', 'Other']);
      }
    };

    fetchCategories();
  }, [user?.id, isCustomer]);

  useEffect(() => {
    const fetchCustomerAssets = async () => {
      if (!form.customerId) {
        setCustomerAssets([]);
        setAvailableFieldOfWork([]);
        return;
      }

      setIsAssetsLoading(true);
      try {
        const { data: customerRecord } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', form.customerId)
          .maybeSingle();

        if (!customerRecord) {
          setCustomerAssets([]);
          setAvailableFieldOfWork([]);
          return;
        }

        const { data, error } = await supabase
          .from('customer_assets')
          .select('category')
          .eq('customer_id', customerRecord.id);

        if (error) throw error;

        const assets = data || [];
        setCustomerAssets(assets);

        const uniqueFields = [...new Set(assets.map((a: any) => a.category).filter(Boolean))] as string[];
        setAvailableFieldOfWork(uniqueFields);
      } catch (err) {
        console.error("Error fetching customer assets:", err);
        setCustomerAssets([]);
        setAvailableFieldOfWork([]);
      } finally {
        setIsAssetsLoading(false);
      }
    };

    fetchCustomerAssets();
  }, [form.customerId]);

  // Ensure current fieldOfWork value is always part of availableCategories so the Select component can render it correctly
  const displayCategories = useMemo(() => {
    if (form.fieldOfWork && !availableCategories.includes(form.fieldOfWork)) {
      return [...availableCategories, form.fieldOfWork];
    }
    return availableCategories;
  }, [availableCategories, form.fieldOfWork]);

  useEffect(() => {
    // Note: Geolocation APIs are restricted to Secure Contexts (HTTPS or localhost).
    // In local development over a LAN IP (e.g. HTTP), isSecureContext is false. This is expected.
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttp = window.location.protocol === 'http:';
    if (isHttp && !isLocalhost) {
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
  const isAutoCompletingRef = useRef(false);

  // Forward geocoding: address -> GPS coordinates
  useEffect(() => {
    if (isAutoCompletingRef.current) {
      isAutoCompletingRef.current = false;
      return;
    }
    if (!form.location || form.location.trim().length < 5) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(form.location)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            setForm(prev => ({
              ...prev,
              customerLat: lat,
              customerLng: lng
            }));
            toast.success("Location coordinates resolved!");
          }
        }
      } catch (e) {
        console.warn("Geocoding failed:", e);
      }
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [form.location]);

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
        fieldOfWork: existingComplaint.field_of_work ? (
          ['Solar', 'Networking', 'Electrical', 'CCTV', 'Other'].find(
            c => c.toLowerCase() === existingComplaint.field_of_work.toLowerCase()
          ) || existingComplaint.field_of_work
        ) : "",
        status: existingComplaint.status || "unassigned",
        severity: existingComplaint.severity as SeverityTier || "minor",
        assignedSupervisor: existingComplaint.assigned_supervisor || "",
        assignedTechnician: existingComplaint.assigned_technician || "",
        description: existingComplaint.description || "",
        supervisor_notes: existingComplaint.supervisor_notes || "",
        targetEndTime: formatDateTimeLocal(existingComplaint.target_end_time),
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
    setIsLocating(true);
    // Note: Geolocation APIs are restricted to Secure Contexts (HTTPS or localhost).
    // In local development over a LAN IP (e.g. http://172.21.6.206:8080), browser security will block
    // geolocation and trigger isSecureContext = false. This is EXPECTED browser behavior.
    // For production deployment, HTTPS must be configured to enable geolocation.
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttp = window.location.protocol === 'http:';
    if (isHttp && !isLocalhost) {
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
          
          toast.success("Location coordinates captured!");
          setLocationHelp("");
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&t=${Date.now()}`);
            const data = await res.json();
            if (data && data.display_name) {
              isAutoCompletingRef.current = true;
              setForm(prev => ({
                ...prev,
                location: data.display_name
              }));
              toast.success("Address auto-populated!");
            }
          } catch (e) {
            console.warn("Reverse geocoding failed:", e);
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

    setIsSaving(true);
    try {
      if (isNew) {
        let status = form.status || "unassigned";
        let phase = 1;
        if (status === "unassigned") {
          phase = 1;
        } else if (status === "assigned") {
          phase = 2;
        } else if (status === "dispatched") {
          phase = 3;
        } else if (["in-progress", "in_progress"].includes(status)) {
          phase = 4;
        } else if (status === "completed" || status === "closed") {
          phase = 6;
        }

        if (form.assignedSupervisor && !isCustomer && status === "unassigned") {
          status = "assigned";
          phase = 2;
        }
        if (form.assignedTechnician && !isCustomer && (status === "unassigned" || status === "assigned")) {
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
          target_end_time: form.targetEndTime ? new Date(form.targetEndTime).toISOString() : null,
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

        // Sync phase based on the manually selected status if it has changed
        if (form.status !== existingComplaint?.status) {
          if (form.status === "unassigned") {
            nextPhase = 1;
          } else if (form.status === "assigned") {
            nextPhase = 2;
          } else if (form.status === "dispatched") {
            nextPhase = 3;
          } else if (["in-progress", "in_progress", "pir_submitted_awaiting_approval", "pir_approved_work_in_progress", "rework_required"].includes(form.status)) {
            nextPhase = 4;
          } else if (form.status === "completed") {
            nextPhase = 6;
          } else if (form.status === "closed") {
            nextPhase = 6;
          }
        }

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

        // 🔥 If technician is assigned, move to Phase 3 (status: 'dispatched')
        if (form.assignedTechnician && !isCustomer) {
          if (existingComplaint?.current_phase < 3) {
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
          supervisor_notes: form.supervisor_notes || null,
          complaint_images: evidenceUrls.length > 0 ? evidenceUrls : null, // ✅ FIXED: Changed from evidence_urls
          current_phase: nextPhase,
          customer_lat: form.customerLat,
          customer_lng: form.customerLng,
          target_end_time: form.targetEndTime ? new Date(form.targetEndTime).toISOString() : null,
        } as any);

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
              disabled={isSaving || !isNew} 
              maxLength={250} 
              className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
            />
          </div>

          {isCustomer ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name</label>
                <Input value={form.customerName} disabled className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Phone <span className="text-destructive">*</span></label>
                <Input 
                  value={form.customerPhone} 
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} 
                  placeholder="+91 9876543210" 
                  required 
                  disabled={isSaving || !isNew} 
                  className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                />
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
                    <Popover open={isCustomerPopoverOpen && !isCustomersLoading} onOpenChange={setIsCustomerPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="h-10 w-full justify-between font-normal disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                          disabled={isSaving || !customers || !isNew}
                        >
                          {form.customerName ? (
                            <span className="truncate font-medium">{form.customerName}</span>
                          ) : (
                            <span className="text-muted-foreground">Search customer by name, phone, or email...</span>
                          )}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search customer by name, phone, or email..." />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            {customers?.map((c: any) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.full_name} ${c.phone || ''} ${c.email || ''}`}
                                onSelect={() => {
                                  setForm({ ...form, customerId: c.id, customerName: c.full_name || "", customerPhone: c.phone || "", fieldOfWork: "" });
                                  setIsCustomerPopoverOpen(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.full_name}</span>
                                  <span className="text-xs text-muted-foreground">{c.phone} {c.email ? `• ${c.email}` : ''}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input 
                      value={form.customerPhone} 
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} 
                      placeholder="+91 ..." 
                      disabled={isSaving || !isNew} 
                      className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Location <span className="text-destructive">*</span></label>
            
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 w-full">
              {isCustomer && (
                <div className="w-full sm:w-auto sm:max-w-xs shrink-0 flex flex-col gap-1.5">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating || isSaving || !isNew}
                    className="w-full flex items-center justify-center gap-2 py-2 border-dashed border-primary/40 hover:border-primary/80 hover:bg-primary/5 transition-all h-11 sm:h-9"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 mr-2 text-primary" />
                        Use Current Location
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-center sm:text-left">
                    Use current location if you are at the field site
                  </p>
                  <div className="flex items-center justify-center my-1 sm:hidden">
                    <div className="h-[1px] bg-border flex-1"></div>
                    <span className="text-[10px] text-muted-foreground px-3 font-semibold uppercase">OR</span>
                    <div className="h-[1px] bg-border flex-1"></div>
                  </div>
                </div>
              )}
              
              <div className="relative flex-1 w-full">
                <Input 
                  value={form.location} 
                  onChange={(e) => {
                    setForm({ ...form, location: e.target.value });
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => {
                    // A brief timeout allows the click event on the suggestion button to register first
                    setTimeout(() => setShowLocationSuggestions(false), 200);
                  }}
                  placeholder={isCustomer ? "Or enter address manually" : "Enter complete address"} 
                  required 
                  disabled={isSaving || !isNew} 
                  className="w-full h-11 sm:h-9 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100" 
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
                        disabled={!isNew}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {form.customerLat && form.customerLng && (
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                GPS Coordinates Captured: {form.customerLat.toFixed(6)}, {form.customerLng.toFixed(6)}
              </p>
            )}
            {locationHelp && (
              <p className="text-xs text-amber-500 mt-1 font-medium">{locationHelp}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Field of Work <span className="text-destructive">*</span></label>
            {isCustomer && (
              <p className="text-xs text-muted-foreground mb-1">
                Select the category of your installed product
              </p>
            )}
            {isCustomer && !isAssetsLoading && availableCategories.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>You have no registered products. Please contact support to register your products before raising a complaint.</span>
              </div>
            ) : isAdminOrSupervisor && form.customerId && !isAssetsLoading && availableFieldOfWork.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No assets found for this customer. Please create assets first or select manually.</span>
              </div>
            ) : (
              <Select
                key={form.fieldOfWork || 'empty'}
                value={form.fieldOfWork}
                onValueChange={(v) => setForm({ ...form, fieldOfWork: v })}
                disabled={isSaving || isAssetsLoading || (isCustomer && availableCategories.length === 0) || !isNew}
              >
                <SelectTrigger className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100">
                  <SelectValue placeholder={isAssetsLoading ? "Loading..." : "Select field"} />
                </SelectTrigger>
                <SelectContent>
                  {(isAdminOrSupervisor && form.customerId && availableFieldOfWork.length > 0
                    ? availableFieldOfWork
                    : displayCategories
                  ).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Severity Level <span className="text-destructive">*</span></label>
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as SeverityTier })} disabled={isSaving || !isNew}>
              <SelectTrigger className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor - Low priority</SelectItem>
                <SelectItem value="moderate">Moderate - Needs attention</SelectItem>
                <SelectItem value="major">Major - Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdminOrSupervisor && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Time / SLA</label>
              <Input 
                type="datetime-local" 
                value={form.targetEndTime} 
                onChange={(e) => setForm({ ...form, targetEndTime: e.target.value })} 
                disabled={isSaving}
                className="h-10"
              />
            </div>
          )}

          {isAdminOrSupervisor && (
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
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Assign supervisor">
                    {form.assignedSupervisor ? <span className="truncate font-medium">{form.assignedSupervisor}</span> : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear_unassigned">None (Unassign)</SelectItem>
                  {matchingSupervisors.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">Matching Expertise {form.fieldOfWork && `(${form.fieldOfWork})`}</div>
                      {matchingSupervisors.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex flex-col text-left py-0.5">
                            <span className="font-medium">{s.full_name}</span>
                            <span className="text-[10px] text-muted-foreground leading-normal">
                              {s.email}{s.phone ? ` • ${s.phone}` : ''}{s.employeeId ? ` • ID: ${s.employeeId}` : ''}{s.expertise ? ` • ${s.expertise}` : ''}
                            </span>
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
                            <span className="font-medium text-muted-foreground">{s.full_name}</span>
                            <span className="text-[10px] text-muted-foreground leading-normal">
                              {s.email}{s.phone ? ` • ${s.phone}` : ''}{s.employeeId ? ` • ID: ${s.employeeId}` : ''}{s.expertise ? ` • ${s.expertise}` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAdminOrSupervisor && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} disabled={isSaving}>
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

          {isRole("supervisor") && (
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
                disabled={isSaving || !technicians || !isRole("supervisor")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Assign technician">
                    {form.assignedTechnician ? <span className="truncate font-medium">{form.assignedTechnician}</span> : undefined}
                  </SelectValue>
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
                              <span className="font-medium">{t.full_name}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
                              <span className="text-[9px] text-muted-foreground">{t.available ? "Available" : "Busy"}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground leading-normal">
                              {t.email}{t.phone ? ` • ${t.phone}` : ''}{t.employeeId ? ` • ID: ${t.employeeId}` : ''}{t.expertise ? ` • ${t.expertise}` : ''}
                            </span>
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
                              <span className="font-medium text-muted-foreground">{t.full_name}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
                            </div>
                            <span className="text-[10px] text-muted-foreground leading-normal">
                              {t.email}{t.phone ? ` • ${t.phone}` : ''}{t.employeeId ? ` • ID: ${t.employeeId}` : ''}{t.expertise ? ` • ${t.expertise}` : ''}
                            </span>
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
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              rows={4} 
              placeholder={isCustomer ? "Describe the issue in detail. What happened? When did it start?" : "Describe the issue..."} 
              required 
              disabled={isSaving || !isNew} 
              className="disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100" 
            />
          </div>

          {(isAdmin || isSupervisor) && (
            <div className="md:col-span-2 min-w-0 max-w-full space-y-2">
              <label className="text-sm font-medium">Supervisor Notes / Key Points for Technician</label>
              <Textarea
                value={form.supervisor_notes}
                onChange={(e) => setForm({ ...form, supervisor_notes: e.target.value })}
                rows={4}
                placeholder="Optional: Add key symptoms or instructions for the technician."
                disabled={isSaving}
                className="w-full min-w-0 max-w-full resize-y break-words"
              />
              <p className="text-xs text-muted-foreground">Optional: Add key symptoms or instructions for the technician.</p>
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
                {evidenceUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">Evidence {i + 1}</a>
                    {!(!isNew && isRole("supervisor")) && (
                      <button type="button" onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
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
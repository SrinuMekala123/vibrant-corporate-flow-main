import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Phone, MapPin, Clock, User, Wrench, FileText, ShieldCheck, CheckCircle2, XCircle, X, Loader2, Play, CheckSquare, Upload, PenTool, Image as ImageIcon, AlertTriangle, MessageSquare, Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { phaseLabels } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { complaintService, type Complaint } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import SignatureCanvas from "react-signature-canvas";
import browserImageCompression from "browser-image-compression";
import { saveOfflineDraft, syncOfflineDrafts, getOfflineDraft, clearOfflineDraft } from '@/lib/offlineStorage';
import ImageGallery from "@/components/ImageGallery";
import { notificationService } from "@/services/notificationService";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type SignatureMode = "draw" | "upload";
type SatisfactionLevel = "satisfied" | "partially_satisfied" | "unsatisfied" | "";

const formatIndianDateTime = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    let normalized = dateString;
    if (
      typeof dateString === "string" &&
      !dateString.endsWith("Z") &&
      !/[+-]\d{2}:\d{2}$/.test(dateString)
    ) {
      normalized = `${dateString}Z`;
    }
    return new Date(normalized).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch (e) {
    return new Date(dateString).toLocaleString();
  }
};

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isRole } = useAuth();
  const sigRef = useRef<SignatureCanvas>(null);
  const channelRef = useRef<any>(null);

  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string | null>(null);
  const [uploadedSignaturePreview, setUploadedSignaturePreview] = useState<string | null>(null);

  const [verificationNote, setVerificationNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [pirFindings, setPirFindings] = useState("");
  const [pirAudioUrl, setPirAudioUrl] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [activePhase, setActivePhase] = useState<number>(1);
  const [canvasWidth, setCanvasWidth] = useState(750);

  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(750, window.innerWidth - 64);
      setCanvasWidth(width);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showVerification, setShowVerification] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [showPIRForm, setShowPIRForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [currentUserFullName, setCurrentUserFullName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [pirSeverityInput, setPirSeverityInput] = useState("medium");
  const [supSeverityInput, setSupSeverityInput] = useState("medium");
  const [targetDurationInput, setTargetDurationInput] = useState("4");
  const [isApprovingPir, setIsApprovingPir] = useState(false);

  const [feedbackSatisfaction, setFeedbackSatisfaction] = useState<SatisfactionLevel>("");
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackContactMethod, setFeedbackContactMethod] = useState("phone");
  const [isCollectingFeedback, setIsCollectingFeedback] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  const [trackingLocation, setTrackingLocation] = useState<{lat: number; lng: number; accuracy?: number; heading?: number; speed?: number; recordedAt?: string} | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const trackingWatchId = useRef<number | null>(null);
  const trackingInterval = useRef<number | null>(null);



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

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintService.getById(id!),
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name, role, phone').eq('id', user.id).single()
        .then(({ data }) => {
          const name = (data as any)?.full_name || '';
          setCurrentUserFullName(name);
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (ticket) {
      setResolutionNote(prev => prev || ticket.resolution || "");
      setPirFindings(prev => prev || ticket.pir_findings || "");
      setPirAudioUrl(prev => prev || ticket.pir_audio_url || "");
      setEvidenceUrls(prev => prev.length > 0 ? prev : (ticket.technician_evidence || []));
      
      if (ticket.pir_findings_severity) setPirSeverityInput(ticket.pir_findings_severity);
      if (ticket.supervisor_severity) setSupSeverityInput(ticket.supervisor_severity);
      if (ticket.target_duration_hours) setTargetDurationInput(String(ticket.target_duration_hours));
      
      if (ticket.current_phase) {
        setActivePhase(ticket.current_phase);
      }
      
      if (!ticket.feedback_collected) {
        setFeedbackSatisfaction("");
        setFeedbackComments("");
        setFeedbackContactMethod("phone");
      } else {
        setFeedbackSatisfaction(ticket.customer_satisfaction || "");
        setFeedbackComments(ticket.feedback_comments || "");
        setFeedbackContactMethod(ticket.feedback_contact_method || "phone");
      }
    }
  }, [ticket]);

  useEffect(() => {
    const fetchCustomerPhone = async () => {
      if (ticket?.customer_id) {
        try {
          const { data } = await supabase.from('profiles').select('phone').eq('id', ticket.customer_id).single();
          if (data?.phone) {
            setCustomerPhone(data.phone);
          }
        } catch (err) {
          if (ticket.customer_name && ticket.customer_name.match(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)) {
            setCustomerPhone(ticket.customer_name);
          }
        }
      }
    };
    fetchCustomerPhone();
  }, [ticket?.customer_id, ticket?.customer_name]);

  // OFFLINE STORAGE - Auto-save draft every 30 seconds
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      if (resolutionNote || pirFindings || evidenceUrls.length > 0) {
        await saveOfflineDraft(id!, {
          resolution: resolutionNote,
          pir_findings: pirFindings,
          pir_audio_url: pirAudioUrl,
          technician_evidence: evidenceUrls, // ✅ FIXED: Use technician_evidence
          timestamp: new Date().toISOString(),
        });
        console.log('💾 Auto-saved draft offline');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [id, resolutionNote, pirFindings, pirAudioUrl, evidenceUrls]);

  // OFFLINE STORAGE - Load saved draft on mount
  useEffect(() => {
    if (!id) return;
    const loadDraft = async () => {
      const draft = await getOfflineDraft(id);
      if (draft && !draft.synced) {
        const shouldRestore = window.confirm('Found unsaved draft. Restore it?');
        if (shouldRestore) {
          if (draft.resolution) setResolutionNote(draft.resolution);
          if (draft.pir_findings) setPirFindings(draft.pir_findings);
          if (draft.pir_audio_url) setPirAudioUrl(draft.pir_audio_url);
          if (draft.technician_evidence) setEvidenceUrls(draft.technician_evidence); // ✅ FIXED
          toast.info('Restored offline draft');
        } else {
          await clearOfflineDraft(id);
        }
      }
    };
    loadDraft();
  }, [id]);

  useEffect(() => {
    const handleOnline = async () => {
      toast.info('Back online! Syncing offline changes...');
      const syncedCount = await syncOfflineDrafts();
      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} offline change(s)`);
        queryClient.invalidateQueries({ queryKey: ['complaint', id] });
        refetch();
      }
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      handleOnline();
    }
    return () => window.removeEventListener('online', handleOnline);
  }, [id, queryClient, refetch]);

  useEffect(() => {
    if (!id) return;
    if (import.meta.env.DEV) {
      console.log(`📡 Setting up realtime subscription for complaint: ${id}`);
    }
    const channel = supabase
      .channel(`complaint-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'complaints',
        filter: `id=eq.${id}`,
      }, (payload) => {
        if (import.meta.env.DEV) {
          console.log('🔄 Realtime update received event:', payload.eventType);
        }
        if (payload.eventType === 'UPDATE') {
          queryClient.setQueryData(['complaint', id], payload.new);
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          if (oldStatus !== newStatus) {
            toast.info(`Ticket status changed to: ${newStatus}`);
          } else {
            toast.info(`Ticket has been updated`);
          }
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (!id) return;
    let locChannel: any = null;

    const fetchLatest = async () => {
      try {
        const latest = await complaintService.getLatestTechnicianLocation(id);
        if (latest) {
          setTrackingLocation({
            lat: latest.lat,
            lng: latest.lng,
            accuracy: latest.accuracy,
            heading: latest.heading,
            speed: latest.speed,
            recordedAt: latest.created_at,
          });
        }
      } catch (e) {
        console.warn("Failed to fetch latest technician location:", e);
      }
    };

    fetchLatest();

    locChannel = complaintService.subscribeToTechnicianLocation(id, (payload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        setTrackingLocation({
          lat: payload.new.lat,
          lng: payload.new.lng,
          accuracy: payload.new.accuracy,
          heading: payload.new.heading,
          speed: payload.new.speed,
          recordedAt: payload.new.created_at,
        });
      }
    });

    return () => {
      if (locChannel) {
        supabase.removeChannel(locChannel);
      }
    };
  }, [id]);

  useEffect(() => {
    return () => {
      stopTechnicianTracking();
    };
  }, []);

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
        toast.error("Failed to send email");
      } else {
        if (import.meta.env.DEV) {
        console.log("✅ Email sent successfully!");
      }
        toast.success(`Email sent to ${email}`);
      }
    } catch (err) {
      console.error("Failed to invoke function:", err);
      toast.error("Failed to send email");
    }
  };

  const uploadToSupabase = async (file: File, folder: string): Promise<string> => {
    setIsUploading(true);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await browserImageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1280,
            useWebWorker: true
          });
          console.log(`Image compressed: ${(file.size / 1024).toFixed(2)}KB -> ${(fileToUpload.size / 1024).toFixed(2)}KB`);
        } catch (err) {
          console.warn('Image compression failed, using original:', err);
        }
      }
      // Enforce 50MB file upload limit to prevent Supabase timeout/size limit rejection
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB. Supabase limit is 50MB. Please compress or choose a smaller file.`);
        throw new Error("File size exceeds 50MB limit");
      }
      if (file.type.startsWith('video/')) {
        const sizeMB = file.size / 1024 / 1024;
        console.log(`Uploading video (${sizeMB.toFixed(1)}MB)...`);
      }
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('complaint-media')
        .upload(fileName, fileToUpload);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('complaint-media')
        .getPublicUrl(fileName);
      return publicUrl;
    } catch (error: any) {
      console.error('Detailed Upload error in Detail page:', error);
      const errorMsg = error.message || error.error_description || 'Unknown error occurred during upload.';
      toast.error(`Upload failed: ${errorMsg}. (Ensure the 'complaint-media' storage bucket exists and policies allow uploads to folder '${folder}/')`);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const fetchIPCoordinates = async (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    try {
      const res = await fetch(`https://ipapi.co/json/?t=${Date.now()}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.latitude && data.longitude) {
        return { lat: data.latitude, lng: data.longitude, accuracy: 5000 };
      }
    } catch (e) {
      console.warn("IP coordinates fetch failed:", e);
    }
    return null;
  };

  const verifyGPS = async (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const startTechnicianTracking = async () => {
    if (!ticket?.id || !currentUserFullName) {
      setTrackingError("Unable to start tracking. Missing ticket or user.");
      return;
    }

    if (!navigator.geolocation) {
      setTrackingError("Geolocation is not supported by your browser.");
      return;
    }

    try {
      setTrackingError(null);
      setIsTracking(true);

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, heading, speed } = pos.coords;
          setTrackingLocation({ lat: latitude, lng: longitude, accuracy, heading, speed, recordedAt: new Date().toISOString() });
        },
        (err) => {
          console.error("Tracking position error:", err);
          setTrackingError(err.message || "Unable to get location updates");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      trackingWatchId.current = watchId;

      const interval = window.setInterval(async () => {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
          });
          const { latitude, longitude, accuracy, heading, speed } = pos.coords;
          setTrackingLocation({ lat: latitude, lng: longitude, accuracy, heading, speed, recordedAt: new Date().toISOString() });
          try {
            await complaintService.sendTechnicianLocation(ticket.id, currentUserFullName, latitude, longitude, accuracy, heading, speed);
          } catch (err) {
            console.warn("Failed to send tracked location:", err);
          }
        } catch (e) {
          console.warn("Periodic tracking error:", e);
          setTrackingError(e instanceof Error ? e.message : "Periodic location update failed");
        }
      }, 12000);

      trackingInterval.current = interval;
    } catch (e) {
      console.error("startTechnicianTracking failed:", e);
      setTrackingError("Failed to initialize tracking");
      setIsTracking(false);
    }
  };

  const stopTechnicianTracking = () => {
    if (trackingWatchId.current !== null) {
      navigator.geolocation.clearWatch(trackingWatchId.current);
      trackingWatchId.current = null;
    }
    if (trackingInterval.current !== null) {
      window.clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
    setIsTracking(false);
  };

  const shareCurrentLocation = async () => {
    if (!ticket?.id || !currentUserFullName) return;
    setTrackingError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      setTrackingLocation({ lat: latitude, lng: longitude, accuracy, heading, speed, recordedAt: new Date().toISOString() });
      await complaintService.sendTechnicianLocation(ticket.id, currentUserFullName, latitude, longitude, accuracy, heading, speed);
      toast.success("Location shared successfully");
    } catch (err: any) {
      console.error("shareCurrentLocation failed:", err);
      setTrackingError(err.message || "Failed to share location");
      toast.error("Failed to share location");
    }
  };

  const updateMutation = useMutation({
    mutationFn: (updates: any) => complaintService.update(id!, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      await clearOfflineDraft(id!);
      toast.success("Ticket updated!");
    },
    onError: (err: any) => toast.error(err.message || "Update failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading complaint...</span>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-20">
        <p>Complaint not found.</p>
        <Link to="/complaints" className="text-primary">Back</Link>
      </div>
    );
  }

  const customerName = ticket.profiles?.full_name || ticket.customer_name || 'Unknown';
  const supervisorName = ticket.assigned_supervisor;
  const technicianName = ticket.assigned_technician;

  const canVerify = isRole("admin", "supervisor") &&
    ticket.status === "completed" &&
    ticket.current_phase === 6;

  const canEdit = isRole("admin", "supervisor");
  const isAssignedTechnician = currentUserFullName === technicianName;

  const canTechnicianAct = isRole("technician") && isAssignedTechnician &&
    ticket.status !== "closed" &&
    (ticket.current_phase === 3 || ticket.current_phase === 4 || ticket.current_phase === 5);

  const handleTriageDecision = async (outcome: 'remote_fixed' | 'field_required') => {
    const customerEmail = ticket.profiles?.email || null;
    const supervisorEmail = ticket.assigned_supervisor ? await fetchEmailByName(ticket.assigned_supervisor) : null;

    const adminIds = await notificationService.getAdminUserIds();
    const slicedId = ticket.id.slice(0, 8);
    const supervisorDisplayName = currentUserFullName || ticket.assigned_supervisor || 'Supervisor';

    if (outcome === 'remote_fixed') {
      // 4. Remote Fix: Notify Customer AND Admin
      if (ticket.customer_id) {
        await notificationService.insertNotification(
          ticket.customer_id,
          ticket.id,
          'success',
          '📞 Remote Fix Resolved',
          `Your issue for Ticket #${slicedId} was resolved remotely by ${supervisorDisplayName}.`,
          2,
          undefined,
          user?.id
        );
      }
      await notificationService.insertNotification(
        adminIds,
        ticket.id,
        'success',
        '📞 Remote Fix Resolved',
        `Ticket #${slicedId} resolved via Remote Fix by ${supervisorDisplayName}.`,
        2,
        undefined,
        user?.id
      );
    } else {
      // 5. Field Visit Required: Notify Admin AND Customer
      await notificationService.insertNotification(
        adminIds,
        ticket.id,
        'info',
        '🚐 Field Visit Required',
        `Field visit required for Ticket #${slicedId}. Technician assignment pending.`,
        2,
        undefined,
        user?.id
      );
      if (ticket.customer_id) {
        await notificationService.insertNotification(
          ticket.customer_id,
          ticket.id,
          'info',
          '🚐 Field Visit Required',
          `A field visit is required for your complaint #${slicedId}. A technician will be assigned shortly.`,
          2,
          undefined,
          user?.id
        );
      }
    }

    updateMutation.mutate({
      status: outcome === 'remote_fixed' ? 'completed' : 'assigned',
      current_phase: outcome === 'remote_fixed' ? 6 : 3,
      triage_outcome: outcome,
      resolution: outcome === 'remote_fixed' ? 'Resolved remotely via telephonic triage.' : null,
      assignment_timestamp: outcome === 'field_required' ? new Date().toISOString() : null
    } as any);
  };

  const handleStartJourney = async () => {
    const gps = await verifyGPS();
    const destination = (ticket.customer_lat && ticket.customer_lng)
      ? `${ticket.customer_lat},${ticket.customer_lng}`
      : ticket.location ? encodeURIComponent(ticket.location) : null;

    if (destination) {
      const mapsUrl = gps 
        ? `https://www.google.com/maps/dir/?api=1&origin=${gps.lat},${gps.lng}&destination=${destination}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      window.open(mapsUrl, '_blank');
      toast.success("🗺️ Opening navigation to customer location...");
    } else {
      toast.warning("📍 Customer location address not available, starting journey anyway...");
    }

    // Notify Supervisor, Customer, and Admin
    let supervisorId = null;
    if (ticket.assigned_supervisor) {
      const supervisorProfile = await fetchProfileByName(ticket.assigned_supervisor);
      if (supervisorProfile) {
        supervisorId = supervisorProfile.id;
      }
    }

    const adminIds = await notificationService.getAdminUserIds();
    const recipientIds = [supervisorId, ticket.customer_id, ...adminIds].filter(Boolean) as string[];

    await notificationService.insertNotification(
      recipientIds,
      ticket.id,
      'info',
      '🚀 Journey Started',
      `Technician ${ticket.assigned_technician || currentUserFullName} has started their journey for Ticket #${ticket.id.slice(0, 8)}.`,
      3,
      undefined,
      user?.id
    );

    updateMutation.mutate({
      status: "in-progress",
      current_phase: 4,
      start_journey_timestamp: new Date().toISOString(),
      arrival_lat: gps?.lat || null,
      arrival_lng: gps?.lng || null
    } as any);

    if (isRole("technician") && isAssignedTechnician) {
      startTechnicianTracking();
    }
  };

  const handleSubmitPIR = async () => {
    if (!pirFindings.trim()) {
      toast.error("Add PIR findings");
      return;
    }

    // Notify Customer, Supervisor, and Admin
    let supervisorId = null;
    if (ticket.assigned_supervisor) {
      const supervisorProfile = await fetchProfileByName(ticket.assigned_supervisor);
      if (supervisorProfile) {
        supervisorId = supervisorProfile.id;
      }
    }

    const adminIds = await notificationService.getAdminUserIds();
    const recipientIds = [ticket.customer_id, supervisorId, ...adminIds].filter(Boolean) as string[];

    await notificationService.insertNotification(
      recipientIds,
      ticket.id,
      'info',
      '📋 PIR Submitted',
      `PIR submitted for Ticket #${ticket.id.slice(0, 8)} by ${ticket.assigned_technician || currentUserFullName}. Pending approval.`,
      4,
      undefined,
      user?.id
    );

    updateMutation.mutate({
      pir_findings: pirFindings,
      pir_audio_url: pirAudioUrl || null,
      technician_evidence: evidenceUrls,
      arrival_timestamp: new Date().toISOString()
    } as any);
    setShowPIRForm(false);
    toast.success("PIR submitted");
  };

  const handleSaveResolution = async () => {
    if (!resolutionNote.trim()) {
      toast.error("Please add resolution notes");
      return;
    }

    // Notify Admin, Supervisor, and Customer
    let supervisorId = null;
    if (ticket.assigned_supervisor) {
      const supervisorProfile = await fetchProfileByName(ticket.assigned_supervisor);
      if (supervisorProfile) {
        supervisorId = supervisorProfile.id;
      }
    }

    const adminIds = await notificationService.getAdminUserIds();
    const recipientIds = [supervisorId, ticket.customer_id, ...adminIds].filter(Boolean) as string[];

    await notificationService.insertNotification(
      recipientIds,
      ticket.id,
      'info',
      '🔧 Resolution Submitted',
      `Job completed and evidence uploaded for Ticket #${ticket.id.slice(0, 8)} by ${ticket.assigned_technician || currentUserFullName}.`,
      5,
      undefined,
      user?.id
    );

    await updateMutation.mutateAsync({
      resolution: resolutionNote
    } as any);
    setShowResolution(false);
    setShowSignOff(true);
    toast.success("Resolution saved! Now complete the sign-off.");
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (PNG, JPG, JPEG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Signature image must be less than 5MB");
      return;
    }
    try {
      const previewUrl = URL.createObjectURL(file);
      setUploadedSignaturePreview(previewUrl);
      const url = await uploadToSupabase(file, 'signatures');
      setUploadedSignatureUrl(url);
      toast.success("Signature uploaded successfully!");
    } catch (err) {
      console.error('Signature upload failed:', err);
      toast.error("Failed to upload signature");
      setUploadedSignaturePreview(null);
    }
  };

  const clearUploadedSignature = () => {
    setUploadedSignatureUrl(null);
    setUploadedSignaturePreview(null);
    toast.info("Uploaded signature cleared");
  };

  // ✅ FIXED: Uses technician_evidence instead of evidence_urls
  const handleApprovePIR = async () => {
    if (!targetDurationInput || isNaN(Number(targetDurationInput)) || Number(targetDurationInput) <= 0) {
      toast.error("Please enter a valid target duration in hours");
      return;
    }
    setIsApprovingPir(true);
    try {
      await updateMutation.mutateAsync({
        pir_findings_severity: pirSeverityInput,
        supervisor_severity: supSeverityInput,
        target_duration_hours: Number(targetDurationInput)
      } as any);

      // Trigger notification to technician
      if (ticket.assigned_technician) {
        const technicianProfile = await fetchProfileByName(ticket.assigned_technician);
        if (technicianProfile) {
          await notificationService.insertNotification(
            technicianProfile.id,
            ticket.id,
            'success',
            '✅ PIR Approved',
            `PIR approved - Proceed with work. Target time: ${targetDurationInput} hours`,
            4,
            undefined,
            user?.id
          );
        }
      }
      toast.success("PIR approved successfully!");
    } catch (err) {
      console.error("Failed to approve PIR:", err);
      toast.error("Failed to approve PIR");
    } finally {
      setIsApprovingPir(false);
    }
  };

  const handleFinalSignOff = async () => {
    let signatureUrl = null;
    if (signatureMode === "draw") {
      const signatureData = sigRef.current?.getCanvas().toDataURL('image/png');
      if (signatureData) {
        const blob = await fetch(signatureData).then(res => res.blob());
        signatureUrl = await uploadToSupabase(new File([blob], 'signature.png', { type: 'image/png' }), 'signatures');
      }
    } else if (signatureMode === "upload") {
      signatureUrl = uploadedSignatureUrl;
    }
    if (!signatureUrl) {
      toast.error("Please provide a customer signature (draw or upload)");
      return;
    }

    // Notify Admin, Supervisor, and Customer
    let supervisorId = null;
    if (ticket.assigned_supervisor) {
      const supervisorProfile = await fetchProfileByName(ticket.assigned_supervisor);
      if (supervisorProfile) {
        supervisorId = supervisorProfile.id;
      }
    }

    const adminIds = await notificationService.getAdminUserIds();
    const adminAndSupIds = [supervisorId, ...adminIds].filter(Boolean) as string[];

    await notificationService.insertNotification(
      adminAndSupIds,
      ticket.id,
      'success',
      '📋 Customer Sign-off Received',
      `Customer sign-off received for Ticket #${ticket.id.slice(0, 8)}. Ready for verification.`,
      5,
      undefined,
      user?.id
    );

    if (ticket.customer_id) {
      await notificationService.insertNotification(
        ticket.customer_id,
        ticket.id,
        'success',
        '✍️ Customer Sign-off',
        `Thank you for signing off on the work for Ticket #${ticket.id.slice(0, 8)}.`,
        5,
        undefined,
        user?.id
      );
    }

    updateMutation.mutate({
      status: "completed",
      current_phase: 6,
      resolution: resolutionNote,
      technician_evidence: evidenceUrls,
      signature_url: signatureUrl,
      signoff_timestamp: new Date().toISOString()
    } as any);
    setShowSignOff(false);
    toast.success("Job completed and signed off!");
  };

  const handleCollectFeedback = async () => {
    if (!feedbackSatisfaction) {
      toast.error("Please select customer satisfaction level");
      return;
    }
    if (!feedbackComments.trim()) {
      toast.error("Please enter customer feedback comments");
      return;
    }
    setIsCollectingFeedback(true);
    try {
      await updateMutation.mutateAsync({
        feedback_collected: true,
        customer_satisfaction: feedbackSatisfaction,
        feedback_comments: feedbackComments,
        feedback_contact_method: feedbackContactMethod,
        feedback_timestamp: new Date().toISOString()
      } as any);
      
      const satisfactionLabel = feedbackSatisfaction === 'satisfied' ? '✅ Satisfied' :
        feedbackSatisfaction === 'partially_satisfied' ? '⚠️ Partially Satisfied' : '❌ Unsatisfied';

      // 12. Notify Technician AND Customer
      if (ticket.assigned_technician) {
        const technicianProfile = await fetchProfileByName(ticket.assigned_technician);
        if (technicianProfile) {
          await notificationService.insertNotification(
            technicianProfile.id,
            ticket.id,
            'feedback',
            '📋 Feedback Saved',
            `Feedback collected and saved for Ticket #${ticket.id.slice(0, 8)}.`,
            6,
            undefined,
            user?.id
          );
        }
      }

      if (ticket.customer_id) {
        await notificationService.insertNotification(
          ticket.customer_id,
          ticket.id,
          'feedback',
          '💖 Feedback Submitted',
          `Thank you for your feedback on Ticket #${ticket.id.slice(0, 8)}.`,
          6,
          undefined,
          user?.id
        );
      }
      toast.success("✅ Customer feedback collected successfully!");
      setShowFeedbackForm(false);
    } catch (error: any) {
      console.error('Failed to collect feedback:', error);
      toast.error("Failed to collect feedback");
    } finally {
      setIsCollectingFeedback(false);
    }
  };

  const handleFinalClosure = async () => {
    if (!ticket.feedback_collected) {
      toast.error("Please collect customer feedback before closing");
      return;
    }
    if (!window.confirm("Confirm final closure of this ticket?\nThis action cannot be undone.")) {
      return;
    }

    // 13. Notify Customer
    if (ticket.customer_id) {
      await notificationService.insertNotification(
        ticket.customer_id,
        ticket.id,
        'success',
        '🎉 Ticket Closed',
        `Ticket #${ticket.id.slice(0, 8)} has been successfully closed. Thank you for choosing Brihaspathi.`,
        6,
        undefined,
        user?.id
      );
    }

    updateMutation.mutate({
      status: "closed",
      current_phase: 6,
      closure_timestamp: new Date().toISOString(),
      closed_by: currentUserFullName
    } as any);
    setShowVerification(false);
    toast.success("🎉 Ticket officially closed!");
  };

  const handleApprove = async () => {
    if (!ticket.feedback_collected) {
      toast.error("Please collect customer feedback first");
      setShowFeedbackForm(true);
      return;
    }
    
    // 13. Notify Customer
    if (ticket.customer_id) {
      await notificationService.insertNotification(
        ticket.customer_id,
        ticket.id,
        'success',
        '🎉 Ticket Closed',
        `Ticket #${ticket.id.slice(0, 8)} has been successfully closed. Thank you for choosing Brihaspathi.`,
        6,
        undefined,
        user?.id
      );
    }

    updateMutation.mutate({ status: "closed", current_phase: 6 } as any);
    setShowVerification(false);
  };

  const handleReject = async () => {
    if (!verificationNote.trim()) {
      toast.error("Add reason");
      return;
    }

    // 6. Notify Customer, Admin, and Technician
    let technicianId = null;
    if (ticket.assigned_technician) {
      const technicianProfile = await fetchProfileByName(ticket.assigned_technician);
      if (technicianProfile) {
        technicianId = technicianProfile.id;
      }
    }

    const adminIds = await notificationService.getAdminUserIds();
    const recipientIds = [ticket.customer_id, technicianId, ...adminIds].filter(Boolean) as string[];

    await notificationService.insertNotification(
      recipientIds,
      ticket.id,
      'warning',
      '🔄 Returned to Triage',
      `Ticket #${ticket.id.slice(0, 8)} has been sent back to Phase 2 for re-evaluation.`,
      2,
      undefined,
      user?.id
    );

    updateMutation.mutate({
      status: "in-progress",
      current_phase: 4,
      resolution: `Rejected: ${verificationNote}`,
      feedback_collected: false,
      customer_satisfaction: null,
      feedback_comments: null,
      feedback_timestamp: null,
      feedback_contact_method: 'phone'
    } as any);
    setFeedbackSatisfaction("");
    setFeedbackComments("");
    setFeedbackContactMethod("phone");
    setShowVerification(false);
  };

  const handleTakeBack = async () => {
    if (!window.confirm("⚠️ Revert this ticket?\nThis will return the ticket to Phase 2 (Telephonic Triage) for re-evaluation.")) {
      return;
    }

    // 6. Notify Customer, Admin, and Technician
    let technicianId = null;
    if (ticket.assigned_technician) {
      const technicianProfile = await fetchProfileByName(ticket.assigned_technician);
      if (technicianProfile) {
        technicianId = technicianProfile.id;
      }
    }

    const adminIds = await notificationService.getAdminUserIds();
    const recipientIds = [ticket.customer_id, technicianId, ...adminIds].filter(Boolean) as string[];

    await notificationService.insertNotification(
      recipientIds,
      ticket.id,
      'warning',
      '🔄 Returned to Triage',
      `Ticket #${ticket.id.slice(0, 8)} has been sent back to Phase 2 for re-evaluation.`,
      2,
      undefined,
      user?.id
    );

    updateMutation.mutate({
      status: "assigned",
      current_phase: 2,
      triage_outcome: null,
      resolution: null,
      assigned_technician: null,
      feedback_collected: false,
      customer_satisfaction: null,
      feedback_comments: null,
      feedback_timestamp: null
    } as any);
    setShowVerification(false);
    toast.success("✅ Ticket returned to Phase 2: Telephonic Triage");
  };

  const handleCallCustomer = () => {
    if (customerPhone) {
      window.location.href = `tel:${customerPhone}`;
    } else {
      toast.error("No phone number available for this customer");
    }
  };

  const openNavigation = () => {
    if ((!ticket.location || !ticket.location.trim()) && (!ticket.customer_lat || !ticket.customer_lng)) {
      toast.error("❌ Customer location details not available");
      return;
    }
    const destination = (ticket.customer_lat && ticket.customer_lng)
      ? `${ticket.customer_lat},${ticket.customer_lng}`
      : encodeURIComponent(ticket.location.trim());

    // Omit origin so Google Maps automatically routes from user's current location.
    // This avoids frontend location prompt delays and async popup blocker issues.
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(mapsUrl, '_blank');
    toast.success("🗺️ Opening navigation to customer location...");
  };

  const renderEvidenceFiles = (urls?: string[] | null) => {
    if (!urls || urls.length === 0) return null;
    
    const getFileType = (url: string) => {
      const lowercaseUrl = url.toLowerCase();
      if (
        lowercaseUrl.endsWith('.mp3') ||
        lowercaseUrl.endsWith('.wav') ||
        lowercaseUrl.endsWith('.m4a') ||
        lowercaseUrl.endsWith('.ogg') ||
        lowercaseUrl.endsWith('.aac') ||
        lowercaseUrl.includes('/audios/')
      ) {
        return 'audio';
      }
      if (
        lowercaseUrl.endsWith('.mp4') ||
        lowercaseUrl.endsWith('.mov') ||
        lowercaseUrl.endsWith('.avi') ||
        lowercaseUrl.endsWith('.mkv') ||
        lowercaseUrl.endsWith('.webm') ||
        lowercaseUrl.endsWith('.3gp') ||
        lowercaseUrl.includes('/videos/')
      ) {
        return 'video';
      }
      if (
        lowercaseUrl.endsWith('.png') ||
        lowercaseUrl.endsWith('.jpg') ||
        lowercaseUrl.endsWith('.jpeg') ||
        lowercaseUrl.endsWith('.gif') ||
        lowercaseUrl.endsWith('.webp') ||
        lowercaseUrl.endsWith('.svg') ||
        lowercaseUrl.includes('/images/')
      ) {
        return 'image';
      }
      return 'document';
    };

    return (
      <div className="flex flex-wrap gap-3 mt-2">
        {urls.map((url, idx) => {
          const type = getFileType(url);
          if (type === 'image') {
            return (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block relative w-20 h-20 border rounded overflow-hidden hover:opacity-90 transition-all bg-muted shadow-sm"
              >
                <img src={url} alt={`Evidence Image ${idx + 1}`} className="w-full h-full object-cover" />
              </a>
            );
          } else if (type === 'video') {
            return (
              <div key={idx} className="relative w-48 border rounded overflow-hidden bg-slate-900 shadow-sm flex flex-col">
                <video src={url} controls className="w-full aspect-video object-cover" />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-white bg-black/50 py-0.5 px-1.5 absolute top-1 right-1 rounded hover:bg-black/70 font-medium"
                >
                  Full
                </a>
              </div>
            );
          } else if (type === 'audio') {
            return (
              <div key={idx} className="w-full max-w-sm border rounded p-2 bg-slate-50 flex flex-col gap-1 shadow-sm">
                <span className="text-[10px] text-muted-foreground font-medium">🎵 Audio Note {idx + 1}:</span>
                <audio src={url} controls className="w-full h-8" />
              </div>
            );
          } else {
            const filename = decodeURIComponent(url.split('/').pop() || 'File').split('?')[0];
            return (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 transition-all bg-white shadow-sm max-w-xs"
              >
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{filename}</p>
                  <p className="text-[10px] text-muted-foreground">Click to view/download</p>
                </div>
              </a>
            );
          }
        })}
      </div>
    );
  };

  const renderPhaseDetails = (phase: number) => {
    if (!ticket) return null;

    switch (phase) {
      case 1:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-slate-800">Phase 1: Registration & Admin Assignment</span>
              <span className="text-xs text-muted-foreground">{formatIndianDateTime(ticket.created_at)}</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The complaint was registered by the customer. The Admin reviews the details and routes it to the designated supervisor.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 bg-white p-3 rounded-lg border">
              <div>
                <span className="text-xs text-muted-foreground block">Complaint Title</span>
                <span className="font-medium text-slate-700 break-words" title={ticket.title}>{ticket.title}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Raised By</span>
                <span className="font-medium text-slate-700">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || 'Customer'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Initial Severity</span>
                <span className="font-medium text-slate-700 capitalize">{ticket.severity || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Supervisor Assigned</span>
                <span className="font-medium text-slate-700">{supervisorName || 'Pending Assignment'}</span>
              </div>
            </div>
            {ticket.complaint_images && ticket.complaint_images.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">📷 Initial Complaint Images (Before Fix):</span>
                <div className="flex flex-wrap gap-2">
                  {ticket.complaint_images.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="block relative w-20 h-20 border rounded overflow-hidden hover:opacity-90">
                      <img src={url} alt={`Initial Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-slate-800">Phase 2: Telephonic Triage</span>
              <span className="text-xs text-muted-foreground">
                {ticket.assignment_timestamp ? formatIndianDateTime(ticket.assignment_timestamp) : 'Pending Triage'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The assigned supervisor evaluates the ticket telephonically to diagnose the issue and determine if it can be resolved remotely.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 bg-white p-3 rounded-lg border">
              <div>
                <span className="text-xs text-muted-foreground block">Triage Supervisor</span>
                <span className="font-medium text-slate-700">{supervisorName || 'Pending'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Triage Outcome</span>
                <span className="font-medium text-slate-700">
                  {ticket.triage_outcome === 'remote_fixed' ? '✅ Resolved by Remote Fix' : ticket.triage_outcome === 'field_required' ? '🔧 Field Visit Required' : '⏳ Pending Triage'}
                </span>
              </div>
            </div>
            {ticket.triage_outcome === 'remote_fixed' && ticket.resolution && (
              <div className="mt-3 bg-success/5 border border-success/20 p-3 rounded-lg">
                <span className="text-xs text-success font-semibold block mb-1">💡 Remote Fix Resolution Notes:</span>
                <p className="text-slate-700 font-normal whitespace-pre-line break-words overflow-hidden">{ticket.resolution}</p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-slate-800">Phase 3: Technician Dispatch</span>
              <span className="text-xs text-muted-foreground">
                {ticket.assignment_timestamp ? formatIndianDateTime(ticket.assignment_timestamp) : 'Pending Dispatch'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              If a field visit is required, the supervisor assigns a specific technician to handle the on-site resolution.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 bg-white p-3 rounded-lg border">
              <div>
                <span className="text-xs text-muted-foreground block">Assigned Technician</span>
                <span className="font-medium text-slate-700">{technicianName || 'Not assigned yet'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Start Journey Time</span>
                <span className="font-medium text-slate-700">
                  {ticket.start_journey_timestamp ? formatIndianDateTime(ticket.start_journey_timestamp) : 'Not started journey yet'}
                </span>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-slate-800">Phase 4: Site Visit & PIR</span>
              <span className="text-xs text-muted-foreground">
                {ticket.arrival_timestamp ? formatIndianDateTime(ticket.arrival_timestamp) : 'Pending Arrival'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The technician arrives at the customer site, logs GPS proof, and submits the Primary Information Report (PIR) detailing the diagnosis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 bg-white p-3 rounded-lg border">
              <div>
                <span className="text-xs text-muted-foreground block">Arrival Status</span>
                <span className="font-medium text-slate-700">
                  {ticket.arrival_timestamp ? '✅ Arrived at Location' : '⏳ In Transit'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">GPS Coordinates (Proof)</span>
                <span className="font-medium text-slate-700">
                  {ticket.arrival_lat && ticket.arrival_lng ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${ticket.arrival_lat},${ticket.arrival_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 inline-flex"
                    >
                      <MapPin className="w-3.5 h-3.5" /> {ticket.arrival_lat.toFixed(6)}, {ticket.arrival_lng.toFixed(6)}
                    </a>
                  ) : (
                    'Not recorded'
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3 bg-slate-50 border p-3 rounded-lg">
              <span className="text-xs text-muted-foreground block mb-1 font-medium">📋 PIR Findings:</span>
              <p className="text-slate-700 font-normal whitespace-pre-line break-words bg-white border p-2.5 rounded overflow-hidden">
                {ticket.pir_findings || 'No findings submitted yet'}
              </p>
            </div>

            {ticket.pir_audio_url && (
              <div className="mt-3 bg-slate-50 border p-3 rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground block font-medium flex items-center gap-1">
                  🎵 Recorded Audio Note:
                </span>
                <audio src={ticket.pir_audio_url} controls className="w-full max-w-md h-10 mt-1" />
              </div>
            )}

            {ticket.technician_evidence && ticket.technician_evidence.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">📸 PIR / Technician Uploaded Files:</span>
                {renderEvidenceFiles(ticket.technician_evidence)}
              </div>
            )}

            {/* Display Approved PIR Validation Details if present */}
            {(ticket.pir_findings_severity || ticket.supervisor_severity || ticket.target_duration_hours) ? (
              <div className="mt-3 bg-emerald-50/50 border border-emerald-200/60 p-4 rounded-lg space-y-3">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">🛡️ PIR Validation Details</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded border border-emerald-100">
                    <span className="text-xs text-muted-foreground block mb-0.5">Findings Severity</span>
                    <span className="font-semibold text-slate-800 capitalize">{ticket.pir_findings_severity || 'Not set'}</span>
                  </div>
                  <div className="bg-white p-3 rounded border border-emerald-100">
                    <span className="text-xs text-muted-foreground block mb-0.5">Supervisor Severity</span>
                    <span className="font-semibold text-slate-800 capitalize">{ticket.supervisor_severity || 'Not set'}</span>
                  </div>
                  <div className="bg-white p-3 rounded border border-emerald-100">
                    <span className="text-xs text-muted-foreground block mb-0.5">Target Duration</span>
                    <span className="font-semibold text-slate-800">{ticket.target_duration_hours ? `${ticket.target_duration_hours} Hours` : 'Not set'}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Supervisor/Admin Validation Action Panel */}
            {isRole("admin", "supervisor") && ticket.pir_findings && !(ticket.pir_findings_severity || ticket.supervisor_severity || ticket.target_duration_hours) && (
              <div className="mt-4 bg-slate-50 border-2 border-dashed border-indigo-200 p-5 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span className="font-semibold text-slate-800 text-sm">Supervisor PIR Verification Panel</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-medium block">PIR Findings Severity</label>
                    <select
                      value={pirSeverityInput}
                      onChange={(e) => setPirSeverityInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-medium block">Supervisor Severity</label>
                    <select
                      value={supSeverityInput}
                      onChange={(e) => setSupSeverityInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-medium block">Target Duration (Hours)</label>
                    <input
                      type="number"
                      min="1"
                      value={targetDurationInput}
                      onChange={(e) => setTargetDurationInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 4"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleApprovePIR}
                    disabled={isApprovingPir}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 text-xs h-9 px-4 rounded shadow-sm transition-all"
                  >
                    {isApprovingPir ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify & Approve PIR
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-slate-800">Phase 5: Remote/Field Resolution & Sign-Off</span>
              <span className="text-xs text-muted-foreground">
                {ticket.signoff_timestamp ? formatIndianDateTime(ticket.signoff_timestamp) : 'Pending Sign-Off'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The job is completed. The technician details the on-site resolution notes and collects the customer's signature/sign-off.
            </p>
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-xs text-muted-foreground block mb-1">🔧 Resolution Note:</span>
              <p className="text-slate-700 font-normal whitespace-pre-line break-words bg-slate-50 border p-2 rounded overflow-hidden">
                {ticket.resolution || 'Pending completion'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {ticket.technician_evidence && ticket.technician_evidence.length > 0 && (
                <div className="bg-white p-3 rounded-lg border">
                  <span className="text-xs text-muted-foreground block mb-2 font-medium">✅ Technician's Resolution Evidence (After):</span>
                  {renderEvidenceFiles(ticket.technician_evidence)}
                </div>
              )}
              {ticket.signature_url && (
                <div className="bg-white p-3 rounded-lg border flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-2 font-medium">✍️ Customer Signature:</span>
                    <img src={ticket.signature_url} alt="Customer Signature" className="max-h-16 border rounded bg-white p-1" />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-2 block">
                    Signed Off At: {ticket.signoff_timestamp ? formatIndianDateTime(ticket.signoff_timestamp) : 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-slate-800">Phase 6: QA Verification & Feedback</span>
              <span className="text-xs text-muted-foreground">
                {ticket.feedback_timestamp ? formatIndianDateTime(ticket.feedback_timestamp) : 'Pending Verification'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The supervisor or admin contacts the customer to verify satisfaction before officially closing the ticket.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 bg-white p-3 rounded-lg border">
              <div>
                <span className="text-xs text-muted-foreground block">Customer Satisfaction</span>
                <span className="font-medium text-slate-700 capitalize">
                  {ticket.customer_satisfaction ? ticket.customer_satisfaction.replace('_', ' ') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Contact Method</span>
                <span className="font-medium text-slate-700 capitalize">
                  {ticket.feedback_contact_method || 'N/A'}
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border mt-3">
              <span className="text-xs text-muted-foreground block mb-1">💬 Customer Feedback Comments:</span>
              <p className="text-slate-700 font-normal break-words bg-slate-50 border p-2 rounded overflow-hidden">
                {ticket.feedback_comments || 'No comments collected yet'}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto p-4 md:p-6 lg:p-8">

      {/* Header */}
      <div className="glass-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-glow relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        {/* Decorative ambient light behind header */}
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-all duration-300 filter blur-xl pointer-events-none" />
        
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0 border border-border/40 hover:border-primary/20 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                Ticket ID: {ticket.id.slice(0, 8)}
              </span>
              {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
              {ticket.status && <StatusBadge status={ticket.status} />}
            </div>
            <h1 className="text-xl md:text-2xl font-display font-extrabold text-foreground tracking-tight break-words" title={ticket.title}>
              {ticket.title}
            </h1>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Customer: <span className="font-semibold text-foreground">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || "Customer"}</span>
              </span>
              <span className="text-muted-foreground/45">•</span>
              <span>
                Registered on <span className="font-medium text-foreground">{formatIndianDateTime(ticket.created_at)}</span>
              </span>
              {ticket.assigned_supervisor && (
                <>
                  <span className="text-muted-foreground/45">•</span>
                  <span>
                    Supervisor: <span className="font-semibold text-primary">{ticket.assigned_supervisor}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0 border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-end">
          {canVerify && (
            <Button size="sm" variant="outline" className="border-warning/60 text-warning hover:bg-warning/5" onClick={() => setShowVerification(!showVerification)}>
              <ShieldCheck className="w-4 h-4 mr-2" /> Verify
            </Button>
          )}
          {canEdit && (
            <Link to={`/complaints/${ticket.id}/edit`} className="w-full md:w-auto">
              <Button variant="outline" size="sm" className="w-full md:w-auto border-border/80 hover:border-primary/30"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Remote Fix Info Banner */}
      {ticket.triage_outcome === 'remote_fixed' && ticket.current_phase === 6 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-info bg-info/5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-info">✅ Resolved Remotely</p>
              <p className="text-xs text-muted-foreground mt-1">
                This ticket was resolved via telephonic triage by {supervisorName || 'supervisor'}.
              </p>
              {ticket.resolution && (
                <div className="mt-2 p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Resolution:</p>
                  <p className="text-sm">{ticket.resolution}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Universal Feedback Status Banner */}
      {ticket.feedback_collected && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`glass-card rounded-xl p-4 border-l-4 ${ticket.customer_satisfaction === 'satisfied' ? 'border-l-success bg-success/5' : ticket.customer_satisfaction === 'partially_satisfied' ? 'border-l-warning bg-warning/5' : 'border-l-destructive bg-destructive/5'}`}>
          <div className="flex items-start gap-3">
            {ticket.customer_satisfaction === 'satisfied' ? (
              <ThumbsUp className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            ) : ticket.customer_satisfaction === 'partially_satisfied' ? (
              <Star className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            ) : (
              <ThumbsDown className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm flex items-center gap-2">
                📋 Universal Feedback Collected
                <span className={`text-xs px-2 py-0.5 rounded-full ${ticket.customer_satisfaction === 'satisfied' ? 'bg-success/20 text-success' : ticket.customer_satisfaction === 'partially_satisfied' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>
                  {ticket.customer_satisfaction?.replace('_', ' ').toUpperCase()}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact Method: <strong>{ticket.feedback_contact_method || 'phone'}</strong>
                {ticket.feedback_timestamp && ` • Collected on ${formatIndianDateTime(ticket.feedback_timestamp)}`}
              </p>
              {ticket.feedback_comments && (
                <div className="mt-2 p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Customer Comments:</p>
                  <p className="text-sm italic">"{ticket.feedback_comments}"</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Grid Layout for Widescreen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Main Column: Actions, forms, timeline */}
        <div className="lg:col-span-2 space-y-6">

      {/* Phase 1: Supervisor Assignment (Admin action needed) */}
      {ticket.current_phase === 1 && !ticket.assigned_supervisor && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary">
            <ShieldCheck className="w-5 h-5" /> Phase 1: Admin Assignment
          </h2>
          {isRole("admin") ? (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground">
                Please assign a Supervisor to review and triage this complaint.
              </p>
              <Link to={`/complaints/${ticket.id}/edit`}>
                <Button className="w-full gradient-primary">
                  <User className="w-4 h-4 mr-2" /> Assign Supervisor
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning animate-pulse" /> Waiting for Administrator to assign a supervisor.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Phase 2: Telephonic Triage (Supervisor action needed) */}
      {ticket.current_phase === 2 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary">
            <Phone className="w-5 h-5" /> Phase 2: Telephonic Triage
          </h2>
          {(isRole("admin") || (isRole("supervisor") && ticket.assigned_supervisor === currentUserFullName)) ? (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground">
                Contact the customer to triage the issue. Choose whether to resolve it remotely or dispatch a technician.
              </p>
              <div className="flex flex-col md:flex-row gap-3 w-full">
                <Button variant="outline" className="w-full whitespace-normal text-center border-success text-success" onClick={() => handleTriageDecision('remote_fixed')}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> 📞 Remote Fix
                </Button>
                <Button className="w-full whitespace-normal text-center gradient-primary" onClick={() => handleTriageDecision('field_required')}>
                  <Wrench className="w-4 h-4 mr-2" /> 🚐 Field Visit Required
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" /> Waiting for assigned supervisor ({ticket.assigned_supervisor || "Supervisor"}) to perform telephonic triage.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Phase 3: Dispatch (Supervisor action needed) */}
      {ticket.current_phase === 3 && !ticket.assigned_technician && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-warning">
            <Phone className="w-5 h-5" /> Phase 3: Dispatch
          </h2>
          {(isRole("supervisor") && ticket.assigned_supervisor === currentUserFullName) ? (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground">
                Please assign a technician matching the required field of work to resolve the issue on-site.
              </p>
              <Link to={`/complaints/${ticket.id}/edit`}>
                <Button className="w-full gradient-primary">
                  <Edit className="w-4 h-4 mr-2" /> Assign Technician & Dispatch
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning animate-pulse" /> Waiting for supervisor ({ticket.assigned_supervisor || "assigned supervisor"}) to assign technician and dispatch.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Technician Actions */}
      {canTechnicianAct && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary"><Wrench className="w-5 h-5" /> Technician Actions</h2>

          {/* Navigate to Customer Button */}
          {ticket.current_phase === 4 && ticket.status === "in-progress" && ticket.location && (
            <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Navigate to Customer</p>
                    <p className="text-xs text-muted-foreground">{ticket.location}</p>
                  </div>
                </div>
                <Button size="sm" onClick={openNavigation} className="gradient-primary text-primary-foreground">
                  <MapPin className="w-3 h-3 mr-1" /> Navigate
                </Button>
              </div>
            </div>
          )}

          {/* Phase 3: Start Journey */}
          {ticket.current_phase === 3 && (ticket.status === "assigned" || ticket.status === "dispatched") && (
            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="font-medium">Ready to start journey?</p>
                <p className="text-sm text-muted-foreground">GPS will verify your arrival.</p>
              </div>
              <Button onClick={handleStartJourney} className="gradient-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Start Journey
              </Button>
            </div>
          )}

          {/* Phase 4: Submit PIR */}
          {ticket.current_phase === 4 && ticket.status === "in-progress" && !showPIRForm && !showResolution && !showSignOff && (
            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="font-medium">Submit Primary Information Report (PIR)</p>
                <p className="text-sm text-muted-foreground">Document your findings at the site.</p>
              </div>
              <Button onClick={() => setShowPIRForm(true)} variant="outline"><FileText className="w-4 h-4 mr-2" /> Submit PIR</Button>
            </div>
          )}

          {/* Technician Live Tracking */}
          {isRole("technician") && isAssignedTechnician && (ticket.current_phase === 3 || ticket.current_phase === 4 || ticket.current_phase === 5) && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Technician Tracking</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={isTracking ? stopTechnicianTracking : startTechnicianTracking} className={isTracking ? "bg-destructive text-white" : "bg-success text-success-foreground"}>
                  {isTracking ? (<><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Stop Sharing Location</>) : (<><MapPin className="w-3.5 h-3.5 mr-2" /> Share My Location</>)}
                </Button>
                <Button size="sm" variant="outline" onClick={shareCurrentLocation} disabled={isTracking}>
                  <MapPin className="w-3.5 h-3.5 mr-2" /> Send Current Location Once
                </Button>
              </div>
              {trackingError && <p className="text-xs text-destructive">{trackingError}</p>}
              {trackingLocation && (
                <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                  <span>Lat: {trackingLocation.lat.toFixed(6)}</span>
                  <span>Lng: {trackingLocation.lng.toFixed(6)}</span>
                  {trackingLocation.accuracy && <span>Acc: ±{trackingLocation.accuracy.toFixed(1)}m</span>}
                  {trackingLocation.heading && <span>Heading: {trackingLocation.heading.toFixed(0)}°</span>}
                  {trackingLocation.recordedAt && <span>Updated: {new Date(trackingLocation.recordedAt).toLocaleTimeString()}</span>}
                </div>
              )}
            </div>
          )}

          {/* PIR Form */}
          {showPIRForm && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <label className="text-sm font-medium">PIR Findings *</label>
              <Textarea value={pirFindings} onChange={e => setPirFindings(e.target.value)} placeholder="Describe field findings..." rows={3} />
              <label className="text-sm font-medium">Upload Evidence / Audio / Files (Optional)</label>
              <input type="file" multiple onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                const newEvidence: string[] = [];
                for (const file of files) {
                  try {
                    if (file.type.startsWith('audio/')) {
                      const url = await uploadToSupabase(file, 'pir-audio');
                      setPirAudioUrl(url);
                      toast.success(`Audio "${file.name}" uploaded`);
                    } else {
                      const url = await uploadToSupabase(file, 'evidence');
                      newEvidence.push(url);
                      toast.success(`File "${file.name}" uploaded`);
                    }
                  } catch (err) {
                    toast.error(`Failed to upload ${file.name}`);
                  }
                }
                if (newEvidence.length > 0) {
                  setEvidenceUrls(prev => [...prev, ...newEvidence]);
                }
              }} className="text-sm" />
              {pirAudioUrl && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded flex items-center gap-1.5 mt-1">
                  🎵 Audio Note: <a href={pirAudioUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Listen to Audio</a>
                </div>
              )}
              {evidenceUrls.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Uploaded Evidence Preview ({evidenceUrls.length} file(s)):</p>
                  <div className="flex flex-wrap gap-2">
                    {evidenceUrls.map((url, i) => (
                      <div key={i} className="relative w-12 h-12 border rounded bg-white overflow-hidden group">
                        <img src={url} alt="Evidence Preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowPIRForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSubmitPIR} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Submit PIR
                </Button>
              </div>
            </div>
          )}

          {/* Phase 4: Add Resolution */}
          {ticket.current_phase === 4 && ticket.status === "in-progress" && !showPIRForm && !showSignOff && (
            <div className="space-y-3 bg-muted/50 p-4 rounded-lg mt-3">
              {showResolution ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Resolution Notes *</label>
                  <Textarea placeholder="Describe work done, parts replaced, tests performed..." value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} rows={3} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowResolution(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveResolution} disabled={updateMutation.isPending} className="bg-primary text-primary-foreground">
                      {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Save & Continue to Sign Off
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Job in progress</p>
                    <p className="text-sm text-muted-foreground">Add resolution notes when work is done.</p>
                  </div>
                  <Button onClick={() => setShowResolution(true)} variant="outline"><CheckSquare className="w-4 h-4 mr-2" /> Add Resolution</Button>
                </div>
              )}
            </div>
          )}

          {/* Sign Off Form */}
          {showSignOff && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/50 p-4 rounded-lg space-y-4 border-l-4 border-l-success mt-3">
              <h3 className="font-semibold text-lg text-success flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Final Sign-Off
              </h3>
              <p className="text-sm text-muted-foreground">Upload evidence and capture customer signature to complete the job.</p>
              {resolutionNote && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Resolution Notes</p>
                  <p className="text-sm">{resolutionNote}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload Evidence (Photos/Videos)
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
                }} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploading} />
                {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
                {evidenceUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {evidenceUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded">
                        Evidence {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Customer Signature *</label>
                <div className="flex gap-2 border-b border-border">
                  <button type="button" onClick={() => setSignatureMode("draw")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${signatureMode === "draw" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <PenTool className="w-4 h-4" /> Draw Signature
                  </button>
                  <button type="button" onClick={() => setSignatureMode("upload")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${signatureMode === "upload" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <ImageIcon className="w-4 h-4" /> Upload Signature
                  </button>
                </div>
                {signatureMode === "draw" && (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-primary/50 rounded-lg p-2 bg-white w-full overflow-hidden">
                      <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ width: canvasWidth, height: 150, className: 'signature-canvas rounded max-w-full' }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" onClick={() => sigRef.current?.clear()} className="text-xs">Clear Signature</Button>
                    </div>
                  </div>
                )}
                {signatureMode === "upload" && (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-primary/50 rounded-lg p-4 bg-white">
                      {uploadedSignaturePreview ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <img src={uploadedSignaturePreview} alt="Uploaded Signature Preview" className="max-h-32 border rounded bg-gray-50" />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-success font-medium">✅ Signature uploaded successfully</p>
                            <Button variant="ghost" size="sm" onClick={clearUploadedSignature} className="text-xs text-destructive">
                              <XCircle className="w-3 h-3 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground mb-3">Upload customer's signature image</p>
                          <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleSignatureUpload} disabled={isUploading} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                          <p className="text-xs text-muted-foreground mt-2">Supported: PNG, JPG, JPEG (Max 5MB)</p>
                        </div>
                      )}
                    </div>
                    {isUploading && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading signature...
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowSignOff(false)}>Cancel</Button>
                <Button size="sm" onClick={handleFinalSignOff} disabled={updateMutation.isPending} className="bg-success hover:bg-success/90 text-success-foreground">
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Finalize & Complete Job
                </Button>
              </div>
            </motion.div>
          )}

          {ticket.current_phase < 3 && (
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground"> Waiting for supervisor to dispatch this ticket.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Phase 6: Verification & Universal Feedback Panel */}
      {showVerification && canVerify && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-warning" /> Phase 6: QA & Closing
          </h2>

          {/* Take Back Button */}
          {ticket.triage_outcome === 'remote_fixed' && isRole("admin", "supervisor") && (
            <div className="mb-4 p-4 rounded-lg bg-warning/10 border-2 border-warning/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-warning mb-1">⚠️ Remote Fix - Revert Option</p>
                  <p className="text-xs text-muted-foreground mb-3">This ticket was resolved remotely via phone. If this was done by mistake or requires a field visit, you can return it to Phase 2 (Telephonic Triage) for re-evaluation.</p>
                  <Button variant="outline" size="sm" onClick={handleTakeBack} disabled={updateMutation.isPending} className="border-warning text-warning hover:bg-warning/20 font-medium">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
                    Return to Phase 2 (Triage)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Universal Feedback Section */}
          <div className="mb-4 p-4 rounded-lg bg-primary/5 border-2 border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-primary">Universal Feedback - Customer Satisfaction</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              The Assignee Team must contact the customer to verify satisfaction {ticket.triage_outcome === 'remote_fixed' ? '(Telephonic Remote Fix)' : '(Field Visit)'} before officially closing the ticket.
            </p>
            {customerPhone && !ticket.feedback_collected && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Contact Customer</p>
                    <p className="text-xs text-muted-foreground">{customerPhone}</p>
                  </div>
                </div>
                {!isRole("customer") && (
                  <Button size="sm" onClick={handleCallCustomer} variant="outline">
                    <Phone className="w-3 h-3 mr-1" /> Call Now
                  </Button>
                )}
              </div>
            )}
            {!ticket.feedback_collected && (
              <>
                <Button onClick={() => setShowFeedbackForm(!showFeedbackForm)} variant="outline" className="w-full mb-3">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {showFeedbackForm ? "Hide Feedback Form" : "Record Customer Feedback"}
                </Button>
                {showFeedbackForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 pt-3 border-t">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Customer Satisfaction Level *</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <button type="button" onClick={() => setFeedbackSatisfaction('satisfied')} className={`p-3 rounded-lg border-2 transition-all ${feedbackSatisfaction === 'satisfied' ? 'border-success bg-success/10 text-success' : 'border-border hover:border-success/50'}`}>
                          <ThumbsUp className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs font-medium">Satisfied</p>
                        </button>
                        <button type="button" onClick={() => setFeedbackSatisfaction('partially_satisfied')} className={`p-3 rounded-lg border-2 transition-all ${feedbackSatisfaction === 'partially_satisfied' ? 'border-warning bg-warning/10 text-warning' : 'border-border hover:border-warning/50'}`}>
                          <Star className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs font-medium">Partially Satisfied</p>
                        </button>
                        <button type="button" onClick={() => setFeedbackSatisfaction('unsatisfied')} className={`p-3 rounded-lg border-2 transition-all ${feedbackSatisfaction === 'unsatisfied' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:border-destructive/50'}`}>
                          <ThumbsDown className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs font-medium">Unsatisfied</p>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Contact Method Used</label>
                      <Select value={feedbackContactMethod} onValueChange={(value) => setFeedbackContactMethod(value)}>
                        <SelectTrigger><SelectValue placeholder="Select contact method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">📞 Phone Call</SelectItem>
                          <SelectItem value="email">📧 Email</SelectItem>
                          <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                          <SelectItem value="sms">📱 SMS</SelectItem>
                          <SelectItem value="in_person">👤 In Person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Customer Comments *</label>
                      <Textarea value={feedbackComments} onChange={(e) => setFeedbackComments(e.target.value)} placeholder="Enter customer's feedback about the service..." rows={3} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Verification Notes (Optional)</label>
                      <Textarea value={verificationNote} onChange={(e) => setVerificationNote(e.target.value)} placeholder="Additional notes from supervisor..." rows={2} />
                    </div>
                    <Button onClick={handleCollectFeedback} disabled={!feedbackSatisfaction || !feedbackComments.trim() || isCollectingFeedback} className="w-full bg-primary text-primary-foreground">
                      {isCollectingFeedback ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Collect & Save Feedback
                    </Button>
                  </motion.div>
                )}
              </>
            )}
            {ticket.feedback_collected && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <p className="text-sm font-medium text-success">Feedback Successfully Collected</p>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><strong>Satisfaction:</strong> {ticket.customer_satisfaction?.replace('_', ' ')}</p>
                  <p><strong>Contact Method:</strong> {ticket.feedback_contact_method}</p>
                  {ticket.feedback_timestamp && (<p><strong>Collected:</strong> {formatIndianDateTime(ticket.feedback_timestamp)}</p>)}
                </div>
              </motion.div>
            )}
          </div>

          {/* Resolution Display */}
          {ticket.resolution && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Resolution</p>
              <p className="text-sm break-words overflow-hidden">{ticket.resolution}</p>
            </div>
          )}

          {/* ✅ FIXED: Before & After Comparison */}
          <div className="space-y-4 mb-4">
            <ImageGallery
              images={ticket.complaint_images || []}
              title="📸 Before: Initial Reported Issue"
              uploader="customer"
              emptyMessage="No initial images provided"
            />
            <ImageGallery
              images={ticket.technician_evidence || []}
              title="✅ After: Technician's Resolution Evidence"
              uploader="technician"
              emptyMessage="Technician has not uploaded evidence yet"
            />
            {ticket.signature_url && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Signature
                </h3>
                <img src={ticket.signature_url} alt="Signature" className="max-w-xs border rounded bg-white p-2" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <Button onClick={handleFinalClosure} disabled={!ticket.feedback_collected || updateMutation.isPending} className="bg-success text-success-foreground hover:bg-success/90" title={!ticket.feedback_collected ? "Please collect customer feedback first" : ""}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirm & Close Ticket
            </Button>
            <Button variant="outline" onClick={handleReject} disabled={!ticket.feedback_collected || !verificationNote.trim()} className="border-destructive text-destructive" title={!ticket.feedback_collected ? "Please collect customer feedback first" : ""}>
              <XCircle className="w-4 h-4 mr-2" /> Reject & Rework
            </Button>
          </div>
          {!ticket.feedback_collected && (
            <p className="text-xs text-warning mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Customer feedback must be collected before closing the ticket
            </p>
          )}
        </motion.div>
      )}

      {/* Timeline & Details */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Phase {ticket.current_phase}: {phaseLabels[ticket.current_phase as keyof typeof phaseLabels]}</h2>
          <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
            💡 Click phases below to view details
          </span>
        </div>
        <PhaseTimeline 
          currentPhase={ticket.current_phase as any || 1} 
          status={ticket.status} 
          activePhase={activePhase}
          onPhaseClick={(phase) => setActivePhase(phase)}
        />
        
        {/* Selected Phase Details Card */}
          <div className="mt-6 border-t pt-5">
            <h3 className="font-semibold text-sm text-primary mb-3 flex items-center gap-1.5">
              🔍 Phase {activePhase} Detail: {phaseLabels[activePhase as keyof typeof phaseLabels]}
            </h3>
            <div className="bg-muted/30 border rounded-xl p-4 space-y-3 text-sm">
              {renderPhaseDetails(activePhase)}
            </div>
          </div>

          {(isRole("customer", "supervisor", "admin") && ticket.assigned_technician && (ticket.current_phase >= 3 || trackingLocation)) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 border-t pt-5">
              <h3 className="font-semibold text-sm text-primary mb-3 flex items-center gap-1.5">
                🗺️ Live Technician Tracking
              </h3>
              <div className="bg-muted/30 border rounded-xl overflow-hidden">
                <MapContainer
                  center={trackingLocation ? [trackingLocation.lat, trackingLocation.lng] : (ticket.customer_lat && ticket.customer_lng ? [ticket.customer_lat, ticket.customer_lng] : [17.385044, 78.486671])}
                  zoom={trackingLocation ? 15 : 12}
                  style={{ height: 360, width: "100%" }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapUpdater center={trackingLocation ? [trackingLocation.lat, trackingLocation.lng] : null} />
                  {ticket.customer_lat && ticket.customer_lng && (
                    <Marker position={[ticket.customer_lat, ticket.customer_lng]}>
                      <Popup>
                        <p className="text-xs font-semibold">Customer Location</p>
                        <p className="text-[10px] text-muted-foreground">{ticket.location || ticket.customer_lat.toFixed(5)}, {ticket.customer_lng.toFixed(5)}</p>
                      </Popup>
                    </Marker>
                  )}
                  {trackingLocation && (
                    <Marker position={[trackingLocation.lat, trackingLocation.lng]}>
                      <Popup>
                        <p className="text-xs font-semibold">{ticket.assigned_technician}</p>
                        <p className="text-[10px] text-muted-foreground">{trackingLocation.lat.toFixed(5)}, {trackingLocation.lng.toFixed(5)}</p>
                        {trackingLocation.accuracy && <p className="text-[10px]">Accuracy: ±{trackingLocation.accuracy.toFixed(1)}m</p>}
                        {trackingLocation.heading && <p className="text-[10px]">Heading: {trackingLocation.heading.toFixed(0)}°</p>}
                        {trackingLocation.speed && <p className="text-[10px]">Speed: {(trackingLocation.speed * 3.6).toFixed(1)} km/h</p>}
                        {trackingLocation.recordedAt && <p className="text-[10px]">Updated: {new Date(trackingLocation.recordedAt).toLocaleTimeString()}</p>}
                      </Popup>
                    </Marker>
                  )}
                  {trackingLocation && ticket.customer_lat && ticket.customer_lng && (
                    <Polyline positions={[[ticket.customer_lat, ticket.customer_lng], [trackingLocation.lat, trackingLocation.lng]]} color="#2563eb" weight={4} opacity={0.7} dashArray="8 8" />
                  )}
                </MapContainer>
                <div className="p-3 border-t flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Customer</span>
                  {trackingLocation && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Technician</span>}
                  {trackingLocation && <span className="ml-auto">Last updated: {new Date(trackingLocation.recordedAt || Date.now()).toLocaleTimeString()}</span>}
                </div>
              </div>
            </motion.div>
          )}
      </motion.div>
        </div>

        {/* Right/Sidebar Column (Details & Assigned Team) */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium ml-2">{customerName}</span>
              </div>
              {customerPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <a href={`tel:${customerPhone}`} className="text-primary hover:underline font-medium">{customerPhone}</a>
                  {!isRole("customer") && (
                    <Button variant="outline" size="sm" onClick={handleCallCustomer} className="ml-auto">
                      <Phone className="w-3 h-3 mr-1" /> Call
                    </Button>
                  )}
                </div>
              )}
              {ticket.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span>{ticket.location}</span>
                </div>
              )}
              {ticket.field_of_work && (
                <div><span className="text-muted-foreground">Field:</span> <span className="font-medium ml-2">{ticket.field_of_work}</span></div>
              )}
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium ml-2">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || "Customer"}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Created {formatIndianDateTime(ticket.created_at)}</div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Updated {formatIndianDateTime(ticket.updated_at)}</div>
              {ticket.description && (
                <div className="pt-3 border-t mt-3">
                  <span className="text-muted-foreground block mb-1">Description:</span>
                  <p className="font-normal text-slate-700 whitespace-pre-line break-words bg-muted/30 p-2.5 rounded-lg border overflow-hidden">{ticket.description}</p>
                </div>
              )}
              {ticket.complaint_images && ticket.complaint_images.length > 0 && (
                <div className="pt-3 border-t mt-3">
                  <ImageGallery
                    images={ticket.complaint_images}
                    title="📷 Initial Reported Images (Before Fix)"
                    uploader="customer"
                  />
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Assigned Team</h2>
            {supervisorName && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center text-white text-xs font-bold">
                  {supervisorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{supervisorName}</p>
                  <p className="text-xs text-muted-foreground">Supervisor</p>
                </div>
              </div>
            )}
            {technicianName ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-white text-xs font-bold">
                  {technicianName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{technicianName}</p>
                  <p className="text-xs text-muted-foreground">Technician</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No technician assigned yet</p>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default ComplaintDetail;

type MapUpdaterProps = {
  center: [number, number] | null;
};

const MapUpdater = ({ center }: MapUpdaterProps) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
};
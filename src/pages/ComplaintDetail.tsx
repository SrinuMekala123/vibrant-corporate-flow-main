import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Edit, Phone, MapPin, Clock, User, Users, Wrench, FileText, ShieldCheck, CheckCircle, CheckCircle2, XCircle, X, Loader2, Play, CheckSquare, Upload, PenTool, Image as ImageIcon, AlertTriangle, MessageSquare, Star, Crown, ThumbsUp, ThumbsDown, RotateCcw, ZoomIn, Download, Calendar, Navigation, HelpCircle, PlusCircle, Search, Sparkles, AlertCircle, MessageCircle, Camera, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { phaseLabels } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { complaintService, formatComplaintTicketId, type Complaint } from "@/services/complaintService";
import { supabase, resolveSupabaseUrl } from "@/lib/supabase";
import { checkAndRunMigration } from "@/utils/databaseMigration";
import SignatureCanvas from "react-signature-canvas";
import browserImageCompression from "browser-image-compression";
import { compressVideoForUpload } from "@/lib/videoCompression";
import ImageGallery from "@/components/ImageGallery";
import LiveRouteTrackingModal from "@/components/LiveRouteTrackingModal";
import { TechnicianMissionControl } from "@/components/TechnicianMissionControl";
import { notificationService } from "@/services/notificationService";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { ManualWhatsAppButton } from "@/components/ManualWhatsAppButton";
import {
  sendWhatsAppMessage,
  getCustomerPhone,
  getCustomerName,
  getRemoteResolutionMessage,
  getFieldVisitScheduledMessage,
  getTechnicianSignOffMessage,
} from "@/utils/whatsappService";

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

const getEffectivePhase = (t: any): number => {
  if (!t) return 1;
  const raw = Number(t.current_phase) || 1;
  const status = t.status || "";

  // Phase 6: QA Verification & Closure
  if (
    status === "closed" ||
    status === "completed" ||
    status === "resolved" ||
    status === "Next Steps / Closure" ||
    status === "awaiting_verification" ||
    status === "resolution_submitted" ||
    raw === 6 ||
    (Boolean(t.signature_url || t.signoff_timestamp) && Boolean(t.resolution || t.resolution_notes))
  ) {
    return Math.max(raw, 6);
  }

  // Phase 5: Resolution Notes & Customer Sign-Off
  if (
    raw === 5 ||
    status === "Resolution & Sign-off" ||
    status === "resolution_pending" ||
    status === "awaiting_signoff" ||
    (Boolean(t.pir_findings) && !t.signoff_timestamp && raw >= 5)
  ) {
    return Math.max(raw, 5);
  }

  // Phase 4: Site Visit & PIR Diagnosis
  if (
    raw === 4 ||
    status === "arrived"
  ) {
    return Math.max(raw, 4);
  }

  // Phase 3: Technician Assignment & Journey
  if (
    raw === 3 ||
    status === "assigned" ||
    status === "dispatched"
  ) {
    return Math.max(raw, 3);
  }

  // Phase 2: Telephonic Triage
  if (
    raw === 2 ||
    status === "triage"
  ) {
    return Math.max(raw, 2);
  }

  return raw;
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
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const [verificationNote, setVerificationNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [pirFindings, setPirFindings] = useState("");
  const [pirAudioUrl, setPirAudioUrl] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [pirEvidenceUrls, setPirEvidenceUrls] = useState<string[]>([]);
  const [resolutionEvidenceUrls, setResolutionEvidenceUrls] = useState<string[]>([]);
  const [isSubmittingPIR, setIsSubmittingPIR] = useState(false);
  const [isSubmittingSignOff, setIsSubmittingSignOff] = useState(false);
  const [activePhase, setActivePhase] = useState<number>(1);
  const [canvasWidth, setCanvasWidth] = useState(750);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const padding = window.innerWidth < 640 ? 40 : 64;
      const width = Math.min(750, window.innerWidth - padding);
      setCanvasWidth(width);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const [showVerification, setShowVerification] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [showPIRForm, setShowPIRForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [currentUserFullName, setCurrentUserFullName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [pirSeverityInput, setPirSeverityInput] = useState("medium");
  const [supSeverityInput, setSupSeverityInput] = useState("medium");
  const [targetDurationInput, setTargetDurationInput] = useState("4");

  const [showStartJourneyModal, setShowStartJourneyModal] = useState(false);
  const [typedStartLocation, setTypedStartLocation] = useState("");
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isApprovingPir, setIsApprovingPir] = useState(false);

  const [feedbackSatisfaction, setFeedbackSatisfaction] = useState<SatisfactionLevel>("");
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackContactMethod, setFeedbackContactMethod] = useState("phone");
  const [isCollectingFeedback, setIsCollectingFeedback] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Happiness Code States (Phase 6 Verification)
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [inputHappinessCode, setInputHappinessCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeVerificationError, setCodeVerificationError] = useState("");
  const [codeVerifiedLocally, setCodeVerifiedLocally] = useState(false);

  const [showRemoteResolutionModal, setShowRemoteResolutionModal] = useState(false);
  const [remoteResolutionNotes, setRemoteResolutionNotes] = useState("");
  const [pendingRemoteResolution, setPendingRemoteResolution] = useState<"remote_fixed" | "field_required" | null>(null);
  const [showRevertPhase2Modal, setShowRevertPhase2Modal] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [isRevertingPhase2, setIsRevertingPhase2] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignSelectedTechs, setReassignSelectedTechs] = useState<string[]>([]);
  const [reassignLeadTechId, setReassignLeadTechId] = useState<string | null>(null);
  const [reassignReason, setReassignReason] = useState("");
  const [reassignSearchTerm, setReassignSearchTerm] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  // Field Visit Assignment Modal (Phase 2 -> Phase 3)
  const [showFieldVisitModal, setShowFieldVisitModal] = useState(false);
  const [fieldVisitSelectedTechs, setFieldVisitSelectedTechs] = useState<string[]>([]);
  const [fieldVisitLeadTechId, setFieldVisitLeadTechId] = useState<string | null>(null);
  const [fieldVisitTechSearch, setFieldVisitTechSearch] = useState<string>("");
  const [fieldVisitScheduledDate, setFieldVisitScheduledDate] = useState<string>("");
  const [fieldVisitScheduledTime, setFieldVisitScheduledTime] = useState<string>("10:00");
  const [fieldVisitSupervisorNotes, setFieldVisitSupervisorNotes] = useState<string>("");
  const [isAssigningFieldVisit, setIsAssigningFieldVisit] = useState(false);

  // PIR Rejection Modal (Supervisor -> Send back to Lead in Phase 4)
  const [showPirRejectModal, setShowPirRejectModal] = useState(false);
  const [pirRejectReason, setPirRejectReason] = useState("");
  const [isRejectingPir, setIsRejectingPir] = useState(false);

  // Phase 6 Final Action & Follow-up
  const [phase6Action, setPhase6Action] = useState<"close" | "follow_up" | "rework">("close");
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [followUpTime, setFollowUpTime] = useState<string>("10:00");
  const [followUpNotes, setFollowUpNotes] = useState<string>("");
  const [isFinalizingClosure, setIsFinalizingClosure] = useState(false);
  const [isForceClosing, setIsForceClosing] = useState(false);
  const [arrivalCoords, setArrivalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingArrivalGps, setIsCapturingArrivalGps] = useState(false);

  // Return for Rework Modal (Phase 6 -> Phase 3 or Phase 5)
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkTargetPhase, setReworkTargetPhase] = useState<3 | 5>(3);
  const [reworkScheduledDate, setReworkScheduledDate] = useState<string>("");
  const [reworkScheduledTime, setReworkScheduledTime] = useState<string>("10:00");
  const [reworkInstructions, setReworkInstructions] = useState<string>("");
  const [reworkSelectedTechs, setReworkSelectedTechs] = useState<string[]>([]);
  const [reworkLeadTechId, setReworkLeadTechId] = useState<string | null>(null);
  const [reworkTechSearch, setReworkTechSearch] = useState<string>("");
  const [isSubmittingRework, setIsSubmittingRework] = useState(false);

  useEffect(() => {
    checkAndRunMigration();
  }, []);



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

  const { data: allTechnicians = [] } = useQuery({
    queryKey: ['technicians-list-for-reassign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'technician')
        .order('full_name');
      if (error) {
        console.warn("Error fetching technicians for reassign:", error);
        return [];
      }
      try {
        const raw = localStorage.getItem("technician_profile_overrides_v1");
        const overrides = raw ? JSON.parse(raw) : {};
        return (data || []).map((t: any) => {
          const over = overrides[t.id] || {};
          return {
            ...t,
            technician_id: t.technician_id || t.employee_id || over.technician_id || over.employee_id || null,
            designation: t.designation || over.designation || null,
            expertise: t.expertise || over.expertise || null,
          };
        });
      } catch {
        return data || [];
      }
    },
    enabled: !!user,
  });

  // Automated background GPS tracking for technicians on active journeys
  useEffect(() => {
    if (!id || !ticket || ticket.status !== 'in-progress' || ticket.current_phase !== 4 || !isRole('technician')) {
      return;
    }

    console.log("📡 Starting automated 30-second location tracking for active journey...");
    
    const trackLocation = async () => {
      if (!navigator.geolocation) return;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => {
              switch(error.code) {
                case error.PERMISSION_DENIED:
                  reject(new Error('GPS permission denied'));
                  break;
                case error.POSITION_UNAVAILABLE:
                  reject(new Error('Location unavailable'));
                  break;
                case error.TIMEOUT:
                  reject(new Error('GPS timeout'));
                  break;
                default:
                  reject(new Error('Unknown GPS error'));
              }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        try {
          const { error } = await supabase.from("location_tracking").insert({
            complaint_id: id,
            latitude: lat,
            longitude: lng,
            accuracy: accuracy || null,
            timestamp: new Date().toISOString()
          });
          if (error) {
            console.warn("Failed to insert location tracking point:", error.message);
          } else {
            console.log(`📡 Logged location point: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        } catch (err) {
          console.warn("Error inserting location tracking point:", err);
        }
      } catch (gpsErr) {
        console.warn("GPS capture failed for automated tracking:", gpsErr);
      }
    };

    // Log immediately on start
    trackLocation();
    
    const interval = setInterval(trackLocation, 30000);
    return () => {
      console.log("📡 Stopping automated location tracking.");
      clearInterval(interval);
    };
  }, [id, ticket?.status, ticket?.current_phase]);


  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name, role, phone').eq('id', user.id).single()
        .then(({ data }) => {
          const name = (data as any)?.full_name || '';
          setCurrentUserFullName(name);
        });
    }
  }, [user?.id]);

  // Session persistence for PIR/Resolution drafts
  useEffect(() => {
    if (!ticket?.id) return;
    const storageKey = `complaint-draft-${ticket.id}`;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.pirFindings && !pirFindings) setPirFindings(draft.pirFindings);
        if (draft.resolutionNote && !resolutionNote) setResolutionNote(draft.resolutionNote);
        if (draft.pirSeverityInput && !pirSeverityInput) setPirSeverityInput(draft.pirSeverityInput);
        if (draft.supSeverityInput && !supSeverityInput) setSupSeverityInput(draft.supSeverityInput);
        if (draft.targetDurationInput && !targetDurationInput) setTargetDurationInput(draft.targetDurationInput);
      }
    } catch {
      // ignore corrupt draft
    }
  }, [ticket?.id]);

  useEffect(() => {
    if (!ticket?.id) return;
    const storageKey = `complaint-draft-${ticket.id}`;
    const draft = {
      pirFindings,
      resolutionNote,
      pirSeverityInput,
      supSeverityInput,
      targetDurationInput,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }, [pirFindings, resolutionNote, pirSeverityInput, supSeverityInput, targetDurationInput, ticket?.id]);

  const clearComplaintDraft = () => {
    if (!ticket?.id) return;
    const storageKey = `complaint-draft-${ticket.id}`;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (ticket) {
      setResolutionNote(prev => prev || ticket.resolution || "");
      setPirFindings(prev => prev || ticket.pir_findings || "");
      setPirAudioUrl(prev => prev || ticket.pir_audio_url || "");
      setPirEvidenceUrls(prev => prev.length > 0 ? prev : (ticket.technician_evidence || []));
      setResolutionEvidenceUrls(prev => prev.length > 0 ? prev : []);
      setEvidenceUrls(prev => prev.length > 0 ? prev : (ticket.technician_evidence || []));
      
      if (ticket.pir_findings_severity) setPirSeverityInput(ticket.pir_findings_severity);
      if (ticket.supervisor_severity) setSupSeverityInput(ticket.supervisor_severity);
      if (ticket.target_duration_hours) setTargetDurationInput(String(ticket.target_duration_hours));
      
      if (ticket) {
        const effPhase = getEffectivePhase(ticket);
        setActivePhase(effPhase);
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
      // 1. Direct phone on ticket if walk-in or stored
      if (ticket?.customer_phone) {
        setCustomerPhone(ticket.customer_phone);
        return;
      }
      // 2. Profile phone if linked
      if (ticket?.customer_id) {
        try {
          const { data } = await supabase.from('profiles').select('phone').eq('id', ticket.customer_id).maybeSingle();
          if (data?.phone) {
            setCustomerPhone(data.phone);
            return;
          }
        } catch (err) {
          // ignore
        }
        try {
          const { data: cust } = await supabase.from('customers').select('phone').eq('id', ticket.customer_id).maybeSingle();
          if (cust?.phone) {
            setCustomerPhone(cust.phone);
            return;
          }
        } catch (err) {
          // ignore
        }
      }
      if (ticket?.profiles?.phone) {
        setCustomerPhone(ticket.profiles.phone);
        return;
      }
      if (ticket?.customer_name && ticket.customer_name.match(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)) {
        setCustomerPhone(ticket.customer_name);
      }
    };
    fetchCustomerPhone();
  }, [ticket?.customer_id, ticket?.customer_phone, ticket?.customer_name, ticket?.profiles?.phone]);

  useEffect(() => {
    if (!ticket?.target_end_time) return;
    const updateTimer = () => {
      const end = new Date(ticket.target_end_time).getTime();
      const now = new Date().getTime();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Target Time Passed");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${mins}m ${secs}s remaining`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [ticket?.target_end_time]);

  useEffect(() => {
    if (!id) return;
    if (import.meta.env.DEV) {
      console.log(`📡 Setting up realtime subscription for complaint: ${id}`);
    }
    
    // Realtime updates are disabled to prevent WebSocket 403 errors
    // If you need realtime updates, set REALTIME_ENABLED to true
    const REALTIME_ENABLED = false;
    if (!REALTIME_ENABLED) {
      return;
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
            const oldLat = payload.old?.arrival_lat;
            const newLat = payload.new?.arrival_lat;
            const oldLng = payload.old?.arrival_lng;
            const newLng = payload.new?.arrival_lng;
            const isCoordUpdate = oldLat !== newLat || oldLng !== newLng;
            if (!isCoordUpdate) {
              toast.info(`Ticket has been updated`);
            }
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

  // Live GPS tracking of the technician while in transit
  useEffect(() => {
    if (!ticket || !isRole("technician") || ticket.status !== 'in-progress' || ticket.current_phase !== 4 || ticket.arrival_timestamp) {
      return;
    }

    let watchId: number | null = null;

    const startWatching = () => {
      if (!navigator.geolocation) return;

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await supabase
              .from('complaints')
              .update({
                arrival_lat: latitude,
                arrival_lng: longitude
              })
              .eq('id', ticket.id);
          } catch (err) {
            console.error("Failed to update live coordinates:", err);
          }
        },
        (error) => {
          console.warn("Live GPS watch error:", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    };

    startWatching();

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [ticket?.id, ticket?.status, ticket?.current_phase, ticket?.arrival_timestamp, isRole]);

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
        setUploadProgressText(`Optimizing image (${(file.size / 1024).toFixed(0)}KB)...`);
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
      } else if (file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv|3gp)$/i.test(file.name)) {
        try {
          fileToUpload = await compressVideoForUpload(file, (prog) => {
            setUploadProgressText(prog.message);
          });
        } catch (err) {
          console.warn('Video compression failed, using original:', err);
        }
      }

      // Enforce 50MB file upload limit to prevent Supabase timeout/size limit rejection
      if (fileToUpload.size > 50 * 1024 * 1024) {
        toast.error(`File is ${(fileToUpload.size / 1024 / 1024).toFixed(1)}MB. Supabase limit is 50MB. Please choose a smaller file.`);
        throw new Error("File size exceeds 50MB limit");
      }

      setUploadProgressText(`Uploading ${(fileToUpload.size / (1024 * 1024)).toFixed(1)}MB to cloud...`);
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('complaint-media')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileToUpload.type || (fileExt === 'mp4' ? 'video/mp4' : fileExt === 'webm' ? 'video/webm' : undefined)
        });
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
      setUploadProgressText("");
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
    return new Promise(async (resolve) => {
      let resolved = false;
      const timer = setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          try {
            const ipGps = await fetchIPCoordinates();
            resolve(ipGps);
          } catch {
            resolve(null);
          }
        }
      }, 3500);

      if (!navigator.geolocation) {
        clearTimeout(timer);
        try {
          const ipGps = await fetchIPCoordinates();
          resolve(ipGps);
        } catch {
          resolve(null);
        }
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          }
        },
        async () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            try {
              const ipGps = await fetchIPCoordinates();
              resolve(ipGps);
            } catch {
              resolve(null);
            }
          }
        },
        { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
      );
    });
  };

  const updateMutation = useMutation({
    mutationFn: (updates: any) => complaintService.update(id!, updates),
    onSuccess: (data: any) => {
      if (data) {
        queryClient.setQueryData(['complaint', id], (prev: any) => ({
          ...(prev || {}),
          ...data,
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
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

  const isCustomer = isRole("customer");
  const isAdmin = isRole("admin");
  const isSupervisor = isRole("supervisor");
  const isTechnician = isRole("technician");
  const isSupervisorOrAdmin = isRole("supervisor", "admin");

  // Multi-technician & Lead Technician calculations (Strict RBAC)
  const leadTechnicianObj = ticket.complaint_technicians?.find((ct: any) => ct.is_lead);
  const leadTechnicianName = leadTechnicianObj?.technician?.full_name || technicianName || "Lead Technician";

  const userAssignment = ticket.complaint_technicians?.find((ct: any) => ct.technician_id === user?.id);
  const hasJunctionData = Boolean(ticket.complaint_technicians && ticket.complaint_technicians.length > 0);

  const isAssignedTechnician = isTechnician && (
    hasJunctionData
      ? (Boolean(userAssignment) || ticket.assigned_to === user?.id || (Boolean(currentUserFullName) && currentUserFullName === technicianName))
      : (ticket.assigned_to === user?.id || (Boolean(currentUserFullName) && currentUserFullName === technicianName) || !ticket.assigned_to)
  );

  const isLeadTechnician = isTechnician && (
    hasJunctionData
      ? (userAssignment?.is_lead === true || (!ticket.complaint_technicians?.some((ct: any) => ct.is_lead) && ticket.complaint_technicians?.[0]?.technician_id === user?.id) || ticket.assigned_to === user?.id || (Boolean(currentUserFullName) && currentUserFullName === technicianName))
      : (ticket.assigned_to === user?.id || (Boolean(currentUserFullName) && currentUserFullName === technicianName) || !ticket.assigned_to)
  );

  const isAssistingTechnician = isTechnician && !isLeadTechnician && isAssignedTechnician;

  const assignedTechBadges = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
    ? ticket.complaint_technicians.map((ct: any) => ({
        id: ct.technician_id,
        name: ct.technician?.full_name || ct.technician_id,
        is_lead: Boolean(ct.is_lead),
      }))
    : (technicianName ? [{ id: ticket.assigned_to || "1", name: technicianName, is_lead: true }] : []);

  const assignedTechNames = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
    ? ticket.complaint_technicians.map((ct: any) => {
        const name = ct.technician?.full_name || ct.technician_id;
        return ct.is_lead ? `${name} (Lead)` : name;
      }).filter(Boolean).join(", ")
    : (technicianName || null);
  const isPirApproved = 
    Boolean(ticket.pir_findings) ||
    ticket.pir_status === "approved" ||
    ticket.status === "pir_approved" ||
    ticket.status === "pir_approved_work_in_progress" ||
    ticket.current_phase >= 5 ||
    Boolean(ticket.pir_approved_at);

  const isPirRevisionRequested = false;
  const isPirSubmittedAndAwaiting = false;

  const currentPhase = getEffectivePhase(ticket);

  const canVerify = isSupervisorOrAdmin &&
    (ticket.status === "completed" || ticket.status === "Resolution & Sign-off" || ticket.status === "awaiting_signoff" || currentPhase === 6 || ticket.status === "closed");

  const canEdit = isRole("admin", "supervisor");

  const canReassign = () => {
    if (!ticket) return false;
    if (!isRole("admin", "supervisor")) return false;
    
    const isClosed = ticket.status === 'closed' || ticket.status === 'Closed' || ticket.status === 'Resolved' || ticket.status === 'resolved' || Boolean(ticket.closed_at) || Boolean(ticket.closure_timestamp);
    if (!isClosed) return true;
    
    // For verified tickets, allow reassignment within 48 hours from the closure timestamp onwards
    const closedDateStr = ticket.closed_at || ticket.closure_timestamp || ticket.feedback_timestamp || ticket.updated_at;
    if (!closedDateStr) return true;
    
    const closedDate = new Date(closedDateStr).getTime();
    if (isNaN(closedDate)) return true;
    
    const now = Date.now();
    const hoursSinceClosed = (now - closedDate) / (1000 * 60 * 60);
    return hoursSinceClosed <= 48;
  };

  const getReassignRemainingHours = (): number | null => {
    if (!ticket) return null;
    const isClosed = ticket.status === 'closed' || ticket.status === 'Closed' || ticket.status === 'Resolved' || ticket.status === 'resolved' || Boolean(ticket.closed_at) || Boolean(ticket.closure_timestamp);
    if (!isClosed) return null;
    const closedDateStr = ticket.closed_at || ticket.closure_timestamp || ticket.feedback_timestamp || ticket.updated_at;
    if (!closedDateStr) return 48;
    const closedDate = new Date(closedDateStr).getTime();
    if (isNaN(closedDate)) return null;
    const now = Date.now();
    const hoursSinceClosed = (now - closedDate) / (1000 * 60 * 60);
    if (hoursSinceClosed > 48) return null;
    return Math.max(0, Math.round((48 - hoursSinceClosed) * 10) / 10);
  };

  const handleConfirmReassign = async () => {
    if (!reassignReason.trim() || reassignReason.trim().length < 10) {
      toast.error("Reassignment reason must be at least 10 characters.");
      return;
    }
    if (reassignSelectedTechs.length === 0) {
      toast.error("Please select at least one technician.");
      return;
    }
    if (!reassignLeadTechId || !reassignSelectedTechs.includes(reassignLeadTechId)) {
      toast.error("Please designate exactly one Lead Technician (click the Crown icon 👑).");
      return;
    }

    setIsReassigning(true);
    try {
      const techPayload = reassignSelectedTechs.map((tid) => ({
        technician_id: tid,
        is_lead: tid === reassignLeadTechId,
      }));

      await complaintService.reassignTechnicians(ticket.id, techPayload, reassignReason);

      // 🔔 WhatsApp Dispatch on Reassignment
      const recipientPhone = customerPhone || ticket.customer_phone || ticket.profiles?.phone;
      const recipientName = ticket.customer_name || ticket.profiles?.full_name || "Customer";
      const leadTechObj = allTechnicians.find((t: any) => t.id === reassignLeadTechId);
      const leadName = leadTechObj?.full_name || "New Field Technician";
      const slicedId = formatComplaintTicketId(ticket);

      if (recipientPhone) {
        try {
          await supabase.functions.invoke('send-walkin-whatsapp', {
            body: {
              phone: recipientPhone,
              name: recipientName,
              ticketId: slicedId,
              technicianName: leadName,
              date: ticket.scheduled_date || "the scheduled date",
              time: ticket.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "",
              event_type: "reassignment"
            }
          });
        } catch (waErr) {
          console.warn("Reassign WhatsApp dispatch skipped:", waErr);
        }
      }

      toast.success("Technicians reassigned successfully! Status set to Assigned.");
      setShowReassignModal(false);
      setReassignReason("");
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign technicians");
    } finally {
      setIsReassigning(false);
    }
  };

  const handleConfirmFieldVisit = async () => {
    if (fieldVisitSelectedTechs.length === 0) {
      toast.error("Please select at least one technician.");
      return;
    }
    if (!fieldVisitLeadTechId || !fieldVisitSelectedTechs.includes(fieldVisitLeadTechId)) {
      toast.error("Please designate exactly one Lead Technician (click the Crown icon 👑).");
      return;
    }
    if (!fieldVisitScheduledDate) {
      toast.error("Scheduled Date is required for field visit assignment.");
      return;
    }
    if (!fieldVisitScheduledTime) {
      toast.error("Scheduled Time is required for field visit assignment.");
      return;
    }

    setIsAssigningFieldVisit(true);
    try {
      const techPayload = fieldVisitSelectedTechs.map((tid) => ({
        technician_id: tid,
        is_lead: tid === fieldVisitLeadTechId,
      }));

      await complaintService.assignFieldVisitTechnicians(
        ticket.id,
        techPayload,
        fieldVisitScheduledDate,
        fieldVisitScheduledTime,
        fieldVisitSupervisorNotes
      );

      const slicedId = formatComplaintTicketId(ticket);
      const leadTechObj = allTechnicians.find((t: any) => t.id === fieldVisitLeadTechId);
      const leadName = leadTechObj?.full_name || "Lead Technician";

      // Send notifications to each assigned technician
      for (const tech of techPayload) {
        const isLead = tech.is_lead;
        const roleTitle = isLead ? "👑 Lead Technician" : "Team Member";
        await notificationService.insertNotification(
          tech.technician_id,
          ticket.id,
          "info",
          "🚐 Field Visit Assigned",
          `You are assigned as ${roleTitle} for Complaint #${slicedId}. Lead: ${leadName}. Scheduled: ${fieldVisitScheduledDate} ${fieldVisitScheduledTime}.`,
          3,
          undefined,
          user?.id
        );
      }

      const adminIds = await notificationService.getAdminUserIds();
      await notificationService.insertNotification(
        adminIds,
        ticket.id,
        "info",
        "🚐 Field Visit Dispatched",
        `Complaint #${slicedId} dispatched to ${fieldVisitSelectedTechs.length} technician(s). Lead: ${leadName}.`,
        3,
        undefined,
        user?.id
      );

      if (ticket.customer_id) {
        await notificationService.insertNotification(
          ticket.customer_id,
          ticket.id,
          "info",
          "🚐 Technician Dispatched",
          `Technician team dispatched for Complaint #${slicedId}. Lead technician: ${leadName}.`,
          3,
          undefined,
          user?.id
        );
      }

      // 🔔 Stage 3: Automated WhatsApp on Field Visit Scheduled
      const recipientPhone = getCustomerPhone(ticket) || customerPhone;
      const recipientName = getCustomerName(ticket);
      const scheduledDateStr = fieldVisitScheduledDate || ticket.scheduled_date || "the scheduled date";
      const scheduledTimeStr = fieldVisitScheduledTime || (ticket.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00 AM");

      if (recipientPhone) {
        try {
          const visitMsg = getFieldVisitScheduledMessage({
            customerName: recipientName,
            technicianName: leadName,
            ticketId: slicedId,
            scheduledDate: scheduledDateStr,
            scheduledTime: scheduledTimeStr,
          });
          await sendWhatsAppMessage(recipientPhone, visitMsg, {
            name: recipientName,
            ticketId: slicedId,
            technicianName: leadName,
            date: scheduledDateStr,
            time: scheduledTimeStr,
            event_type: "field_visit_scheduled",
          });
          console.log("✅ Stage 3: Field Visit Scheduled WhatsApp sent successfully");
        } catch (waErr) {
          console.warn("Stage 3: Field Visit WhatsApp dispatch skipped:", waErr);
        }
      }

      toast.success("Field visit scheduled and technicians assigned successfully!");
      setShowFieldVisitModal(false);
      queryClient.invalidateQueries({ queryKey: ["complaint", id] });
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      refetch();
    } catch (err: any) {
      console.error("Field visit assignment failed:", err);
      toast.error(err.message || "Failed to assign field visit technicians");
    } finally {
      setIsAssigningFieldVisit(false);
    }
  };

  const canTechnicianAct = (
    (isRole("technician") && isAssignedTechnician) ||
    isSupervisorOrAdmin
  ) &&
    ticket.status !== "verified" &&
    ticket.status !== "Closed" &&
    (currentPhase === 3 || currentPhase === 4 || currentPhase === 5 || currentPhase === 6);

  const getCleanSupervisorNotes = (rawNotes?: string | null) => {
    if (!rawNotes) return "";
    return rawNotes
      .replace(/\[Reverted (to|back to) Phase 2[^\]]*\](:[^\n]*)?/gi, "")
      .trim();
  };

  const isVideoUrl = (url?: string | null): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.ogg') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.endsWith('.quicktime') ||
      cleanUrl.endsWith('.avi') ||
      cleanUrl.endsWith('.mkv') ||
      cleanUrl.endsWith('.3gp') ||
      url.includes('video')
    );
  };

  const handleTriageDecision = async (outcome: 'remote_fixed' | 'field_required') => {
    if (outcome === 'remote_fixed') {
      setPendingRemoteResolution('remote_fixed');
      setRemoteResolutionNotes("");
      setShowRemoteResolutionModal(true);
      return;
    }

    if (outcome === 'field_required') {
      const initialIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
        ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
        : (ticket.assigned_to ? [ticket.assigned_to] : []);
      setFieldVisitSelectedTechs(initialIds);
      const initialLead = ticket.complaint_technicians?.find((ct: any) => ct.is_lead)?.technician_id || initialIds[0] || null;
      setFieldVisitLeadTechId(initialLead);
      setFieldVisitScheduledDate(ticket.scheduled_date || new Date().toISOString().split("T")[0]);
      setFieldVisitScheduledTime(ticket.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00");
      setFieldVisitSupervisorNotes(getCleanSupervisorNotes(ticket.supervisor_notes));
      setShowFieldVisitModal(true);
      return;
    }
  };

  const handleRemoteResolutionSave = async () => {
    if (!remoteResolutionNotes.trim()) {
      toast.error("Please describe how the issue was resolved remotely.");
      return;
    }

    const adminIds = await notificationService.getAdminUserIds();
    const slicedId = formatComplaintTicketId(ticket);
    const supervisorDisplayName = currentUserFullName || ticket.assigned_supervisor || 'Supervisor';

    try {
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
    } catch (notificationError) {
      console.warn("Notification failed, continuing with save:", notificationError);
    }

    const now = new Date().toISOString();
    const generatedHpCode = ticket.happiness_code || Math.floor(10000 + Math.random() * 90000).toString();

    updateMutation.mutate({
      status: 'completed',
      current_phase: 6,
      triage_outcome: 'remote_fixed',
      resolution: remoteResolutionNotes.trim(),
      resolution_notes: remoteResolutionNotes.trim(),
      resolved_remotely: true,
      resolution_type: 'telephonic_triage',
      resolved_at: now,
      resolved_by: user?.id || null,
      happiness_code: generatedHpCode,
      happiness_code_sent_at: now,
      happiness_code_verified: false,
    } as any, {
      onSuccess: () => {
        setShowRemoteResolutionModal(false);
        setPendingRemoteResolution(null);
        setRemoteResolutionNotes("");
        toast.success("Remote resolution saved & Happiness Code generated successfully.");

        // 🔔 Stage 2: Automated WhatsApp on Remote Resolution
        const recipientPhone = getCustomerPhone(ticket) || customerPhone;
        const recipientName = getCustomerName(ticket);
        if (recipientPhone) {
          const remoteMsg = getRemoteResolutionMessage({
            customerName: recipientName,
            ticketId: slicedId,
            happinessCode: generatedHpCode,
          });
          sendWhatsAppMessage(recipientPhone, remoteMsg, {
            name: recipientName,
            ticketId: slicedId,
            happiness_code: generatedHpCode,
            event_type: "remote_resolution",
          }).catch((err) => console.warn("Stage 2: WhatsApp remote resolution dispatch skipped:", err));
        }
      },
      onError: (error: any) => {
        console.error("Failed to save remote resolution:", error);
        toast.error(error?.message || "Failed to save remote resolution.");
      }
    });
  };

  const handleRevertBackToPhase2 = async () => {
    setIsRevertingPhase2(true);
    try {
      const supervisorDisplayName = user?.name || user?.email || "Supervisor";

      await updateMutation.mutateAsync({
        status: 'assigned',
        current_phase: 2,
        triage_outcome: null,
        resolved_remotely: false,
        resolution: null,
        resolution_notes: null,
        resolved_at: null,
        resolved_by: null,
        supervisor_notes: null, // Reset completely fresh for supervisor to enter new diagnostic notes
      } as any);

      // Notify in background
      void (async () => {
        try {
          const slicedId = ticket.id.slice(0, 8);
          const adminIds = await notificationService.getAdminUserIds();
          await notificationService.insertNotification(
            adminIds,
            ticket.id,
            'warning',
            '🔄 Ticket Reverted to Phase 2',
            `Ticket #${slicedId} was reverted back to Phase 2 (Telephonic Triage) by ${supervisorDisplayName}.`,
            2,
            undefined,
            user?.id
          );
        } catch (e) {
          console.warn("Revert notification failed:", e);
        }
      })();

      setShowRevertPhase2Modal(false);
      setFieldVisitSupervisorNotes("");
      toast.success("Ticket successfully reverted back to Phase 2 (Telephonic Triage).");
    } catch (error: any) {
      console.error("Failed to revert ticket to Phase 2:", error);
      toast.error(error?.message || "Failed to revert ticket to Phase 2.");
    } finally {
      setIsRevertingPhase2(false);
    }
  };

  const handleStartJourney = async () => {
    if (!isLeadTechnician) {
      toast.error(`⚠️ Only the Lead Technician (${leadTechnicianName}) can start the journey.`);
      return;
    }
    setIsDetectingGps(true);
    setDetectedCoords(null);
    setTypedStartLocation("");

    try {
      const gps = await verifyGPS();
      setIsDetectingGps(false);
      if (gps) {
        // Distance check:
        if (ticket.customer_lat && ticket.customer_lng) {
          const dist = calculateDistance(gps.lat, gps.lng, Number(ticket.customer_lat), Number(ticket.customer_lng));
          if (dist > 50) {
            const isConfirmed = window.confirm(`Target destination is more than 50km away (${dist.toFixed(1)}km). Are you sure you are traveling to the correct site?`);
            if (!isConfirmed) {
              return;
            }
          }
        }
        await confirmStartJourneyWithCoords(gps.lat, gps.lng);
      } else {
        toast.error("GPS location access is required to start your journey");
      }
    } catch (e) {
      console.warn("GPS detection failed:", e);
      setIsDetectingGps(false);
      toast.error("GPS location access is required to start your journey");
    }
  };

  const confirmStartJourneyWithCoords = async (lat: number, lng: number) => {
    const startLocJson = JSON.stringify({ lat, lng });

    const destination = (ticket.customer_lat && ticket.customer_lng)
      ? `${ticket.customer_lat},${ticket.customer_lng}`
      : ticket.location ? encodeURIComponent(ticket.location) : null;

    if (destination) {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destination}&travelmode=driving`;
      window.open(mapsUrl, '_blank');
      toast.success("🗺️ Opening navigation to customer location...");
    } else {
      toast.warning("📍 Customer location address not available, starting journey anyway...");
    }

    try {
      await supabase.from("location_tracking").insert({
        complaint_id: ticket.id,
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        timestamp: new Date().toISOString()
      });
      console.log("Recorded start location in location_tracking");
    } catch (dbErr) {
      console.warn("Failed to record journey start location in tracking table:", dbErr);
    }

    await saveJourneyStart(startLocJson);
  };

  // Robust GPS arrival capture for technicians marking "I Arrived"
  const handleArrivedGPS = async () => {
    if (!isLeadTechnician) {
      toast.error(`⚠️ Only the Lead Technician (${leadTechnicianName}) can mark arrival.`);
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsCapturingArrivalGps(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            switch(error.code) {
              case error.PERMISSION_DENIED:
                reject(new Error('Please allow GPS access in your browser settings'));
                break;
              case error.POSITION_UNAVAILABLE:
                reject(new Error('Location information is unavailable'));
                break;
              case error.TIMEOUT:
                reject(new Error('GPS request timed out. Please try again.'));
                break;
              default:
                reject(new Error('An unknown error occurred while capturing GPS'));
            }
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });

      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setArrivalCoords(coords);

      const nowIso = new Date().toISOString();
      await updateMutation.mutateAsync({
        arrival_timestamp: nowIso,
        arrival_lat: coords.lat,
        arrival_lng: coords.lng,
        status: "in-progress",
        current_phase: 4
      } as any);

      toast.success(`GPS location captured successfully (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
    } catch (error) {
      console.error('GPS Error:', error);
      toast.error(error instanceof Error ? error.message : 'Could not get GPS location. Please enable location services and try again.');
    } finally {
      setIsCapturingArrivalGps(false);
    }
  };

  const confirmStartJourney = async () => {
    setShowStartJourneyModal(false);

    let startLocJson = null;
    let lat = null;
    let lng = null;

    if (typedStartLocation.trim()) {
      startLocJson = JSON.stringify({ address: typedStartLocation.trim() });
    } else if (detectedCoords) {
      lat = detectedCoords.lat;
      lng = detectedCoords.lng;
      startLocJson = JSON.stringify({ lat, lng });
    }

    if (lat && lng && ticket.customer_lat && ticket.customer_lng) {
      const dist = calculateDistance(lat, lng, Number(ticket.customer_lat), Number(ticket.customer_lng));
      if (dist > 50) {
        const isConfirmed = window.confirm(`Target destination is more than 50km away (${dist.toFixed(1)}km). Are you sure you are traveling to the correct site?`);
        if (!isConfirmed) {
          return;
        }
      }
    }

    const destination = (ticket.customer_lat && ticket.customer_lng)
      ? `${ticket.customer_lat},${ticket.customer_lng}`
      : ticket.location ? encodeURIComponent(ticket.location) : null;

    if (destination) {
      let mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      if (typedStartLocation.trim()) {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(typedStartLocation.trim())}&destination=${destination}&travelmode=driving`;
      } else if (detectedCoords) {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${detectedCoords.lat},${detectedCoords.lng}&destination=${destination}&travelmode=driving`;
      }
      window.open(mapsUrl, '_blank');
      toast.success("🗺️ Opening navigation to customer location...");
    } else {
      toast.warning("📍 Customer location address not available, starting journey anyway...");
    }

    if (lat && lng) {
      try {
        await supabase.from("location_tracking").insert({
          complaint_id: ticket.id,
          latitude: lat,
          longitude: lng,
          accuracy: 10,
          timestamp: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn("Failed to record journey start location in tracking table:", dbErr);
      }
    }

    await saveJourneyStart(startLocJson);
  };

  const saveJourneyStart = async (startLocJson: string | null) => {
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
      pir_decision_tree: startLocJson
    } as any);
  };

  const handleSubmitPIR = async () => {
    if (!isLeadTechnician) {
      toast.error(`⚠️ Only the Lead Technician (${leadTechnicianName}) can submit the PIR.`);
      return;
    }

    if (!pirFindings.trim()) {
      toast.error("Add PIR findings");
      return;
    }

    if (isSubmittingPIR) return;
    setIsSubmittingPIR(true);

    try {
      // 1. Fast GPS detection (max 3.5s timeout)
      const gps = await verifyGPS();
      const finalPirEvidence = pirEvidenceUrls.length > 0 ? pirEvidenceUrls : evidenceUrls;
      const isResubmit = Boolean(
        isPirRevisionRequested ||
        ticket.pir_status === "revision_requested" ||
        ticket.pir_status === "rejected" ||
        ticket.status === "pir_rejected" ||
        ticket.status === "PIR Revision Requested" ||
        ticket.status === "PIR Rejected"
      );

      const nowIso = new Date().toISOString();

      // 2. Perform database update immediately to advance straight to Phase 5 without supervisor approval
      await updateMutation.mutateAsync({
        pir_findings: pirFindings,
        pir_audio_url: pirAudioUrl || null,
        technician_evidence: finalPirEvidence,
        arrival_timestamp: ticket.arrival_timestamp || nowIso,
        arrival_lat: gps?.lat || ticket.arrival_lat || null,
        arrival_lng: gps?.lng || ticket.arrival_lng || null,
        current_phase: 5,
        status: "in-progress",
        pir_status: "approved",
        pir_approved_at: nowIso,
        pir_resubmitted_at: nowIso
      } as any);

      setActivePhase(5);
      setShowPIRForm(false);
      setShowResolution(true);
      toast.success("PIR submitted successfully! You can now add resolution notes.");
      clearComplaintDraft();

      // 3. Dispatch notifications in background so UI is never blocked
      (async () => {
        try {
          let supervisorId = null;
          if (ticket.assigned_supervisor) {
            const supervisorProfile = await fetchProfileByName(ticket.assigned_supervisor);
            if (supervisorProfile) supervisorId = supervisorProfile.id;
          }
          const adminIds = await notificationService.getAdminUserIds();
          const recipientIds = [ticket.customer_id, supervisorId, ...adminIds].filter(Boolean) as string[];

          await notificationService.insertNotification(
            recipientIds,
            ticket.id,
            'info',
            '📋 PIR Submitted - Work In Progress',
            `PIR diagnostic submitted for Ticket #${ticket.id.slice(0, 8)} by ${ticket.assigned_technician || currentUserFullName}. Work is now in progress.`,
            5,
            undefined,
            user?.id
          );
        } catch (bgErr) {
          console.warn("Background PIR notification dispatch failed:", bgErr);
        }
      })();
    } catch (err: any) {
      console.error("Submit PIR failed:", err);
      toast.error(err.message || "Failed to submit PIR");
    } finally {
      setIsSubmittingPIR(false);
    }
  };

  const handleSaveResolution = async () => {
    if (!isLeadTechnician) {
      toast.error(`⚠️ Only the Lead Technician (${leadTechnicianName}) can save resolution.`);
      return;
    }

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
      resolution: resolutionNote,
      resolution_notes: resolutionNote,
      current_phase: 5
    } as any);
    setShowResolution(false);
    setShowSignOff(true);
    toast.success("Resolution saved! Now complete the sign-off.");
    clearComplaintDraft();
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

  // Phase 4: Approve PIR by Supervisor
  const handleApprovePIR = async () => {
    if (!targetDurationInput || isNaN(Number(targetDurationInput)) || Number(targetDurationInput) <= 0) {
      toast.error("Please enter a valid target duration in hours");
      return;
    }
    setIsApprovingPir(true);
    try {
      const targetDuration = Number(targetDurationInput);
      const targetEndTime = new Date();
      targetEndTime.setHours(targetEndTime.getHours() + targetDuration);

      await updateMutation.mutateAsync({
        current_phase: 5,
        status: "pir_approved",
        pir_findings_severity: pirSeverityInput,
        supervisor_severity: supSeverityInput,
        target_duration_hours: targetDuration || null,
        pir_status: "approved",
        pir_approved_by: (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) ? user.id : null,
        pir_approved_at: new Date().toISOString(),
        target_end_time: targetEndTime.toISOString()
      } as any);

      setActivePhase(5);

      // Trigger notification to Lead & Assigned Technicians safely
      try {
        let technicianId = null;
        if (ticket.assigned_technician) {
          const technicianProfile = await fetchProfileByName(ticket.assigned_technician);
          if (technicianProfile) technicianId = technicianProfile.id;
        }
        if (ticket.assigned_to) {
          technicianId = ticket.assigned_to;
        }

        const techIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
          ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
          : (technicianId ? [technicianId] : []);

        if (techIds.length > 0) {
          await notificationService.insertNotification(
            techIds,
            ticket.id,
            'success',
            '✅ PIR Approved by Supervisor',
            `PIR approved for Ticket #${ticket.id.slice(0, 8)}. Target time: ${targetDurationInput} hours. Proceed with resolution and sign-off.`,
            5,
            undefined,
            user?.id
          );
        }
      } catch (notifErr) {
        console.warn("Could not dispatch approval notification:", notifErr);
      }

      toast.success("PIR verified & approved! Complaint moved to Phase 5: Resolution & Sign-off.");
    } catch (err: any) {
      console.error("Failed to approve PIR:", err);
      toast.error(err?.message || "Failed to approve PIR");
    } finally {
      setIsApprovingPir(false);
    }
  };

  // Phase 4: Request More Info on PIR and Send Back to Lead Technician
  const handleConfirmRejectPir = async () => {
    if (!pirRejectReason.trim()) {
      toast.error("Please provide the required details or missing information");
      return;
    }
    setIsRejectingPir(true);
    try {
      const trimmedNotes = pirRejectReason.trim();
      const currentUserId = (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) ? user.id : null;

      await updateMutation.mutateAsync({
        current_phase: 3,
        status: "pir_rejected",
        pir_status: "revision_requested",
        pir_revision_notes: trimmedNotes,
        pir_revision_requested_by: currentUserId,
        pir_revision_requested_at: new Date().toISOString(),
        pir_resubmitted_at: null,
        reassignment_reason: trimmedNotes
      } as any);

      let technicianId = null;
      if (ticket.assigned_technician) {
        const technicianProfile = await fetchProfileByName(ticket.assigned_technician);
        if (technicianProfile) technicianId = technicianProfile.id;
      }
      if (ticket.assigned_to) {
        technicianId = ticket.assigned_to;
      }

      const techIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
        ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
        : (technicianId ? [technicianId] : []);

      if (techIds.length > 0) {
        await notificationService.insertNotification(
          techIds,
          ticket.id,
          'warning',
          'ℹ️ Additional PIR Info Requested',
          `Supervisor requested more information on Ticket #${ticket.id.slice(0, 8)}. Note: ${pirRejectReason.trim()}`,
          3,
          undefined,
          user?.id
        );
      }
      setShowPirRejectModal(false);
      setPirRejectReason("");
      setActivePhase(3);
      toast.success("Request for more info sent to technician! Complaint returned to Phase 3.");
    } catch (err: any) {
      console.error("Failed to request more info on PIR:", err);
      toast.error(err?.message || "Failed to send request");
    } finally {
      setIsRejectingPir(false);
    }
  };

  const handleRequestRevisionPIR = async () => {
    setShowPirRejectModal(true);
  };

  // Phase 5: Complete Sign-Off by Lead Technician
  const handleFinalSignOff = async () => {
    if (!isLeadTechnician) {
      toast.error(`⚠️ Only the Lead Technician (${leadTechnicianName}) can submit the final resolution and customer sign-off.`);
      return;
    }

    if (!resolutionNote.trim()) {
      toast.error("Please provide final resolution notes describing the work done. This field is mandatory.");
      return;
    }

    // Validate signature is provided BEFORE starting submission
    const isCanvasNotEmpty = sigRef.current ? !sigRef.current.isEmpty() : false;
    const isDrawn = signatureMode === "draw" && (isCanvasNotEmpty || hasDrawnSignature);
    const isUploaded = signatureMode === "upload" && Boolean(uploadedSignatureUrl);
    if (!isDrawn && !isUploaded) {
      toast.error("⚠️ Customer signature is mandatory. Please draw or upload the customer's signature before submitting.");
      return;
    }

    if (isSubmittingSignOff) return;
    setIsSubmittingSignOff(true);

    try {
      let signatureUrl = null;
      if (signatureMode === "draw") {
        if (!sigRef.current || sigRef.current.isEmpty()) {
          toast.error("Please draw the customer signature in the canvas.");
          setIsSubmittingSignOff(false);
          return;
        }
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
        setIsSubmittingSignOff(false);
        return;
      }

      // Auto-generate random 5-digit Happiness Code (e.g. 32333)
      const generatedHappinessCode = Math.floor(10000 + Math.random() * 90000).toString();

      await updateMutation.mutateAsync({
        status: "completed",
        current_phase: 6,
        resolution: resolutionNote.trim(),
        signature_url: signatureUrl,
        technician_evidence: resolutionEvidenceUrls.length > 0 ? resolutionEvidenceUrls : null,
        signoff_timestamp: new Date().toISOString(),
        happiness_code: generatedHappinessCode,
        happiness_code_sent_at: new Date().toISOString(),
        happiness_code_verified: false
      } as any);

      setShowResolution(false);
      toast.success("✅ Sign-off complete & Happiness Code sent to customer! Moved to Phase 6 QA Verification.");

      // Background notifications & WhatsApp dispatch so UI is never blocked
      (async () => {
        try {
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
            'status_change',
            '✅ Resolution Submitted',
            `Ticket #${formatComplaintTicketId(ticket)} has been resolved by Lead Technician ${leadTechnicianName}. Pending supervisor QA verification.`,
            6,
            undefined,
            user?.id
          );

          // 🔔 Stage 4: Automated WhatsApp on Technician Sign-Off
          const recipientPhone = getCustomerPhone(ticket) || customerPhone;
          const recipientName = getCustomerName(ticket);
          const slicedId = formatComplaintTicketId(ticket);

          if (recipientPhone) {
            const signOffMsg = getTechnicianSignOffMessage({
              customerName: recipientName,
              ticketId: slicedId,
              happinessCode: generatedHappinessCode,
            });
            await sendWhatsAppMessage(recipientPhone, signOffMsg, {
              name: recipientName,
              ticketId: slicedId,
              event_type: "technician_signoff",
              happiness_code: generatedHappinessCode,
            });
            console.log("✅ Stage 4: Technician Sign-Off WhatsApp sent successfully");
          }
        } catch (bgErr) {
          console.warn("Background notification/WhatsApp error:", bgErr);
        }
      })();
    } catch (err: any) {
      console.error("Failed to complete sign-off:", err);
      toast.error(err?.message || "Failed to submit sign-off");
    } finally {
      setIsSubmittingSignOff(false);
    }
  };

  // Phase 6 Return for Rework Handlers
  const handleOpenReworkModal = () => {
    const currentIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
      ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
      : (ticket.assigned_to ? [ticket.assigned_to] : []);
    const currentLead = ticket.complaint_technicians?.find((ct: any) => ct.is_lead)?.technician_id || currentIds[0] || null;
    setReworkSelectedTechs(currentIds);
    setReworkLeadTechId(currentLead);
    setReworkScheduledDate(ticket.scheduled_date || new Date().toISOString().split("T")[0]);
    setReworkScheduledTime(ticket.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00");
    setReworkInstructions(verificationNote || "");
    setReworkTargetPhase(3);
    setShowReworkModal(true);
  };

  const handleConfirmRework = async () => {
    if (!reworkScheduledDate) {
      toast.error("Please specify a new scheduled date for rework");
      return;
    }
    if (!reworkInstructions.trim()) {
      toast.error("Please provide rework instructions for the technicians");
      return;
    }
    if (reworkSelectedTechs.length === 0) {
      toast.error("Please select at least one technician for the rework assignment");
      return;
    }

    const leadId = reworkLeadTechId || reworkSelectedTechs[0];
    const leadProfile = allTechnicians.find((t: any) => t.id === leadId);
    const leadName = leadProfile?.full_name || "Lead Technician";

    setIsSubmittingRework(true);
    try {
      await updateMutation.mutateAsync({
        status: "assigned",
        current_phase: reworkTargetPhase,
        scheduled_date: reworkScheduledDate,
        scheduled_time: reworkScheduledTime,
        assigned_to: leadId,
        assigned_technician: leadName,
        reassignment_reason: reworkInstructions.trim(),
        supervisor_notes: `[Rework Required - Phase ${reworkTargetPhase}] ${reworkInstructions.trim()}`,
        happiness_code: null,
        happiness_code_sent_at: null,
        happiness_code_verified: false,
        feedback_collected: false,
        // Preserve previous customer feedback and resolution notes for reference until new ones are collected
        signature_url: null,
        technician_evidence: null,
        signoff_timestamp: null
      } as any);

      try {
        await supabase.from("complaint_technicians").delete().eq("complaint_id", ticket.id);
        const newRows = reworkSelectedTechs.map(tid => ({
          complaint_id: ticket.id,
          technician_id: tid,
          is_lead: tid === leadId,
          phase: reworkTargetPhase,
          assigned_at: new Date().toISOString()
        }));
        await supabase.from("complaint_technicians").insert(newRows);
      } catch (e) {
        console.warn("Could not update complaint_technicians junction on rework:", e);
      }

      await notificationService.insertNotification(
        reworkSelectedTechs,
        ticket.id,
        'warning',
        '⚠️ Ticket Returned for Rework',
        `Ticket #${formatComplaintTicketId(ticket)} returned for rework to Phase ${reworkTargetPhase}. Scheduled: ${reworkScheduledDate} at ${reworkScheduledTime}. Notes: ${reworkInstructions.trim()}`,
        reworkTargetPhase,
        undefined,
        user?.id
      );

      if (ticket.customer_id) {
        await notificationService.insertNotification(
          ticket.customer_id,
          ticket.id,
          'info',
          '🔧 Service Rework Scheduled',
          `Your service ticket #${formatComplaintTicketId(ticket)} has been scheduled for follow-up rework on ${reworkScheduledDate} at ${reworkScheduledTime}.`,
          reworkTargetPhase,
          undefined,
          user?.id
        );
      }

      setShowReworkModal(false);
      setVerificationNote("");
      toast.success(`Ticket returned for rework to Phase ${reworkTargetPhase} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['complaint', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    } catch (err: any) {
      console.error("Failed to return ticket for rework:", err);
      toast.error(err?.message || "Failed to return ticket for rework");
    } finally {
      setIsSubmittingRework(false);
    }
  };

  const handleVerifyHappinessCode = async () => {
    if (!inputHappinessCode.trim()) {
      setCodeVerificationError("Please enter the 5-digit Happiness Code");
      return;
    }
    const cleanInput = inputHappinessCode.trim();
    const cleanTarget = (ticket.happiness_code || "").toString().trim();

    if (!cleanTarget) {
      setCodeVerificationError("No Happiness Code found for this ticket. Ask technician or check resolution.");
      return;
    }

    if (cleanInput !== cleanTarget) {
      setCodeVerificationError("Invalid Happiness Code. Please check with the customer.");
      toast.error("Invalid Happiness Code. Please check with the customer.");
      return;
    }

    setIsVerifyingCode(true);
    setCodeVerificationError("");
    try {
      await updateMutation.mutateAsync({
        happiness_code_verified: true
      } as any);
      setCodeVerifiedLocally(true);
      toast.success("✅ Happiness Code verified successfully!");
    } catch (err: any) {
      console.error("Failed to verify happiness code:", err);
      toast.error(err?.message || "Failed to verify Happiness Code");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Force Close Complaint (Admin / Supervisor bypasses happiness code)
  const handleForceCloseTicket = async () => {
    if (!window.confirm("⚡ Confirm Force Closure of this ticket?\nThis will immediately close the complaint without requiring customer Happiness Code verification.")) {
      return;
    }
    setIsForceClosing(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: any = {
        status: "closed",
        current_phase: 6,
        closed_at: nowIso,
        closure_timestamp: nowIso,
        closed_by: currentUserFullName || user?.email || "Admin (Force Close)",
        force_closed: true
      };

      // If feedback was entered in the form, also save it alongside force closure
      if (feedbackSatisfaction) {
        payload.feedback_collected = true;
        payload.customer_satisfaction = feedbackSatisfaction;
        payload.feedback_comments = feedbackComments.trim() || undefined;
        payload.feedback_timestamp = nowIso;
        payload.feedback_contact_method = 'phone';
      }

      await updateMutation.mutateAsync(payload);

      if (ticket.customer_id) {
        await notificationService.insertNotification(
          ticket.customer_id,
          ticket.id,
          'success',
          '🎉 Ticket Closed',
          `Ticket #${formatComplaintTicketId(ticket)} has been successfully closed. Thank you for choosing Brihaspathi.`,
          6,
          undefined,
          user?.id
        );
      }

      // 🔔 WhatsApp Dispatch on Final Closure
      const recipientPhone = customerPhone || ticket.customer_phone || ticket.profiles?.phone;
      const recipientName = ticket.customer_name || ticket.profiles?.full_name || "Customer";
      const slicedId = formatComplaintTicketId(ticket);

      if (recipientPhone) {
        try {
          await supabase.functions.invoke('send-walkin-whatsapp', {
            body: {
              phone: recipientPhone,
              name: recipientName,
              ticketId: slicedId,
              event_type: "closure",
              message: `Dear Customer, your complaint ${slicedId} is successfully closed. Thank you for choosing Brihaspathi Technologies!`
            }
          });
          console.log("✅ Final Closure WhatsApp sent successfully");
        } catch (waErr) {
          console.warn("Closure WhatsApp dispatch skipped:", waErr);
        }
      }

      toast.success("⚡ Ticket Force Closed successfully without Happiness Code!");
    } catch (err: any) {
      console.error("Failed to force close ticket:", err);
      toast.error(err?.message || "Failed to force close ticket");
    } finally {
      setIsForceClosing(false);
    }
  };

  // Phase 6: Final Closure / Follow-up / Rework
  const handlePhase6Finalize = async () => {
    if (phase6Action === "close") {
      if (!ticket.feedback_collected) {
        toast.error("⚠️ Please collect and record customer feedback before closing this ticket.");
        return;
      }
      if (!ticket.happiness_code_verified && !codeVerifiedLocally) {
        toast.error("⚠️ Customer Happiness Code must be verified before closing this ticket.");
        return;
      }
      if (!window.confirm("Confirm final closure of this ticket?\nThis will mark the complaint as Closed.")) {
        return;
      }
      setIsFinalizingClosure(true);
      try {
        if (ticket.customer_id) {
          await notificationService.insertNotification(
            ticket.customer_id,
            ticket.id,
            'success',
            '🎉 Ticket Closed',
            `Ticket #${formatComplaintTicketId(ticket)} has been successfully closed. Thank you for choosing Brihaspathi.`,
            6,
            undefined,
            user?.id
          );
        }

        await updateMutation.mutateAsync({
          status: "verified",
          current_phase: 6,
          closed_at: new Date().toISOString(),
          closure_timestamp: new Date().toISOString(),
          closed_by: currentUserFullName || user?.email || "Supervisor"
        } as any);

        // 🔔 Step 4: WhatsApp Dispatch on Final Closure
        const recipientPhone = customerPhone || ticket.customer_phone || ticket.profiles?.phone;
        const recipientName = ticket.customer_name || ticket.profiles?.full_name || "Customer";
        const slicedId = formatComplaintTicketId(ticket);

        if (recipientPhone) {
          try {
            await supabase.functions.invoke('send-walkin-whatsapp', {
              body: {
                phone: recipientPhone,
                name: recipientName,
                ticketId: slicedId,
                event_type: "closure",
                message: `Dear Customer, your complaint ${slicedId} is successfully closed. Thank you for choosing Brihaspathi Technologies!`
              }
            });
            console.log("✅ Step 4: Final Closure WhatsApp sent successfully");
          } catch (waErr) {
            console.warn("Step 4: Closure WhatsApp dispatch skipped:", waErr);
          }
        }

        toast.success("🎉 Ticket officially closed successfully!");
      } catch (err: any) {
        console.error("Failed to close ticket:", err);
        toast.error(err?.message || "Failed to close ticket");
      } finally {
        setIsFinalizingClosure(false);
      }
    } else if (phase6Action === "follow_up") {
      if (!followUpDate) {
        toast.error("Please select a date for the follow-up visit");
        return;
      }
      setIsFinalizingClosure(true);
      try {
        await updateMutation.mutateAsync({
          status: "assigned",
          current_phase: 3,
          scheduled_date: followUpDate,
          scheduled_time: followUpTime,
          supervisor_notes: followUpNotes.trim() ? `[Follow-up Visit] ${followUpNotes.trim()}` : ticket.supervisor_notes
        } as any);

        const techIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
          ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
          : (ticket.assigned_to ? [ticket.assigned_to] : []);

        if (techIds.length > 0) {
          await notificationService.insertNotification(
            techIds,
            ticket.id,
            'info',
            '📅 Follow-up Visit Scheduled',
            `Follow-up visit scheduled for Ticket #${formatComplaintTicketId(ticket)} on ${followUpDate} at ${followUpTime}.`,
            3,
            undefined,
            user?.id
          );
        }
        toast.success("📅 Follow-up visit scheduled and dispatched!");
      } catch (err: any) {
        console.error("Failed to schedule follow-up:", err);
        toast.error(err?.message || "Failed to schedule follow-up");
      } finally {
        setIsFinalizingClosure(false);
      }
    } else if (phase6Action === "rework") {
      handleOpenReworkModal();
    }
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

    // 🔔 WhatsApp Dispatch on Final Closure
    const recipientPhone = customerPhone || ticket.customer_phone || ticket.profiles?.phone;
    const recipientName = ticket.customer_name || ticket.profiles?.full_name || "Customer";
    const slicedId = formatComplaintTicketId(ticket);

    if (recipientPhone) {
      try {
        await supabase.functions.invoke('send-walkin-whatsapp', {
          body: {
            phone: recipientPhone,
            name: recipientName,
            ticketId: slicedId,
            event_type: "closure"
          }
        });
      } catch (waErr) {
        console.warn("Closure WhatsApp dispatch skipped:", waErr);
      }
    }

    updateMutation.mutate({
      status: "verified",
      current_phase: 6,
      closure_timestamp: new Date().toISOString(),
      closed_by: currentUserFullName
    } as any);
    setShowVerification(false);
    toast.success("🎉 Ticket officially verified!");
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

    // 🔔 WhatsApp Dispatch on Approval Closure
    const recipientPhone = customerPhone || ticket.customer_phone || ticket.profiles?.phone;
    const recipientName = ticket.customer_name || ticket.profiles?.full_name || "Customer";
    const slicedId = formatComplaintTicketId(ticket);

    if (recipientPhone) {
      try {
        await supabase.functions.invoke('send-walkin-whatsapp', {
          body: {
            phone: recipientPhone,
            name: recipientName,
            ticketId: slicedId,
            event_type: "closure"
          }
        });
      } catch (waErr) {
        console.warn("Closure WhatsApp dispatch skipped:", waErr);
      }
    }

    updateMutation.mutate({ status: "verified", current_phase: 6 } as any);
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
      feedback_contact_method: 'phone'
    } as any);
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
      assigned_technician: null,
      feedback_collected: false,
      happiness_code: null,
      happiness_code_sent_at: null,
      happiness_code_verified: false
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
        lowercaseUrl.includes('/audios/') ||
        lowercaseUrl.includes('/pir-audio/')
      ) {
        return 'audio';
      }
      if (
        lowercaseUrl.endsWith('.mp4') ||
        lowercaseUrl.endsWith('.webm') ||
        lowercaseUrl.endsWith('.ogg') ||
        lowercaseUrl.endsWith('.mov') ||
        lowercaseUrl.endsWith('.quicktime') ||
        lowercaseUrl.includes('video')
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
        lowercaseUrl.includes('/images/') ||
        lowercaseUrl.includes('/evidence/')
      ) {
        return 'image';
      }
      return 'document';
    };

    const mediaUrls = urls.filter(url => {
      const type = getFileType(url);
      return type === 'image' || type === 'video';
    });

    const audioUrls = urls.filter(url => getFileType(url) === 'audio');
    const docUrls = urls.filter(url => getFileType(url) === 'document');

    // Fallback: if no media detected but URLs exist, treat all as images
    const finalMediaUrls = mediaUrls.length > 0 ? mediaUrls : (docUrls.length > 0 && urls.length > 0 ? urls : []);

    return (
      <div className="space-y-3 mt-2 w-full">
        {finalMediaUrls.length > 0 && (
          <ImageGallery
            images={finalMediaUrls}
            title="Attached Media"
            uploader="technician"
            emptyMessage="No media files attached"
          />
        )}

        {audioUrls.map((url, idx) => {
          const resolved = resolveSupabaseUrl(url);
          return (
            <div key={idx} className="w-full max-w-md border rounded-xl p-3.5 bg-slate-100/60 flex flex-col gap-2 shadow-sm">
              <span className="text-xs font-bold text-[#0083a2] flex items-center gap-1.5">
                🎵 Audio Note {idx + 1}
              </span>
              <audio src={resolved} controls className="w-full h-9 rounded-lg animate-fade-in" />
            </div>
          );
        })}

        {docUrls.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {docUrls.map((url, idx) => {
              const resolved = resolveSupabaseUrl(url);
              const filename = decodeURIComponent(url.split('/').pop() || 'File').split('?')[0];
              return (
                <a
                  key={idx}
                  href={resolved}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all bg-white shadow-sm max-w-xs w-full"
                >
                  <div className="p-2 rounded bg-primary/10 text-primary shrink-0">
                    <FileText className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{filename}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">Click to view/download</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
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

            {ticket.supervisor_notes && (
              <div className="mt-3 min-w-0 max-w-full overflow-hidden bg-indigo-50/70 border border-indigo-200 p-3 rounded-lg">
                <p className="text-xs font-semibold text-indigo-700 mb-1">📋 Supervisor's Initial Assessment / Diagnostic Notes</p>
                <p className="max-w-full break-words overflow-wrap-anywhere text-sm text-slate-700 whitespace-pre-wrap">{ticket.supervisor_notes}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3 bg-white p-3 rounded-lg border">
              <div>
                <span className="text-xs text-muted-foreground block">Assigned Technician</span>
                <span className="font-medium text-slate-700">{technicianName || 'Not assigned yet'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Scheduled Date & Time</span>
                <span className="font-medium text-slate-700">
                  {ticket.scheduled_date ? (
                    <span className="text-primary font-semibold flex items-center gap-1">
                      📅 {new Date(ticket.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {ticket.scheduled_time && ` at ${ticket.scheduled_time.slice(0, 5)}`}
                    </span>
                  ) : (
                    'Not scheduled yet'
                  )}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Start Journey Time</span>
                <span className="font-medium text-slate-700">
                  {ticket.start_journey_timestamp ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      🚀 Started on {formatIndianDateTime(ticket.start_journey_timestamp)}
                    </span>
                  ) : 'Not started journey yet'}
                </span>
              </div>
            </div>

            {ticket.start_journey_timestamp && (
              <div className="mt-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Live Transit Status</span>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {ticket.arrival_timestamp ? 'Technician Arrived at Site' : 'Technician is en route to your location'}
                    </span>
                  </div>
                  {(() => {
                    let startLoc = '';
                    if (ticket.pir_decision_tree) {
                      try {
                        const parsed = JSON.parse(ticket.pir_decision_tree);
                        if (parsed) {
                          if (parsed.address) startLoc = parsed.address;
                          else if (parsed.lat && parsed.lng) startLoc = `${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`;
                        }
                      } catch (e) {}
                    }
                    return (
                      <div className="space-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {startLoc && (
                          <p>
                            Started from: <span className="font-semibold text-slate-700 dark:text-slate-300">{startLoc}</span>
                          </p>
                        )}
                        {ticket.arrival_lat && ticket.arrival_lng && !ticket.arrival_timestamp && (
                          <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            Current Live Position: <span className="font-mono font-semibold">{ticket.arrival_lat.toFixed(6)}, {ticket.arrival_lng.toFixed(6)}</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {(() => {
                  const dest = (ticket.customer_lat && ticket.customer_lng)
                    ? `${ticket.customer_lat},${ticket.customer_lng}`
                    : ticket.location ? encodeURIComponent(ticket.location.trim()) : '';

                  const currentPos = (ticket.arrival_lat && ticket.arrival_lng && !ticket.arrival_timestamp)
                    ? `${ticket.arrival_lat},${ticket.arrival_lng}`
                    : '';

                  let startLoc = '';
                  if (ticket.pir_decision_tree) {
                    try {
                      const parsed = JSON.parse(ticket.pir_decision_tree);
                      if (parsed) {
                        if (parsed.address) startLoc = parsed.address;
                        else if (parsed.lat && parsed.lng) startLoc = `${parsed.lat},${parsed.lng}`;
                      }
                    } catch (e) {}
                  }

                  if (currentPos || startLoc) {
                    return (
                      <button
                        type="button"
                        onClick={() => setShowTrackingModal(true)}
                        className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 hover:bg-emerald-200/80 rounded-lg border border-emerald-200/50 dark:border-emerald-900/50 inline-flex items-center gap-1.5 transition-colors"
                      >
                        🚗 Track Transit Route Proof
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
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
                <div className="space-y-1.5 mt-0.5">
                  {(() => {
                    let startLat = null;
                    let startLng = null;
                    let startAddress = null;
                    if (ticket.pir_decision_tree) {
                      try {
                        const parsed = JSON.parse(ticket.pir_decision_tree);
                        if (parsed) {
                          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                            startLat = parsed.lat;
                            startLng = parsed.lng;
                          } else if (parsed.address) {
                            startAddress = parsed.address;
                          }
                        }
                      } catch (e) {}
                    }

                    const dest = (ticket.customer_lat && ticket.customer_lng)
                      ? `${ticket.customer_lat},${ticket.customer_lng}`
                      : ticket.location ? encodeURIComponent(ticket.location.trim()) : '';

                    const startOrigin = (startLat && startLng)
                      ? `${startLat},${startLng}`
                      : startAddress
                        ? encodeURIComponent(startAddress.trim())
                        : '';

                    return (
                      <>
                        {(startLat && startLng) ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Start: </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${startLat},${startLng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> {startLat.toFixed(6)}, {startLng.toFixed(6)}
                            </a>
                          </div>
                        ) : startAddress ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Start: </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(startAddress)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> {startAddress}
                            </a>
                          </div>
                        ) : null}
                        {ticket.arrival_lat && ticket.arrival_lng ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Arrival: </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${ticket.arrival_lat},${ticket.arrival_lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> {ticket.arrival_lat.toFixed(6)}, {ticket.arrival_lng.toFixed(6)}
                            </a>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Arrival: Not recorded yet</div>
                        )}
                        {(startOrigin || (ticket.arrival_lat && ticket.arrival_lng)) && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowTrackingModal(true)}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded"
                            >
                              🗺️ View Travel Route Proof
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
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
                <audio src={resolveSupabaseUrl(ticket.pir_audio_url)} controls className="w-full max-w-md h-10 mt-1" />
              </div>
            )}

            {ticket.technician_evidence && ticket.technician_evidence.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">📸 PIR / Technician Uploaded Files:</span>
                {renderEvidenceFiles(ticket.technician_evidence)}
              </div>
            )}

            {/* Display Approved PIR Validation Details if present */}
            {(ticket.pir_findings_severity || ticket.supervisor_severity || ticket.target_duration_hours || ticket.target_end_time) ? (
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
                {ticket.target_end_time && (
                  <div className="mt-2 bg-indigo-50 border border-indigo-150 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-indigo-700 block font-medium">Locked Target End Time</span>
                      <span className="text-sm font-semibold text-indigo-900">{formatIndianDateTime(ticket.target_end_time)}</span>
                    </div>
                    {ticket.status === 'pir_approved_work_in_progress' && (
                      <div className="text-right">
                        <span className="text-xs text-indigo-700 block font-medium">Time Remaining</span>
                        <span className="text-sm font-bold text-indigo-900 animate-pulse">{timeLeft}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Supervisor/Admin Validation Action Panel */}
            {isRole("admin", "supervisor") && isPirSubmittedAndAwaiting && (
              <div id="supervisor-pir-verification-panel" className="mt-4 bg-slate-50 border-2 border-dashed border-indigo-200 p-4 sm:p-5 rounded-lg space-y-4 max-w-full overflow-x-hidden">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  <span className="font-semibold text-slate-800 text-sm md:text-base whitespace-normal break-words">Supervisor PIR Verification Panel</span>
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

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 w-full">
                  <Button
                    onClick={handleRequestRevisionPIR}
                    disabled={isApprovingPir}
                    variant="outline"
                    className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center gap-1.5 text-xs sm:text-sm min-h-[44px] px-4 py-2.5 rounded shadow-sm transition-all w-full sm:w-auto whitespace-normal break-words text-center"
                  >
                    <RotateCcw className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-none">Request More Info</span>
                  </Button>
                  <Button
                    onClick={handleApprovePIR}
                    disabled={isApprovingPir}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 text-xs sm:text-sm min-h-[44px] px-4 py-2.5 rounded shadow-sm transition-all w-full sm:w-auto whitespace-normal break-words text-center"
                  >
                    {isApprovingPir ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span className="truncate">Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Approve & Set Target Time</span>
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
                    <img src={resolveSupabaseUrl(ticket.signature_url)} alt="Customer Signature" className="max-h-16 border rounded bg-white p-1" />
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
              {(ticket.scheduled_date || ticket.scheduled_time) && (
                <div className="md:col-span-2 border-t pt-2 mt-1">
                  <span className="text-xs text-muted-foreground block">Scheduled / Follow-up Visit</span>
                  <span className="font-semibold text-primary">
                    📅 {new Date(ticket.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {ticket.scheduled_time && ` at ${ticket.scheduled_time.slice(0, 5)}`}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-white p-3 rounded-lg border mt-3">
              <span className="text-xs text-muted-foreground block mb-1">Customer Feedback Comments:</span>
              <p className="text-slate-700 font-normal break-words whitespace-pre-wrap max-w-full bg-slate-50 border p-2 rounded overflow-hidden">
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
    <div className="space-y-4 sm:space-y-6 w-full max-w-none px-3 sm:px-4 md:px-6 lg:px-8 py-4 overflow-x-hidden">

      {/* Header */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 border border-border/60 shadow-glow relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
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
                Ticket ID: {formatComplaintTicketId(ticket)}
              </span>
              {ticket.customer_type === 'New / Non-BTL Customer' || ticket.customer_type === 'Non-BTL' || ticket.customer_type === 'Walk-in' || (!ticket.customer_id && !ticket.customer_name) ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
                  Walk-in / Non-BTL
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm">
                  Existing Customer
                </span>
              )}
              {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
              {ticket.status && <StatusBadge status={ticket.status} />}
            </div>
            <h1 className="text-xl md:text-2xl font-display font-extrabold text-foreground tracking-tight break-words" title={ticket.title}>
              {ticket.title}
            </h1>
             <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 w-full">
               <span className="flex items-center gap-1">
                 Customer: <span className="font-semibold text-foreground break-words">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || "Customer"}</span>
                 {ticket.customer_phone && (
                   <span className="text-muted-foreground text-[11px]">({ticket.customer_phone})</span>
                 )}
               </span>
               <span className="text-muted-foreground/45 hidden sm:inline">•</span>
               <span className="flex items-center gap-1">
                 Registered: <span className="font-medium text-foreground">{formatIndianDateTime(ticket.created_at)}</span>
               </span>
               {ticket.assigned_supervisor && (
                 <>
                   <span className="text-muted-foreground/45 hidden sm:inline">•</span>
                   <span className="flex items-center gap-1">
                     Supervisor: <span className="font-semibold text-primary break-words">{ticket.assigned_supervisor}</span>
                   </span>
                 </>
               )}
                {assignedTechBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-semibold text-muted-foreground">Technician(s):</span>
                    {assignedTechBadges.map((tb: any, i: number) => (
                      <span key={tb.id || i} className={tb.is_lead ? "font-bold text-amber-700 flex items-center gap-1" : "text-slate-700"}>
                        {tb.is_lead && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        {tb.name}
                        {tb.is_lead && <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 rounded font-bold">Lead</span>}
                      </span>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {/* 📲 WhatsApp Notification Center (Admin & Supervisor) */}
          {(isAdmin || isSupervisor) && (
            <div className="w-full sm:w-auto">
              <ManualWhatsAppButton
                ticket={ticket}
                buttonVariant="outline"
                buttonText="WhatsApp Update"
                size="sm"
              />
            </div>
          )}

          {canReassign() && (
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto border-primary/60 text-primary hover:bg-primary/5 whitespace-normal break-words text-center"
              onClick={() => {
                const initialIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
                  ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
                  : (ticket.assigned_to ? [ticket.assigned_to] : []);
                setReassignSelectedTechs(initialIds);
                const initialLead = ticket.complaint_technicians?.find((ct: any) => ct.is_lead)?.technician_id || initialIds[0] || null;
                setReassignLeadTechId(initialLead);
                setReassignReason(ticket.reassignment_reason || "");
                setShowReassignModal(true);
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2 shrink-0" />
              {getReassignRemainingHours() !== null
                ? `Reassign (${getReassignRemainingHours()}h left)`
                : "Reassign Technicians"}
            </Button>
          )}
          {canVerify && (
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto border-warning/60 text-warning hover:bg-warning/10 font-semibold whitespace-normal break-words text-center"
              onClick={() => {
                const elem = document.getElementById("phase-6-verification-section");
                if (elem) elem.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <ShieldCheck className="w-4 h-4 mr-2 shrink-0" /> Verify & QA Close
            </Button>
          )}
          {canEdit && (
            <Link to={`/complaints/${ticket.id}/edit`} className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto border-border/80 hover:border-primary/30 whitespace-normal break-words text-center"><Edit className="w-4 h-4 mr-2 shrink-0" /> Edit</Button>
            </Link>
          )}
        </div>
      </div>

      {/* 🚀 Mobile Mission Control (One-Tap Calling, WhatsApp, Navigation & GPS Arrival) - Only for Lead Technician */}
      {isLeadTechnician && (
        <TechnicianMissionControl
          ticketType="complaint"
          ticketId={ticket.id}
          ticketDisplayId={formatComplaintTicketId(ticket)}
          customerName={ticket.customer_name || ticket.profiles?.full_name || "Customer"}
          customerPhone={ticket.customer_phone || customerPhone || ticket.profiles?.phone || ""}
          locationAddress={ticket.location || (ticket.customer_lat && ticket.customer_lng ? `${ticket.customer_lat}, ${ticket.customer_lng}` : "")}
          customerLat={ticket.customer_lat}
          customerLng={ticket.customer_lng}
          arrivalLat={ticket.arrival_lat}
          arrivalLng={ticket.arrival_lng}
          arrivalTimestamp={ticket.arrival_timestamp}
          isLeadOrAdmin={isLeadTechnician}
          complaint={ticket}
          onArrivalLogged={() => {
            queryClient.invalidateQueries({ queryKey: ["complaint", id] });
          }}
        />
      )}

      {/* Crew Navigation Card for Non-Lead Technicians */}
      {isAssistingTechnician && !isLeadTechnician && (
        <div className="crew-navigation-card bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Site Navigation (Crew View)
          </h3>
          <p className="text-xs text-blue-700 mb-4">
            You are assigned as crew. Contact Lead Technician: <strong>{leadTechnicianName}</strong> for coordination.
          </p>
          <button 
            onClick={() => {
              const address = ticket.location || ticket.address || "";
              const lat = ticket.customer_lat;
              const lng = ticket.customer_lng;
              let url = "#";
              if (lat && lng) {
                url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
              } else if (address) {
                url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
              }
              if (url !== "#") window.open(url, '_blank');
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" /> Navigate to Site
          </button>
        </div>
      )}

      {/* Reassignment Notice Banner */}
      {ticket.reassignment_reason && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-amber-500 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-amber-900 dark:text-amber-200">🔄 Ticket Returned for Rework / Reassigned</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                <strong>Supervisor Instructions:</strong> {ticket.reassignment_reason}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Previous Submission History (Shown after reassignment) */}
      {ticket.reassignment_reason && (ticket.pir_findings || ticket.resolution_notes || (ticket.technician_evidence && ticket.technician_evidence.length > 0) || ticket.signature_url || ticket.signoff_timestamp) && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-amber-500 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-semibold text-sm text-amber-900 dark:text-amber-200">📦 Previous Submission History</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                This ticket was previously worked on. The original findings, evidence, and sign-off are preserved below for reference.
              </p>

              {ticket.pir_findings && (
                <div className="bg-white/60 dark:bg-slate-900/40 rounded-lg p-3 border border-amber-200/60">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Previous PIR Findings</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{ticket.pir_findings}</p>
                </div>
              )}

              {(ticket.resolution || ticket.resolution_notes) && (
                <div className="bg-white/60 dark:bg-slate-900/40 rounded-lg p-3 border border-amber-200/60">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Previous Resolution Notes</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{ticket.resolution || ticket.resolution_notes}</p>
                </div>
              )}

              {ticket.technician_evidence && ticket.technician_evidence.length > 0 && (
                <div className="bg-white/60 dark:bg-slate-900/40 rounded-lg p-3 border border-amber-200/60">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Previous Work Evidence Photos ({ticket.technician_evidence.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ticket.technician_evidence.map((url: string, i: number) => (
                      <img key={i} src={resolveSupabaseUrl(url)} alt={`Previous evidence ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-amber-200" />
                    ))}
                  </div>
                </div>
              )}

              {ticket.signature_url && (
                <div className="bg-white/60 dark:bg-slate-900/40 rounded-lg p-3 border border-amber-200/60">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Previous Customer Signature</p>
                  <img src={resolveSupabaseUrl(ticket.signature_url)} alt="Previous Customer Signature" className="max-h-20 max-w-full object-contain rounded-lg border border-amber-200 bg-white p-1" />
                  {ticket.signoff_timestamp && (
                    <p className="text-[10px] text-amber-700 mt-1">Signed Off At: {formatIndianDateTime(ticket.signoff_timestamp)}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Previous Resolution Notes Notice (Shown to technicians during rework) */}
      {ticket.current_phase < 6 && (ticket.resolution || ticket.resolution_notes) && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-blue-500 bg-blue-500/10">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-blue-900 dark:text-blue-200">📝 Previous Resolution Notes</p>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 whitespace-pre-wrap break-words">
                {ticket.resolution || ticket.resolution_notes}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                ℹ️ These notes are preserved to help technicians during rework. New resolution notes will be submitted in Phase 5.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Previous Customer Feedback Notice (Shown during rework before new feedback is collected) */}
      {!ticket.feedback_collected && ticket.feedback_comments && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-purple-500 bg-purple-500/10">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-purple-900 dark:text-purple-200">💬 Customer Feedback (Before Rework)</p>
                {ticket.customer_satisfaction && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 uppercase">
                    {ticket.customer_satisfaction.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-800 dark:text-purple-300 mt-1 italic break-words">
                "{ticket.feedback_comments}"
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                ℹ️ Ticket was returned for rework. New customer feedback will be collected upon QA verification.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Remote Fix Info Banner with Revert back to Phase 2 Option */}
      {(ticket.triage_outcome === 'remote_fixed' || ticket.resolved_remotely) && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-info bg-info/5">
          <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-info">✅ Resolved Remotely</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/20">
                    Telephonic Triage Fix
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This ticket was marked as resolved remotely by {supervisorName || ticket.assigned_supervisor || 'supervisor'}.
                  {ticket.resolved_at && ` • ${formatIndianDateTime(ticket.resolved_at)}`}
                </p>
                {ticket.resolution_notes && (
                  <div className="mt-2 p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Resolution Notes:</p>
                    <p className="text-sm whitespace-pre-wrap break-words">{ticket.resolution_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Revert back to Phase 2 Button for Admin / Supervisor */}
            {isRole("admin", "supervisor") && (
              <div className="mt-2 sm:mt-0 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRevertPhase2Modal(true)}
                  className="rounded-xl border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-500 font-bold text-xs gap-1.5 shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Revert back to Phase 2
                </Button>
              </div>
            )}
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
                  <p className="text-sm italic break-words whitespace-pre-wrap max-w-full">"{ticket.feedback_comments}"</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Grid Layout for Widescreen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start w-full">
        {/* Left/Main Column: Actions, forms, timeline */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0 w-full">

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
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="font-semibold flex items-center gap-2 text-primary">
              <Phone className="w-5 h-5" /> Phase 2: Telephonic Triage
            </h2>
          </div>
          {(isRole("admin") || (isRole("supervisor") && ticket.assigned_supervisor === currentUserFullName)) ? (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground">
                Contact the customer to triage the issue. Choose whether to resolve it remotely or dispatch a technician.
              </p>
              <div className="flex flex-col md:flex-row gap-3 w-full">
                <Button 
                  variant="outline" 
                  className="w-full md:flex-1 border-success text-success whitespace-normal h-auto py-4" 
                  onClick={() => handleTriageDecision('remote_fixed')}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" /> 📞 Remote Fix
                </Button>
                <Button 
                  className="w-full md:flex-1 gradient-primary whitespace-normal h-auto py-4" 
                  onClick={() => handleTriageDecision('field_required')}
                >
                  <Wrench className="w-4 h-4 mr-2 shrink-0" /> 🚐 Field Visit Required
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
      {ticket.current_phase === 3 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-warning">
            <Wrench className="w-5 h-5" /> Phase 3: Field Visit Dispatch
          </h2>

          {getCleanSupervisorNotes(ticket.supervisor_notes) && (
            <div className="mb-4 min-w-0 max-w-full overflow-hidden p-3 rounded-lg bg-indigo-50/70 border border-indigo-200">
              <p className="text-xs font-semibold text-indigo-700 mb-1">📋 Supervisor's Initial Assessment / Diagnostic Notes</p>
              <p className="max-w-full break-words overflow-wrap-anywhere text-sm whitespace-pre-wrap bg-white/70 p-2 rounded border border-indigo-100">{getCleanSupervisorNotes(ticket.supervisor_notes)}</p>
            </div>
          )}

          {!ticket.assigned_technician ? (
            ((isRole("supervisor") && ticket.assigned_supervisor === currentUserFullName) || isRole("admin")) ? (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <p className="text-sm text-muted-foreground">
                  Please assign technicians matching the required field of work to resolve the issue on-site.
                </p>
                <Button 
                  className="w-full gradient-primary"
                  onClick={() => {
                    const initialIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
                      ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
                      : (ticket.assigned_to ? [ticket.assigned_to] : []);
                    setFieldVisitSelectedTechs(initialIds);
                    const initialLead = ticket.complaint_technicians?.find((ct: any) => ct.is_lead)?.technician_id || initialIds[0] || null;
                    setFieldVisitLeadTechId(initialLead);
                    setFieldVisitScheduledDate(ticket.scheduled_date || new Date().toISOString().split("T")[0]);
                    setFieldVisitScheduledTime(ticket.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00");
                    setFieldVisitSupervisorNotes(getCleanSupervisorNotes(ticket.supervisor_notes));
                    setShowFieldVisitModal(true);
                  }}
                >
                  <Wrench className="w-4 h-4 mr-2" /> Assign Technicians & Dispatch
                </Button>
              </div>
            ) : (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning animate-pulse" /> Waiting for supervisor ({ticket.assigned_supervisor || "assigned supervisor"}) to assign technician and dispatch.
                </p>
              </div>
            )
          ) : (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Field Team Dispatched
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Scheduled: {ticket.scheduled_date ? new Date(ticket.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set'} {ticket.scheduled_time ? `at ${ticket.scheduled_time.slice(0, 5)}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Lead Technician: <span className="text-primary font-bold">{ticket.assigned_technician}</span>
                </p>
                {((isRole("supervisor") && ticket.assigned_supervisor === currentUserFullName) || isRole("admin")) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs font-semibold bg-white dark:bg-slate-900 border-emerald-300 hover:border-primary"
                    onClick={() => {
                      const initialIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
                        ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
                        : (ticket.assigned_to ? [ticket.assigned_to] : []);
                      setFieldVisitSelectedTechs(initialIds);
                      const initialLead = ticket.complaint_technicians?.find((ct: any) => ct.is_lead)?.technician_id || initialIds[0] || null;
                      setFieldVisitLeadTechId(initialLead);
                      setFieldVisitScheduledDate(ticket.scheduled_date || new Date().toISOString().split("T")[0]);
                      setFieldVisitScheduledTime(ticket.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00");
                      setFieldVisitSupervisorNotes(getCleanSupervisorNotes(ticket.supervisor_notes));
                      setShowFieldVisitModal(true);
                    }}
                  >
                    <Wrench className="w-3.5 h-3.5 mr-1.5 text-primary" /> Modify / Reassign Team
                  </Button>
                )}
              </div>

              {/* Ready for Site Visit / Start Journey / Arrive on Site for Field Technicians */}
              {isTechnician && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/90 p-3.5 rounded-xl border border-emerald-200/90 dark:border-emerald-800 shadow-2xs mt-2">
                  <div>
                    <p className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      {!ticket.start_journey_timestamp ? "Ready for Site Visit?" : "In Transit / Arrived at Site"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {!ticket.start_journey_timestamp
                        ? "Start journey with GPS tracking, or proceed directly to Phase 4 on-site diagnostic."
                        : "Proceed to Phase 4 to record Primary Information Report (PIR) diagnostic findings."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!ticket.start_journey_timestamp && (
                      <Button onClick={handleStartJourney} size="sm" className="gradient-primary text-white text-xs font-semibold shadow-xs" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                        Start Journey
                      </Button>
                    )}
                    {isLeadTechnician && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const nowIso = new Date().toISOString();
                          await updateMutation.mutateAsync({
                            current_phase: 4,
                            status: "in-progress",
                            arrival_timestamp: ticket.arrival_timestamp || nowIso,
                          } as any);
                          setActivePhase(4);
                          toast.success("Proceeding to Phase 4: Site Visit & PIR Diagnosis");
                        }}
                        variant={ticket.start_journey_timestamp ? "default" : "outline"}
                        className={`text-xs font-semibold shadow-xs ${ticket.start_journey_timestamp ? "gradient-primary text-white" : "border-primary/40 text-primary hover:bg-primary/10"}`}
                        disabled={updateMutation.isPending}
                      >
                        <MapPin className="w-3.5 h-3.5 mr-1.5" />
                        Arrive on Site • Begin PIR Diagnosis
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isSupervisorOrAdmin && (
                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800 p-3 rounded-lg flex items-center justify-between shadow-2xs mt-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                    <Clock className="w-4 h-4 text-indigo-600 animate-pulse shrink-0" />
                    <span>Technician team dispatched. Awaiting on-site arrival and PIR diagnostic from <strong>{leadTechnicianName}</strong>.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Technician Actions for Phase 4, 5, 6 */}
      {canTechnicianAct && currentPhase >= 4 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">

          {/* Phase 4: Site Visit & PIR Diagnosis */}
          {currentPhase === 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="bg-muted/50 p-4 sm:p-5 rounded-xl space-y-4 border-l-4 border-l-primary shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">Phase 4: Site Visit & Primary Information Report (PIR)</h3>
                      <p className="text-xs text-muted-foreground">
                        Document on-site diagnostic findings, observed severity, and evidence photos before starting work.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full w-fit">
                    Lead: {leadTechnicianName}
                  </span>
                </div>

                {isLeadTechnician ? (
                  /* Lead Technician: PIR Diagnostic Input Form */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleArrivedGPS}
                        disabled={isCapturingArrivalGps || ticket.arrival_timestamp}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                      >
                        {isCapturingArrivalGps ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Capturing GPS...</>
                        ) : (
                          <><MapPin className="w-3.5 h-3.5 mr-1.5" /> {ticket.arrival_timestamp ? 'Arrived (GPS) ✓' : 'I Arrived (GPS)'}</>
                        )}
                      </Button>
                      {arrivalCoords && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {arrivalCoords.lat.toFixed(5)}, {arrivalCoords.lng.toFixed(5)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" /> PIR Findings & Site Diagnostic *
                      </label>
                      <Textarea
                        value={pirFindings}
                        onChange={e => setPirFindings(e.target.value)}
                        placeholder="Describe field findings, root cause, parts observed, voltage/pressure readings..."
                        rows={4}
                        className="bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">Technician Observed Severity</label>
                        <Select value={pirSeverityInput} onValueChange={setPirSeverityInput}>
                          <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low - Minor Issue</SelectItem>
                            <SelectItem value="medium">Medium - Normal Attention</SelectItem>
                            <SelectItem value="high">High - Serious Issue</SelectItem>
                            <SelectItem value="critical">Critical - Urgent Fix Needed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">Arrival Status</label>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 h-10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Arrived on site {ticket.arrival_timestamp ? `at ${formatIndianDateTime(ticket.arrival_timestamp)}` : "just now"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Original Complaint Proofs Notice */}
                    {ticket.complaint_images && ticket.complaint_images.length > 0 && (
                      <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs space-y-1.5">
                        <span className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          📷 Initial Complaint Proofs (Phase 1 • Permanent Record)
                        </span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {ticket.complaint_images.map((url: string, idx: number) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="relative w-14 h-14 border rounded-lg overflow-hidden block hover:opacity-90">
                              <img src={url} alt={`Initial ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence Upload */}
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-primary" /> Upload Diagnostic Evidence Photos / Video / Audio (Optional)
                      </label>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.mkv,audio/*"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          setIsUploading(true);
                          try {
                            const uploadPromises = files.map(async (file) => {
                              try {
                                if (file.type.startsWith('audio/')) {
                                  const url = await uploadToSupabase(file, 'pir-audio');
                                  setPirAudioUrl(url);
                                  toast.success(`Audio note "${file.name}" uploaded`);
                                  return null;
                                } else {
                                  const url = await uploadToSupabase(file, 'evidence');
                                  return url;
                                }
                              } catch (err) {
                                console.error("Upload error:", file.name, err);
                                toast.error(`Failed to upload ${file.name}`);
                                return null;
                              }
                            });
                            const results = await Promise.all(uploadPromises);
                            const successfulUrls = results.filter((u): u is string => !!u);
                            if (successfulUrls.length > 0) {
                              setPirEvidenceUrls(prev => [...prev, ...successfulUrls]);
                              setEvidenceUrls(prev => [...prev, ...successfulUrls]);
                              toast.success(`${successfulUrls.length} file(s) uploaded!`);
                            }
                          } finally {
                            setIsUploading(false);
                            setUploadProgressText("");
                            e.target.value = '';
                          }
                        }}
                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer w-full"
                        disabled={isUploading}
                      />
                    </div>

                    {isUploading && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 p-2.5 rounded-xl border border-primary/20 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        <span>{uploadProgressText || "Optimizing and uploading files... Please wait."}</span>
                      </div>
                    )}

                    {pirAudioUrl && (
                      <div className="text-xs text-muted-foreground bg-card p-2 rounded-lg border flex items-center justify-between">
                        <span>🎵 PIR Audio Note Attached</span>
                        <a href={pirAudioUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Listen</a>
                      </div>
                    )}

                    {pirEvidenceUrls.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1.5">Uploaded PIR Diagnostic Attachments ({pirEvidenceUrls.length} file(s)):</p>
                        <div className="flex flex-wrap gap-2">
                          {pirEvidenceUrls.map((url, i) => (
                            <div key={i} className="relative w-16 h-16 border rounded-lg bg-slate-900 overflow-hidden group shadow-xs">
                              {isVideoUrl(url) ? (
                                <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                                  <video src={resolveSupabaseUrl(url)} className="w-full h-full object-cover" muted playsInline />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white shadow-sm">
                                      <Play className="w-3 h-3 fill-white ml-0.5" />
                                    </div>
                                  </div>
                                  <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-white px-1 rounded">VIDEO</span>
                                </div>
                              ) : (
                                <img src={resolveSupabaseUrl(url)} alt={`PIR Evidence ${i + 1}`} className="w-full h-full object-cover" />
                              )}
                              <button type="button" onClick={() => {
                                setPirEvidenceUrls(prev => prev.filter((_, idx) => idx !== i));
                                setEvidenceUrls(prev => prev.filter(u => u !== url));
                              }} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex justify-end pt-3 border-t px-4 py-3">
                      <Button
                        size="default"
                        onClick={handleSubmitPIR}
                        disabled={isSubmittingPIR || updateMutation.isPending || isUploading}
                        className="w-full sm:w-auto gradient-primary text-white font-semibold shadow-sm text-sm sm:text-base whitespace-normal break-words text-center"
                      >
                        {isSubmittingPIR || updateMutation.isPending || isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Saving PIR...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Save PIR & Proceed to Resolution Notes (Phase 5)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : isAssistingTechnician ? (
                  /* Assisting Technician View */
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm font-medium flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>👑 Lead Technician ({leadTechnicianName}) is recording the on-site PIR diagnostic report.</span>
                  </div>
                ) : (
                  /* Supervisor / Admin View */
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-sm font-medium flex items-center gap-3">
                      <Clock className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground text-sm">Site Diagnostic In Progress</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Lead Technician: <strong>{leadTechnicianName}</strong> is conducting site inspection and recording findings.
                        </p>
                      </div>
                    </div>
                    {ticket.pir_findings && (
                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-1.5">
                        <p className="font-semibold text-foreground">Recorded PIR Diagnostic Findings:</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{ticket.pir_findings}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Phase 5: Resolution Notes & Customer Sign-Off */}
          {currentPhase === 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/50 p-4 sm:p-5 rounded-xl space-y-4 border-l-4 border-l-success shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div>
                  <h3 className="font-semibold text-base sm:text-lg text-success flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" /> Phase 5: Resolution, Evidence & Customer Sign-Off
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lead Technician: <strong className="text-foreground">{leadTechnicianName}</strong>
                    {ticket.target_duration_hours && ` • Target SLA: ${ticket.target_duration_hours} hrs`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30">
                    PIR Recorded • Ready for Resolution
                  </span>
                </div>
              </div>

              {/* PIR Summary Card */}
              {ticket.pir_findings && (
                <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Primary Information Report (PIR) Summary</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong className="text-foreground">Diagnostic Findings:</strong> {ticket.pir_findings}
                  </p>
                  {ticket.target_end_time && (
                    <p className="text-muted-foreground">
                      Target Completion: <strong className="text-foreground">{formatIndianDateTime(ticket.target_end_time)}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Supervisor Rework Instructions for Technicians */}
              {ticket.reassignment_reason && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold">
                    <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>⚠️ Supervisor Rework Instructions</span>
                  </div>
                  <p className="text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{ticket.reassignment_reason}</p>
                </div>
              )}

              {/* Previous Customer Feedback Reference for Technicians */}
              {ticket.feedback_comments && (
                <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-semibold">
                    <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Previous Customer Feedback</span>
                    {ticket.customer_satisfaction && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 uppercase">
                        {ticket.customer_satisfaction.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 italic">"{ticket.feedback_comments}"</p>
                </div>
              )}

              {isLeadTechnician ? (
                !showResolution && !ticket.signoff_timestamp ? (
                  /* Primary Add/Update Resolution Action Card - ONLY visible to Lead Technician */
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-success/30 shadow-xs">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-success" /> Ready to Document Resolution & Collect Sign-Off?
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click below to enter the work completion notes, attach photo/video proofs of the fix, and capture the customer's signature.
                      </p>
                    </div>
                     <Button
                       onClick={() => setShowResolution(true)}
                       className="w-full sm:w-auto bg-success hover:bg-success/90 text-success-foreground font-semibold px-5 py-2.5 shadow-sm transition-all whitespace-normal break-words text-center text-sm sm:text-base"
                     >
                       <PlusCircle className="w-4 h-4 mr-2 shrink-0" /> {ticket.resolution ? "Update Resolution & Customer Sign-Off" : "Add Resolution & Customer Sign-Off"}
                     </Button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Fill out all resolution details and capture the customer sign-off below:
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowResolution(false)}
                        className="text-xs text-muted-foreground h-7 px-2"
                      >
                        Collapse Form
                      </Button>
                    </div>

                    {/* Previous Resolution Notes Reference Box */}
                    {(ticket.resolution || ticket.resolution_notes) && (
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                        <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Previous Resolution Notes (For Reference):
                        </p>
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ticket.resolution || ticket.resolution_notes}</p>
                      </div>
                    )}

                    {/* 1. Final Resolution Notes */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" /> Final Resolution & Work Done Notes *
                      </label>
                      <Textarea
                        placeholder="Describe work completed in detail: parts repaired/replaced, diagnostic checks executed, calibration, tests verified with customer..."
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        rows={4}
                        className="bg-white dark:bg-slate-900 border-border focus:border-primary text-sm"
                      />
                    </div>

                    {/* 2. Upload Proof / Work Evidence (Images & Videos) */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-primary" /> Attach Work Completion Proof (Photos / Videos)
                      </label>
                      <div className="border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-xl p-4 bg-white/70 dark:bg-slate-900/70 transition-colors text-center">
                        <input
                          id="resolution-evidence-input"
                          type="file"
                          multiple
                          accept="image/*,video/*,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.mkv"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            setIsUploading(true);
                            try {
                              const uploadPromises = files.map(async (file) => {
                                try {
                                  return await uploadToSupabase(file, 'evidence');
                                } catch (err) {
                                  toast.error(`Failed to upload ${file.name}`);
                                  return null;
                                }
                              });
                              const results = await Promise.all(uploadPromises);
                              const successfulUrls = results.filter((u): u is string => !!u);
                              if (successfulUrls.length > 0) {
                                setResolutionEvidenceUrls((prev) => [...prev, ...successfulUrls]);
                                setEvidenceUrls((prev) => [...prev, ...successfulUrls]);
                                toast.success(`${successfulUrls.length} work completion file(s) optimized & uploaded!`);
                              }
                            } finally {
                              setIsUploading(false);
                              setUploadProgressText("");
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                          disabled={isUploading}
                        />
                        <label
                          htmlFor="resolution-evidence-input"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-semibold rounded-lg cursor-pointer hover:bg-primary/20 transition-colors text-xs sm:text-sm"
                        >
                          <Upload className="w-4 h-4" /> {isUploading ? (uploadProgressText || "Optimizing & Uploading...") : "Choose Work Completion Photos"}
                        </label>
                        {isUploading && (
                          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-primary mt-2 animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{uploadProgressText || "Compressing and uploading media..."}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Supported: JPG, PNG, WEBP, MP4, MOV. Upload after-fix photos of repaired equipment.
                        </p>
                      </div>

                      {/* Evidence Thumbnails Grid */}
                      {resolutionEvidenceUrls.length > 0 && (
                        <div className="space-y-1.5 mt-3">
                          <p className="text-xs font-semibold text-muted-foreground">Work Completion Attachments ({resolutionEvidenceUrls.length}):</p>
                          <div className="flex flex-wrap gap-2.5">
                            {resolutionEvidenceUrls.map((url, i) => (
                              <div key={i} className="relative w-16 h-16 sm:w-20 sm:h-20 border rounded-lg bg-slate-900 overflow-hidden group shadow-xs">
                                {isVideoUrl(url) ? (
                                  <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                                    <video src={resolveSupabaseUrl(url)} className="w-full h-full object-cover" muted playsInline />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white shadow-sm">
                                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                                      </div>
                                    </div>
                                    <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-white px-1 rounded">VIDEO</span>
                                  </div>
                                ) : (
                                  <img src={resolveSupabaseUrl(url)} alt={`Resolution Evidence ${i + 1}`} className="w-full h-full object-cover" />
                                )}
                                <button
                                  type="button"
                                  title="Remove attachment"
                                  onClick={() => {
                                    setResolutionEvidenceUrls((prev) => prev.filter((_, idx) => idx !== i));
                                    setEvidenceUrls((prev) => prev.filter((u) => u !== url));
                                  }}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity shadow-xs"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Customer Sign-off / Signature */}
                    <div className="space-y-3 pt-2">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <PenTool className="w-4 h-4 text-primary" /> Customer Sign-Off & Signature *
                      </label>

                       <div className="flex flex-col sm:flex-row gap-2 border-b border-border">
                        <button
                          type="button"
                          onClick={() => setSignatureMode("draw")}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${signatureMode === "draw" ? "text-primary border-b-2 border-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <PenTool className="w-4 h-4" /> ✍️ Draw Signature
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignatureMode("upload")}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${signatureMode === "upload" ? "text-primary border-b-2 border-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <ImageIcon className="w-4 h-4" /> 📸 Upload Signature Photo
                        </button>
                      </div>

                      {signatureMode === "draw" && (
                        <div className="space-y-2">
                          <div className="border-2 border-dashed border-primary/40 rounded-xl p-2 bg-white w-full overflow-hidden shadow-2xs">
                            <SignatureCanvas
                              ref={sigRef}
                              penColor="black"
                              onEnd={() => setHasDrawnSignature(true)}
                              canvasProps={{ width: canvasWidth, height: 160, className: 'signature-canvas rounded-lg max-w-full bg-white' }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Please ask the customer to draw their signature in the box above</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                sigRef.current?.clear();
                                setHasDrawnSignature(false);
                              }}
                              className="text-xs h-7"
                            >
                              Clear Signature
                            </Button>
                          </div>
                        </div>
                      )}

                      {signatureMode === "upload" && (
                        <div className="space-y-2">
                          <div className="border-2 border-dashed border-primary/40 rounded-xl p-4 bg-white dark:bg-slate-900 text-center">
                            {uploadedSignaturePreview ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-center">
                                  <img src={uploadedSignaturePreview} alt="Uploaded Signature Preview" className="max-h-32 border rounded bg-white p-1 shadow-xs" />
                                </div>
                                <div className="flex items-center justify-between max-w-sm mx-auto">
                                  <p className="text-xs text-success font-medium">✓ Signature uploaded successfully</p>
                                  <Button variant="ghost" size="sm" onClick={clearUploadedSignature} className="text-xs text-destructive h-7">
                                    <XCircle className="w-3.5 h-3.5 mr-1" /> Remove
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="py-3">
                                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm font-medium text-foreground mb-1">Upload Customer Signature Image</p>
                                <p className="text-xs text-muted-foreground mb-3">Upload a photo or scanned copy of customer's signed work report</p>
                                <input
                                  id="signature-upload-input"
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg"
                                  onChange={handleSignatureUpload}
                                  disabled={isUploading}
                                  className="hidden"
                                />
                                <label
                                  htmlFor="signature-upload-input"
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-semibold rounded-lg cursor-pointer hover:bg-primary/20 transition-colors text-xs"
                                >
                                  <Upload className="w-4 h-4" /> Browse Signature Image
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Complete Sign-Off Action Button */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowResolution(false)}
                        className="w-full sm:w-auto text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="default"
                        onClick={handleFinalSignOff}
                        disabled={isSubmittingSignOff || updateMutation.isPending || isUploading}
                        className="bg-success hover:bg-success/90 text-success-foreground w-full sm:w-auto font-semibold shadow-sm text-sm"
                      >
                        {isSubmittingSignOff || updateMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Submitting Resolution & Sign-Off...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Complete Sign-off & Submit Resolution
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              ) : isAssistingTechnician ? (
                /* Assisting Technicians see read-only banner */
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm font-medium flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>⚠️ Only the Lead Technician ({leadTechnicianName}) can submit the resolution.</span>
                </div>
              ) : (
                /* Admin / Supervisor see read-only status card */
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm font-medium flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">⏳ Awaiting technician resolution submission.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Assigned to Lead Technician: <strong>{leadTechnicianName}</strong>. The resolution form is strictly accessible only to the Lead Technician.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Phase 6: QA Verification, Customer Satisfaction & Final Closure */}
          {currentPhase === 6 && (
            <motion.div id="phase-6-verification-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-warning" />
                  <h3 className="font-semibold text-foreground text-base">Phase 6: QA Verification & Final Closure</h3>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.force_closed ? (
                    <span className="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1 rounded-full border border-amber-300">
                      Closed (Force Closure)
                    </span>
                  ) : ticket.status === 'closed' ? (
                    <span className="text-xs font-bold bg-muted text-muted-foreground px-3 py-1 rounded-full">
                      Ticket Closed
                    </span>
                  ) : (
                    <span className="text-xs font-bold bg-warning/20 text-warning px-3 py-1 rounded-full">
                      Ready for Final QA & Closure
                    </span>
                  )}
                </div>
              </div>

              {/* 48-Hour Post-Closure Reassignment Action Strip (Admin / Supervisor) */}
              {isSupervisorOrAdmin && (ticket.status === 'closed' || Boolean(ticket.closed_at)) && (
                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">48-Hour Post-Closure Reassignment Window:</span>{" "}
                      {getReassignRemainingHours() !== null ? (
                        <span className="text-primary font-bold">{getReassignRemainingHours()} hours remaining from closure time</span>
                      ) : (
                        <span className="text-muted-foreground">Reassignment available for 48 hours after closure</span>
                      )}
                    </div>
                  </div>
                  {canReassign() && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const initialIds = (ticket.complaint_technicians && ticket.complaint_technicians.length > 0)
                          ? ticket.complaint_technicians.map((ct: any) => ct.technician_id)
                          : (ticket.assigned_to ? [ticket.assigned_to] : []);
                        setReassignSelectedTechs(initialIds);
                        const initialLead = ticket.complaint_technicians?.find((ct: any) => ct.is_lead)?.technician_id || initialIds[0] || null;
                        setReassignLeadTechId(initialLead);
                        setReassignReason(ticket.reassignment_reason || "");
                        setShowReassignModal(true);
                      }}
                      className="gradient-primary text-white font-semibold text-xs h-8 px-3.5 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reassign Technicians
                    </Button>
                  )}
                </div>
              )}

              {/* Resolution Summary Card */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground border-b pb-2">
                  <span>Lead Technician: <strong className="text-foreground">{leadTechnicianName}</strong></span>
                  {ticket.signoff_timestamp && <span>Signed Off: {formatIndianDateTime(ticket.signoff_timestamp)}</span>}
                </div>
                {ticket.resolution && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Final Resolution Notes:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{ticket.resolution}</p>
                  </div>
                )}
                {ticket.signature_url && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Customer Signature:</p>
                    <img src={resolveSupabaseUrl(ticket.signature_url)} alt="Customer Signature" className="max-h-20 border rounded-lg bg-white p-1.5" />
                  </div>
                )}
                {ticket.technician_evidence && ticket.technician_evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Work Evidence Photos ({ticket.technician_evidence.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {ticket.technician_evidence.map((url: string, i: number) => (
                        <a key={i} href={resolveSupabaseUrl(url)} target="_blank" rel="noreferrer" className="w-16 h-16 border rounded-lg overflow-hidden hover:opacity-80 transition-opacity relative bg-slate-900 block">
                          {isVideoUrl(url) ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <video src={resolveSupabaseUrl(url)} className="w-full h-full object-cover" muted playsInline />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="w-3.5 h-3.5 text-white fill-white" />
                              </div>
                            </div>
                          ) : (
                            <img src={resolveSupabaseUrl(url)} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!ticket.force_closed && (
                <div>
                  {/* Customer Satisfaction Feedback & Happiness Code (Strictly visible only to Supervisors & Admins in Phase 6) */}
                  {isSupervisorOrAdmin ? (
                    !showVerificationForm && !ticket.feedback_collected ? (
                      /* By default in Phase 6, show ONLY a button: "Collect Customer Feedback & Verify" */
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-primary" /> Customer Satisfaction & Happiness Code Verification
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Verify the customer's 5-digit Happiness Code and record satisfaction feedback before final ticket closure.
                          </p>
                        </div>
                        <Button
                          onClick={() => setShowVerificationForm(true)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 text-xs shrink-0 shadow-xs"
                        >
                          <ShieldCheck className="w-4 h-4 mr-1.5" /> Collect Customer Feedback & Verify
                        </Button>
                      </div>
                    ) : (
                      /* Full Feedback & Happiness Code Verification Panel */
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                         <div className="flex items-center gap-2">
                           <MessageSquare className="w-4.5 h-4.5 text-primary" />
                           <h4 className="font-semibold text-sm text-primary break-words">Customer Satisfaction & Verification</h4>
                         </div>
                         <div className="flex items-center gap-2 w-full sm:w-auto">
                           {customerPhone && (
                             <Button size="sm" variant="outline" onClick={handleCallCustomer} className="text-xs h-7 w-full sm:w-auto">
                               <Phone className="w-3 h-3 mr-1" /> Call Customer ({customerPhone})
                             </Button>
                           )}
                           {!ticket.feedback_collected && (
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={() => setShowVerificationForm(false)}
                               className="text-xs h-7 text-muted-foreground w-full sm:w-auto"
                             >
                               Collapse
                             </Button>
                           )}
                         </div>
                       </div>

                        {/* 1. Happiness Code Verification (LG style) */}
                        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-border space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-500" /> Enter Customer's Happiness Code *
                            </label>
                            {ticket.happiness_code_sent_at && (
                              <span className="text-[11px] text-muted-foreground">
                                Sent to customer via WhatsApp: {formatIndianDateTime(ticket.happiness_code_sent_at)}
                              </span>
                            )}
                          </div>

                          {ticket.happiness_code_verified || codeVerifiedLocally ? (
                            <div className="p-2.5 rounded-lg bg-success/15 border border-success/30 text-success text-xs font-semibold flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> Happiness Code Verified Successfully!
                              </span>
                              <span className="font-mono bg-success/20 px-2 py-0.5 rounded text-xs tracking-wider">
                                {ticket.happiness_code || "VERIFIED"}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Ask the customer for the 5-digit code sent to their WhatsApp upon technician resolution.
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Enter Customer's Happiness Code"
                                  value={inputHappinessCode}
                                  onChange={(e) => {
                                    setInputHappinessCode(e.target.value.replace(/\D/g, '').slice(0, 5));
                                    setCodeVerificationError("");
                                  }}
                                  maxLength={5}
                                  className="font-mono tracking-widest text-sm max-w-[260px] bg-background"
                                />
                                <Button
                                  size="sm"
                                  onClick={handleVerifyHappinessCode}
                                  disabled={isVerifyingCode || inputHappinessCode.length !== 5}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 font-semibold"
                                >
                                  {isVerifyingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                                  Verify Code
                                </Button>
                              </div>
                              {codeVerificationError && (
                                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {codeVerificationError}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. Customer Satisfaction Feedback */}
                        {!ticket.feedback_collected ? (
                          <div className="space-y-3 pt-1">
                            {/* Context box if customer feedback was previously recorded before rework */}
                            {ticket.feedback_comments && (
                              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs space-y-1">
                                <p className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Previous Customer Feedback (Before Rework)
                                </p>
                                <p className="text-muted-foreground">
                                  Previous Rating: <strong className="capitalize text-foreground">{ticket.customer_satisfaction?.replace('_', ' ') || 'Recorded'}</strong>
                                </p>
                                <p className="text-slate-700 dark:text-slate-300 italic">"{ticket.feedback_comments}"</p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  * Collecting new feedback below will record the customer's updated satisfaction and replace the previous comments.
                                </p>
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-foreground">Satisfaction Level *</label>
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setFeedbackSatisfaction('satisfied')}
                                  className={`p-2.5 rounded-lg border text-center transition-all ${feedbackSatisfaction === 'satisfied' ? 'border-success bg-success/15 text-success font-semibold' : 'border-border hover:border-success/40 text-muted-foreground'}`}
                                >
                                  <ThumbsUp className="w-4 h-4 mx-auto mb-1" />
                                  <span className="text-xs">Satisfied</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFeedbackSatisfaction('partially_satisfied')}
                                  className={`p-2.5 rounded-lg border text-center transition-all ${feedbackSatisfaction === 'partially_satisfied' ? 'border-warning bg-warning/15 text-warning font-semibold' : 'border-border hover:border-warning/40 text-muted-foreground'}`}
                                >
                                  <Star className="w-4 h-4 mx-auto mb-1" />
                                  <span className="text-xs">Partially</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFeedbackSatisfaction('unsatisfied')}
                                  className={`p-2.5 rounded-lg border text-center transition-all ${feedbackSatisfaction === 'unsatisfied' ? 'border-destructive bg-destructive/15 text-destructive font-semibold' : 'border-border hover:border-destructive/40 text-muted-foreground'}`}
                                >
                                  <ThumbsDown className="w-4 h-4 mx-auto mb-1" />
                                  <span className="text-xs">Unsatisfied</span>
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-foreground">Customer Comments</label>
                              <Textarea
                                value={feedbackComments}
                                onChange={e => setFeedbackComments(e.target.value)}
                                placeholder="Customer remarks on repair quality, punctuality..."
                                rows={2}
                                className="bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>

                            <Button
                              size="sm"
                              onClick={handleCollectFeedback}
                              disabled={!feedbackSatisfaction || isCollectingFeedback}
                              className="w-full bg-primary text-primary-foreground text-xs font-semibold"
                            >
                              {isCollectingFeedback ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                              Record Customer Feedback
                            </Button>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-xs space-y-1">
                            <p className="font-semibold text-success flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Feedback Recorded
                            </p>
                            <p><strong>Satisfaction:</strong> {ticket.customer_satisfaction?.replace('_', ' ')}</p>
                            {ticket.feedback_comments && <p><strong>Comments:</strong> {ticket.feedback_comments}</p>}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-center space-y-2">
                      <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400 mx-auto" />
                      <h4 className="font-semibold text-sm text-foreground">Under Supervisor QA Review & Customer Verification</h4>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Your resolution and sign-off have been submitted. The supervisor or admin will verify satisfaction with the customer before closing this ticket.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Final Action (Supervisor / Admin) */}
              {isSupervisorOrAdmin && ticket.status !== 'verified' && (
                <div className="space-y-3 pt-2 border-t">
                  <label className="text-sm font-semibold text-foreground block">Final Action Decision</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPhase6Action("close")}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${phase6Action === "close" ? "border-success bg-success/10 text-success" : "border-border hover:border-success/30"}`}
                    >
                      <CheckCircle2 className="w-5 h-5 mb-1.5 text-success" />
                      <p className="text-xs font-bold">Close Ticket Successfully</p>
                      <p className="text-[11px] text-muted-foreground">Mark resolution verified & complete.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhase6Action("follow_up")}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${phase6Action === "follow_up" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                    >
                      <Calendar className="w-5 h-5 mb-1.5 text-primary" />
                      <p className="text-xs font-bold">Schedule Follow-up Visit</p>
                      <p className="text-[11px] text-muted-foreground">Re-dispatch for pending parts/tests.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPhase6Action("rework");
                        handleOpenReworkModal();
                      }}
                      className="p-3 rounded-xl border-2 border-destructive/30 hover:border-destructive bg-destructive/5 hover:bg-destructive/10 text-destructive text-left transition-all"
                    >
                      <RotateCcw className="w-5 h-5 mb-1.5 text-destructive" />
                      <p className="text-xs font-bold">Return for Rework</p>
                      <p className="text-[11px] text-muted-foreground">Reassign & schedule rework visit.</p>
                    </button>
                  </div>

                  {phase6Action === "follow_up" && (
                    <div className="p-3.5 rounded-xl bg-muted/40 border space-y-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1.5">Scheduled Follow-up Date & Time *</label>
                        <DateTimePicker
                          dateValue={followUpDate}
                          timeValue={followUpTime}
                          onDateChange={setFollowUpDate}
                          onTimeChange={setFollowUpTime}
                          placeholder="Pick follow-up date & time..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1">Follow-up Instructions</label>
                        <Textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} placeholder="Explain what needs to be checked during the follow-up visit..." rows={2} />
                      </div>
                    </div>
                  )}

                  {phase6Action === "rework" && (
                    <div className="p-3.5 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
                      <label className="text-xs font-semibold text-destructive block">Rework Reason / Instructions *</label>
                      <Textarea value={verificationNote} onChange={e => setVerificationNote(e.target.value)} placeholder="Explain why resolution was rejected and what technician must redo..." rows={3} />
                    </div>
                  )}

                  {/* Prerequisites warning when closing ticket */}
                  {phase6Action === "close" && (!ticket.feedback_collected || !(ticket.happiness_code_verified || codeVerifiedLocally)) && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          Required for Standard Closure:
                        </p>
                        <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded uppercase">
                          Admin Override Available
                        </span>
                      </div>
                      <div className="space-y-1 pl-4">
                        {!(ticket.happiness_code_verified || codeVerifiedLocally) && (
                          <p className="list-item">Customer Happiness Code is not yet verified.</p>
                        )}
                        {!ticket.feedback_collected && (
                          <p className="list-item">Customer satisfaction feedback has not been recorded yet.</p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-amber-500/20">
                        💡 <strong>Admin Note:</strong> If customer cannot provide the Happiness Code, you can record customer feedback above if available and click <strong>⚡ Force Close Ticket</strong> below to bypass the Happiness Code requirement.
                      </p>
                    </div>
                  )}

                   <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                     {/* Admin / Supervisor Force Close Button */}
               {isSupervisorOrAdmin && ticket.status !== 'closed' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleForceCloseTicket}
                        disabled={isForceClosing || isFinalizingClosure || updateMutation.isPending}
                        className="border-amber-400 text-amber-800 dark:border-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold text-xs h-10 px-4 shadow-xs"
                        title="Force close this ticket without requiring customer Happiness Code verification"
                      >
                        {isForceClosing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            Force Closing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-1.5" />
                            ⚡ Force Close Ticket (Skip Code)
                          </>
                        )}
                      </Button>
                    )}

                    <div className="flex items-center gap-2 sm:ml-auto">
                      <Button
                        onClick={handlePhase6Finalize}
                        disabled={
                          isFinalizingClosure || 
                          isForceClosing ||
                          updateMutation.isPending || 
                          (phase6Action === 'close' && (!ticket.feedback_collected || !(ticket.happiness_code_verified || codeVerifiedLocally)))
                        }
                        className={phase6Action === 'close' ? 'bg-success hover:bg-success/90 text-white font-semibold flex-1 sm:flex-initial' : phase6Action === 'follow_up' ? 'gradient-primary text-white flex-1 sm:flex-initial' : 'bg-destructive text-white flex-1 sm:flex-initial'}
                      >
                        {isFinalizingClosure ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                        {phase6Action === 'close' ? 'Finalize & Close Complaint' : phase6Action === 'follow_up' ? 'Schedule Follow-up Visit' : 'Send Back for Rework'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Timeline & Details */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Phase {currentPhase}: {phaseLabels[currentPhase as keyof typeof phaseLabels]}</h2>
          <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
            💡 Click phases below to view details
          </span>
        </div>
        <PhaseTimeline 
          currentPhase={currentPhase as any || 1} 
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
      </motion.div>
        </div>

        {/* Right/Sidebar Column (Details & Assigned Team) */}
        <div className="space-y-6 min-w-0 w-full">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium ml-2 truncate max-w-[200px] sm:max-w-none inline-block align-bottom">{customerName}</span>
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
              {(ticket.location || (ticket.customer_lat && ticket.customer_lng)) && (
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="break-words font-medium">{ticket.location || `${ticket.customer_lat}, ${ticket.customer_lng}`}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Button variant="outline" size="sm" onClick={openNavigation} className="text-xs h-7 text-primary border-primary/30 hover:bg-primary/5">
                      <Navigation className="w-3 h-3 mr-1" /> Open Map
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowTrackingModal(true)} className="text-xs h-7 text-muted-foreground hover:text-foreground">
                      🚗 Route Proof
                    </Button>
                  </div>
                </div>
              )}
              {ticket.field_of_work && (
                <div><span className="text-muted-foreground">Field:</span> <span className="font-medium ml-2">{ticket.field_of_work}</span></div>
              )}
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium ml-2 truncate max-w-[200px] sm:max-w-none inline-block align-bottom">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || "Customer"}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Created {formatIndianDateTime(ticket.created_at)}</div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Updated {formatIndianDateTime(ticket.updated_at)}</div>
              {ticket.description && (
                <div className="pt-3 border-t mt-3">
                  <span className="text-muted-foreground block mb-1">Description:</span>
                  <p className="font-normal text-slate-700 whitespace-pre-line break-words bg-muted/30 p-2.5 rounded-lg border overflow-hidden max-w-full">{ticket.description}</p>
                </div>
              )}
              {ticket.complaint_images && ticket.complaint_images.length > 0 && (
                <div className="pt-3 border-t mt-3">
                  <ImageGallery
                    images={ticket.complaint_images}
                    title="🔒 Phase 1: Customer Initial Proofs (Permanent)"
                    uploader="customer"
                  />
                </div>
              )}
              {ticket.technician_evidence && ticket.technician_evidence.length > 0 && (
                <div className="pt-3 border-t mt-3">
                  <ImageGallery
                    images={ticket.technician_evidence}
                    title="🔧 Phase 3 & 5: Technician Diagnostic & Resolution Proofs"
                    uploader="technician"
                  />
                </div>
              )}
              {ticket.signature_url && (
                <div className="pt-3 border-t mt-3 space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground block">✍️ Customer Sign-Off Signature:</span>
                  <div className="p-2 border rounded-lg bg-white inline-block">
                    <img src={ticket.signature_url} alt="Customer Signature" className="max-h-20 max-w-full object-contain" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Assigned Team</h2>
             {supervisorName && (
               <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 min-w-0">
                 <div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center text-white text-xs font-bold shrink-0">
                   {supervisorName.charAt(0).toUpperCase()}
                 </div>
                 <div className="min-w-0 flex-1">
                   <p className="font-medium text-sm truncate" title={supervisorName}>{supervisorName}</p>
                   <p className="text-xs text-muted-foreground">Supervisor</p>
                 </div>
               </div>
             )}
             {technicianName ? (
               <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 min-w-0">
                 <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-white text-xs font-bold shrink-0">
                   {technicianName.charAt(0).toUpperCase()}
                 </div>
                 <div className="min-w-0 flex-1">
                   <p className="font-medium text-sm truncate" title={technicianName}>{technicianName}</p>
                   <p className="text-xs text-muted-foreground">Technician</p>
                 </div>
               </div>
             ) : (
               <p className="text-sm text-muted-foreground italic">No technician assigned yet</p>
             )}
          </motion.div>
        </div>

      {showStartJourneyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              🚀 Start Journey
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Confirm your starting location. This will show on the customer's route map.
            </p>
            
            <div className="mt-4 space-y-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Starting Location / Landmark
              </label>
              <input
                type="text"
                placeholder="e.g. Shangri-la Plaza, Road No. 2, Banjara Hills"
                value={typedStartLocation}
                onChange={(e) => setTypedStartLocation(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                disabled={isDetectingGps}
              />
              {isDetectingGps ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Attempting to detect GPS location...
                </div>
              ) : detectedCoords ? (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  GPS coordinates detected: {detectedCoords.lat.toFixed(6)}, {detectedCoords.lng.toFixed(6)}
                </div>
              ) : (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  GPS blocked/unavailable. Please type your starting location above.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowStartJourneyModal(false);
                  setIsDetectingGps(false);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStartJourney}
                disabled={isDetectingGps}
                className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors shadow-lg shadow-primary/20 flex items-center gap-1"
              >
                Confirm & Start
              </button>
            </div>
          </div>
        </div>
      )}
      {showTrackingModal && (
        <LiveRouteTrackingModal
          complaintId={ticket.id}
          ticket={ticket}
          onClose={() => setShowTrackingModal(false)}
        />
      )}

      <Dialog open={showRemoteResolutionModal} onOpenChange={setShowRemoteResolutionModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remote Resolution Notes</DialogTitle>
            <DialogDescription>
              Describe how you resolved this issue remotely. This will be saved as the official resolution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={remoteResolutionNotes}
              onChange={(e) => setRemoteResolutionNotes(e.target.value)}
              placeholder="Describe how you resolved this issue remotely..."
              rows={5}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {remoteResolutionNotes.length}/1000 characters
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRemoteResolutionModal(false);
              setPendingRemoteResolution(null);
              setRemoteResolutionNotes("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleRemoteResolutionSave} disabled={!remoteResolutionNotes.trim()}>
              Save Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Revert back to Phase 2 (Telephonic Triage) */}
      <Dialog open={showRevertPhase2Modal} onOpenChange={setShowRevertPhase2Modal}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-600">
              <RotateCcw className="w-5 h-5" /> Revert back to Phase 2?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-2">
              If this complaint was marked as <strong>Resolved Remotely</strong> by mistake, reverting will:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-foreground">
                <li>Return ticket to <strong>Phase 2: Telephonic Triage</strong></li>
                <li>Reset ticket status back to <strong>Assigned</strong></li>
                <li>Clear remote resolution and leave supervisor notes freshly empty for dispatching field crew</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setShowRevertPhase2Modal(false)} disabled={isRevertingPhase2}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2 font-bold"
              onClick={handleRevertBackToPhase2}
              disabled={isRevertingPhase2}
            >
              {isRevertingPhase2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Confirm Revert to Phase 2
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Visit Assignment Modal (Phase 2 -> Phase 3) */}
      <Dialog open={showFieldVisitModal} onOpenChange={setShowFieldVisitModal}>
        <DialogContent className="sm:max-w-3xl w-[96vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-card max-w-full">
          {/* Sticky Header */}
          <div className="p-5 sm:p-6 pr-12 sm:pr-14 border-b border-border/60 bg-card/95 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
                  <span>Assign Field Visit Team</span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Phase 3 Dispatch
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>Select technicians, designate 1 Lead, and schedule visit for</span>
                  <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border/60 text-[11px]">
                    #{formatComplaintTicketId(ticket)}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {/* 1. Assignment History Panel */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Assignment History ({formatComplaintTicketId(ticket)})
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Current Status: <span className="text-primary font-bold uppercase">{ticket.status || "unassigned"}</span>
                </span>
              </div>

              {ticket.complaint_technicians && ticket.complaint_technicians.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {ticket.complaint_technicians.map((ct: any, idx: number) => (
                    <div key={ct.id || idx} className="flex items-center justify-between text-xs bg-card p-2 rounded-xl border border-border/60">
                      <div className="flex items-center gap-2 min-w-0">
                        {ct.is_lead ? (
                          <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-semibold text-foreground truncate">
                          {ct.technician?.full_name || ct.profiles?.full_name || "Technician"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({ct.is_lead ? "Lead" : "Assisting"})
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 shrink-0">
                        <span>Assigned: {ct.assigned_at ? new Date(ct.assigned_at).toLocaleDateString("en-IN") : "Recent"}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted font-medium text-[10px]">{ticket.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-0.5">
                  No previous technician assignments on record for this ticket.
                </p>
              )}
            </div>

            {/* 2. Selected Team Summary Strip */}
            {fieldVisitSelectedTechs.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2.5">
                <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" /> Selected Field Team ({fieldVisitSelectedTechs.length})
                  </span>
                  {!fieldVisitLeadTechId ? (
                    <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                      ⚠️ Please designate 1 Lead Technician
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Lead designated
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {fieldVisitSelectedTechs.map((tid) => {
                    const tech = allTechnicians.find((t: any) => t.id === tid);
                    const isLead = fieldVisitLeadTechId === tid;
                    return (
                      <div
                        key={tid}
                        className={`flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-xs transition-all shadow-xs ${
                          isLead
                            ? "bg-amber-50 dark:bg-amber-950/50 border-amber-400 text-amber-950 dark:text-amber-200 font-bold ring-1 ring-amber-400/40"
                            : "bg-card border-border/80 text-foreground"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isLead ? "bg-amber-400 text-amber-950" : "bg-muted text-foreground"
                          }`}
                        >
                          {(tech?.full_name || "T").charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[140px]">{tech?.full_name || "Technician"}</span>
                        {isLead ? (
                          <span className="text-[10px] uppercase tracking-wider bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5">
                            <Crown className="w-3 h-3 fill-amber-600 text-amber-600" /> Lead
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFieldVisitLeadTechId(tid)}
                            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold px-1 py-0.5 rounded hover:bg-amber-500/10 transition-colors"
                          >
                            Set Lead
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const next = fieldVisitSelectedTechs.filter((id) => id !== tid);
                            setFieldVisitSelectedTechs(next);
                            if (fieldVisitLeadTechId === tid) {
                              setFieldVisitLeadTechId(next.length > 0 ? next[0] : null);
                            }
                          }}
                          className="ml-1 text-muted-foreground hover:text-destructive text-sm font-bold w-4 h-4 flex items-center justify-center rounded-full hover:bg-destructive/10"
                          title="Remove from team"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Select Technician(s) with Search Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Select Technician(s) <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Check to add • Set 1 as Lead
                </span>
              </div>

              {/* Search input box */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search technicians by name, ID, designation, or expertise..."
                  value={fieldVisitTechSearch}
                  onChange={(e) => setFieldVisitTechSearch(e.target.value)}
                  className="h-9 pl-9 pr-8 text-xs bg-muted/30 rounded-xl border-border/70"
                />
                {fieldVisitTechSearch && (
                  <button
                    type="button"
                    onClick={() => setFieldVisitTechSearch("")}
                    className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 border border-border/70 rounded-2xl p-2 bg-muted/15">
                {(() => {
                  const filteredTechs = allTechnicians.filter((t: any) => {
                    if (!fieldVisitTechSearch.trim()) return true;
                    const q = fieldVisitTechSearch.toLowerCase();
                    return (
                      (t.full_name || "").toLowerCase().includes(q) ||
                      (t.technician_id || "").toLowerCase().includes(q) ||
                      (t.employee_id || "").toLowerCase().includes(q) ||
                      (t.designation || "").toLowerCase().includes(q) ||
                      (t.expertise || "").toLowerCase().includes(q) ||
                      (t.phone || "").toLowerCase().includes(q)
                    );
                  });

                  if (filteredTechs.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        {fieldVisitTechSearch ? `No technicians matching "${fieldVisitTechSearch}"` : "No technicians available."}
                      </p>
                    );
                  }

                  return filteredTechs.map((t: any) => {
                    const isChecked = fieldVisitSelectedTechs.includes(t.id);
                    const isLead = fieldVisitLeadTechId === t.id;
                    const techBadge = t.technician_id || t.employee_id || null;
                    const desigText = t.designation || null;
                    const expText = t.expertise || null;

                    return (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                          isChecked
                            ? isLead
                              ? "bg-amber-500/[0.08] border-amber-400 shadow-xs ring-1 ring-amber-400/30"
                              : "bg-primary/[0.06] border-primary/40 shadow-xs"
                            : "bg-card hover:bg-muted/40 border-border/60"
                        }`}
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                          onClick={() => {
                            if (!isChecked) {
                              const next = [...fieldVisitSelectedTechs, t.id];
                              setFieldVisitSelectedTechs(next);
                              if (next.length === 1 || !fieldVisitLeadTechId) {
                                setFieldVisitLeadTechId(t.id);
                              }
                            } else {
                              const next = fieldVisitSelectedTechs.filter((id) => id !== t.id);
                              setFieldVisitSelectedTechs(next);
                              if (fieldVisitLeadTechId === t.id) {
                                setFieldVisitLeadTechId(next.length > 0 ? next[0] : null);
                              }
                            }
                          }}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {}}
                            className="rounded-md shrink-0"
                          />
                          <div className="w-9 h-9 rounded-xl gradient-cool text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {(t.full_name || "T").charAt(0).toUpperCase()}
                          </div>
                          <div className="text-xs min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground text-sm">{t.full_name || t.email}</span>
                              {techBadge && (
                                <span className="px-1.5 py-0.5 rounded-md bg-muted text-primary text-[10px] font-mono font-bold border border-border/60">
                                  ID: {techBadge}
                                </span>
                              )}
                              {desigText && (
                                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20">
                                  {desigText}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                              {t.phone && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <Phone className="w-3 h-3 text-muted-foreground" /> {t.phone}
                                </span>
                              )}
                              {expText && (
                                <span className="flex items-center gap-1 text-primary truncate max-w-[280px]">
                                  <Wrench className="w-3 h-3 shrink-0" /> <span className="truncate">{expText}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="shrink-0">
                            {isLead ? (
                              <span className="px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-black bg-amber-500 text-white shadow-xs">
                                <Crown className="w-3.5 h-3.5 fill-white text-white" /> Lead
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFieldVisitLeadTechId(t.id);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-bold bg-muted hover:bg-amber-500 hover:text-white transition-all text-muted-foreground border border-border/60"
                                title="Click to designate as Lead"
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-500" /> Set Lead
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* 4. Schedule Field Visit: Combined Date & Time with Interactive Calendar & Time Picker */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Schedule Field Visit <span className="text-destructive">*</span>
                </span>
                <span className="text-[11px] text-muted-foreground">Click field to pick date & time</span>
              </div>

              <DateTimePicker
                dateValue={fieldVisitScheduledDate}
                timeValue={fieldVisitScheduledTime}
                onDateChange={setFieldVisitScheduledDate}
                onTimeChange={setFieldVisitScheduledTime}
                placeholder="Select field visit date & time..."
              />

              {/* Quick Presets Bar */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mr-0.5">
                  Quick:
                </span>
                <button
                  type="button"
                  onClick={() => setFieldVisitScheduledDate(new Date().toISOString().split("T")[0])}
                  className="text-[11px] px-2.5 py-0.5 rounded-lg bg-card border border-border/60 text-foreground font-semibold hover:border-primary transition-colors shadow-2xs"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tmrw = new Date();
                    tmrw.setDate(tmrw.getDate() + 1);
                    setFieldVisitScheduledDate(tmrw.toISOString().split("T")[0]);
                  }}
                  className="text-[11px] px-2.5 py-0.5 rounded-lg bg-card border border-border/60 text-foreground font-semibold hover:border-primary transition-colors shadow-2xs"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setFieldVisitScheduledTime("10:00")}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-card border border-border/60 text-foreground font-semibold hover:border-primary transition-colors shadow-2xs"
                >
                  10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setFieldVisitScheduledTime("14:00")}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-card border border-border/60 text-foreground font-semibold hover:border-primary transition-colors shadow-2xs"
                >
                  02:00 PM
                </button>
                <button
                  type="button"
                  onClick={() => setFieldVisitScheduledTime("17:00")}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-card border border-border/60 text-foreground font-semibold hover:border-primary transition-colors shadow-2xs"
                >
                  05:00 PM
                </button>
              </div>
            </div>

            {/* 5. Supervisor Diagnostic / Initial Instructions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-foreground">
                  Supervisor Instructions for Field Team
                </label>
                <span className="text-[11px] text-muted-foreground font-medium">Optional</span>
              </div>
              <Textarea
                placeholder="Detail technical instructions, required tools, or customer preferences for the field engineers..."
                value={fieldVisitSupervisorNotes}
                onChange={(e) => setFieldVisitSupervisorNotes(e.target.value)}
                rows={2}
                className="resize-none text-xs bg-card rounded-xl border-border/70"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Site inspection & diagnosis",
                  "Carry replacement spare parts",
                  "Customer requested morning visit",
                  "Priority warranty repair"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setFieldVisitSupervisorNotes((prev) =>
                        prev ? `${prev.trim()}, ${preset}` : preset
                      );
                    }}
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-muted/60 hover:bg-muted text-foreground transition-colors font-medium border border-border/50"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Footer: ALWAYS Visible at Bottom */}
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/30 backdrop-blur-md shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 pb-6">
            <div className="text-xs">
              {fieldVisitSelectedTechs.length === 0 ? (
                <span className="text-destructive font-semibold flex items-center gap-1.5">
                  ⚠️ Select at least 1 technician for dispatch
                </span>
              ) : !fieldVisitLeadTechId ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  ⚠️ Please designate 1 Lead Technician
                </span>
              ) : !fieldVisitScheduledDate || !fieldVisitScheduledTime ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  ⚠️ Please pick a Scheduled Date & Time
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Ready to dispatch: {fieldVisitSelectedTechs.length} tech(s) (
                  {allTechnicians.find((t: any) => t.id === fieldVisitLeadTechId)?.full_name || "Lead"} as Lead)
                </span>
              )}
            </div>

             <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFieldVisitModal(false)}
                disabled={isAssigningFieldVisit}
                className="rounded-xl h-10 px-4 text-xs font-bold w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="gradient-primary rounded-xl font-bold h-10 px-5 text-xs shadow-md w-full sm:w-auto"
                onClick={handleConfirmFieldVisit}
                disabled={
                  isAssigningFieldVisit ||
                  fieldVisitSelectedTechs.length === 0 ||
                  !fieldVisitLeadTechId ||
                  !fieldVisitScheduledDate ||
                  !fieldVisitScheduledTime
                }
              >
                {isAssigningFieldVisit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Dispatching Field Team...
                  </>
                ) : (
                  <>
                    <Wrench className="w-3.5 h-3.5 mr-2" /> Confirm Field Visit & Dispatch
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassignment Modal */}
      <Dialog open={showReassignModal} onOpenChange={(open) => {
        setShowReassignModal(open);
        if (!open) {
          setReassignSearchTerm("");
        }
      }}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0">
          <div className="p-6 border-b bg-gradient-to-r from-primary/5 via-card to-card">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  Reassign Technicians & Crew
                </DialogTitle>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-muted text-muted-foreground border">
                  #{formatComplaintTicketId(ticket)}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1.5">
                Assign a new field team or update lead responsibility for this complaint ticket.
              </DialogDescription>
            </DialogHeader>

            {/* 48h Post-Closure Notice Banner */}
            {(ticket?.status === 'closed' || ticket?.status === 'resolved' || ticket?.status === 'qa_verified' || ticket?.closed_at) && (
              <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="font-semibold">48-Hour Post-Closure Reassignment Window:</span>{" "}
                  {getReassignRemainingHours() !== null ? (
                    <span><strong>{getReassignRemainingHours()} hours remaining</strong> to reassign this ticket after closure. Once 48 hours pass, reassignment will be locked.</span>
                  ) : (
                    <span>Ticket was previously closed. Reassignment is available within 48 hours of closure.</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 space-y-5">
            {/* Selected Team Overview Strip */}
            {reassignSelectedTechs.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" /> Selected Team ({reassignSelectedTechs.length})
                  </span>
                  {!reassignLeadTechId && (
                    <span className="text-xs font-semibold text-destructive animate-pulse flex items-center gap-1">
                      ⚠️ Please designate 1 Lead
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {reassignSelectedTechs.map((tid) => {
                    const tech = allTechnicians.find((t: any) => t.id === tid);
                    const isLead = reassignLeadTechId === tid;
                    const name = tech?.full_name || tech?.email || "Technician";

                    return (
                      <div
                        key={tid}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                          isLead
                            ? "bg-amber-500 text-white font-bold border-amber-600 shadow-xs"
                            : "bg-muted text-foreground border-border"
                        }`}
                      >
                        {isLead ? (
                          <Crown className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                        ) : (
                          <User className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="max-w-[140px] truncate">{name}</span>
                        {isLead && <span className="text-[10px] opacity-90">(Lead)</span>}
                        
                        <button
                          type="button"
                          onClick={() => {
                            const next = reassignSelectedTechs.filter((id) => id !== tid);
                            setReassignSelectedTechs(next);
                            if (reassignLeadTechId === tid) {
                              setReassignLeadTechId(next.length > 0 ? next[0] : null);
                            }
                          }}
                          className={`ml-1 rounded-full p-0.5 hover:bg-black/20 transition-colors ${isLead ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                          title="Remove from team"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Technician Selection & Search */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" /> Assign Technicians <span className="text-destructive">*</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {allTechnicians.filter((t: any) => {
                    if (!reassignSearchTerm.trim()) return true;
                    const q = reassignSearchTerm.toLowerCase();
                    const name = (t.full_name || "").toLowerCase();
                    const email = (t.email || "").toLowerCase();
                    const techId = (t.technician_id || "").toLowerCase();
                    const phone = (t.phone || "").toLowerCase();
                    const desig = (t.designation || t.expertise || "").toLowerCase();
                    return name.includes(q) || email.includes(q) || techId.includes(q) || phone.includes(q) || desig.includes(q);
                  }).length} available
                </span>
              </div>

              {/* Search Filter Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search technician by name, ID, phone, or specialty..."
                  value={reassignSearchTerm}
                  onChange={(e) => setReassignSearchTerm(e.target.value)}
                  className="pl-9 pr-8 text-xs h-9 bg-muted/20"
                />
                {reassignSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setReassignSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Technician Cards List */}
              <div className="max-h-60 overflow-y-auto space-y-2 border rounded-xl p-2.5 bg-muted/10 divide-y divide-border/40">
                {allTechnicians.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    No technicians found in system.
                  </div>
                ) : (
                  (() => {
                    const filtered = allTechnicians.filter((t: any) => {
                      if (!reassignSearchTerm.trim()) return true;
                      const q = reassignSearchTerm.toLowerCase();
                      const name = (t.full_name || "").toLowerCase();
                      const email = (t.email || "").toLowerCase();
                      const techId = (t.technician_id || "").toLowerCase();
                      const phone = (t.phone || "").toLowerCase();
                      const desig = (t.designation || t.expertise || "").toLowerCase();
                      return name.includes(q) || email.includes(q) || techId.includes(q) || phone.includes(q) || desig.includes(q);
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-6 text-xs text-muted-foreground">
                          <p>No technicians matching "{reassignSearchTerm}"</p>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="text-xs h-auto p-0 mt-1 text-primary"
                            onClick={() => setReassignSearchTerm("")}
                          >
                            Clear search filter
                          </Button>
                        </div>
                      );
                    }

                    return filtered.map((t: any) => {
                      const isChecked = reassignSelectedTechs.includes(t.id);
                      const isLead = reassignLeadTechId === t.id;
                      const staffId = t.technician_id || t.staff_id;
                      const desig = t.designation || t.expertise || "Technician";

                      return (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all pt-2.5 pb-2.5 ${
                            isChecked
                              ? isLead
                                ? "bg-amber-500/10 border-amber-400/80 shadow-xs ring-1 ring-amber-400/30"
                                : "bg-primary/5 border-primary/40 shadow-xs"
                              : "bg-card hover:bg-muted/40 border-border/60"
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const next = [...reassignSelectedTechs, t.id];
                                  setReassignSelectedTechs(next);
                                  if (next.length === 1 || !reassignLeadTechId) {
                                    setReassignLeadTechId(t.id);
                                  }
                                } else {
                                  const next = reassignSelectedTechs.filter((id) => id !== t.id);
                                  setReassignSelectedTechs(next);
                                  if (reassignLeadTechId === t.id) {
                                    setReassignLeadTechId(next.length > 0 ? next[0] : null);
                                  }
                                }
                              }}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground truncate">
                                  {t.full_name || t.email}
                                </span>
                                {staffId && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                    {staffId}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span>{desig}</span>
                                {t.phone && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5" /> {t.phone}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </label>

                          <div className="flex items-center gap-2 shrink-0">
                            {isChecked && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setReassignLeadTechId(t.id);
                                }}
                                className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 font-bold transition-all ${
                                  isLead
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950 dark:hover:text-amber-300"
                                }`}
                                title={isLead ? "Designated Lead Technician" : "Click to designate as Lead Technician"}
                              >
                                <Crown className={`w-3.5 h-3.5 ${isLead ? "fill-white text-white" : "text-amber-600 dark:text-amber-400"}`} />
                                {isLead ? "👑 Lead" : "Make Lead"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            {/* Reassignment Reason with Quick Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Reason for Reassignment <span className="text-destructive">*</span>
                </label>
                <span className={`text-xs font-medium ${reassignReason.trim().length >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {reassignReason.trim().length}/10 min chars
                </span>
              </div>

              {/* Quick Preset Reason Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Quick reasons:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Technician unavailable / on leave",
                    "Specialized skill / tool required",
                    "Customer requested reschedule",
                    "Field visit delay / SLA escalation",
                    "Area territory coverage re-alignment"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReassignReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                        reassignReason === preset
                          ? "bg-primary text-primary-foreground font-semibold border-primary"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                placeholder="Detail why this complaint is being reassigned (minimum 10 characters)..."
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                rows={3}
                className="resize-none text-xs bg-muted/20"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowReassignModal(false);
                setReassignSearchTerm("");
              }}
              disabled={isReassigning}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gradient-primary text-xs font-bold shadow-md"
              onClick={handleConfirmReassign}
              disabled={
                isReassigning ||
                reassignReason.trim().length < 10 ||
                reassignSelectedTechs.length === 0 ||
                !reassignLeadTechId
              }
            >
              {isReassigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reassigning...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Confirm Reassignment ({reassignSelectedTechs.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request More Information Modal (Supervisor -> Send back to Lead) */}
      <Dialog open={showPirRejectModal} onOpenChange={setShowPirRejectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <HelpCircle className="w-5 h-5" />
              Request More Information on PIR
            </DialogTitle>
            <DialogDescription>
              Explain what additional information, diagnostic tests, or photos/evidence the technician needs to provide before this PIR can be approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold block text-foreground">
              Information Required from Technician <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="e.g. Please upload clear photos of the wiring and provide details on the compressor pressure reading..."
              value={pirRejectReason}
              onChange={(e) => setPirRejectReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPirRejectModal(false)}
              disabled={isRejectingPir}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRejectPir}
              disabled={isRejectingPir || !pirRejectReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {isRejectingPir ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                </>
              ) : (
                "Send Request to Technician"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔄 Return for Rework Modal (Supervisor -> Reassign, Reschedule & Send Back) */}
      <Dialog open={showReworkModal} onOpenChange={setShowReworkModal}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 max-w-full overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <RotateCcw className="w-5 h-5 text-destructive" /> Return Ticket for Rework
            </DialogTitle>
            <DialogDescription>
              Specify the rework instructions, pick a return phase, set the new scheduled date/time, and reassign the technician team for Ticket #{formatComplaintTicketId(ticket)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* 1. Target Phase for Rework */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Send Back To Phase <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReworkTargetPhase(3)}
                  className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all text-xs ${
                    reworkTargetPhase === 3
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold ring-2 ring-amber-500"
                      : "border-border hover:border-amber-400/50 bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span className="font-bold">Phase 3 (Dispatch)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-normal break-words">
                    Requires on-site re-visit, re-travel, and new diagnosis.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReworkTargetPhase(5)}
                  className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all text-xs ${
                    reworkTargetPhase === 5
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500"
                      : "border-border hover:border-indigo-400/50 bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold">Phase 5 (Resolution)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-normal break-words">
                    PIR is accepted, technician must redo fix/proof/sign-off.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. New Scheduled Date & Time */}
             <div className="bg-muted/30 p-3.5 rounded-xl border space-y-1.5 w-full">
               <label className="text-xs font-semibold block text-foreground">
                 New Scheduled Date & Time <span className="text-destructive">*</span>
               </label>
               <div className="w-full">
                 <DateTimePicker
                   dateValue={reworkScheduledDate}
                   timeValue={reworkScheduledTime}
                   onDateChange={setReworkScheduledDate}
                   onTimeChange={setReworkScheduledTime}
                   placeholder="Pick new scheduled date & time..."
                 />
               </div>
             </div>

            {/* 3. Rework Instructions / Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block text-foreground">
                Rework Reason & Instructions for Technicians <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Detail what was unsatisfactory, specific parts to re-check, customer complaints about the fix, or testing steps..."
                value={reworkInstructions}
                onChange={(e) => setReworkInstructions(e.target.value)}
                rows={3}
                className="bg-background text-xs"
              />
            </div>

            {/* 4. Technician Assignment & Lead Selection */}
            <div className="space-y-2 border rounded-xl p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground block">
                  Assign Technicians for Rework ({reworkSelectedTechs.length} selected) <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">Select team members</span>
              </div>

              {allTechnicians.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active technicians found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {allTechnicians.map((tech: any) => {
                    const isSelected = reworkSelectedTechs.includes(tech.id);
                    const isLead = reworkLeadTechId === tech.id;
                    return (
                      <div
                        key={tech.id}
                        className={`w-full p-2 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                          isSelected ? "bg-primary/10 border-primary/40 text-foreground" : "bg-background border-border text-muted-foreground"
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const next = [...reworkSelectedTechs, tech.id];
                                setReworkSelectedTechs(next);
                                if (!reworkLeadTechId) setReworkLeadTechId(tech.id);
                              } else {
                                const next = reworkSelectedTechs.filter((id) => id !== tech.id);
                                setReworkSelectedTechs(next);
                                if (reworkLeadTechId === tech.id) {
                                  setReworkLeadTechId(next[0] || null);
                                }
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <span className="truncate font-medium">{tech.full_name || tech.email}</span>
                        </label>

                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => setReworkLeadTechId(tech.id)}
                            title={isLead ? "Designated Lead Technician" : "Click to make Lead Technician"}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                              isLead ? "bg-amber-500 text-amber-950 shadow-xs" : "bg-muted text-muted-foreground hover:bg-amber-500/20 hover:text-amber-700"
                            }`}
                          >
                            <Crown className={`w-3 h-3 ${isLead ? "fill-amber-950 text-amber-950" : ""}`} />
                            {isLead ? "Lead" : "Make Lead"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3 flex flex-col sm:flex-row">
             <Button
               type="button"
               variant="outline"
               onClick={() => setShowReworkModal(false)}
               disabled={isSubmittingRework}
               className="w-full sm:w-auto"
             >
               Cancel
             </Button>
             <Button
               type="button"
               onClick={handleConfirmRework}
               disabled={
                 isSubmittingRework ||
                 !reworkScheduledDate ||
                 !reworkInstructions.trim() ||
                 reworkSelectedTechs.length === 0
               }
               className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold w-full sm:w-auto"
             >
               {isSubmittingRework ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling Rework...
                 </>
               ) : (
                 <>
                   <RotateCcw className="w-4 h-4 mr-1.5" /> Confirm & Return to Phase {reworkTargetPhase}
                 </>
               )}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
};

export default ComplaintDetail;
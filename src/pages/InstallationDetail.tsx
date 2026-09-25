import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useQuery } from '@tanstack/react-query';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Navigation,
  Copy,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  Edit3,
  User,
  Star,
  Check,
  X,
  ExternalLink,
  RotateCcw,
  Calendar,
  Zap,
  RefreshCw,
  Eye,
  History,
  Crown,
  Users
} from 'lucide-react';
import { installationService, formatInstallationTicketId } from '@/services/installationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ManualWhatsAppButton } from '@/components/ManualWhatsAppButton';
import OffCanvasPanel from '@/components/OffCanvasPanel';
import {
  sendWhatsAppMessage,
  getCustomerPhone,
  getCustomerName,
  getInstallationSignOffMessage,
  getInstallationClosedMessage,
  getTicketFullSummaryMessage,
} from '@/utils/whatsappService';
import { notificationService, type Notification } from '@/services/notificationService';
import {
  INSTALLATION_STATUSES,
  getInstallationStatusLabel,
} from '@/constants/installationStatuses';

// Local cache helpers to preserve completion evidence & happiness codes across schema cache variations
const getLocalInstallationData = (instId: string) => {
  try {
    if (!instId) return {};
    const key = `btl_inst_execution_${instId}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch (e) {
    return {};
  }
};

const saveLocalInstallationData = (instId: string, data: any) => {
  try {
    if (!instId) return;
    const key = `btl_inst_execution_${instId}`;
    const existing = getLocalInstallationData(instId);
    localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
  } catch (e) {
    console.warn("Failed to persist local installation execution data:", e);
  }
};

export default function InstallationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [installation, setInstallation] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [isLeadTechnician, setIsLeadTechnician] = useState(false);
  const [isAssignedTechnician, setIsAssignedTechnician] = useState(false);
  
  // Interactive Phase Timeline State
  const [activePhase, setActivePhase] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    equipment_model: '',
    serial_number: '',
    installation_notes: '',
    testing_results: ''
  });
  
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([]);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Material Shortage State
  const [materialShortageDetails, setMaterialShortageDetails] = useState('');
  const [materialShortagePhotos, setMaterialShortagePhotos] = useState<any[]>([]);
  
  // Force Close Modal & Data State
  const [showForceCloseModal, setShowForceCloseModal] = useState(false);
  const [forceCloseReason, setForceCloseReason] = useState('');
  const [forceCloseComments, setForceCloseComments] = useState('');
  const [isForceClosing, setIsForceClosing] = useState(false);

  // Admin Verification Form Visibility
  const [showAdminVerification, setShowAdminVerification] = useState(false);

  // Admin Edit Modal State
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);
  const [adminEditData, setAdminEditData] = useState<any>({});
  const [isSavingAdminEdit, setIsSavingAdminEdit] = useState(false);

  // Admin Happiness Code & Final Action State
  const [enteredHappinessCode, setEnteredHappinessCode] = useState('');
  const [customerSatisfaction, setCustomerSatisfaction] = useState('');
  const [customerComments, setCustomerComments] = useState('');
  const [happinessCodeVerified, setHappinessCodeVerified] = useState(false);
  const [happinessCodeError, setHappinessCodeError] = useState(false);
  const [finalAction, setFinalAction] = useState<'close' | 'followup' | 'rework' | null>(null);
  const [followupReason, setFollowupReason] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupTime, setFollowupTime] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignSelectedTechs, setReassignSelectedTechs] = useState<string[]>([]);
  const [reassignLeadTechId, setReassignLeadTechId] = useState<string | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [reassignSearchTerm, setReassignSearchTerm] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  
  const sigRef = useRef<any>(null);

  const openAdminEdit = () => {
    if (!installation) return;
    const rawStatus = String(installation.status || '').trim();
    const lower = rawStatus.toLowerCase();
    const workflowToAdminStatus: Record<string, string> = {
      unassigned: 'Unassigned',
      assigned: 'Assigned',
      en_route: 'Assigned',
      dispatched: 'Dispatched',
      arrived: 'In Progress',
      in_progress: 'In Progress',
      completed: 'Site Completed and Handed Over',
      verified: 'Verified',
      closed: 'Verified',
      force_closed: 'Verified',
      revision_requested: 'In Progress',
      pending_material_shortage: 'Pending due to Material Shortage',
      'work in progress': 'In Progress',
      'configuration pending': 'In Progress',
      'signature pending due to client unavailability': 'In Progress',
    };
    const adminStatuses = INSTALLATION_STATUSES;
    const normalizedStatus =
      workflowToAdminStatus[lower] ||
      adminStatuses.find((s) => s.toLowerCase() === lower) ||
      (adminStatuses.includes(rawStatus) ? rawStatus : null) ||
      (rawStatus || 'Assigned');

    setAdminEditData({
      equipment_details: installation.equipment_details || '',
      equipment_model: installation.equipment_model || installation.brand || '',
      brand: installation.brand || '',
      serial_number: installation.serial_number || '',
      priority: installation.priority || 'Medium',
      is_chargeable: installation.is_chargeable ? 'Yes' : 'No',
      service_charge: installation.service_charge || 0,
      notes: installation.notes || installation.installation_notes || '',
      testing_results: installation.testing_results || '',
      non_btl_customer_name: installation.non_btl_customer_name || '',
      non_btl_contact_number: installation.non_btl_contact_number || '',
      non_btl_address: installation.non_btl_address || '',
      status: normalizedStatus,
    });
    setShowAdminEditModal(true);
  };

  const { data: allTechnicians = [] } = useQuery({
    queryKey: ['technicians-list-for-installation-reassign'],
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
      return data || [];
    },
  });

  const getReassignRemainingHours = (): number | null => {
    if (!installation) return null;
    const isClosed = currentStatusLower === 'verified' || currentStatusLower === 'force_closed' || installation?.force_closed || currentStatusLower === 'closed';
    if (!isClosed) return null;
    const closedDateStr = installation.verified_at || installation.force_closed_at || installation.updated_at;
    if (!closedDateStr) return 48;
    const closedDate = new Date(closedDateStr).getTime();
    if (isNaN(closedDate)) return null;
    const now = Date.now();
    const hoursSinceClosed = (now - closedDate) / (1000 * 60 * 60);
    if (hoursSinceClosed > 48) return null;
    return Math.max(0, Math.round((48 - hoursSinceClosed) * 10) / 10);
  };

  const canReassign = (): boolean => {
    if (!isAdmin && !isSupervisor) return false;
    const isClosed = currentStatusLower === 'verified' || currentStatusLower === 'force_closed' || installation?.force_closed || currentStatusLower === 'closed';
    if (!isClosed) return true;
    const closedDateStr = installation.verified_at || installation.force_closed_at || installation.updated_at;
    if (!closedDateStr) return true;
    const closedDate = new Date(closedDateStr).getTime();
    if (isNaN(closedDate)) return true;
    const now = Date.now();
    const hoursSinceClosed = (now - closedDate) / (1000 * 60 * 60);
    return hoursSinceClosed <= 48;
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
      toast.error("Please designate exactly one Lead Technician.");
      return;
    }

    setIsReassigning(true);
    try {
      const techPayload = reassignSelectedTechs.map((tid) => ({
        technician_id: tid,
        is_lead: tid === reassignLeadTechId,
      }));

      await installationService.reassignTechnicians(id!, techPayload, reassignReason);

      toast.success("Installation reassigned successfully! Status set to Assigned.");
      setShowReassignModal(false);
      setReassignReason('');
      setReassignSelectedTechs([]);
      setReassignLeadTechId(null);
      setReassignSearchTerm('');
      fetchInstallation();
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign installation");
    } finally {
      setIsReassigning(false);
    }
  };

  const saveAdminEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSavingAdminEdit(true);
    try {
      const isChargeableBool = adminEditData.is_chargeable === 'Yes';
      const payload: any = {
        equipment_details: adminEditData.equipment_details || null,
        equipment_model: adminEditData.equipment_model || null,
        brand: adminEditData.brand || null,
        serial_number: adminEditData.serial_number || null,
        priority: adminEditData.priority,
        is_chargeable: isChargeableBool,
        service_charge: isChargeableBool ? Number(adminEditData.service_charge) || 0 : 0,
        notes: adminEditData.notes || null,
        testing_results: adminEditData.testing_results || null,
        status: adminEditData.status,
        updated_at: new Date().toISOString()
      };

      if (installation.customer_type !== 'Existing BTL Customer' || installation.non_btl_customer_name) {
        payload.non_btl_customer_name = adminEditData.non_btl_customer_name || null;
        payload.non_btl_contact_number = adminEditData.non_btl_contact_number || null;
        payload.non_btl_address = adminEditData.non_btl_address || null;
      }

      const { error } = await supabase
        .from('installations')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      toast.success('Installation updated successfully!');
      setShowAdminEditModal(false);
      fetchInstallation();
    } catch (err: any) {
      toast.error(`Failed to update installation: ${err?.message || 'Error'}`);
    } finally {
      setIsSavingAdminEdit(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchInstallation();
  }, [id]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser(data);
    }
  };

  const fetchInstallation = async () => {
    if (!id) return;
    try {
      let instData: any = null;

      // 1. Try full join query
      const { data: deepData, error: deepError } = await supabase
        .from('installations')
        .select(`
          *,
          customer:customers(id, full_name, phone, email, customer_type),
          location:customer_locations(address, city, location_name),
          technicians:installation_technicians(
            id,
            technician_id,
            technician:profiles!installation_technicians_technician_id_fkey (
              id,
              full_name,
              phone,
              email,
              role
            ),
            is_lead
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (!deepError && deepData) {
        console.log('[InstallationDetail] deepData.technicians:', deepData.technicians);
        instData = deepData;
      } else {
        // Strategy 2: Fallback to flat query + manual join
        console.warn("Deep query failed or constrained, using fallback strategy:", deepError?.message);
        
        const { data: baseInst, error: baseError } = await supabase
          .from('installations')
          .select('*')
          .eq('id', id)
          .single();

        if (baseError) throw baseError;
        instData = baseInst;

        // Manually fetch customer if linked
        if (baseInst.customer_id) {
          try {
            const { data: cust } = await supabase
              .from('customers')
              .select('id, full_name, phone, email, customer_type')
              .eq('id', baseInst.customer_id)
              .single();
            if (cust) instData.customer = cust;
          } catch (e) {
            console.warn("Sub-fetch customer warning:", e);
          }
        }

        // Manually fetch technicians
        try {
          const { data: techLinks, error: techLinksError } = await supabase
            .from('installation_technicians')
            .select('technician_id, is_lead')
            .eq('installation_id', id);

          console.log('[InstallationDetail] techLinks:', techLinks, 'error:', techLinksError);

          if (techLinks && techLinks.length > 0) {
            const techIds = techLinks.map((tl: any) => tl.technician_id).filter(Boolean);
            console.log('[InstallationDetail] techIds:', techIds);
            if (techIds.length > 0) {
              const { data: profs, error: profsError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', techIds);

              console.log('[InstallationDetail] profs:', profs, 'error:', profsError);

              instData.technicians = techLinks.map((tl: any) => {
                const p = profs?.find((prof: any) => prof.id === tl.technician_id);
                const techData = p ? {
                  ...p,
                  full_name: p.full_name || p.designation || p.email || 'Technician'
                } : { id: tl.technician_id, full_name: 'Technician', employee_id: null, role: 'technician' };
                return {
                  technician_id: tl.technician_id,
                  is_lead: tl.is_lead,
                  technician: techData
                };
              });
            }
          }
        } catch (e) {
          console.warn("Sub-fetch technicians warning:", e);
        }
      }

      if (instData) {
        // Merge with local storage cache to preserve completed data & happiness code if DB schema cache lacks columns
        const localCached = getLocalInstallationData(id || '');
        if (!instData.happiness_code && localCached.happiness_code) {
          instData.happiness_code = localCached.happiness_code;
        }
        if (!instData.customer_signature && localCached.customer_signature) {
          instData.customer_signature = localCached.customer_signature;
        }
        if ((!instData.evidence_photos || instData.evidence_photos.length === 0) && localCached.evidence_photos) {
          instData.evidence_photos = localCached.evidence_photos;
        }
        if (!instData.equipment_model && localCached.equipment_model) {
          instData.equipment_model = localCached.equipment_model;
        }
        if (!instData.serial_number && localCached.serial_number) {
          instData.serial_number = localCached.serial_number;
        }
        if (!instData.installation_notes && localCached.installation_notes) {
          instData.installation_notes = localCached.installation_notes;
        }
        if (!instData.testing_results && localCached.testing_results) {
          instData.testing_results = localCached.testing_results;
        }
        if (!instData.completed_at && localCached.completed_at) {
          instData.completed_at = localCached.completed_at;
        }

        setInstallation(instData);
        const st = getInstallationStatusLabel(instData.status || '').toLowerCase();
        let phase = instData.current_phase || 1;
        if (st === 'verified' || instData.force_closed) phase = 6;
        else if (st === 'site completed and handed over') phase = 5;
        else if (st === 'in progress') phase = 4;
        else if (st === 'dispatched') phase = 3;
        else if (st === 'assigned') phase = 2;
        else if (st === 'unassigned') phase = 1;
        setCurrentPhase(phase);
        
        setFormData({
          equipment_model: instData.equipment_model || instData.equipment_scope || instData.brand || instData.brand_oem || '',
          serial_number: instData.serial_number || '',
          installation_notes: instData.installation_notes || instData.scope_instructions || instData.notes || '',
          testing_results: instData.testing_results || ''
        });

        if (instData.evidence_photos && Array.isArray(instData.evidence_photos)) {
          setUploadedPhotos(instData.evidence_photos);
        }

        if (instData.customer_signature) {
          setSignatureData(instData.customer_signature);
          setSignatureCaptured(true);
        }

        if (instData.customer_satisfaction) {
          setCustomerSatisfaction(instData.customer_satisfaction);
        }
        if (instData.customer_feedback_comments || instData.feedback_comments) {
          setCustomerComments(instData.customer_feedback_comments || instData.feedback_comments || '');
        }
        if (instData.happiness_code_verified || st === 'verified') {
          setHappinessCodeVerified(true);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const leadTech = instData.technicians?.find((t: any) => t.is_lead === true || t.is_lead === 'true');
          const assignedTech = instData.technicians?.find((t: any) => {
            const techId = t.technician_id || t.technician?.id;
            return techId === user.id;
          });

          const isLead = 
            (leadTech && (leadTech.technician_id === user.id || leadTech.technician?.id === user.id)) ||
            instData.lead_technician_id === user.id;

          setIsLeadTechnician(isLead);
          setIsAssignedTechnician(!!assignedTech || isLead);

          console.log('[InstallationDetail] Current User ID:', user.id);
          console.log('[InstallationDetail] Lead Tech ID from DB:', instData.lead_technician_id);
          console.log('[InstallationDetail] Technicians array:', instData.technicians);
          console.log('[InstallationDetail] isLeadTechnician:', isLead);
          console.log('[InstallationDetail] isAssignedTechnician:', !!assignedTech || isLead);
        }
      }
    } catch (e) {
      console.warn("Error in fetchInstallation:", e);
    }
  };

  // 1. FIX GPS PERMISSION ISSUE WITH HIGH ACCURACY & EXPLICIT ERROR MAPPING
  const handleArrivedGPS = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    try {
      toast.info("Capturing your live GPS coordinates...");
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
                reject(new Error('GPS request timed out'));
                break;
              default:
                reject(new Error('An unknown error occurred while capturing GPS'));
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      const { error } = await supabase
        .from('installations')
        .update({
          current_phase: 4,
          arrival_gps_lat: position.coords.latitude,
          arrival_gps_lng: position.coords.longitude,
          arrival_time: new Date().toISOString(),
          status: 'In Progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('GPS arrival recorded successfully! Status updated to In Progress.');
      setCurrentPhase(4);
      fetchInstallation();
    } catch (error) {
      console.error('GPS Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to capture GPS location');
      
      // Resilient fallback so field technician is never blocked from marking arrival
      try {
        await supabase
          .from('installations')
          .update({
            current_phase: 4,
            arrival_time: new Date().toISOString(),
            status: 'In Progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        toast.info('Arrival marked successfully (without GPS coordinates).');
        setCurrentPhase(4);
        fetchInstallation();
      } catch (fallbackErr) {
        console.error('Fallback arrival update error:', fallbackErr);
      }
    }
  };

  const handleManualStatusChange = async (newStatus: string) => {
    try {
      let nextPhase = currentPhase;
      const lower = newStatus.toLowerCase();
      if (lower === 'unassigned') nextPhase = 1;
      else if (lower === 'assigned') nextPhase = 2;
      else if (lower === 'dispatched') nextPhase = 3;
      else if (lower === 'in progress') nextPhase = 4;
      else if (lower === 'pending due to material shortage') nextPhase = 2;
      else if (lower === 'site completed and handed over') nextPhase = 5;
      else if (lower === 'verified') nextPhase = 6;

      const payload: any = {
        status: newStatus,
        current_phase: nextPhase,
        updated_at: new Date().toISOString()
      };

      if (lower === 'pending due to material shortage') {
        payload.notes = materialShortageDetails || installation.notes || 'Pending due to material shortage';
        if (materialShortagePhotos.length > 0) {
          payload.evidence_photos = materialShortagePhotos.map(p => p.url || p);
        }
      }

      const { error } = await supabase
        .from('installations')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      
      setCurrentPhase(nextPhase);
      
      if (lower === 'pending due to material shortage') {
        toast.success('Status updated: Pending due to Material Shortage. Admin/Supervisor has been notified.');
      } else {
        toast.success(`Status updated to: ${newStatus}`);
      }
      
      fetchInstallation();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err?.message || 'Error'}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    for (const file of files) {
      const fileUrl = URL.createObjectURL(file);
      setUploadedPhotos(prev => [...prev, { url: fileUrl, file, uploading: true }]);
      
      const fileName = `${id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('installation-evidence')
        .upload(fileName, file);
      
      if (error) {
        console.warn("installation-evidence bucket failed, attempting complaint-evidence:", error);
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from('complaint-evidence')
          .upload(fileName, file);

        if (fallbackError) {
          toast.error(`Failed to upload ${file.name}`);
          setUploadedPhotos(prev => prev.filter(p => p.url !== fileUrl));
        } else {
          const { data: urlData } = supabase.storage
            .from('complaint-evidence')
            .getPublicUrl(fileName);
          
          setUploadedPhotos(prev => prev.map(p => 
            p.url === fileUrl ? { url: urlData.publicUrl, uploading: false } : p
          ));
        }
      } else {
        const { data: urlData } = supabase.storage
          .from('installation-evidence')
          .getPublicUrl(fileName);
        
        setUploadedPhotos(prev => prev.map(p => 
          p.url === fileUrl ? { url: urlData.publicUrl, uploading: false } : p
        ));
      }
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const clearSignature = () => {
    sigRef.current?.clear();
    setSignatureCaptured(false);
    setSignatureData(null);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureData(reader.result as string);
        setSignatureCaptured(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // SEND HAPPINESS CODE WHATSAPP IMMEDIATELY AFTER TECHNICIAN SUBMITS
  const handleCompleteInstallation = async () => {
    if (!formData.installation_notes || uploadedPhotos.length === 0 || !signatureCaptured) {
      toast.error('Please complete all required fields (installation notes, photos, and customer signature)');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Generate 5-digit Happiness Code
      const happinessCode = Math.floor(10000 + Math.random() * 90000).toString();
      
      let finalSignature = signatureData;
      if (sigRef.current && !sigRef.current.isEmpty()) {
        try {
          const canvasData = sigRef.current.toDataURL('image/png');
          if (canvasData) {
            finalSignature = canvasData;
          }
        } catch (sigErr) {
          console.warn("Signature canvas export:", sigErr);
        }
      }

      // Clean photos array to prevent non-serializable File objects
      const cleanPhotos = uploadedPhotos
        .filter((p: any) => !p.uploading && (p.url || typeof p === 'string'))
        .map((p: any) => {
          if (typeof p === 'string') return { url: p };
          return { url: p.url, name: p.name || 'Installation Evidence' };
        });

      // Save to local cache immediately to guarantee instant and persistent visibility
      saveLocalInstallationData(id!, {
        happiness_code: happinessCode,
        customer_signature: finalSignature,
        evidence_photos: cleanPhotos,
        equipment_model: formData.equipment_model,
        serial_number: formData.serial_number,
        installation_notes: formData.installation_notes,
        testing_results: formData.testing_results,
        completed_at: new Date().toISOString(),
        status: 'Site Completed and Handed Over',
        current_phase: 5
      });

      // Update installation to Phase 5 (Completion) using resilient installationService
      const payload: any = {
        current_phase: 5,
        status: 'Site Completed and Handed Over',
        equipment_model: formData.equipment_model || null,
        equipment_scope: formData.equipment_model || null,
        equipment_details: formData.equipment_model || null,
        serial_number: formData.serial_number || null,
        installation_notes: formData.installation_notes,
        scope_instructions: formData.installation_notes,
        notes: formData.installation_notes,
        testing_results: formData.testing_results || null,
        evidence_photos: cleanPhotos,
        customer_signature: finalSignature,
        completed_at: new Date().toISOString(),
        happiness_code: happinessCode,
        happiness_code_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await installationService.update(id!, payload);

      // Update local state immediately
      setInstallation((prev: any) => ({
        ...prev,
        ...payload,
        status: 'Site Completed and Handed Over',
        current_phase: 5,
        happiness_code: happinessCode,
        completed_at: new Date().toISOString(),
        equipment_model: formData.equipment_model || null,
        serial_number: formData.serial_number || null,
        installation_notes: formData.installation_notes,
        testing_results: formData.testing_results || null,
        evidence_photos: cleanPhotos,
        customer_signature: finalSignature
      }));
      setCurrentPhase(5);
      setActivePhase(5);
      
      // IMMEDIATELY send Stage 3 WhatsApp to customer (Happiness Code)
      const customerPhone = getCustomerPhone(installation) || installation?.customer?.phone || installation?.non_btl_contact_number || installation?.customer_phone;
      const customerName = getCustomerName(installation);
      const displayId = formatInstallationTicketId(installation) || installation?.ticket_id || id?.slice(0, 8);
      
      if (customerPhone) {
        try {
          const signOffMsg = getInstallationSignOffMessage({
            customerName,
            ticketId: displayId,
            happinessCode: happinessCode
          });
          await sendWhatsAppMessage(customerPhone, signOffMsg, {
            phone: customerPhone.replace(/\D/g, ''),
            message: signOffMsg,
            ticketId: displayId,
            happiness_code: happinessCode,
            code: happinessCode,
            event_type: 'technician_signoff'
          });
        } catch (whatsappError) {
          console.warn('Technician completion WhatsApp warning:', whatsappError);
        }
      }
      
      toast.success('Installation completed! Happiness Code sent to customer via WhatsApp.');
      
      const customerId = installation?.customer_id || installation?.customer?.id;
      if (customerId) {
        try {
          await notificationService.insertNotification(
            customerId,
            installation.id,
            "success",
            "Installation Completed",
            `Installation ${displayId} has been signed off. Happiness code verification is now with admin.`,
            4,
            `/installations/${installation.id}`,
            user?.id
          );
        } catch (notifErr) {
          console.warn("Installation sign-off app notification warning:", notifErr);
        }
      }
      
      fetchInstallation();
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(error?.message || 'Failed to submit installation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyHappinessCode = () => {
    if (!enteredHappinessCode.trim()) {
      toast.error('Please enter the 5-digit Happiness Code');
      return;
    }
    if (!customerSatisfaction) {
      toast.error('Please select customer satisfaction level');
      return;
    }

    const correctCode = String(installation?.happiness_code || '').trim();
    if (enteredHappinessCode.trim() === correctCode) {
      setHappinessCodeVerified(true);
      setHappinessCodeError(false);
      toast.success('✓ Happiness Code Verified! Customer satisfaction recorded.');
    } else {
      setHappinessCodeVerified(false);
      setHappinessCodeError(true);
      toast.error('✗ Incorrect Happiness Code. Please verify with customer again.');
    }
  };

  // ADMIN FINAL ACTION DECISION HANDLER
  const handleFinalAction = async () => {
    if (!finalAction) {
      toast.error('Please select a final action');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const updateData: any = {
        updated_at: nowIso,
      };

      if (finalAction === 'close') {
        if (!enteredHappinessCode || enteredHappinessCode.length !== 5) {
          toast.error('Please enter valid 5-digit happiness code');
          return;
        }
        if (!customerSatisfaction) {
          toast.error('Please select customer satisfaction level');
          return;
        }

        updateData.status = 'Verified';
        updateData.current_phase = 6;
        updateData.happiness_code = enteredHappinessCode;
        updateData.happiness_code_verified = true;
        updateData.customer_satisfaction = customerSatisfaction;
        updateData.customer_feedback_comments = customerComments;
        updateData.verified_at = nowIso;
        updateData.verified_by = currentUser?.id;

      } else if (finalAction === 'followup') {
        if (!followupReason) {
          toast.error('Please provide follow-up reason');
          return;
        }
        if (!followupDate) {
          toast.error('Please schedule follow-up date');
          return;
        }
        if (!followupTime) {
          toast.error('Please select follow-up time');
          return;
        }

        updateData.status = 'Dispatched';
        updateData.current_phase = 3;
        updateData.followup_reason = followupReason;
        updateData.followup_scheduled_date = followupDate;
        updateData.followup_scheduled_time = followupTime;
        updateData.reassignment_reason = `Follow-up visit scheduled: ${followupReason}`;

      } else if (finalAction === 'rework') {
        if (!reworkReason) {
          toast.error('Please provide rework reason');
          return;
        }

        updateData.status = 'In Progress';
        updateData.current_phase = 4;
        updateData.rework_reason = reworkReason;
        updateData.reassignment_reason = `Rework required: ${reworkReason}`;
      }

      const { error } = await supabase
        .from('installations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success(`Installation ${finalAction === 'close' ? 'verified and closed' : finalAction === 'followup' ? 'follow-up scheduled' : 'rework requested'} successfully`);
      
      const customerIdAction = installation?.customer_id || installation?.customer?.id;
      const leadTechId = installation?.technicians?.find((t: any) => t.is_lead)?.technician_id || installation?.lead_technician_id;
      
      if (finalAction === 'close' && customerIdAction) {
        try {
          await notificationService.insertNotification(
            customerIdAction,
            installation.id,
            "success",
            "Installation Verified & Closed",
            `Installation ${displayTicketId} has been verified and closed by admin.`,
            6,
            `/installations/${installation.id}`,
            user?.id
          );
        } catch (notifErr) {
          console.warn("Installation close app notification warning:", notifErr);
        }
      } else if (finalAction === 'rework' && leadTechId) {
        try {
          await notificationService.insertNotification(
            leadTechId,
            installation.id,
            "warning",
            "Rework Required",
            `Rework required for installation ${displayTicketId}. Reason: ${reworkReason}`,
            6,
            `/installations/${installation.id}`,
            user?.id
          );
        } catch (notifErr) {
          console.warn("Installation rework app notification warning:", notifErr);
        }
      } else if (finalAction === 'followup' && leadTechId) {
        try {
          await notificationService.insertNotification(
            leadTechId,
            installation.id,
            "info",
            "Follow-up Scheduled",
            `Follow-up visit scheduled for installation ${displayTicketId} on ${followupDate} at ${followupTime}. Reason: ${followupReason}`,
            6,
            `/installations/${installation.id}`,
            user?.id
          );
        } catch (notifErr) {
          console.warn("Installation followup app notification warning:", notifErr);
        }
      }
      
      fetchInstallation();
      
      setFinalAction(null);
      setEnteredHappinessCode('');
      setCustomerSatisfaction('');
      setCustomerComments('');
      setFollowupReason('');
      setFollowupDate('');
      setFollowupTime('');
      setReworkReason('');
    } catch (err: any) {
      toast.error(`Failed to ${finalAction}: ${err?.message || 'Error'}`);
    }
  };

  // FORCE CLOSE INSTALLATION MODAL SAVE HANDLER (Admin bypasses Happiness Code)
  const handleSaveForceClose = async () => {
    if (!forceCloseReason.trim()) {
      toast.error('Please select a reason for force closing');
      return;
    }

    setIsForceClosing(true);
    try {
      const nowIso = new Date().toISOString();
      const adminName = currentUser?.full_name || currentUser?.email || 'Admin';
      const formattedComments = forceCloseComments.trim();
      const updateData: any = {
        current_phase: 6,
        status: 'Verified',
        verified_at: nowIso,
        verified_by: currentUser?.id,
        customer_satisfaction: customerSatisfaction || 'Satisfied (Force Closed)',
        customer_feedback_comments: formattedComments ? `[Force Closed - ${forceCloseReason}] ${formattedComments}` : `[Force Closed - ${forceCloseReason}]`,
        happiness_code_verified: false,
        force_closed: true,
        force_close_reason: forceCloseReason,
        force_close_comments: formattedComments || null,
        force_closed_by: adminName,
        force_closed_at: nowIso,
        updated_at: nowIso
      };

      const { error } = await supabase
        .from('installations')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.warn("Full force close update failed, trying fallback:", error);
        await supabase
          .from('installations')
          .update({
            status: 'Verified',
            current_phase: 6,
            verified_at: nowIso,
            force_closed: true,
            force_close_reason: forceCloseReason,
            force_close_comments: formattedComments || null,
            force_closed_by: adminName,
            force_closed_at: nowIso
          })
          .eq('id', id);
      }

      // Stage 4 WhatsApp Notification on Force Close
      try {
        const custPhone = getCustomerPhone(installation);
        const custName = getCustomerName(installation);
        const displayId = formatInstallationTicketId(installation) || installation?.ticket_id || id?.slice(0, 8);
        if (custPhone) {
          const closeMsg = getInstallationClosedMessage({
            customerName: custName,
            ticketId: displayId
          });
          await sendWhatsAppMessage(custPhone, closeMsg, {
            ticketId: displayId,
            name: custName,
            event_type: 'closed'
          });
        }
      } catch (waErr) {
        console.warn("Force close WhatsApp notification error:", waErr);
      }

      toast.success("⚡ Installation Force Closed successfully!");
      
      const customerIdForce = installation?.customer_id || installation?.customer?.id;
      if (customerIdForce) {
        try {
          const adminIds = await notificationService.getAdminUserIds();
          await notificationService.insertNotification(
            [customerIdForce, ...adminIds],
            installation.id,
            "warning",
            "Installation Force Closed",
            `Installation ${displayId} has been force closed by admin.${forceCloseReason ? ` Reason: ${forceCloseReason}` : ''}`,
            6,
            `/installations/${installation.id}`,
            user?.id
          );
        } catch (notifErr) {
          console.warn("Installation force close app notification warning:", notifErr);
        }
      }
      
      setShowForceCloseModal(false);
      setForceCloseReason('');
      setForceCloseComments('');
      fetchInstallation();
    } catch (error: any) {
      console.error("Failed to force close installation:", error);
      toast.error(error?.message || "Failed to force close installation");
    } finally {
      setIsForceClosing(false);
    }
  };

  // 2-DAY (48-HOUR) POST-CLOSURE REASSIGN CHECK
  const siteAddress = installation?.site_address || 
    installation?.location?.address || 
    installation?.non_btl_address || 
    installation?.customer?.address ||
    [installation?.location?.location_name, installation?.location?.city].filter(Boolean).join(", ") || 
    'N/A';

  const customerPhone = installation?.customer?.phone || installation?.non_btl_contact_number || installation?.customer_phone || '';
  const customerName = installation?.customer?.full_name || installation?.non_btl_customer_name || 'Walk-in Customer';
  const displayTicketId = formatInstallationTicketId(installation) || installation?.ticket_id || id?.slice(0, 8);
  
  const leadTechnicianInfo = installation?.technicians?.find((t: any) => t.is_lead)?.technician || 
    installation?.technicians?.[0]?.technician;
  const leadTechnicianName = leadTechnicianInfo?.full_name || "Lead Technician";

  const callClient = () => {
    if (!customerPhone) {
      toast.error('No contact phone available');
      return;
    }
    window.location.href = `tel:${customerPhone}`;
  };

  const whatsappClient = () => {
    if (!customerPhone) {
      toast.error('No contact phone available');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const message = `Hello ${customerName}, regarding installation job ${displayTicketId}`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const navigateToSite = () => {
    if (!siteAddress || siteAddress === 'N/A') {
      toast.error('No address available for navigation');
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteAddress)}`, '_blank');
  };

  const copyAddress = () => {
    if (!siteAddress || siteAddress === 'N/A') return;
    navigator.clipboard.writeText(siteAddress);
    toast.success('Address copied to clipboard');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleString();
  };

  const getFileType = (url: string) => {
    const lowercaseUrl = url.toLowerCase();
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

  // ROLES: Strict isolation so admin/supervisor never see technician mission control
  const isAdmin = currentUser?.role === 'admin';
  const isTechnician = currentUser?.role === 'technician';
  const isSupervisor = currentUser?.role === 'supervisor';
  const canEdit = isAdmin || isSupervisor;
  const canView = isAdmin || isSupervisor || isLeadTechnician || isAssignedTechnician;
  const currentStatusLower = (installation?.status || '').toLowerCase();
  
  const isForceClosed = Boolean(installation?.force_closed || currentStatusLower === 'force_closed');
  const isVerified = currentStatusLower === 'verified' || getInstallationStatusLabel(currentStatusLower) === 'Verified';
  const isClosed = currentStatusLower === 'verified' || currentStatusLower === 'force_closed' || installation?.force_closed || currentStatusLower === 'closed';
  const isClosedOrVerified = isForceClosed || isVerified;
  const isPhase5ReadyForVerification = (currentPhase === 5 || getInstallationStatusLabel(currentStatusLower) === 'Site Completed and Handed Over') && !isClosedOrVerified;

  const normalizedStatusValue = getInstallationStatusLabel(installation?.status || 'Assigned');

  const canClickArrived = [
    'assigned',
    'en_route',
    'en route',
    'in_progress',
    'in progress',
    'unassigned',
    'revision_requested'
  ].includes(currentStatusLower);

  if (!installation) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-4 border-primary border-t-transparent" />
          <p className="text-xs font-semibold text-muted-foreground">Loading installation job...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="installation-detail-page max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Header & Admin Edit Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/installations')} 
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Back to Installations list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-bold font-mono text-slate-900">{displayTicketId}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              getInstallationStatusLabel(installation?.status || '') === 'Verified' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              getInstallationStatusLabel(installation?.status || '') === 'Site Completed and Handed Over' ? 'bg-amber-100 text-amber-900 border-amber-300' :
              getInstallationStatusLabel(installation?.status || '') === 'Pending due to Material Shortage' ? 'bg-rose-100 text-rose-800 border-rose-300' :
              'bg-blue-100 text-blue-800 border-blue-200'
            }`}>
              {getInstallationStatusLabel(installation?.status || 'Unassigned')}
            </span>
            {installation.is_chargeable && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Billable (₹{installation.service_charge || 0})
              </span>
            )}
            {installation.priority && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Priority: {installation.priority}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ManualWhatsAppButton
            ticket={installation}
            ticketType="installation"
            buttonVariant="outline"
            buttonText="WhatsApp Update"
            size="sm"
          />

          {isAdmin && (
            <>
                   <button
                     type="button"
                     onClick={() => {
                       if (!isPhase5ReadyForVerification) {
                         toast.error("Please wait until the Lead Technician completes the installation (Phase 5).");
                         return;
                       }
                       setShowAdminVerification(true);
                       setActivePhase(6);
                     }}
                     className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                     title="Open Phase 6 Admin Verification & Customer Feedback"
                   >
                     <ShieldCheck className="w-3.5 h-3.5" /> Verify Installation
                   </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Lead Technician Banner & Manual Status Modifier */}
      {(leadTechnicianInfo || installation.lead_technician_id) ? (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <p className="text-xs font-medium text-blue-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              🔒 Status progression is managed by Lead Technician: <strong>{leadTechnicianInfo?.full_name || 'Not Assigned'}</strong>
              {leadTechnicianInfo?.employee_id && (
                <span className="text-blue-700 ml-1">({leadTechnicianInfo.employee_id})</span>
              )}
            </span>
          </p>
          {leadTechnicianInfo?.phone && (
            <span className="text-xs text-blue-800 font-semibold shrink-0">
              📞 {leadTechnicianInfo.phone}
            </span>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <p className="text-xs font-medium text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              🔒 Status progression is managed by Lead Technician: <strong>Not Assigned</strong>
            </span>
          </p>
        </div>
      )}

      {/* 3. TECHNICIAN MISSION CONTROL - TECHNICIANS ONLY (Hidden from Admin / Supervisor) */}
      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              {isAdmin ? "Admin Status Control:" : "Lead Technician Live Status Update:"}
            </label>
            <span className="text-[11px] text-muted-foreground font-medium">Select current operational state</span>
          </div>
          <select
            value={normalizedStatusValue}
            onChange={(e) => handleManualStatusChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {INSTALLATION_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
          {/* Material Shortage Details - Conditional */}
          {(normalizedStatusValue === 'Pending due to Material Shortage') && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <label className="text-sm font-bold text-amber-900">Material Shortage Details</label>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-amber-800 mb-1">List Required Materials *</label>
                <textarea
                  rows={3}
                  value={materialShortageDetails}
                  onChange={(e) => setMaterialShortageDetails(e.target.value)}
                  placeholder="e.g., 50m cable, 4 connectors, 2 circuit breakers..."
                  className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-amber-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-amber-800 mb-1">Upload Photos of Missing Materials/Defective Parts</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const newPhotos = files.map(file => ({
                      url: URL.createObjectURL(file),
                      file,
                      uploading: true
                    }));
                    setMaterialShortagePhotos(prev => [...prev, ...newPhotos]);
                    
                    // Upload to Supabase
                    files.forEach(async (file) => {
                      const fileName = `${id}/material_shortage/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                      const { data, error } = await supabase.storage
                        .from('installation-evidence')
                        .upload(fileName, file);
                      
                      if (!error) {
                        const { data: urlData } = supabase.storage
                          .from('installation-evidence')
                          .getPublicUrl(fileName);
                        setMaterialShortagePhotos(prev => prev.map(p => 
                          p.file === file ? { url: urlData.publicUrl, file, uploading: false } : p
                        ));
                      }
                    });
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
                />
              </div>
              
              {materialShortagePhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {materialShortagePhotos.map((photo, idx) => (
                    <div key={idx} className="relative w-16 h-16 border rounded-lg overflow-hidden">
                      <img src={photo.url} alt={`Material shortage ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setMaterialShortagePhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. TECHNICIAN MISSION CONTROL - LEAD TECHNICIAN ONLY */}
      {isLeadTechnician && isTechnician && currentPhase >= 2 && currentPhase < 6 && (
        <div className="mission-control-banner bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wider uppercase text-amber-400 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              TECHNICIAN MISSION CONTROL
            </h3>
            <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
              Live Field Ops
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button 
              type="button"
              onClick={callClient} 
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-xs shadow-sm cursor-pointer"
            >
              <Phone className="w-4 h-4" /> Call Client
            </button>
            <button 
              type="button"
              onClick={whatsappClient} 
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-xs shadow-sm cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </button>
            <button 
              type="button"
              onClick={navigateToSite} 
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-xs shadow-sm cursor-pointer"
            >
              <Navigation className="w-4 h-4" /> Navigate
            </button>
            <button 
              type="button"
              onClick={handleArrivedGPS} 
              disabled={!canClickArrived}
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <MapPin className="w-4 h-4" /> 
              {getInstallationStatusLabel(installation?.status || '') === 'In Progress' && installation?.arrival_time ? 'Arrived (GPS) ✓' : 'I Arrived (GPS)'}
            </button>
          </div>
          
          <div className="p-3 bg-slate-800/90 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border border-slate-700">
            <div>
              <p className="text-[11px] text-slate-400 font-semibold">Site Address:</p>
              <p className="font-semibold text-xs text-slate-100">{siteAddress === 'N/A' ? 'Address not provided' : siteAddress}</p>
            </div>
            <button 
              type="button"
              onClick={copyAddress} 
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0 text-slate-200 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Crew Member View - Non-Lead Assigned Technicians */}
      {isAssignedTechnician && !isLeadTechnician && (
        <div className="bg-blue-50 border-2 border-blue-200 p-5 rounded-2xl">
          <h3 className="font-bold text-sm text-blue-900 mb-1">Crew Member View (Read-Only)</h3>
          <p className="text-xs text-blue-700 mb-3">Lead Tech: {leadTechnicianInfo?.full_name || 'Not Assigned'}</p>
          <button
            type="button"
            onClick={() => {
              const address = siteAddress === 'N/A' ? '' : siteAddress;
              if (address) {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
              } else {
                toast.error('No address available for navigation');
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <Navigation className="w-4 h-4" /> Navigate to Site
          </button>
        </div>
      )}

      {/* 4. Interactive 6-Phase Timeline */}
      <div className="space-y-3">
        <div className="phase-timeline flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-2xl overflow-x-auto gap-2">
          {[
            { num: 1, label: 'Registration' },
            { num: 2, label: 'Assignment' },
            { num: 3, label: 'Dispatch' },
            { num: 4, label: 'Execution' },
            { num: 5, label: 'Completion' },
            { num: 6, label: 'Verification' }
          ].map(phase => {
            const isCompleted = currentPhase > phase.num;
            const isSelected = activePhase === phase.num;
            const isPhase6Ready = phase.num === 6 && isPhase5ReadyForVerification;
            const isPhaseActive = currentPhase >= phase.num || isPhase6Ready;
            return (
              <button
                key={phase.num}
                type="button"
                onClick={() => setActivePhase(activePhase === phase.num ? null : phase.num)}
                className={`flex flex-col items-center flex-1 min-w-[75px] cursor-pointer transition-all duration-200 group focus:outline-none p-1.5 rounded-xl ${
                  isSelected ? 'bg-primary/10 ring-2 ring-primary/40' : 'hover:bg-slate-100/80'
                } ${isPhaseActive ? 'text-primary font-bold' : 'text-slate-400'}`}
                title={`Click to view Phase ${phase.num}: ${phase.label} details`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary text-white shadow-md scale-110'
                    : isPhaseActive
                      ? 'border-primary bg-primary text-white shadow-xs group-hover:scale-105' 
                      : 'border-slate-300 bg-white text-slate-500 group-hover:border-slate-400'
                }`}>
                  {isCompleted ? '✓' : phase.num}
                </div>
                <span className={`text-[11px] mt-1.5 text-center leading-tight transition-colors ${
                  isSelected ? 'text-primary font-extrabold underline underline-offset-2' : ''
                }`}>
                  {phase.label}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 opacity-75">
                  {isSelected ? '▲ close' : '▼ click details'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Expanded Phase Details Panel */}
        {activePhase && (
          <div className="phase-details bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border-2 border-blue-200 rounded-2xl p-5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200 pb-2.5">
              <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                  {activePhase}
                </span>
                {activePhase === 1 && 'Phase 1: Registration Details'}
                {activePhase === 2 && 'Phase 2: Assignment Details'}
                {activePhase === 3 && 'Phase 3: Dispatch & Scheduling Details'}
                {activePhase === 4 && 'Phase 4: Site Execution & Equipment Details'}
                {activePhase === 5 && 'Phase 5: Completion, Evidence & Sign-Off'}
                {activePhase === 6 && 'Phase 6: Admin Verification & Feedback'}
              </h4>
              <button
                type="button"
                onClick={() => setActivePhase(null)}
                className="text-xs text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>

            {/* Phase 1 Content */}
            {activePhase === 1 && (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-800">
                <div>
                  <span className="text-muted-foreground font-semibold block">Ticket Created:</span>
                  <p className="font-bold text-slate-900">{formatDate(installation.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Customer Type:</span>
                  <p className="font-bold text-slate-900">{installation.customer_type || 'Customer'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Customer Name:</span>
                  <p className="font-bold text-slate-900">{customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Contact Phone:</span>
                  <p className="font-bold text-slate-900">{customerPhone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Priority:</span>
                  <span className="font-bold text-slate-900">{installation.priority || 'Medium'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Equipment Scope:</span>
                  <p className="font-bold text-slate-900">{installation.equipment_details || installation.equipment_type || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <span className="text-muted-foreground font-semibold block">Site Address:</span>
                  <p className="font-medium text-slate-800">{siteAddress}</p>
                </div>
              </div>
            )}

            {/* Phase 2 Content */}
            {activePhase === 2 && (
              <div className="space-y-3 text-xs text-slate-800">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground font-semibold block">Assigned Date:</span>
                    <p className="font-bold text-slate-900">{formatDate(installation.assigned_at || installation.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Supervisor / Admin:</span>
                    <p className="font-bold text-slate-900">{installation.supervisor_name || 'System Admin'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Total Assigned:</span>
                    <p className="font-bold text-slate-900">{installation.technicians?.length || 0} Technicians</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block mb-1.5">Assigned Technicians Team:</span>
                  {installation.technicians && installation.technicians.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {installation.technicians.map((t: any, idx: number) => (
                        <div key={idx} className="bg-white border border-blue-200 rounded-xl p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="font-bold text-xs text-slate-900">
                                {t.technician?.full_name || t.technician?.designation || t.technician?.employee_id || t.technician?.email || 'Technician'}
                                {t.is_lead && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">LEAD</span>}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {[t.technician?.employee_id, t.technician?.role, t.technician?.designation].filter(Boolean).join(' • ') || 'Assigned Technician'}
                              </p>
                            </div>
                          </div>
                          {t.technician?.phone && (
                            <a href={`tel:${t.technician.phone}`} className="text-[11px] text-blue-600 font-semibold hover:underline">
                              📞 {t.technician.phone}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="italic text-slate-500">No technicians assigned yet.</p>
                  )}
                </div>
                {installation.notes && (
                  <div>
                    <span className="text-muted-foreground font-semibold block">Assignment Instructions / Notes:</span>
                    <p className="font-medium text-slate-800 bg-white/70 p-2 rounded-lg border border-blue-200 mt-1">{installation.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Phase 3 Content */}
            {activePhase === 3 && (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-800">
                <div>
                  <span className="text-muted-foreground font-semibold block">Scheduled Visit Date:</span>
                  <p className="font-bold text-slate-900">
                    {installation.scheduled_date 
                      ? new Date(`${installation.scheduled_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
                      : 'Pending Schedule'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Scheduled Visit Time:</span>
                  <p className="font-bold text-slate-900">{installation.scheduled_time ? installation.scheduled_time.slice(0, 5) : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Dispatch Status:</span>
                  <span className="font-bold text-slate-900 uppercase">{installation.status || 'Assigned'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Lead Technician:</span>
                  <p className="font-bold text-slate-900">{leadTechnicianInfo?.full_name || 'Assigned Lead'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Tech Contact Phone:</span>
                  <p className="font-bold text-slate-900">{leadTechnicianInfo?.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Dispatched Timestamp:</span>
                  <p className="font-bold text-slate-900">{installation.dispatched_at ? formatDate(installation.dispatched_at) : (currentPhase >= 3 ? 'Dispatched' : 'Pending')}</p>
                </div>
              </div>
            )}

            {/* Phase 4 Content */}
            {activePhase === 4 && (
              <div className="space-y-3 text-xs text-slate-800">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground font-semibold block">GPS Arrival Time:</span>
                    <p className="font-bold text-slate-900">{installation.arrival_time ? formatDate(installation.arrival_time) : 'Not recorded'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">GPS Coordinates:</span>
                    <p className="font-mono font-bold text-slate-900">
                      {installation.arrival_gps_lat && installation.arrival_gps_lng 
                        ? `${Number(installation.arrival_gps_lat).toFixed(5)}, ${Number(installation.arrival_gps_lng).toFixed(5)}` 
                        : (installation.latitude ? `${installation.latitude}, ${installation.longitude}` : 'GPS not recorded')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Equipment Model / Make:</span>
                    <p className="font-bold text-slate-900">{formData.equipment_model || installation.equipment_model || installation.brand || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Equipment Serial Number:</span>
                    <p className="font-mono font-bold text-slate-900">{formData.serial_number || installation.serial_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Testing & Calibration:</span>
                    <p className="font-bold text-slate-900">{formData.testing_results || installation.testing_results || 'Standard Testing'}</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold block">Technician On-Site Execution Notes:</span>
                  <p className="font-medium text-slate-800 bg-white/80 p-2.5 rounded-lg border border-blue-200 mt-1">
                    {formData.installation_notes || installation.installation_notes || 'No execution notes entered yet.'}
                  </p>
                </div>
              </div>
            )}

            {/* Phase 5 Content (Completion, Evidence & Sign-Off) */}
            {activePhase === 5 && (
              <div className="space-y-4 text-xs text-slate-800">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground font-semibold block">Completed At:</span>
                    <p className="font-bold text-slate-900">{installation.completed_at ? formatDate(installation.completed_at) : 'Not completed yet'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Happiness Code:</span>
                    {installation.happiness_code ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-black text-sm text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                          {installation.happiness_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(installation.happiness_code);
                            toast.success('Happiness Code copied!');
                          }}
                          className="p-1 hover:bg-amber-100 rounded text-amber-800 cursor-pointer"
                          title="Copy Happiness Code"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-emerald-700 font-bold">✓ WhatsApp Sent</span>
                      </div>
                    ) : (
                      <p className="font-semibold text-slate-500">Pending Completion</p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Customer Sign-Off Status:</span>
                    <p className="font-bold text-emerald-700">{signatureCaptured || installation.customer_signature ? 'Signed On-Site ✓' : 'Pending Signature'}</p>
                  </div>
                </div>

                {/* Equipment & Testing Details */}
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-blue-200">
                  <div>
                    <span className="text-muted-foreground font-semibold block">Equipment Model:</span>
                    <p className="font-bold text-slate-900">{formData.equipment_model || installation.equipment_model || installation.equipment_details || installation.brand || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Hardware Serial Number:</span>
                    <p className="font-mono font-bold text-slate-900">{formData.serial_number || installation.serial_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Testing & Calibration:</span>
                    <p className="font-bold text-slate-900">{formData.testing_results || installation.testing_results || 'Standard Testing ✓'}</p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground font-semibold block">Technician On-Site Notes:</span>
                  <p className="font-medium text-slate-800 bg-white/90 p-2.5 rounded-lg border border-blue-200 mt-1 leading-relaxed">
                    {formData.installation_notes || installation.installation_notes || installation.notes || 'No execution notes entered.'}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-blue-200">
                  <div>
                    <span className="text-muted-foreground font-semibold block mb-1">Customer Digital Signature:</span>
                    {signatureData || installation.customer_signature ? (
                      <div className="bg-white border border-blue-200 rounded-xl p-2 inline-block shadow-2xs">
                        <img src={signatureData || installation.customer_signature} alt="Customer Signature" className="h-16 max-w-full object-contain" />
                      </div>
                    ) : (
                      <p className="italic text-slate-500">No signature captured.</p>
                    )}
                  </div>

                  <div>
                    <span className="text-muted-foreground font-semibold block mb-1">
                      Evidence / Installation Photos ({(uploadedPhotos && uploadedPhotos.length) || (installation.evidence_photos && installation.evidence_photos.length) || 0}):
                    </span>
                    {((uploadedPhotos && uploadedPhotos.length > 0) || (installation.evidence_photos && installation.evidence_photos.length > 0)) ? (
                      <div className="flex flex-wrap gap-2">
                        {(uploadedPhotos.length > 0 ? uploadedPhotos : (installation.evidence_photos || [])).map((photo: any, idx: number) => {
                          const src = photo.url || photo;
                          const fileType = getFileType(src);
                          return (
                            <a key={idx} href={src} target="_blank" rel="noreferrer" className="block relative group">
                              {fileType === 'video' ? (
                                <video src={src} className="w-14 h-14 object-cover rounded-lg border border-blue-300 shadow-2xs group-hover:opacity-80" muted />
                              ) : (
                                <img src={src} alt={`Evidence ${idx + 1}`} className="w-14 h-14 object-cover rounded-lg border border-blue-300 shadow-2xs group-hover:opacity-80" />
                              )}
                              <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] rounded-lg transition-opacity font-bold">
                                View
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="italic text-slate-500">No completion photos uploaded.</p>
                    )}
                  </div>
                </div>

                {/* GPS Arrival Proof */}
                {installation.arrival_gps_lat && installation.arrival_gps_lng && (
                  <div className="p-2.5 bg-white/80 border border-blue-200 rounded-xl flex items-center justify-between mt-2">
                    <div>
                      <h4 className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" /> GPS Arrival Proof
                      </h4>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        Arrived: {formatDate(installation.arrival_time)} ({Number(installation.arrival_gps_lat).toFixed(5)}, {Number(installation.arrival_gps_lng).toFixed(5)})
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => window.open(`https://www.google.com/maps?q=${installation.arrival_gps_lat},${installation.arrival_gps_lng}`, '_blank')}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                      View Map
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Phase 6 Content */}
            {activePhase === 6 && (
              <div className="space-y-3 text-xs text-slate-800">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground font-semibold block">Verified Date:</span>
                    <p className="font-bold text-slate-900">{formatDate(installation.verified_at || installation.force_closed_at || 'Pending')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Happiness Code Status:</span>
                    <p className="font-bold text-slate-900">
                      {installation.force_closed 
                        ? '⚡ Bypassed (Force Closed)' 
                        : (happinessCodeVerified || installation.happiness_code_verified ? 'Verified Successfully ✓' : 'Pending Verification')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block">Customer Satisfaction:</span>
                    <p className="font-bold text-slate-900">{customerSatisfaction || installation.customer_satisfaction || 'Not recorded'}</p>
                  </div>
                </div>
                {installation.force_closed && (
                  <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-3">
                    <p className="font-bold text-amber-900">⚡ Force Closed Details:</p>
                    <p className="text-amber-800"><strong>Reason:</strong> {installation.force_close_reason || 'Administrative Override'}</p>
                    {installation.force_close_comments && <p className="text-amber-800"><strong>Comments:</strong> {installation.force_close_comments}</p>}
                  </div>
                )}
                {(customerComments || installation.customer_feedback_comments) && !installation.force_closed && (
                  <div>
                    <span className="text-muted-foreground font-semibold block">Customer Feedback Comments:</span>
                    <p className="font-medium text-slate-800 bg-white/80 p-2.5 rounded-lg border border-blue-200 mt-1">
                      {customerComments || installation.customer_feedback_comments}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Equipment Info */}
      <div className="equipment-info border border-slate-200 bg-white rounded-2xl p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-4 h-4 text-primary" /> EQUIPMENT TO INSTALL
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground font-semibold block">Equipment Details:</span>
            <p className="font-bold text-sm text-slate-800">{installation.equipment_details || installation.equipment_type || 'N/A'}</p>
          </div>
          {installation.brand && (
            <div>
              <span className="text-muted-foreground font-semibold block">Brand / Make:</span>
              <p className="font-bold text-sm text-slate-800">{installation.brand}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground font-semibold block">Chargeable Scope:</span>
            <p className="font-semibold text-slate-800">{installation.is_chargeable ? 'Yes (Billable)' : 'No (Standard Scope)'}</p>
          </div>
          <div>
            <span className="text-muted-foreground font-semibold block">Scheduled Date:</span>
            <p className="font-semibold text-slate-800">{formatDate(installation.scheduled_date || installation.created_at)}</p>
          </div>
          {installation.notes && (
            <div className="md:col-span-2">
              <span className="text-muted-foreground font-semibold block">Site Notes:</span>
              <p className="font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{installation.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. INSTALLATION EXECUTION & COMPLETION */}
      {(currentPhase === 4 || getInstallationStatusLabel(currentStatusLower) === 'In Progress') && 
       currentPhase < 5 && 
       !isClosedOrVerified && (
         <div className="space-y-5">
          {/* PREVIOUS ATTEMPT HISTORY - Read Only */}
          {(installation.installation_notes || installation.testing_results || (installation.evidence_photos && installation.evidence_photos.length > 0) || installation.rework_log) && (
            <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-300 rounded-xl">
              <h4 className="font-bold text-sm text-amber-900 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> Previous Attempt History (Read-Only)
              </h4>
              <div className="space-y-3 text-xs">
                {installation.rework_log && (
                  <div>
                    <span className="font-semibold text-amber-800 block mb-1">Rework Log:</span>
                    <p className="text-amber-900 whitespace-pre-wrap bg-white/70 p-2 rounded border border-amber-200">{installation.rework_log}</p>
                  </div>
                )}
                {installation.installation_notes && (
                  <div>
                    <span className="font-semibold text-amber-800 block mb-1">Previous Installation Notes:</span>
                    <p className="text-amber-900 whitespace-pre-wrap bg-white/70 p-2 rounded border border-amber-200">{installation.installation_notes}</p>
                  </div>
                )}
                {installation.testing_results && (
                  <div>
                    <span className="font-semibold text-amber-800 block mb-1">Previous Testing Results:</span>
                    <p className="text-amber-900 whitespace-pre-wrap bg-white/70 p-2 rounded border border-amber-200">{installation.testing_results}</p>
                  </div>
                )}
                {(installation.evidence_photos && installation.evidence_photos.length > 0) && (
                  <div>
                    <span className="font-semibold text-amber-800 block mb-1">Previous Evidence Photos:</span>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(installation.evidence_photos) ? installation.evidence_photos : []).map((photo: any, idx: number) => {
                        const src = typeof photo === 'string' ? photo : photo.url;
                        const fileType = getFileType(src);
                        return fileType === 'video' ? (
                          <video key={idx} src={src} className="w-20 h-20 object-cover rounded-lg border border-amber-300" muted />
                        ) : (
                          <img key={idx} src={src} alt={`Previous evidence ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-amber-300" />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FRESH NEW ATTEMPT FORM */}
          <div className="border-2 border-primary/20 rounded-xl p-4 bg-white">
            <h4 className="font-bold text-sm text-primary mb-3">New Attempt - Fresh Data Entry</h4>
            {isLeadTechnician ? (
             <>
               <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                 <div>
                   <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                     <CheckCircle2 className="w-5 h-5 text-blue-600" />
                     INSTALLATION EXECUTION & COMPLETION
                   </h3>
                   <p className="text-xs text-muted-foreground">Record hardware serial, upload site photos, and capture customer sign-off.</p>
                 </div>
                 <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md">
                   {isLeadTechnician ? '️ Editable - Lead Technician' : isAdmin ? 'Admin' : 'Supervisor'}
                 </span>
               </div>

               {/* Equipment Details */}
               <div className="grid md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-700 mb-1.5">Equipment Model *</label>
                   <input
                     type="text"
                     required
                     value={formData.equipment_model}
                     onChange={(e) => setFormData({...formData, equipment_model: e.target.value})}
                     placeholder="e.g., Luminous 2kW Inverter"
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-700 mb-1.5">Serial Number *</label>
                   <input
                     type="text"
                     required
                     value={formData.serial_number}
                     onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                     placeholder="e.g., SN123456789"
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                   />
                 </div>
               </div>

               {/* Installation Notes */}
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1.5">Installation Notes & Work Performed *</label>
                 <textarea
                   required
                   rows={4}
                   value={formData.installation_notes}
                   onChange={(e) => setFormData({...formData, installation_notes: e.target.value})}
                   placeholder="Describe the complete installation work performed, configuration details, and any observations..."
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                 />
               </div>

               {/* Testing Results */}
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1.5">Testing Results & Configuration Details</label>
                 <textarea
                   rows={3}
                   value={formData.testing_results}
                   onChange={(e) => setFormData({...formData, testing_results: e.target.value})}
                   placeholder="Voltage readings, connectivity tests, network configuration, settings applied..."
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                 />
               </div>

               {/* Photo Upload */}
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1.5">Upload Installation Photos & Videos *</label>
                 <input
                   type="file"
                   multiple
                   accept="image/*,video/*"
                   onChange={handlePhotoUpload}
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-slate-50"
                 />
                  {uploadedPhotos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mt-3">
                      {uploadedPhotos.map((photo, index) => {
                        const src = photo.url;
                        const fileType = getFileType(src);
                        return (
                          <div key={index} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                            {fileType === 'video' ? (
                              <video src={src} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <img src={src} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                            )}
                            {photo.uploading && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[11px] font-semibold">
                                Uploading...
                              </div>
                            )}
                            <button 
                              type="button"
                              onClick={() => removePhoto(index)} 
                              className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
               </div>

               {/* Customer Signature */}
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1.5">Customer Sign-Off *</label>
                 <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                   <SignatureCanvas
                     ref={sigRef}
                     canvasProps={{ className: 'signature-pad w-full h-32 bg-white' }}
                     onEnd={() => setSignatureCaptured(true)}
                   />
                 </div>
                 <div className="flex flex-wrap items-center gap-2 mt-2">
                   <button 
                     type="button"
                     onClick={clearSignature} 
                     className="px-3 py-1 border border-slate-300 hover:bg-slate-50 rounded-md text-xs font-medium text-slate-700"
                   >
                     Clear Signature
                   </button>
                   <span className="text-xs text-muted-foreground">OR upload signature image:</span>
                   <input type="file" accept="image/*" onChange={handleSignatureUpload} className="text-xs" />
                 </div>
                 {signatureCaptured && (
                   <p className="text-emerald-600 font-semibold text-xs mt-1.5 flex items-center gap-1">
                     <CheckCircle2 className="w-3.5 h-3.5" /> ✓ Signature captured
                   </p>
                 )}
               </div>

                 {/* Complete Button */}
                 <button
                   onClick={handleCompleteInstallation}
                   disabled={isSubmitting || !formData.equipment_model || !formData.serial_number || !formData.installation_notes}
                   className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                 >
                   {isSubmitting ? 'Completing...' : '✅ Complete Installation & Send Happiness Code'}
                 </button>
             </>
            ) : (isAssignedTechnician || isAdmin || isSupervisor) ? (
             <>
               <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                 <div>
                   <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                     <Eye className="w-5 h-5 text-slate-500" />
                     INSTALLATION EXECUTION & COMPLETION
                   </h3>
                   <p className="text-xs text-muted-foreground">View-only access. Contact Lead Technician to make changes.</p>
                 </div>
                 <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                   Read Only
                 </span>
               </div>

               <div className="grid sm:grid-cols-2 gap-3 text-xs">
                 <div>
                   <span className="text-muted-foreground font-semibold block">Equipment Model:</span>
                   <p className="font-bold text-slate-900">{installation.equipment_model || installation.equipment_details || 'N/A'}</p>
                 </div>
                 <div>
                   <span className="text-muted-foreground font-semibold block">Serial Number:</span>
                   <p className="font-bold text-slate-900">{installation.serial_number || 'N/A'}</p>
                 </div>
                 <div className="sm:col-span-2">
                   <span className="text-muted-foreground font-semibold block">Installation Notes:</span>
                   <p className="font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">{installation.installation_notes || installation.notes || 'N/A'}</p>
                 </div>
                 <div className="sm:col-span-2">
                   <span className="text-muted-foreground font-semibold block">Testing Results:</span>
                   <p className="font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">{installation.testing_results || 'N/A'}</p>
                 </div>
               </div>

                {installation.evidence_photos && installation.evidence_photos.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-2">Evidence Photos:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {(Array.isArray(installation.evidence_photos) ? installation.evidence_photos : []).map((photo: any, idx: number) => {
                        const src = typeof photo === 'string' ? photo : photo.url;
                        const fileType = getFileType(src);
                        return (
                          <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                            {fileType === 'video' ? (
                              <video src={src} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <img src={src} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

               {installation.customer_signature && (
                 <div>
                   <span className="text-xs font-semibold text-slate-700 block mb-2">Customer Signature:</span>
                   <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                     <img src={installation.customer_signature} alt="Customer Signature" className="w-full h-32 object-contain bg-white" />
                   </div>
                 </div>
                )}
              </>
            ) : null}
          </div>
        </div>
        )}

      {/* Phase 5 Completed Banner */}
      {isPhase5ReadyForVerification && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              5
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-950">Phase 5 Completed — Waiting for Admin Verification</h4>
              <p className="text-xs text-amber-800">The technician has submitted installation evidence and customer sign-off. Admin verification required to finalize and close.</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
            Ready for Verification
          </span>
        </div>
      )}

      {/* Admin Waiting Note for Phases 1 to 4 */}
      {isAdmin && currentPhase < 5 && !isClosedOrVerified && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 flex items-center gap-3 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <h4 className="font-bold text-slate-700">Admin Verification & Feedback (Phase 6)</h4>
            <p className="text-slate-500 mt-0.5">Admin verification form and closure decisions will appear here once on-site work and customer sign-off are completed in Phase 5.</p>
          </div>
        </div>
      )}

      {/* Read-Only Force Close Summary Card */}
      {isForceClosed && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-950 text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600 fill-amber-500" />
              ⚡ Force Closed Installation Summary (Phase 6)
            </h4>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
              Force Closed
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-800 pt-2 border-t border-amber-200">
            <div>
              <span className="text-amber-800 font-semibold block">Reason for Force Closure:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{installation.force_close_reason || 'Administrative Override'}</p>
            </div>
            <div>
              <span className="text-amber-800 font-semibold block">Closed By & Date:</span>
              <p className="font-medium text-slate-800 mt-0.5">
                {installation.force_closed_by || 'Admin'} on {formatDate(installation.force_closed_at || installation.verified_at)}
              </p>
            </div>
            {installation.force_close_comments && (
              <div className="sm:col-span-2 mt-1">
                <span className="text-amber-800 font-semibold block mb-1">Administrative Comments:</span>
                <p className="font-normal text-slate-800 bg-white/90 p-3 rounded-xl border border-amber-200 text-xs leading-relaxed">
                  {installation.force_close_comments}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Read-Only Verified Summary Card */}
      {isVerified && !isForceClosed && (
        <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-emerald-950 text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ✓ Installation Verified & Closed (Phase 6)
            </h4>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-200 text-emerald-900 border border-emerald-300">
              Verified
            </span>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-800 pt-2 border-t border-emerald-200">
            <div>
              <span className="text-emerald-800 font-semibold block">Customer Satisfaction:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{installation.customer_satisfaction || 'Satisfied'}</p>
            </div>
            <div>
              <span className="text-emerald-800 font-semibold block">Happiness Code:</span>
              <p className="font-mono font-bold text-emerald-900 text-sm mt-0.5">
                {installation.happiness_code ? `${installation.happiness_code} (Verified ✓)` : 'Verified ✓'}
              </p>
            </div>
            <div>
              <span className="text-emerald-800 font-semibold block">Verified Date:</span>
              <p className="font-medium text-slate-800 mt-0.5">{formatDate(installation.verified_at)}</p>
            </div>
            {installation.customer_feedback_comments && (
              <div className="sm:col-span-2 md:col-span-3 mt-1">
                <span className="text-emerald-800 font-semibold block mb-1">Customer Feedback:</span>
                <p className="font-normal text-slate-800 bg-white/90 p-3 rounded-xl border border-emerald-200 text-xs leading-relaxed">
                  {installation.customer_feedback_comments}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. ADMIN VERIFICATION & FINAL ACTION DECISION (Admin View strictly in Phase 5 ready for verification) */}
      {isAdmin && isPhase5ReadyForVerification && (
        <div className="admin-verification-section space-y-6">
          <div className="border-t-2 border-slate-200 pt-6">
            <h3 className="font-bold text-xl mb-4 text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              ADMIN VERIFICATION & CUSTOMER FEEDBACK (PHASE 6)
            </h3>
            
            {/* Conditional Forms Based on Final Action */}
            {finalAction === 'close' && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-6 mb-6 shadow-xs">
                <h4 className="font-semibold text-base mb-2 flex items-center gap-2 text-amber-900">
                  🔐 Customer Satisfaction & Happiness Code Verification
                </h4>
                <p className="text-xs text-amber-800/90 mb-4">
                  Call the customer and verify the 5-digit Happiness Code generated upon technician sign-off before closing this ticket.
                </p>

                {/* Prominent Happiness Code Display for Admin */}
                {installation.happiness_code && (
                  <div className="bg-white border-2 border-amber-300 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-amber-800 tracking-wider block">
                        🔑 Generated Happiness Code (For Admin Reference)
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-mono font-black text-amber-950 tracking-widest bg-amber-100/90 px-3 py-1 rounded-lg border border-amber-300">
                          {installation.happiness_code}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          (Sent to customer via WhatsApp on sign-off)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(installation.happiness_code);
                        setEnteredHappinessCode(installation.happiness_code);
                        toast.success('Happiness Code copied & filled!');
                      }}
                      className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy & Auto-fill
                    </button>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enter Customer's Happiness Code *</label>
                    <input
                      type="text"
                      maxLength={5}
                      pattern="\d{5}"
                      value={enteredHappinessCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setEnteredHappinessCode(value);
                        setHappinessCodeError(false);
                      }}
                      placeholder="Enter 5-digit code"
                      className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-base font-mono tracking-widest bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Satisfaction Level *</label>
                    <select
                      value={customerSatisfaction}
                      onChange={(e) => setCustomerSatisfaction(e.target.value)}
                      className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Select satisfaction level</option>
                      <option value="Very Satisfied">😊😊 Very Satisfied</option>
                      <option value="Satisfied">😊 Satisfied</option>
                      <option value="Partially Satisfied">😐 Partially Satisfied</option>
                      <option value="Unsatisfied"> Unsatisfied</option>
                      <option value="Very Unsatisfied">😞 Very Unsatisfied</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Feedback Comments</label>
                  <textarea
                    rows={3}
                    value={customerComments}
                    onChange={(e) => setCustomerComments(e.target.value)}
                    placeholder="Record customer's feedback, complaints, or compliments..."
                    className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={verifyHappinessCode}
                  disabled={!enteredHappinessCode || !customerSatisfaction || enteredHappinessCode.length !== 5}
                  className="mt-4 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  ✓ Verify Code & Collect Feedback
                </button>
                
                {happinessCodeVerified && (
                  <div className="mt-4 p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ✓ Happiness Code Verified Successfully! Customer satisfaction recorded.
                  </div>
                )}
                {happinessCodeError && (
                  <div className="mt-4 p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    ✗ Incorrect Happiness Code. Please verify with customer again.
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Fields - ONLY show when finalAction === 'followup' */}
            {finalAction === 'followup' && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-6 mb-6 shadow-xs">
                <h4 className="font-semibold text-base mb-2 flex items-center gap-2 text-blue-900">
                  📅 Schedule Follow-up Visit
                </h4>
                <p className="text-xs text-blue-800/90 mb-4">
                  Schedule a follow-up visit for pending parts, additional testing, or remaining work.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Reason *</label>
                    <textarea
                      required
                      rows={3}
                      value={followupReason}
                      onChange={(e) => setFollowupReason(e.target.value)}
                      placeholder="Explain why follow-up visit is needed (pending parts, additional testing, etc.)..."
                      className="w-full border-2 border-blue-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Follow-up Date & Time *</label>
                    <DateTimePicker
                      dateValue={followupDate}
                      timeValue={followupTime}
                      onDateChange={setFollowupDate}
                      onTimeChange={setFollowupTime}
                      placeholder="Pick follow-up date & time..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rework Fields - ONLY show when finalAction === 'rework' */}
            {finalAction === 'rework' && (
              <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-6 mb-6 shadow-xs">
                <h4 className="font-semibold text-base mb-2 flex items-center gap-2 text-rose-900">
                  🔄 Return for Rework
                </h4>
                <p className="text-xs text-rose-800/90 mb-4">
                  Reassign this installation for correction. Describe the quality issues found.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rework Reason *</label>
                  <textarea
                    required
                    rows={3}
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    placeholder="Describe quality issues found and what needs to be corrected..."
                    className="w-full border-2 border-rose-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}

            {/* FINAL ACTION DECISION */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-base text-slate-900 mb-4">Final Action Decision</h4>
              
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {/* Close Ticket Successfully */}
                <button
                  type="button"
                  onClick={() => setFinalAction('close')}
                  className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                    finalAction === 'close' 
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 hover:border-emerald-400 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 text-xs font-bold">✓</span>
                    </div>
                    <h5 className="font-semibold text-xs text-emerald-900">Close Ticket Successfully</h5>
                  </div>
                  <p className="text-[11px] text-slate-600">Mark installation verified & complete (Phase 6). Customer satisfied.</p>
                </button>

                {/* Schedule Follow-up Visit */}
                <button
                  type="button"
                  onClick={() => setFinalAction('followup')}
                  className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                    finalAction === 'followup' 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' 
                      : 'border-slate-200 hover:border-blue-400 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <h5 className="font-semibold text-xs text-blue-900">Schedule Follow-up Visit</h5>
                  </div>
                  <p className="text-[11px] text-slate-600">Re-dispatch for pending parts/tests or additional work.</p>
                </button>

                {/* Return for Rework */}
                <button
                  type="button"
                  onClick={() => setFinalAction('rework')}
                  className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                    finalAction === 'rework' 
                      ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20' 
                      : 'border-slate-200 hover:border-rose-400 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-rose-100 rounded-full flex items-center justify-center">
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <h5 className="font-semibold text-xs text-rose-900">Return for Rework</h5>
                  </div>
                  <p className="text-[11px] text-slate-600">Reassign & schedule rework visit (Phase 4). Quality issues found.</p>
                </button>
              </div>

              {/* Required Before Closing */}
              {finalAction === 'close' && !happinessCodeVerified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs">
                  <p className="text-amber-800 font-semibold mb-1">⚠️ Required before closing ticket:</p>
                  <ul className="text-amber-700 list-disc list-inside space-y-0.5">
                    <li>Customer Happiness Code must be verified above</li>
                    <li>Customer satisfaction feedback must be recorded above</li>
                  </ul>
                  <p className="text-[11px] text-amber-600 mt-2 font-medium">
                    💡 <strong>Admin Note:</strong> If the customer or technician is unavailable to provide the code, you can use the <strong>⚡ Force Close</strong> button below to bypass Happiness Code verification.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleFinalAction}
                  disabled={
                    !finalAction ||
                    (finalAction === 'close' && !happinessCodeVerified)
                  }
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-xs sm:text-sm cursor-pointer"
                >
                  {finalAction === 'close' && '✓ Finalize & Close Installation (Phase 6)'}
                  {finalAction === 'followup' && '📅 Schedule Follow-up Visit'}
                  {finalAction === 'rework' && '🔄 Return for Rework (Phase 4)'}
                  {!finalAction && 'Select Final Action Decision'}
                </button>
                
                {/* Force Close Button for Admin (Opens Modal) */}
                <button
                  type="button"
                  onClick={() => {
                    setForceCloseReason('');
                    setForceCloseComments('');
                    setShowForceCloseModal(true);
                  }}
                  disabled={isForceClosing}
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Force close this installation with reason and comments modal"
                >
                  <Zap className="w-4 h-4" />
                  ⚡ Force Close
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

      {/* Force Close Modal Dialog */}
      <Dialog open={showForceCloseModal} onOpenChange={setShowForceCloseModal}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900 text-lg font-bold">
              <Zap className="w-5 h-5 text-amber-600 fill-amber-500" />
              ⚡ Force Close Installation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Force closing immediately marks this installation verified and closed without requiring customer Happiness Code verification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reason for Force Closure <span className="text-rose-500">*</span>
              </label>
              <Select value={forceCloseReason} onValueChange={setForceCloseReason}>
                <SelectTrigger className="w-full text-xs font-medium bg-white">
                  <SelectValue placeholder="-- Select Reason --" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Customer Unreachable">Customer Unreachable</SelectItem>
                  <SelectItem value="Customer Refused Service">Customer Refused Service</SelectItem>
                  <SelectItem value="Duplicate Request">Duplicate Request</SelectItem>
                  <SelectItem value="Administrative Override">Administrative Override</SelectItem>
                  <SelectItem value="Site Unreachable / Address Incomplete">Site Unreachable / Address Incomplete</SelectItem>
                  <SelectItem value="Work Completed Outside System">Work Completed Outside System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Comments / Administrative Notes
              </label>
              <Textarea
                rows={3}
                value={forceCloseComments}
                onChange={(e) => setForceCloseComments(e.target.value)}
                placeholder="Explain why this installation is being force closed without customer code..."
                className="text-xs bg-white"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold">⚡ Action Summary:</p>
              <p>• Status will be updated to Force Closed (Phase 6)</p>
              <p>• Closure notification will be sent to the customer via WhatsApp</p>
              <p>• Happiness code verification requirement will be bypassed</p>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForceCloseModal(false);
                setForceCloseReason('');
                setForceCloseComments('');
              }}
              className="text-xs"
              disabled={isForceClosing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveForceClose}
              disabled={isForceClosing || !forceCloseReason}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isForceClosing ? 'Saving...' : 'Save & Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. 2-DAY (48-HOUR) POST-CLOSURE REASSIGN OPTION */}
      {(isAdmin || isSupervisor) && (currentStatusLower === 'verified' || currentStatusLower === 'force_closed' || installation?.force_closed) && installation.verified_at && (
        <div className="mt-6 p-5 bg-blue-50/80 border border-blue-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-100 pb-2">
            <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              Post-Closure Reassignment (48-Hour Window)
            </h4>
            <span className="text-xs text-blue-700 font-medium">
              Available until: {formatDate(new Date(new Date(installation.verified_at).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString())}
            </span>
          </div>
          
          {canReassign() ? (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pt-1">
              <p className="text-xs text-blue-800">
                {getReassignRemainingHours() !== null ? (
                  <><strong>{getReassignRemainingHours()} hours remaining</strong> to reassign this installation after closure. Reassign if the customer reports issues or needs follow-up work.</>
                ) : (
                  <>Reassign this installation if the customer reports issues or needs follow-up work within 2 days of closure.</>
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  const initialIds = (installation.technicians && installation.technicians.length > 0)
                    ? installation.technicians.map((t: any) => t.technician_id)
                    : [];
                  setReassignSelectedTechs(initialIds);
                  const initialLead = installation.technicians?.find((t: any) => t.is_lead)?.technician_id || initialIds[0] || null;
                  setReassignLeadTechId(initialLead);
                  setReassignReason(installation.reassignment_reason || '');
                  setShowReassignModal(true);
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                🔄 Reassign for Follow-up
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-medium">
              The 48-hour post-closure reassignment window has expired. For new requirements, please register a new ticket.
            </p>
          )}
        </div>
      )}

      {/* Reassignment Modal */}
      <Dialog open={showReassignModal} onOpenChange={setShowReassignModal}>
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
                  {formatInstallationTicketId(installation)}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1.5">
                Assign a new field team or update lead responsibility for this installation.
              </DialogDescription>
            </DialogHeader>

            {/* 48h Post-Closure Notice Banner */}
            {isClosed && (
              <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 text-xs flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-semibold">48-Hour Post-Closure Reassignment Window:</span>{" "}
                  {getReassignRemainingHours() !== null ? (
                    <span><strong>{getReassignRemainingHours()} hours remaining</strong> to reassign this installation after closure. Once 48 hours pass, reassignment will be locked.</span>
                  ) : (
                    <span>Installation was previously closed. Reassignment is available within 48 hours of closure.</span>
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
                              setReassignLeadTechId(next[0] || null);
                            }
                          }}
                          className="ml-0.5 rounded-full hover:bg-black/10 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Technician Search & Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Select Technicians</label>
              <Input
                placeholder="Search technicians..."
                value={reassignSearchTerm}
                onChange={(e) => setReassignSearchTerm(e.target.value)}
                className="text-xs"
              />
              <div className="border rounded-xl max-h-48 overflow-y-auto">
                {allTechnicians.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 text-center">No technicians available.</p>
                ) : (
                  <div className="divide-y">
                    {allTechnicians
                      .filter((t: any) => {
                        if (!reassignSearchTerm.trim()) return true;
                        const q = reassignSearchTerm.toLowerCase();
                        const name = (t.full_name || t.email || "").toLowerCase();
                        const empId = (t.employee_id || t.technician_id || "").toLowerCase();
                        return name.includes(q) || empId.includes(q);
                      })
                      .map((tech: any) => {
                        const isSelected = reassignSelectedTechs.includes(tech.id);
                        const isLead = reassignLeadTechId === tech.id;
                        const name = tech.full_name || tech.email || "Technician";

                        return (
                          <div
                            key={tech.id}
                            className={`flex items-center gap-2 p-2.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                            onClick={() => {
                              const next = isSelected
                                ? reassignSelectedTechs.filter((id) => id !== tech.id)
                                : [...reassignSelectedTechs, tech.id];
                              setReassignSelectedTechs(next);
                              if (isSelected && isLead) {
                                setReassignLeadTechId(next[0] || null);
                              } else if (!isSelected && !reassignLeadTechId) {
                                setReassignLeadTechId(tech.id);
                              }
                            }}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSelected ? "bg-primary border-primary" : "border-slate-300"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {isLead ? (
                              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <User className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">{name}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {tech.employee_id || tech.technician_id || "No ID"} {tech.designation ? `• ${tech.designation}` : ""}
                              </p>
                            </div>
                            {isLead && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                LEAD
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500">Click a technician to select. First selected becomes Lead automatically, or click Crown icon on any selected tech.</p>
            </div>

            {/* Reassignment Reason */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Reassignment Reason *</label>
              <Textarea
                rows={3}
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Detail why this installation is being reassigned (minimum 10 characters)..."
                className="text-xs"
              />
              <span className={`text-xs font-medium ${reassignReason.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {reassignReason.trim().length}/10 min chars
              </span>
            </div>

            <DialogFooter className="flex sm:justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReassignModal(false);
                  setReassignSearchTerm("");
                }}
                className="text-xs"
                disabled={isReassigning}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmReassign}
                disabled={
                  isReassigning ||
                  reassignReason.trim().length < 10 ||
                  reassignSelectedTechs.length === 0 ||
                  !reassignLeadTechId
                }
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReassigning ? 'Reassigning...' : `Confirm Reassignment (${reassignSelectedTechs.length})`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 9. Admin Edit Installation Details — ~80% off-canvas */}
      {showAdminEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Admin Edit: Installation Details
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAdminEditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="admin-edit-installation-form" onSubmit={saveAdminEdit} className="space-y-4 text-xs">
              {/* Equipment & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Equipment Details / Scope</label>
                  <Input
                    value={adminEditData.equipment_details || ''}
                    onChange={(e) => setAdminEditData({ ...adminEditData, equipment_details: e.target.value })}
                    placeholder="e.g. 8-Ch NVR, 4 MP Cameras"
                    className="text-xs bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Equipment Model</label>
                  <Input
                    value={adminEditData.equipment_model || ''}
                    onChange={(e) => setAdminEditData({ ...adminEditData, equipment_model: e.target.value })}
                    placeholder="Model specification"
                    className="text-xs bg-slate-50"
                  />
                </div>
              </div>

              {/* Brand & Serial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand / OEM</label>
                  <Input
                    value={adminEditData.brand || ''}
                    onChange={(e) => setAdminEditData({ ...adminEditData, brand: e.target.value })}
                    placeholder="e.g. Hikvision, CP Plus"
                    className="text-xs bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Serial Number</label>
                  <Input
                    value={adminEditData.serial_number || ''}
                    onChange={(e) => setAdminEditData({ ...adminEditData, serial_number: e.target.value })}
                    placeholder="Hardware Serial No."
                    className="text-xs bg-slate-50"
                  />
                </div>
              </div>

              {/* Priority, Chargeable, Service Charge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={adminEditData.priority}
                    onChange={(e) => setAdminEditData({ ...adminEditData, priority: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Is Chargeable?</label>
                  <select
                    value={adminEditData.is_chargeable}
                    onChange={(e) => setAdminEditData({ ...adminEditData, is_chargeable: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="No">No (Standard)</option>
                    <option value="Yes">Yes (Billable)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Charge (₹)</label>
                  <Input
                    type="number"
                    value={adminEditData.service_charge || ''}
                    onChange={(e) => setAdminEditData({ ...adminEditData, service_charge: e.target.value })}
                    disabled={adminEditData.is_chargeable !== 'Yes'}
                    className="text-xs bg-slate-50 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lifecycle Status</label>
                <select
                  value={adminEditData.status || 'Assigned'}
                  onChange={(e) => setAdminEditData({ ...adminEditData, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                >
                  {INSTALLATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              {/* Notes & Testing Results */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Installation / Scope Notes</label>
                <Textarea
                  rows={2}
                  value={adminEditData.notes || ''}
                  onChange={(e) => setAdminEditData({ ...adminEditData, notes: e.target.value })}
                  placeholder="Scope notes, special instructions..."
                  className="text-xs bg-slate-50 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Testing Results</label>
                <Textarea
                  rows={2}
                  value={adminEditData.testing_results || ''}
                  onChange={(e) => setAdminEditData({ ...adminEditData, testing_results: e.target.value })}
                  placeholder="Testing & commissioning observations..."
                  className="text-xs bg-slate-50 resize-none"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

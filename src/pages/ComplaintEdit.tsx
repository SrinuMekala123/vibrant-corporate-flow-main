import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Filter, Loader2, Upload, X, Info, User, MapPin, ShieldCheck, AlertTriangle, Search, CheckCircle2, Crown, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SeverityTier } from "@/data/mockData";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { complaintService } from "@/services/complaintService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { compressImageForUpload } from "@/lib/imageCompression";
import { compressVideoForUpload } from "@/lib/videoCompression";
import { notificationService } from "@/services/notificationService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatFullCustomerAddress } from "@/lib/utils";

const formatDateToYYYYMMDD = (d: Date | null) => {
  if (!d) return null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${year}-${month}-${day}`;
};

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

// Helper: Calculate Asset Warranty Expiry Details
const getAssetWarrantyDetails = (purchaseDateStr?: string, months?: number) => {
  if (!purchaseDateStr) {
    return {
      status: "Unknown",
      isExpired: true,
      expiryDateStr: "Not Specified",
      purchaseDateStr: "Not Specified",
      months: Number(months || 0),
      expiryDate: null,
      daysRemaining: 0
    };
  }

  const pDate = new Date(purchaseDateStr);
  if (isNaN(pDate.getTime())) {
    return {
      status: "Unknown",
      isExpired: true,
      expiryDateStr: "Invalid Date",
      purchaseDateStr: "Invalid Date",
      months: Number(months || 0),
      expiryDate: null,
      daysRemaining: 0
    };
  }

  const expDate = new Date(pDate);
  expDate.setMonth(expDate.getMonth() + Number(months || 0));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = expDate < today;

  return {
    status: isExpired ? "Expired" : "Active",
    isExpired,
    expiryDateStr: expDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    purchaseDateStr: pDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    months: Number(months || 0),
    daysRemaining,
    expiryDate: expDate
  };
};

const isAssetWarrantyActive = (purchaseDate: string, warrantyMonths: number) => {
  return !getAssetWarrantyDetails(purchaseDate, warrantyMonths).isExpired;
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
      // 1. Fetch from customers table (where all BTL and direct customers are created)
      const { data: custList } = await supabase
        .from('customers')
        .select('id, user_id, full_name, email, phone, customer_type')
        .order('full_name', { ascending: true });

      // 2. Fetch from profiles table (auth users with customer role)
      const { data: profList } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'customer');

      const map = new Map<string, any>();

      (custList || []).forEach((c: any) => {
        map.set(c.id, {
          id: c.id,
          user_id: c.user_id,
          full_name: c.full_name,
          email: c.email || '',
          phone: c.phone || '',
          customer_type: c.customer_type
        });
      });

      (profList || []).forEach((p: any) => {
        const existing = Array.from(map.values()).find((c: any) => c.user_id === p.id);
        if (!existing) {
          map.set(p.id, {
            id: p.id,
            user_id: p.id,
            full_name: p.full_name,
            email: p.email || '',
            phone: p.phone || '',
            customer_type: 'Registered'
          });
        }
      });

      return Array.from(map.values());
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

  const [customerType, setCustomerType] = useState<"Existing BTL Customer" | "New / Non-BTL Customer">("Existing BTL Customer");
  const [form, setForm] = useState({
    title: "",
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    location: "",
    locationId: "",
    fieldOfWork: "",
    coverage: "Under Warranty",
    chargeableService: "No",
    serviceCharge: 0,
    brand: "",
    status: "unassigned",
    severity: "minor" as SeverityTier,
    assignedSupervisor: "",
    assignedTechnician: "",
    description: "",
    supervisor_notes: "",
    targetEndTime: "",
    scheduledDate: null as Date | null,
    scheduledTime: "",
    customerLat: null as number | null,
    customerLng: null as number | null,
  });

  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);
  const [leadTechnicianId, setLeadTechnicianId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [currentUserFullName, setCurrentUserFullName] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationHelp, setLocationHelp] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['Solar', 'Networking', 'Electrical', 'CCTV', 'Mixed Services', 'Other']);
  const [userOverrodeFieldOfWork, setUserOverrodeFieldOfWork] = useState(false);
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [customerAssets, setCustomerAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [availableFieldOfWork, setAvailableFieldOfWork] = useState<string[]>([]);

  // 📦 Assets to Service (Multi-Asset Line Items)
  const [assets, setAssets] = useState<Array<{
    id?: string;
    asset_type: string;
    asset_name: string;
    reported_issue: string;
    warranty_status: 'Active' | 'Expired' | 'Not Applicable' | string;
    is_chargeable: boolean;
    service_charge: number;
  }>>([
    {
      asset_type: '',
      asset_name: '',
      reported_issue: '',
      warranty_status: 'Active',
      is_chargeable: false,
      service_charge: 0,
    },
  ]);

  const handleAddAsset = () => {
    setAssets((prev) => [
      ...prev,
      {
        asset_type: '',
        asset_name: '',
        reported_issue: '',
        warranty_status: 'Active',
        is_chargeable: false,
        service_charge: 0,
      },
    ]);
  };

  const handleRemoveAsset = (index: number) => {
    setAssets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateAsset = (index: number, field: string, value: any) => {
    setAssets((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      if (field === 'warranty_status') {
        if (value === 'Expired') {
          target.is_chargeable = true;
        } else if (value === 'Active' || value === 'Not Applicable') {
          target.is_chargeable = false;
          target.service_charge = 0;
        }
      }
      if (field === 'is_chargeable' && !value) {
        target.service_charge = 0;
      }
      next[index] = target;
      return next;
    });
  };

  const totalChargeableAmount = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.is_chargeable ? (Number(a.service_charge) || 0) : 0), 0);
  }, [assets]);

  const handleSelectRegisteredAssetForRow = (index: number, assetId: string) => {
    const chosen = customerAssets.find((a: any) => a.id === assetId);
    if (!chosen) return;
    const wInfo = getAssetWarrantyDetails(chosen.purchase_date, chosen.warranty_months);
    const isExpired = wInfo.isExpired;
    const brandPart = chosen.brand ? `[${chosen.brand}] ` : '';
    const namePart = chosen.product_name || chosen.category || 'Asset';
    const serialPart = chosen.serial_number ? ` (S/N: ${chosen.serial_number})` : '';

    setAssets((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        asset_type: chosen.category || next[index].asset_type,
        asset_name: `${brandPart}${namePart}${serialPart}`,
        warranty_status: isExpired ? 'Expired' : 'Active',
        is_chargeable: isExpired,
        service_charge: isExpired ? (next[index].service_charge || 0) : 0,
      };
      return next;
    });
  };

  // 🧠 Smart Field of Work auto-detection from assets
  const mapToStandardCategory = useCallback((type: string) => {
    const raw = (type || '').trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower === 'camera' || lower.includes('cam') || lower.includes('cctv') || lower.includes('dvr') || lower.includes('nvr')) {
      return 'CCTV';
    }
    if (lower.includes('solar') || lower.includes('inverter') || lower.includes('pv') || lower.includes('panel')) {
      return 'Solar';
    }
    if (lower.includes('network') || lower.includes('router') || lower.includes('wifi') || lower.includes('switch') || lower.includes('lan')) {
      return 'Networking';
    }
    if (lower.includes('electr') || lower.includes('wire') || lower.includes('power') || lower.includes('ups')) {
      return 'Electrical';
    }
    // Match against known categories
    const match = availableCategories.find(c => c.toLowerCase() === lower);
    return match || raw;
  }, [availableCategories]);

  useEffect(() => {
    if (userOverrodeFieldOfWork) return;

    const validAssetTypes = assets
      .map(a => (a.asset_type || '').trim())
      .filter(t => t.length > 0);

    if (validAssetTypes.length === 0) return;

    const categories = Array.from(new Set(validAssetTypes.map(t => mapToStandardCategory(t))));

    if (categories.length === 1) {
      const singleCat = categories[0];
      setForm(prev => {
        if (prev.fieldOfWork !== singleCat) {
          return { ...prev, fieldOfWork: singleCat };
        }
        return prev;
      });
    } else if (categories.length > 1) {
      setForm(prev => {
        if (prev.fieldOfWork !== "Mixed Services") {
          return { ...prev, fieldOfWork: "Mixed Services" };
        }
        return prev;
      });
    }
  }, [assets, userOverrodeFieldOfWork, mapToStandardCategory]);

  // 🛡️ Auto-sync Coverage & Chargeable Service based on assets
  useEffect(() => {
    if (!assets || assets.length === 0) return;

    const hasExpiredOrChargeable = assets.some(
      a => a.warranty_status === 'Expired' || a.is_chargeable === true
    );

    const calculatedTotalCharge = assets.reduce(
      (sum, a) => sum + (a.is_chargeable ? (Number(a.service_charge) || 0) : 0),
      0
    );

    if (hasExpiredOrChargeable) {
      setForm(prev => {
        if (
          prev.coverage === "Chargeable Service" &&
          prev.chargeableService === "Yes" &&
          prev.serviceCharge === calculatedTotalCharge
        ) {
          return prev;
        }
        return {
          ...prev,
          coverage: "Chargeable Service",
          chargeableService: "Yes",
          serviceCharge: calculatedTotalCharge,
        };
      });
    } else {
      setForm(prev => {
        if (
          prev.coverage === "Under Warranty" &&
          prev.chargeableService === "No" &&
          prev.serviceCharge === 0
        ) {
          return prev;
        }
        return {
          ...prev,
          coverage: "Under Warranty",
          chargeableService: "No",
          serviceCharge: 0,
        };
      });
    }
  }, [assets]);

  // 📝 New Complaint Draft Persistence & Clearing
  const isDraftClearedRef = useRef(false);

  const clearDraft = useCallback(() => {
    isDraftClearedRef.current = true;
    try {
      localStorage.removeItem('draft_new_complaint');
      sessionStorage.removeItem('draft_new_complaint');
    } catch (e) {
      console.warn("Failed to clear draft:", e);
    }
  }, []);

  const resetFormToBlank = useCallback(() => {
    clearDraft();
    setForm({
      title: "",
      customerId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      location: "",
      locationId: "",
      fieldOfWork: "",
      coverage: "Under Warranty",
      chargeableService: "No",
      serviceCharge: 0,
      brand: "",
      status: "unassigned",
      severity: "minor" as SeverityTier,
      assignedSupervisor: "",
      assignedTechnician: "",
      description: "",
      supervisor_notes: "",
      targetEndTime: "",
      scheduledDate: null,
      scheduledTime: "",
      customerLat: null,
      customerLng: null,
    });
    setAssets([
      {
        asset_type: '',
        asset_name: '',
        reported_issue: '',
        warranty_status: 'Active',
        is_chargeable: false,
        service_charge: 0,
      },
    ]);
    setSelectedSupervisorId("");
    setSelectedTechnicianIds([]);
    setLeadTechnicianId(null);
    setEvidenceUrls([]);
    setSelectedLocationId("");
    setSelectedAssetId("");
    setUserOverrodeFieldOfWork(false);
  }, [clearDraft]);

  const handleCancel = useCallback(() => {
    resetFormToBlank();
    navigate(-1);
  }, [resetFormToBlank, navigate]);

  useEffect(() => {
    if (!isNew) return;
    try {
      const saved = localStorage.getItem('draft_new_complaint');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) {
          setForm(prev => ({
            ...prev,
            ...parsed.form,
            scheduledDate: parsed.form.scheduledDate ? new Date(parsed.form.scheduledDate) : null,
          }));
        }
        if (parsed.customerType) setCustomerType(parsed.customerType);
        if (parsed.selectedSupervisorId) setSelectedSupervisorId(parsed.selectedSupervisorId);
        if (parsed.selectedTechnicianIds) setSelectedTechnicianIds(parsed.selectedTechnicianIds);
        if (parsed.leadTechnicianId) setLeadTechnicianId(parsed.leadTechnicianId);
        if (parsed.evidenceUrls) setEvidenceUrls(parsed.evidenceUrls);
        if (parsed.assets && Array.isArray(parsed.assets) && parsed.assets.length > 0) {
          setAssets(parsed.assets);
        }
        if (parsed.userOverrodeFieldOfWork) setUserOverrodeFieldOfWork(Boolean(parsed.userOverrodeFieldOfWork));
      }
    } catch (e) {
      console.warn("Failed to restore new complaint draft:", e);
    }
  }, [isNew]);

  useEffect(() => {
    if (!isNew || isDraftClearedRef.current || isSaving) return;
    const timer = setTimeout(() => {
      try {
        if (isDraftClearedRef.current || isSaving) return;
        const hasContent = form.title || form.customerId || form.customerName || form.description || assets.some(a => a.asset_name || a.asset_type);
        if (hasContent) {
          const data = {
            form,
            customerType,
            selectedSupervisorId,
            selectedTechnicianIds,
            leadTechnicianId,
            evidenceUrls,
            assets,
            userOverrodeFieldOfWork,
          };
          localStorage.setItem('draft_new_complaint', JSON.stringify(data));
        }
      } catch (e) {
        console.warn("Failed to save new complaint draft:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isNew, isSaving, form, customerType, selectedSupervisorId, selectedTechnicianIds, leadTechnicianId, evidenceUrls, assets, userOverrodeFieldOfWork]);

  // ✅ Validation checks controlling the "Create Complaint" / "Save" button state
  const hasValidCustomer = Boolean(
    isCustomer
      ? (form.customerId || user?.id)
      : (customerType === "Existing BTL Customer" ? Boolean(form.customerId) : Boolean(form.customerName?.trim()))
  );

  const hasValidLocation = Boolean(form.location && form.location.trim().length > 0);

  // Must have at least 1 valid asset with a name
  const hasValidAssets = Boolean(
    assets.length > 0 &&
    assets.some(a => (a.asset_name || '').trim().length > 0)
  );

  // Main issue text area
  const hasValidDescription = Boolean(form.description && form.description.trim().length > 0);

  // Field of Work (auto-filled by Requirement 2 or manually selected)
  const hasValidFieldOfWork = Boolean(form.fieldOfWork && form.fieldOfWork.trim().length > 0);

  const isFormValid = Boolean(
    hasValidCustomer &&
    hasValidLocation &&
    hasValidAssets &&
    hasValidDescription &&
    hasValidFieldOfWork
  );

  const missingRequiredFields = useMemo(() => {
    const list: string[] = [];
    if (!hasValidCustomer) list.push(customerType === "Existing BTL Customer" ? "Customer" : "Customer Name");
    if (!hasValidLocation) list.push("Location");
    if (!hasValidAssets) list.push("Asset Name");
    if (!hasValidDescription) list.push("Problem Description");
    if (!hasValidFieldOfWork) list.push("Field of Work");
    return list;
  }, [hasValidCustomer, customerType, hasValidLocation, hasValidAssets, hasValidDescription, hasValidFieldOfWork]);

  // 🛡️ Derived Asset & Warranty Expiry Information
  const selectedAsset = useMemo(() => {
    return customerAssets.find((a: any) => a.id === selectedAssetId) || null;
  }, [customerAssets, selectedAssetId]);

  const selectedAssetWarranty = useMemo(() => {
    if (!selectedAsset) return null;
    return getAssetWarrantyDetails(selectedAsset.purchase_date, selectedAsset.warranty_months);
  }, [selectedAsset]);

  const handleAssetSelection = (assetId: string) => {
    setSelectedAssetId(assetId);
    const chosen = customerAssets.find((a: any) => a.id === assetId);
    if (chosen) {
      const wInfo = getAssetWarrantyDetails(chosen.purchase_date, chosen.warranty_months);
      const isUnderWarranty = !wInfo.isExpired;
      setForm(prev => ({
        ...prev,
        fieldOfWork: chosen.category || prev.fieldOfWork,
        brand: chosen.brand || prev.brand,
        coverage: isUnderWarranty ? "Under Warranty" : "Out of Warranty",
        chargeableService: isUnderWarranty ? "No" : "Yes",
        serviceCharge: isUnderWarranty ? 0 : (prev.serviceCharge || 500)
      }));
      toast.info(
        isUnderWarranty
          ? `Asset is under warranty until ${wInfo.expiryDateStr}. Coverage set to "Under Warranty" (Non-chargeable).`
          : `Asset warranty expired on ${wInfo.expiryDateStr}. Coverage set to "Out of Warranty" (Chargeable Service).`
      );
    }
  };
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [customerLocations, setCustomerLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [isLocationsLoading, setIsLocationsLoading] = useState(false);
  const [supervisorError, setSupervisorError] = useState("");

  // 🔍 Smart Walk-in Auto-Detector State
  const [matchedCustomer, setMatchedCustomer] = useState<{ id: string; user_id?: string; full_name: string; phone?: string; email?: string; address?: string; customer_type?: string } | null>(null);
  const [showMatchAlert, setShowMatchAlert] = useState(false);
  const [overrideDuplicateCustomer, setOverrideDuplicateCustomer] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  const checkExistingCustomerPhone = async (phoneStr: string) => {
    if (!phoneStr) {
      setShowMatchAlert(false);
      setMatchedCustomer(null);
      return;
    }
    const cleanPhone = phoneStr.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setShowMatchAlert(false);
      return;
    }

    setIsCheckingPhone(true);
    try {
      const last10 = cleanPhone.slice(-10);
      // 1. Check in customers table
      const { data: custData } = await supabase
        .from('customers')
        .select('id, user_id, full_name, phone, email, address, customer_type')
        .ilike('phone', `%${last10}%`)
        .limit(1)
        .maybeSingle();

      if (custData) {
        setMatchedCustomer({
          id: custData.id,
          user_id: custData.user_id,
          full_name: custData.full_name,
          phone: custData.phone,
          email: custData.email,
          address: custData.address,
          customer_type: custData.customer_type
        });
        setShowMatchAlert(true);
        setOverrideDuplicateCustomer(false);
        toast.warning(`⚠️ Customer with this phone number already exists: ${custData.full_name}. Please use existing customer.`, {
          duration: 6000
        });
        return;
      }

      // 2. Check in profiles table
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, customer_type')
        .eq('role', 'customer')
        .ilike('phone', `%${last10}%`)
        .limit(1)
        .maybeSingle();

      if (profData) {
        // Verify if this customer's active record in customers table has changed or removed their phone
        let { data: linkedCust } = await supabase
          .from('customers')
          .select('id, user_id, phone, full_name, address, customer_type')
          .eq('user_id', profData.id)
          .limit(1)
          .maybeSingle();

        if (!linkedCust && profData.email) {
          const { data: custByEmail } = await supabase
            .from('customers')
            .select('id, user_id, phone, full_name, address, customer_type')
            .ilike('email', profData.email)
            .limit(1)
            .maybeSingle();
          linkedCust = custByEmail;
        }

        if (linkedCust) {
          const linkedDigits = (linkedCust.phone || '').replace(/\D/g, '').slice(-10);
          if (!linkedDigits || linkedDigits !== last10) {
            console.log(`Freed phone detected! Profile ${profData.full_name} changed phone to '${linkedCust.phone}'. Freeing ${last10}...`);
            // Synchronize stale profile in background so phone is freed everywhere
            void supabase.from('profiles').update({ phone: linkedCust.phone || null }).eq('id', profData.id);
            setShowMatchAlert(false);
            setMatchedCustomer(null);
            return;
          }
        }

        setMatchedCustomer({
          id: linkedCust?.id || profData.id,
          user_id: profData.id,
          full_name: profData.full_name,
          phone: profData.phone,
          email: profData.email,
          address: linkedCust?.address || "",
          customer_type: profData.customer_type || linkedCust?.customer_type
        });
        setShowMatchAlert(true);
        setOverrideDuplicateCustomer(false);
        toast.warning(`⚠️ Customer with this phone number already exists: ${profData.full_name}. Please use existing customer.`, {
          duration: 6000
        });
      } else {
        setShowMatchAlert(false);
        setMatchedCustomer(null);
      }
    } catch (err) {
      console.warn("Smart Walk-in check error:", err);
      setShowMatchAlert(false);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleConvertToRegistered = (matched: any) => {
    setCustomerType("Existing BTL Customer");
    setForm(prev => ({
      ...prev,
      customerId: matched.id,
      customerName: matched.full_name,
      customerPhone: matched.phone || prev.customerPhone,
      customerEmail: matched.email || prev.customerEmail,
      location: matched.address || prev.location,
      coverage: "Under Warranty",
      chargeableService: "No"
    }));
    setShowMatchAlert(false);
    toast.success(`Switched to registered customer: ${matched.full_name}`);
  };

  const clearSupervisorError = () => {
    if (supervisorError) setSupervisorError("");
  };

  const calculateAutoStatus = () => {
    if (isNew) {
      if (form.assignedSupervisor || selectedSupervisorId) return "assigned";
      return "unassigned";
    }

    const phase = existingComplaint?.current_phase || 1;
    if (form.assignedTechnician || selectedTechnicianId || (selectedTechnicianIds && selectedTechnicianIds.length > 0)) return "dispatched";
    if (form.assignedSupervisor || selectedSupervisorId) return "assigned";
    if (phase >= 6) return "closed";
    if (phase >= 5) return "completed";
    if (phase >= 4) return "in-progress";
    if (phase >= 3) return "dispatched";
    if (phase >= 2) return "assigned";
    return "unassigned";
  };

  const autoStatus = calculateAutoStatus();

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
              .select('id, product_name, brand, category, serial_number, model_number, purchase_date, warranty_months, status')
              .eq('customer_id', customerRecord.id)
              .order('created_at', { ascending: false });

            if (assetsError) {
              console.error("Error fetching customer assets:", assetsError);
              setAvailableCategories([]);
              return;
            }

            if (assets && assets.length > 0) {
              const uniqueCategories = [...new Set(assets.map((a: any) => a.category).filter(Boolean))] as string[];
              setCustomerAssets(assets);
              setAvailableCategories(uniqueCategories);

              // If creating a new complaint and there is only 1 asset, auto-select and apply warranty defaults
              if (isNew && assets.length === 1 && !selectedAssetId) {
                const soleAsset = assets[0];
                setSelectedAssetId(soleAsset.id);
                const wInfo = getAssetWarrantyDetails(soleAsset.purchase_date, soleAsset.warranty_months);
                const isUnderWarranty = !wInfo.isExpired;
                setForm(prev => ({
                  ...prev,
                  fieldOfWork: soleAsset.category || prev.fieldOfWork,
                  brand: soleAsset.brand || prev.brand,
                  coverage: isUnderWarranty ? "Under Warranty" : "Out of Warranty",
                  chargeableService: isUnderWarranty ? "No" : "Yes",
                  serviceCharge: isUnderWarranty ? 0 : prev.serviceCharge
                }));
              }
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
  }, [user?.id, isCustomer, isNew]);

  useEffect(() => {
    const fetchCustomerAssets = async () => {
      if (!form.customerId) {
        setCustomerAssets([]);
        setAvailableFieldOfWork([]);
        return;
      }

      setIsAssetsLoading(true);
      try {
        const targetIds: string[] = [form.customerId];

        // 1. Check if form.customerId matches id in customers table
        const { data: directCust } = await supabase
          .from('customers')
          .select('id, user_id')
          .eq('id', form.customerId)
          .maybeSingle();

        if (directCust) {
          if (directCust.id && !targetIds.includes(directCust.id)) targetIds.push(directCust.id);
          if (directCust.user_id && !targetIds.includes(directCust.user_id)) targetIds.push(directCust.user_id);
        } else {
          // 2. Check if form.customerId matches user_id in customers table
          const { data: byUserCust } = await supabase
            .from('customers')
            .select('id, user_id')
            .eq('user_id', form.customerId)
            .maybeSingle();

          if (byUserCust?.id && !targetIds.includes(byUserCust.id)) {
            targetIds.push(byUserCust.id);
          }
        }

        // 3. Query customer_assets with all rich details
        const { data, error } = await supabase
          .from('customer_assets')
          .select('id, product_name, brand, category, serial_number, model_number, purchase_date, warranty_months, status')
          .in('customer_id', targetIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const assets = data || [];
        setCustomerAssets(assets);

        const uniqueFields = [...new Set(assets.map((a: any) => a.category).filter(Boolean))] as string[];
        setAvailableFieldOfWork(uniqueFields);

        // If creating a new complaint and there is only 1 asset, auto-select and apply warranty defaults
        if (isNew && assets.length === 1 && !selectedAssetId) {
          const soleAsset = assets[0];
          setSelectedAssetId(soleAsset.id);
          const wInfo = getAssetWarrantyDetails(soleAsset.purchase_date, soleAsset.warranty_months);
          const isUnderWarranty = !wInfo.isExpired;
          setForm(prev => ({
            ...prev,
            fieldOfWork: soleAsset.category || prev.fieldOfWork,
            brand: soleAsset.brand || prev.brand,
            coverage: isUnderWarranty ? "Under Warranty" : "Out of Warranty",
            chargeableService: isUnderWarranty ? "No" : "Yes",
            serviceCharge: isUnderWarranty ? 0 : prev.serviceCharge
          }));
        }
      } catch (err) {
        console.error("Error fetching customer assets:", err);
        setCustomerAssets([]);
        setAvailableFieldOfWork([]);
      } finally {
        setIsAssetsLoading(false);
      }
    };

    fetchCustomerAssets();
  }, [form.customerId, isNew]);

  useEffect(() => {
    const fetchCustomerLocations = async () => {
      if (!form.customerId) {
        setCustomerLocations([]);
        setSelectedLocationId("");
        return;
      }

      setIsLocationsLoading(true);
      try {
        const targetIds: string[] = [form.customerId];

        const { data: directCust } = await supabase
          .from('customers')
          .select('id, user_id')
          .eq('id', form.customerId)
          .maybeSingle();

        if (directCust) {
          if (directCust.id && !targetIds.includes(directCust.id)) targetIds.push(directCust.id);
          if (directCust.user_id && !targetIds.includes(directCust.user_id)) targetIds.push(directCust.user_id);
        } else {
          const { data: byUserCust } = await supabase
            .from('customers')
            .select('id, user_id')
            .eq('user_id', form.customerId)
            .maybeSingle();

          if (byUserCust?.id && !targetIds.includes(byUserCust.id)) {
            targetIds.push(byUserCust.id);
          }
        }

        const { data, error } = await supabase
          .from('customer_locations')
          .select('*')
          .in('customer_id', targetIds)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        const locations = data || [];
        setCustomerLocations(locations);

        // Auto-select primary location if available, or first contact address
        const defaultLoc = locations.find((loc: any) => loc.is_primary) || locations[0];
        if (defaultLoc) {
          setSelectedLocationId(defaultLoc.id);
          const fullAddr = formatFullCustomerAddress(defaultLoc);
          setForm(prev => ({ 
            ...prev, 
            locationId: defaultLoc.id, 
            location: fullAddr || defaultLoc.location_name || prev.location 
          }));
        } else if (directCust) {
          // If customer has no records in customer_locations, fallback to customer's registered address
          const { data: custWithAddr } = await supabase
            .from('customers')
            .select('address')
            .eq('id', directCust.id)
            .maybeSingle();
          if (custWithAddr?.address) {
            setForm(prev => ({
              ...prev,
              location: custWithAddr.address
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching customer locations:", err);
        setCustomerLocations([]);
        setSelectedLocationId("");
      } finally {
        setIsLocationsLoading(false);
      }
    };

     fetchCustomerLocations();
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

  // India bounding box coordinate validation (rejects bogus/foreign coordinates like Cincinnati OH)
  const isValidIndiaCoords = (lat?: number | null, lng?: number | null) => {
    return typeof lat === 'number' && typeof lng === 'number' &&
      lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
  };

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
      let parsedScheduledDate: Date | null = null;
      if (existingComplaint.scheduled_date) {
        const parts = existingComplaint.scheduled_date.split('-');
        if (parts.length === 3) {
          parsedScheduledDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          const dt = new Date(existingComplaint.scheduled_date);
          if (!isNaN(dt.getTime())) parsedScheduledDate = dt;
        }
      }

      const isNonBtl = !existingComplaint.customer_id || existingComplaint.customer_type === 'New / Non-BTL Customer' || existingComplaint.customer_type === 'Non-BTL';
      setCustomerType(isNonBtl ? 'New / Non-BTL Customer' : 'Existing BTL Customer');

      setForm({
        title: existingComplaint.title || "",
        customerId: existingComplaint.customer_id || "",
        customerName: existingComplaint.customer_name || "",
        customerPhone: existingComplaint.customer_phone || "",
        customerEmail: existingComplaint.customer_email || "",
        location: existingComplaint.location || "",
        locationId: existingComplaint.location_id || "",
        fieldOfWork: existingComplaint.field_of_work ? (
          ['Solar', 'Networking', 'Electrical', 'CCTV', 'Other'].find(
            c => c.toLowerCase() === existingComplaint.field_of_work.toLowerCase()
          ) || existingComplaint.field_of_work
        ) : "",
        coverage: existingComplaint.coverage || "Under Warranty",
        chargeableService: existingComplaint.chargeable_service ? (String(existingComplaint.chargeable_service).toLowerCase() === 'true' || existingComplaint.chargeable_service === 'Yes' ? 'Yes' : 'No') : "No",
        serviceCharge: existingComplaint.service_charge != null ? Number(existingComplaint.service_charge) : 0,
        brand: existingComplaint.brand || "",
        status: existingComplaint.status || "unassigned",
        severity: existingComplaint.severity as SeverityTier || "minor",
        assignedSupervisor: existingComplaint.assigned_supervisor || "",
        assignedTechnician: existingComplaint.assigned_technician || "",
        description: existingComplaint.description || "",
        supervisor_notes: existingComplaint.supervisor_notes || "",
        targetEndTime: formatDateTimeLocal(existingComplaint.target_end_time),
        scheduledDate: parsedScheduledDate,
        scheduledTime: existingComplaint.scheduled_time || "",
        customerLat: existingComplaint.customer_lat || null,
        customerLng: existingComplaint.customer_lng || null,
      });
      if (existingComplaint.location_id) {
        setSelectedLocationId(existingComplaint.location_id);
      }
      // Load complaint_images
      setEvidenceUrls(existingComplaint.complaint_images || []);

      // Load assigned technician IDs & Lead
      if (existingComplaint.complaint_technicians && existingComplaint.complaint_technicians.length > 0) {
        setSelectedTechnicianIds(existingComplaint.complaint_technicians.map((ct: any) => ct.technician_id));
        const lead = existingComplaint.complaint_technicians.find((ct: any) => ct.is_lead)?.technician_id || existingComplaint.complaint_technicians[0]?.technician_id;
        setLeadTechnicianId(lead);
      } else if (existingComplaint.assigned_to) {
        setSelectedTechnicianIds([existingComplaint.assigned_to]);
        setLeadTechnicianId(existingComplaint.assigned_to);
      } else {
        setSelectedTechnicianIds([]);
        setLeadTechnicianId(null);
      }

      // Load complaint_assets
      if ((existingComplaint as any).complaint_assets && (existingComplaint as any).complaint_assets.length > 0) {
        setAssets((existingComplaint as any).complaint_assets.map((a: any) => ({
          id: a.id,
          asset_type: a.asset_type || '',
          asset_name: a.asset_name || '',
          reported_issue: a.reported_issue || '',
          warranty_status: (a.warranty_status === 'Expired' ? 'Expired' : 'Active') as 'Active' | 'Expired',
          is_chargeable: typeof a.is_chargeable === 'boolean' ? a.is_chargeable : (a.warranty_status === 'Expired'),
          service_charge: Number(a.service_charge) || 0,
        })));
      } else if (existingComplaint.id) {
        supabase
          .from('complaint_assets')
          .select('*')
          .eq('complaint_id', existingComplaint.id)
          .order('created_at', { ascending: true })
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              setAssets(data.map((a: any) => ({
                id: a.id,
                asset_type: a.asset_type || '',
                asset_name: a.asset_name || '',
                reported_issue: a.reported_issue || '',
                warranty_status: (a.warranty_status === 'Expired' ? 'Expired' : 'Active') as 'Active' | 'Expired',
                is_chargeable: typeof a.is_chargeable === 'boolean' ? a.is_chargeable : (a.warranty_status === 'Expired'),
                service_charge: Number(a.service_charge) || 0,
              })));
            } else {
              // Legacy single-asset fallback
              setAssets([{
                asset_type: existingComplaint.field_of_work || '',
                asset_name: existingComplaint.brand || existingComplaint.title || '',
                reported_issue: existingComplaint.description || '',
                warranty_status: existingComplaint.coverage === 'Out of Warranty' ? 'Expired' : 'Active',
                is_chargeable: existingComplaint.chargeable_service === 'Yes' || String(existingComplaint.chargeable_service) === 'true',
                service_charge: Number(existingComplaint.service_charge) || 0,
              }]);
            }
          });
      }
    }
  }, [existingComplaint]);

  useEffect(() => {
    if (supervisors && form.assignedSupervisor) {
      const supTarget = String(form.assignedSupervisor).trim().toLowerCase();
      const match = supervisors.find((s: any) => 
        s.id === form.assignedSupervisor || 
        (s.full_name && s.full_name.trim().toLowerCase() === supTarget)
      );
      if (match) {
        setSelectedSupervisorId(match.id);
        if (form.assignedSupervisor !== match.full_name) {
          setForm(prev => ({ ...prev, assignedSupervisor: match.full_name }));
        }
      }
    }
  }, [supervisors, form.assignedSupervisor]);

  useEffect(() => {
    if (technicians && form.assignedTechnician && selectedTechnicianIds.length === 0) {
      const match = technicians.find((t: any) => t.full_name === form.assignedTechnician);
      if (match) {
        setSelectedTechnicianId(match.id);
        setSelectedTechnicianIds([match.id]);
      }
    }
  }, [technicians, form.assignedTechnician, selectedTechnicianIds.length]);

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
      if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp)$/i.test(file.name)) {
        setUploadProgressText(`Compressing photo (${(file.size / 1024).toFixed(0)}KB -> ~250KB)...`);
        try {
          fileToUpload = await compressImageForUpload(file, { maxSizeMB: 0.25, maxWidthOrHeight: 1600, useWebWorker: true }, (pct) => {
            setUploadProgressText(`Compressing photo: ${pct}%...`);
          });
          console.log(`[Upload] Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(fileToUpload.size / 1024).toFixed(1)}KB`);
        } catch (err) {
          console.warn('Image compression fallback to original:', err);
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

      setUploadProgressText(`Uploading ${(fileToUpload.size / (1024 * 1024)).toFixed(1)}MB to cloud...`);
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('complaint-media').upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileToUpload.type || (fileExt === 'mp4' ? 'video/mp4' : fileExt === 'webm' ? 'video/webm' : undefined)
      });
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
      setUploadProgressText("");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in");
      return;
    }
    
    // Ensure title exists or generate from description / asset
    if (!form.title || form.title.trim() === "") {
      form.title = form.description ? form.description.slice(0, 60).trim() : (assets[0]?.asset_name || "Complaint Service Request");
    }
    
    if (isCustomer || customerType === "Existing BTL Customer") {
      if (!form.customerId) {
        toast.error("Please select a registered customer");
        return;
      }
    } else {
      if (!form.customerName || form.customerName.trim() === "") {
        toast.error("Please enter the client / customer name");
        return;
      }
      if (!form.customerPhone || form.customerPhone.trim() === "") {
        toast.error("Please enter the customer contact phone number");
        return;
      }
      const phoneDigits = form.customerPhone.replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
        toast.error("Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210)");
        return;
      }
      if (matchedCustomer && !overrideDuplicateCustomer) {
        toast.error(`⚠️ Customer with this phone number already exists: ${matchedCustomer.full_name}. Please use existing customer.`, {
          duration: 6000
        });
        setShowMatchAlert(true);
        return;
      }
    }
    
    // Mandatory Location Check for ALL complaints (Existing or New Customer)
    if (!form.location || form.location.trim() === "") {
      toast.error("Location / site address must be filled");
      return;
    }

    // Mandatory Assets to Service Check: must have at least 1 valid asset with a name
    const validAssets = assets.filter(a => (a.asset_name || '').trim().length > 0);
    if (validAssets.length === 0) {
      toast.error("Please add at least one asset with an asset name");
      return;
    }

    // Auto-fill asset_type if left empty
    validAssets.forEach(a => {
      if (!a.asset_type || a.asset_type.trim() === "") {
        a.asset_type = form.fieldOfWork || "General";
      }
    });

    // Auto-sync fieldOfWork, coverage, chargeableService if empty so backward-compatible schemas remain satisfied
    if (!form.fieldOfWork && validAssets[0]?.asset_type) {
      form.fieldOfWork = validAssets[0].asset_type;
    }
    if (!form.coverage) {
      form.coverage = assets.some(a => a.warranty_status === 'Active') ? 'Under Warranty' : 'Out of Warranty';
    }
    if (!form.chargeableService) {
      form.chargeableService = assets.some(a => a.is_chargeable) ? 'Yes' : 'No';
    }
    
    if (!form.fieldOfWork || form.fieldOfWork.trim() === "") {
      toast.error("Please select a Field of Work");
      return;
    }

    if (!form.coverage || form.coverage.trim() === "") {
      toast.error("Please select Coverage (e.g. Under Warranty, Out of Warranty, AMC, etc.)");
      return;
    }

    if (!form.chargeableService || form.chargeableService.trim() === "") {
      toast.error("Please specify if this is a Chargeable Service (Yes or No)");
      return;
    }
    
    if (!form.description || form.description.trim() === "") {
      toast.error("Please provide a problem description");
      return;
    }

    if (form.status === "assigned" && !form.assignedSupervisor) {
      toast.error("Please select a supervisor before marking as Assigned");
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        if (isCustomer) {
          // Verify customer record exists
          const { data: customerRecord, error: customerError } = await supabase
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (customerError) throw customerError;
        }

        // Robust supervisor resolution
        const matchedSup = selectedSupervisorId 
          ? supervisors?.find((s: any) => s.id === selectedSupervisorId)
          : (form.assignedSupervisor ? supervisors?.find((s: any) => s.full_name === form.assignedSupervisor || s.id === form.assignedSupervisor) : null);
        const resolvedSupervisorName = isCustomer 
          ? null 
          : (matchedSup?.full_name || form.assignedSupervisor || (selectedSupervisorId ? selectedSupervisorId : null));

        const autoStatus = calculateAutoStatus();
        let status = resolvedSupervisorName ? "assigned" : (autoStatus || "unassigned");
        let phase = resolvedSupervisorName ? 2 : 1;
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

        const assignedTechNames = isNew ? null : (selectedTechnicianIds
          .map((tid) => technicians?.find((t: any) => t.id === tid)?.full_name)
          .filter(Boolean)
          .join(", ") || null);

        const techObjs = isNew ? [] : selectedTechnicianIds.map((tid) => ({
          technician_id: tid,
          is_lead: tid === (leadTechnicianId || selectedTechnicianIds[0]),
        }));
        const leadTechId = isNew ? null : (techObjs.find((t) => t.is_lead)?.technician_id || selectedTechnicianIds[0] || null);

        const isExistingBtl = isCustomer || customerType === "Existing BTL Customer";
        let linkedCustomerId: string | null = null;

        // 1. Existing Customer linking
        if (isExistingBtl && form.customerId) {
          linkedCustomerId = form.customerId;
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", form.customerId)
              .maybeSingle();
            if (prof?.id) {
              linkedCustomerId = prof.id;
            } else {
              const { data: custRec } = await supabase
                .from("customers")
                .select("id, user_id")
                .eq("id", form.customerId)
                .maybeSingle();
              if (custRec?.user_id) {
                linkedCustomerId = custRec.user_id;
              } else if (custRec?.id) {
                linkedCustomerId = custRec.id;
              }
            }
          } catch (e) {
            console.warn("Could not verify profile/customer ID:", e);
          }
        }

        // 2. Auto-create Walk-in / New Customer in customers table and link
        let isCustomerFound = false;
        if (!isExistingBtl && (form.customerPhone || form.customerName)) {
          try {
            const cleanPhone = (form.customerPhone || "").replace(/\D/g, "");
            const last10 = cleanPhone.slice(-10);

            let matchedCustomer: any = null;
            if (last10) {
              const { data: matchedCust } = await supabase
                .from("customers")
                .select("id, user_id, full_name, email")
                .ilike("phone", `%${last10}%`)
                .maybeSingle();
              matchedCustomer = matchedCust;

              if (!matchedCustomer) {
                const { data: matchedProf } = await supabase
                  .from("profiles")
                  .select("id, full_name, email")
                  .eq("role", "customer")
                  .ilike("phone", `%${last10}%`)
                  .maybeSingle();
                if (matchedProf) {
                  matchedCustomer = {
                    id: matchedProf.id,
                    user_id: matchedProf.id,
                    full_name: matchedProf.full_name,
                    email: matchedProf.email
                  };
                }
              }
            }

            if (matchedCustomer && !overrideDuplicateCustomer) {
              linkedCustomerId = matchedCustomer.user_id || matchedCustomer.id;
              if (matchedCustomer.full_name && !form.customerName) {
                form.customerName = matchedCustomer.full_name;
              }
              isCustomerFound = true;
            } else {
              let newProfileId: string | null = null;

              if (form.customerEmail && /^\S+@\S+\.\S+$/.test(form.customerEmail)) {
                try {
                  const { data: edgeData, error: edgeError } = await supabase.functions.invoke("create-customer-user", {
                    body: {
                      email: form.customerEmail.trim().toLowerCase(),
                      full_name: form.customerName || "Customer",
                      phone: form.customerPhone,
                      role: "customer"
                    }
                  });

                  if (!edgeError) {
                    newProfileId = edgeData?.user?.id || edgeData?.userId || null;
                  }
                } catch (edgeErr) {
                  console.warn("Edge function customer creation failed:", edgeErr);
                }
              }

              if (newProfileId) {
                linkedCustomerId = newProfileId;
              } else {
                const { data: newCust, error: newCustErr } = await supabase
                  .from("customers")
                  .insert([{
                    full_name: form.customerName || "Customer",
                    phone: form.customerPhone || null,
                    email: form.customerEmail || null,
                    address: form.location || null,
                    customer_type: customerType === "New / Non-BTL Customer" ? "Walk-in" : "Retail",
                    entity_type: "Individual"
                  }])
                  .select("id")
                  .maybeSingle();

                if (!newCustErr && newCust?.id) {
                  linkedCustomerId = newCust.id;
                }

                if (form.customerEmail && /^\S+@\S+\.\S+$/.test(form.customerEmail) && !newProfileId) {
                  void (async () => {
                    try {
                      await supabase.functions.invoke("create-customer-user", {
                        body: {
                          email: form.customerEmail.trim().toLowerCase(),
                          full_name: form.customerName || "Customer",
                          phone: form.customerPhone,
                          role: "customer"
                        }
                      });
                    } catch (authErr) {
                      console.warn("Background customer user creation:", authErr);
                    }
                  })();
                }
              }
            }
          } catch (custErr) {
            console.warn("Walk-in customer auto-link skipped:", custErr);
          }
        }

        const isNonBtl = !isExistingBtl && (!isCustomerFound || overrideDuplicateCustomer);
        const newComplaint = await complaintService.create({
          customer_type: isNonBtl ? "New / Non-BTL Customer" : "Existing BTL Customer",
          customer_id: linkedCustomerId,
          customer_name: form.customerName || null,
          customer_phone: form.customerPhone || null,
          customer_email: form.customerEmail || null,
          created_by_name: currentUserFullName || "User",
          title: form.title,
          description: form.description,
          status: status,
          assigned_supervisor: resolvedSupervisorName,
          supervisor_assigned: resolvedSupervisorName,
          assigned_technician: isCustomer ? null : assignedTechNames,
          assigned_to: leadTechId,
          location_id: (isExistingBtl && selectedLocationId) ? selectedLocationId : null,
          location: form.location || null,
          field_of_work: form.fieldOfWork || null,
          coverage: form.coverage || (assets.some(a => a.warranty_status === 'Active') ? "Under Warranty" : "Out of Warranty"),
          chargeable_service: form.chargeableService || (assets.some(a => a.is_chargeable) ? "Yes" : "No"),
          service_charge: form.chargeableService === "Yes" ? (Number(form.serviceCharge) || totalChargeableAmount) : totalChargeableAmount,
          brand: form.brand || null,
          severity: form.severity || null,
          current_phase: phase,
          resolution: null,
          complaint_images: evidenceUrls.length > 0 ? evidenceUrls : null,
          customer_lat: isValidIndiaCoords(form.customerLat, form.customerLng) ? form.customerLat : null,
          customer_lng: isValidIndiaCoords(form.customerLat, form.customerLng) ? form.customerLng : null,
          target_end_time: form.targetEndTime ? new Date(form.targetEndTime).toISOString() : null,
          scheduled_date: null,
          scheduled_time: null,
        } as any, techObjs);

        if (import.meta.env.DEV) {
          console.log("✅ Complaint created ID:", newComplaint.id);
        }

        // Insert Assets: Store multiple line items in complaint_assets table
        if (newComplaint?.id && validAssets.length > 0) {
          const assetsToInsert = validAssets.map(a => ({
            complaint_id: newComplaint.id,
            asset_type: a.asset_type,
            asset_name: a.asset_name,
            reported_issue: a.reported_issue,
            warranty_status: a.warranty_status,
            is_chargeable: a.is_chargeable,
            service_charge: a.service_charge || 0
          }));
          const { error: assetInsErr } = await supabase.from('complaint_assets').insert(assetsToInsert);
          if (assetInsErr) {
            console.error("Failed to insert complaint assets:", assetInsErr);
          }
        }

        // Invalidate queries so lists/dashboards/customers update immediately
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['complaint_assets'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['customers-list'] });
        queryClient.invalidateQueries({ queryKey: ['customerProfiles'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        
        const displayTicketId = newComplaint.ticket_id || newComplaint.id.slice(0, 8);

        // Notify in background asynchronously without blocking UI navigation
        void (async () => {
          try {
            if (isCustomer) {
              const adminIds = await notificationService.getAdminUserIds();
              await notificationService.insertNotification(
                adminIds,
                newComplaint.id,
                'info',
                '🔔 New Complaint Registered',
                `New complaint registered by ${form.customerName || "Customer"}. Ticket #${displayTicketId} requires assignment.`,
                1,
                undefined,
                user?.id
              );
            } else {
              if (form.assignedSupervisor) {
                const supervisorProfile = await fetchProfileByName(form.assignedSupervisor);
                if (supervisorProfile) {
                  await notificationService.insertNotification(
                    supervisorProfile.id,
                    newComplaint.id,
                    'assignment',
                    '📋 Ticket Assigned',
                    `You have been assigned to Ticket #${displayTicketId} for telephonic triage.`,
                    1,
                    undefined,
                    user?.id
                  );
                }
              }

              if (form.assignedTechnician) {
                const technicianProfile = await fetchProfileByName(form.assignedTechnician);
                if (technicianProfile) {
                  await notificationService.insertNotification(
                    technicianProfile.id,
                    newComplaint.id,
                    'assignment',
                    '🔧 Direct Dispatch',
                    `Directly assigned to Ticket #${displayTicketId}. Proceed to site.`,
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
                    `A technician has been dispatched to your location for Ticket #${displayTicketId}.`,
                    3,
                    undefined,
                    user?.id
                  );
                }
              }
            }
          } catch (notifErr) {
            console.warn("Background notification dispatch:", notifErr);
          }
        })();

        clearDraft();
        resetFormToBlank();
        if (isCustomer) {
          toast.success(`Complaint #${displayTicketId} submitted! Our team will contact you soon.`);
          navigate("/dashboard");
        } else {
          toast.success(`Complaint #${displayTicketId} created successfully!`);
          navigate("/complaints");
        }
      } else {
        const matchedSup = selectedSupervisorId 
          ? supervisors?.find((s: any) => s.id === selectedSupervisorId)
          : (form.assignedSupervisor ? supervisors?.find((s: any) => s.full_name === form.assignedSupervisor || s.id === form.assignedSupervisor) : null);
        const resolvedSupervisorName = isCustomer 
          ? null 
          : (matchedSup?.full_name || form.assignedSupervisor || (selectedSupervisorId ? selectedSupervisorId : null));

        const autoStatus = calculateAutoStatus();
        let nextPhase = existingComplaint?.current_phase || 1;
        let nextStatus = autoStatus;

        if (autoStatus === "unassigned") {
          nextPhase = 1;
        } else if (autoStatus === "assigned") {
          nextPhase = 2;
        } else if (autoStatus === "dispatched") {
          nextPhase = 3;
        } else if (autoStatus === "in-progress") {
          nextPhase = 4;
        } else if (autoStatus === "completed" || autoStatus === "closed") {
          nextPhase = 6;
        }

        if (resolvedSupervisorName && nextPhase === 1) {
          nextPhase = 2;
          nextStatus = "assigned";
        }

        const supervisorChanged = resolvedSupervisorName && resolvedSupervisorName !== existingComplaint?.assigned_supervisor;
        const assignedTechNames = selectedTechnicianIds
          .map((tid) => technicians?.find((t: any) => t.id === tid)?.full_name)
          .filter(Boolean)
          .join(", ") || null;

        const techObjs = selectedTechnicianIds.map((tid) => ({
          technician_id: tid,
          is_lead: tid === (leadTechnicianId || selectedTechnicianIds[0]),
        }));
        const leadTechId = techObjs.find((t) => t.is_lead)?.technician_id || selectedTechnicianIds[0] || null;

        const technicianChanged = assignedTechNames && assignedTechNames !== existingComplaint?.assigned_technician;
        const existingTicketDisplay = existingComplaint?.ticket_id || id?.slice(0, 8);

        await complaintService.update(id!, {
          title: form.title,
          description: form.description,
          location: form.location || null,
          location_id: selectedLocationId || null,
          field_of_work: form.fieldOfWork || null,
          coverage: form.coverage || (assets.some(a => a.warranty_status === 'Active') ? "Under Warranty" : "Out of Warranty"),
          chargeable_service: form.chargeableService || (assets.some(a => a.is_chargeable) ? "Yes" : "No"),
          service_charge: form.chargeableService === "Yes" ? (Number(form.serviceCharge) || totalChargeableAmount) : totalChargeableAmount,
          brand: form.brand || null,
          severity: form.severity || null,
          status: nextStatus,
          assigned_supervisor: resolvedSupervisorName,
          supervisor_assigned: resolvedSupervisorName,
          assigned_technician: assignedTechNames || form.assignedTechnician || null,
          assigned_to: leadTechId,
          supervisor_notes: form.supervisor_notes || null,
          complaint_images: evidenceUrls.length > 0 ? evidenceUrls : null,
          current_phase: nextPhase,
          customer_lat: isValidIndiaCoords(form.customerLat, form.customerLng) ? form.customerLat : null,
          customer_lng: isValidIndiaCoords(form.customerLat, form.customerLng) ? form.customerLng : null,
          target_end_time: form.targetEndTime ? new Date(form.targetEndTime).toISOString() : null,
          scheduled_date: formatDateToYYYYMMDD(form.scheduledDate),
          scheduled_time: form.scheduledTime || null,
        } as any, techObjs);

        if (supervisorChanged) {
          const supervisorProfile = await fetchProfileByName(form.assignedSupervisor);
          if (supervisorProfile) {
            await notificationService.insertNotification(
              supervisorProfile.id,
              id!,
              'assignment',
              '📋 Ticket Assigned',
              `You have been assigned to Ticket #${existingTicketDisplay} for telephonic triage.`,
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
              `You have been assigned to Ticket #${existingTicketDisplay} at ${form.location || 'site'}.`,
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
              `Technician ${form.assignedTechnician} has been assigned to your Ticket #${existingTicketDisplay}.`,
              3,
              undefined,
              user?.id
            );
          }
        }

        // Sync complaint_assets: delete old assets for this complaint and re-insert updated list
        if (id && validAssets.length > 0) {
          const { error: delErr } = await supabase.from('complaint_assets').delete().eq('complaint_id', id);
          if (delErr) {
            console.warn("Failed to delete old complaint assets:", delErr);
          }
          const assetsToInsert = validAssets.map(a => ({
            complaint_id: id,
            asset_type: a.asset_type,
            asset_name: a.asset_name,
            reported_issue: a.reported_issue,
            warranty_status: a.warranty_status,
            is_chargeable: a.is_chargeable,
            service_charge: a.service_charge || 0
          }));
          const { error: assetUpdateErr } = await supabase.from('complaint_assets').insert(assetsToInsert);
          if (assetUpdateErr) {
            console.error("Failed to update complaint assets:", assetUpdateErr);
          }
        }

        // Invalidate queries so lists/dashboards/details update immediately
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['complaint_assets'] });
        queryClient.invalidateQueries({ queryKey: ['complaint_assets', id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['complaint', id] });

        clearDraft();
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
    <div className="space-y-6 w-full pb-20">
      <div className="flex items-center gap-3">
        <button onClick={handleCancel} className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center" disabled={isSaving}>
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
        {/* ==================================================================== */}
        {/* 📋 SECTION 1: TOP DETAILS (TICKET ID, ISSUE TITLE, CUSTOMER & SITE) */}
        {/* ==================================================================== */}
        <div className="space-y-4">
          {/* Ticket ID & Full-Width Issue Title */}
          <div className={`grid grid-cols-1 ${!isNew ? 'md:grid-cols-3' : 'grid-cols-1'} gap-4`}>
            {!isNew && (
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-sm font-medium">Ticket ID (Auto-Generated)</label>
                <Input 
                  value={existingComplaint?.ticket_id || `Ticket #${id?.slice(0, 8)}`} 
                  disabled 
                  readOnly
                  className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100 font-mono text-xs"
                />
              </div>
            )}

            <div className={`space-y-1.5 ${!isNew ? 'md:col-span-2' : 'w-full'}`}>
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Issue Title <span className="text-destructive">*</span></label>
                <span className="text-xs text-muted-foreground">
                  {(form.title || "").length}/250
                </span>
              </div>
              <Input 
                value={form.title} 
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} 
                placeholder="Brief description of the problem..." 
                required 
                disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                maxLength={250} 
                className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
              />
            </div>
          </div>

          {/* Customer & Location 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {isCustomer ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Your Name</label>
                  <Input value={form.customerName} disabled className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Contact Phone <span className="text-destructive">*</span></label>
                  <Input 
                    value={form.customerPhone} 
                    onChange={(e) => setForm(prev => ({ ...prev, customerPhone: e.target.value }))} 
                    placeholder="+91 9876543210" 
                    required 
                    disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                    className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Row 1, Col 1: Customer Type Toggle */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Customer Type <span className="text-destructive">*</span>
                  </label>
                  <div className="flex items-center gap-2 pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-xs bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors flex-1">
                      <input
                        type="radio"
                        name="customer_type"
                        value="Existing BTL Customer"
                        checked={customerType === "Existing BTL Customer"}
                        onChange={() => {
                          setCustomerType("Existing BTL Customer");
                          setForm(prev => ({ ...prev, customerId: "", customerName: "", customerPhone: "", customerEmail: "", coverage: "Under Warranty", chargeableService: "No" }));
                        }}
                        disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                        className="text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-slate-800 dark:text-slate-200 font-bold truncate">🔘 Registered BTL</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-xs bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors flex-1">
                      <input
                        type="radio"
                        name="customer_type"
                        value="New / Non-BTL Customer"
                        checked={customerType === "New / Non-BTL Customer"}
                        onChange={() => {
                          setCustomerType("New / Non-BTL Customer");
                          setSelectedLocationId("");
                          setForm(prev => ({
                            ...prev,
                            customerId: "",
                            customerName: "",
                            customerPhone: "",
                            customerEmail: "",
                            locationId: "",
                            coverage: "Out of Warranty",
                            chargeableService: "Yes"
                          }));
                        }}
                        disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                        className="text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span className="text-amber-900 dark:text-amber-300 font-bold truncate">🔘 Direct / Walk-in</span>
                    </label>
                  </div>
                </div>

                {/* Row 1, Col 2: Phone */}
                {customerType === "Existing BTL Customer" ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Contact Phone</label>
                    <Input 
                      value={form.customerPhone} 
                      onChange={(e) => setForm(prev => ({ ...prev, customerPhone: e.target.value }))} 
                      placeholder="+91 ..." 
                      disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                      className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>Contact Phone / WhatsApp <span className="text-destructive">*</span></span>
                      {isCheckingPhone && (
                        <span className="text-[10px] text-primary flex items-center gap-1 font-semibold">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                        </span>
                      )}
                    </label>
                    <Input 
                      value={form.customerPhone} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(prev => ({ ...prev, customerPhone: val }));
                        if (val.replace(/\D/g, '').length >= 10) {
                          checkExistingCustomerPhone(val);
                        }
                      }} 
                      onBlur={(e) => checkExistingCustomerPhone(e.target.value)}
                      placeholder="+91 9876543210" 
                      required 
                      disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                      className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                    />
                  </div>
                )}

                {/* Smart Walk-in Alert Banner */}
                {showMatchAlert && matchedCustomer && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:col-span-2 p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">
                          ⚠️ Existing Customer Profile Detected!
                        </p>
                        <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                          This phone number matches registered customer: <strong>{matchedCustomer.full_name}</strong> ({matchedCustomer.phone}). Do you want to link this ticket to their registered account instead?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleConvertToRegistered(matchedCustomer)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 shadow-sm rounded-lg flex-1 sm:flex-none"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Yes, Switch to Registered
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOverrideDuplicateCustomer(true);
                          setShowMatchAlert(false);
                          toast.info("Proceeding with direct entry without linking registered account.");
                        }}
                        className="text-xs h-8 px-2.5 text-slate-600 hover:text-slate-900 rounded-lg"
                      >
                        No, Keep as Walk-in
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Row 2, Col 1: Customer Search / Input */}
                {customerType === "Existing BTL Customer" ? (
                  isCustomersLoading && !isNew ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Customer</label>
                      <div className="flex items-center gap-2 text-muted-foreground h-10">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading customers...
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Customer <span className="text-destructive">*</span></label>
                      <Popover open={isCustomerPopoverOpen && !isCustomersLoading} onOpenChange={setIsCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="h-10 w-full justify-between font-normal disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                            disabled={isSaving || !customers || (!isNew && !isAdminOrSupervisor)}
                          >
                            {form.customerName ? (
                              <span className="truncate font-medium">{form.customerName}</span>
                            ) : (
                              <span className="text-muted-foreground">Search by name, phone, or email...</span>
                            )}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search customer by name, phone, or email..." />
                            <CommandList>
                              <CommandEmpty className="py-4 text-center text-xs space-y-2">
                                <p className="text-muted-foreground">No existing customer found.</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerType("New / Non-BTL Customer");
                                    setSelectedLocationId("");
                                    setForm(prev => ({
                                      ...prev,
                                      customerId: "",
                                      customerName: "",
                                      customerPhone: "",
                                      customerEmail: "",
                                      locationId: "",
                                      coverage: "Out of Warranty",
                                      chargeableService: "Yes"
                                    }));
                                    setIsCustomerPopoverOpen(false);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  + Create as Walk-in / New Customer
                                </button>
                              </CommandEmpty>
                              {customers?.map((c: any) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.full_name} ${c.phone || ''} ${c.email || ''}`}
                                  onSelect={() => {
                                    setForm(prev => ({
                                      ...prev,
                                      customerId: c.id,
                                      customerName: c.full_name || "",
                                      customerPhone: c.phone || "",
                                      customerEmail: c.email || "",
                                      location: c.address || prev.location,
                                      fieldOfWork: ""
                                    }));
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
                  )
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Client / Customer Name <span className="text-destructive">*</span></label>
                    <Input 
                      value={form.customerName} 
                      onChange={(e) => setForm(prev => ({ ...prev, customerName: e.target.value }))} 
                      placeholder="e.g. Ramesh Kumar / Direct Client" 
                      required 
                      disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                      className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                    />
                  </div>
                )}

                {/* Row 2, Col 2: Service Location Dropdown (for BTL) OR Email (for Walk-in) */}
                {customerType === "Existing BTL Customer" ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Installation / Service Location</label>
                    {!form.customerId ? (
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted/30 text-xs text-muted-foreground flex items-center">
                        Select a customer to view saved locations
                      </div>
                    ) : isLocationsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground h-10">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading locations...
                      </div>
                    ) : customerLocations.length === 0 ? (
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted/30 text-xs text-muted-foreground flex items-center">
                        No saved locations found. Enter address below.
                      </div>
                    ) : (
                      <Select
                        value={selectedLocationId}
                        onValueChange={(v) => {
                          const loc = customerLocations.find((l: any) => l.id === v);
                          setSelectedLocationId(v);
                          setForm(prev => ({
                            ...prev,
                            locationId: v,
                            location: loc ? formatFullCustomerAddress(loc) : prev.location,
                          }));
                        }}
                        disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                      >
                        <SelectTrigger className="h-10 text-left truncate">
                          <SelectValue placeholder="Select location" className="truncate text-left" />
                        </SelectTrigger>
                        <SelectContent className="max-w-[92vw] sm:max-w-lg">
                          {customerLocations.map((loc: any) => (
                            <SelectItem key={loc.id} value={loc.id} className="whitespace-normal break-words py-2">
                              <div className="flex flex-col text-left py-0.5 max-w-full">
                                <span className="font-semibold break-words">{loc.location_name}</span>
                                <span className="text-xs text-muted-foreground break-words whitespace-normal leading-relaxed mt-0.5">
                                  {formatFullCustomerAddress(loc)}
                                  {loc.is_primary && " • Primary"}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Contact Email (Optional)</label>
                    <Input 
                      type="email"
                      value={form.customerEmail} 
                      onChange={(e) => setForm(prev => ({ ...prev, customerEmail: e.target.value }))} 
                      placeholder="client@example.com" 
                      disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                      className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                    />
                  </div>
                )}
              </>
            )}

            {/* Row 3: Location / Address (Full Width across 2 columns) */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">Location / Address <span className="text-destructive">*</span></label>
              
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 w-full">
                {isCustomer && (
                  <div className="w-full sm:w-auto sm:max-w-xs shrink-0 flex flex-col gap-1.5">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleGetCurrentLocation}
                      disabled={isLocating || isSaving || !isNew}
                      className="w-full flex items-center justify-center gap-2 py-2 border-dashed border-primary/40 hover:border-primary/80 hover:bg-primary/5 transition-all h-10"
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
                  </div>
                )}
                
                <div className="relative flex-1 w-full">
                  <Input 
                    value={form.location} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(prev => ({ ...prev, location: val }));
                      setShowLocationSuggestions(true);
                    }}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowLocationSuggestions(false), 200);
                    }}
                    placeholder={isCustomer ? "Or enter address manually" : "Enter complete address"} 
                    required 
                    disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
                    className="w-full h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100" 
                  />
                  
                  {showLocationSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-popover text-popover-foreground border shadow-lg rounded-xl p-1 max-h-60 overflow-y-auto w-full">
                      {filteredSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, location: suggestion }));
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
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 📦 SECTION 2: ASSETS TO SERVICE (FULL WIDTH - NO EMPTY GAPS)        */}
        {/* ==================================================================== */}
        <div className="space-y-4 p-5 bg-card border border-border/80 rounded-2xl shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Assets to Service</h3>
              <span className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                {assets.length} {assets.length === 1 ? 'Asset' : 'Assets'}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddAsset}
              disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
              className="border-dashed border-2 border-blue-200 hover:border-blue-400 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 font-semibold text-xs h-9 px-3 gap-1.5 transition-all shadow-none"
            >
              <Plus className="w-4 h-4" />
              + Add Asset
            </Button>
          </div>

          {/* List of asset cards */}
          {assets.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <Package className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">No assets added to this complaint yet.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAsset}
                className="border-dashed border-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 gap-1.5 font-semibold text-xs h-9"
              >
                <Plus className="w-4 h-4" />
                + Add First Asset
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((asset, index) => {
                const isExpiredOrChargeable = asset.warranty_status === 'Expired' || Boolean(asset.is_chargeable);

                return (
                  <div
                    key={index}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-3 bg-white dark:bg-card shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    {/* Top Bar inside Card: Item Label, Badges & Quick-fill */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Item #{index + 1}
                        </span>
                        {asset.warranty_status === 'Active' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active Warranty (Free)
                          </span>
                        ) : asset.warranty_status === 'Expired' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Warranty Expired • Chargeable
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Not Applicable
                          </span>
                        )}

                        {asset.warranty_status !== 'Expired' && (
                          <label className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 cursor-pointer ml-1 select-none">
                            <Checkbox
                              id={`chargeable-check-${index}`}
                              checked={asset.is_chargeable}
                              onCheckedChange={(checked) => handleUpdateAsset(index, 'is_chargeable', Boolean(checked))}
                              disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                              className="h-3.5 w-3.5"
                            />
                            <span>Manual Chargeable Override</span>
                          </label>
                        )}
                      </div>

                      {/* Optional Quick-fill from registered customer assets if available */}
                      {customerAssets.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 hidden sm:inline">Registered Asset:</span>
                          <Select
                            onValueChange={(val) => handleSelectRegisteredAssetForRow(index, val)}
                            disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                          >
                            <SelectTrigger className="h-7 text-[11px] px-2 w-[150px] bg-slate-50 dark:bg-slate-900 border-dashed text-slate-600 dark:text-slate-300">
                              <SelectValue placeholder="Quick-fill..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                              {customerAssets.map((ca: any) => {
                                const brandPart = ca.brand ? `[${ca.brand}] ` : '';
                                const namePart = ca.product_name || ca.category || 'Asset';
                                return (
                                  <SelectItem key={ca.id} value={ca.id} className="text-xs">
                                    {brandPart}{namePart} ({ca.category || 'Item'})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Top Row (Grid Layout: 12 Columns) */}
                    <div className="grid grid-cols-12 gap-3 items-end">
                      {/* Column 1 (Wide): Asset Name */}
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Asset Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          placeholder="e.g., Front Gate Camera"
                          value={asset.asset_name}
                          onChange={(e) => handleUpdateAsset(index, 'asset_name', e.target.value)}
                          disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                          className="h-9 text-sm"
                          required
                        />
                      </div>

                      {/* Column 2 (Medium): Asset Type */}
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Asset Type <span className="text-destructive">*</span>
                        </label>
                        <Input
                          placeholder="e.g., Camera, DVR, Solar"
                          value={asset.asset_type}
                          onChange={(e) => handleUpdateAsset(index, 'asset_type', e.target.value)}
                          disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                          className="h-9 text-sm"
                          required
                        />
                      </div>

                      {/* Column 3 (Small): Warranty Status */}
                      <div className="col-span-6 sm:col-span-2 space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Warranty Status
                        </label>
                        <Select
                          value={asset.warranty_status}
                          onValueChange={(val) => handleUpdateAsset(index, 'warranty_status', val)}
                          disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Column 4 (Small): Service Charge (Enabled if Expired / Chargeable) */}
                      <div className="col-span-5 sm:col-span-2 space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Service Charge
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 select-none">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={asset.service_charge || ''}
                            onChange={(e) => handleUpdateAsset(index, 'service_charge', parseFloat(e.target.value) || 0)}
                            disabled={!isExpiredOrChargeable || isSaving || (!isNew && !isAdminOrSupervisor)}
                            className="h-9 pl-6 text-sm font-medium disabled:bg-slate-50 dark:disabled:bg-slate-900/40 disabled:text-slate-400 disabled:border-slate-200 dark:disabled:border-slate-800"
                          />
                        </div>
                      </div>

                      {/* Column 5 (Icon): Delete/Trash Button */}
                      <div className="col-span-1 sm:col-span-1 flex items-end justify-center pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAsset(index)}
                          disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                          className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          title="Remove this asset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Bottom Row (Full Width): Reported Issue */}
                    <div className="mt-3 space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Reported Issue
                      </label>
                      <Input
                        placeholder="Describe the issue with this equipment (e.g., No power, video flicker, lens blur)..."
                        value={asset.reported_issue}
                        onChange={(e) => handleUpdateAsset(index, 'reported_issue', e.target.value)}
                        disabled={isSaving || (!isNew && !isAdminOrSupervisor)}
                        className="h-9 text-sm w-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Summary: Invoice-style footer */}
          {assets.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-4 mt-4 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-slate-500 dark:text-slate-400 text-sm flex items-center flex-wrap gap-2">
                <span>Total Assets: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{assets.length}</strong></span>
                <span>•</span>
                <span>Chargeable: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{assets.filter(a => a.is_chargeable || a.warranty_status === 'Expired').length}</strong></span>
                <span>•</span>
                <span>Under Warranty: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{assets.filter(a => a.warranty_status === 'Active' && !a.is_chargeable).length}</strong></span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total Chargeable Amount:</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{totalChargeableAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* ⚙️ SECTION 3: JOB DETAILS & CLASSIFICATION (COMPACT 4-COLUMN GRID)   */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
          {/* Field of Work */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Field of Work <span className="text-destructive">*</span></label>
            {isCustomer && (
              <p className="text-xs text-muted-foreground mb-1">
                Category of your product
              </p>
            )}
            {isCustomer && !isAssetsLoading && availableCategories.length === 0 ? (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-500 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No registered products found.</span>
              </div>
            ) : isAdminOrSupervisor && form.customerId && !isAssetsLoading && availableFieldOfWork.length === 0 ? (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-500 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No assets found for customer.</span>
              </div>
            ) : (
              <Select
                key={form.fieldOfWork || 'empty'}
                value={form.fieldOfWork}
                onValueChange={(v) => {
                  setUserOverrodeFieldOfWork(true);
                  setForm(prev => ({ ...prev, fieldOfWork: v }));
                }}
                disabled={isSaving || isAssetsLoading || (isCustomer && availableCategories.length === 0) || (!isNew && !isAdminOrSupervisor)}
              >
                <SelectTrigger className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100">
                  <SelectValue placeholder={isAssetsLoading ? "Loading..." : "Select field"} />
                </SelectTrigger>
                <SelectContent>
                  {displayCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Severity Level */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Severity Level <span className="text-destructive">*</span></label>
            <Select value={form.severity} onValueChange={(v) => setForm(prev => ({ ...prev, severity: v as SeverityTier }))} disabled={isSaving || (!isNew && !isAdminOrSupervisor)}>
              <SelectTrigger className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100">
                <SelectValue placeholder="Select Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor - Low priority</SelectItem>
                <SelectItem value="moderate">Moderate - Needs attention</SelectItem>
                <SelectItem value="major">Major - Urgent</SelectItem>
                <SelectItem value="critical">Critical - Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Coverage Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Coverage <span className="text-destructive">*</span>
              </label>
              {assets.length > 0 && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  Auto-set
                </span>
              )}
            </div>
            <Select 
              value={form.coverage} 
              onValueChange={(v) => {
                setForm(prev => ({
                  ...prev,
                  coverage: v,
                  chargeableService: (v === 'Under Warranty' || v === 'AMC' || v === 'CAMC') ? 'No' : 'Yes'
                }));
              }} 
              disabled={isSaving || assets.length > 0}
            >
              <SelectTrigger className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100">
                <SelectValue placeholder="Select coverage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Under Warranty">Under Warranty</SelectItem>
                <SelectItem value="Out of Warranty">Out of Warranty</SelectItem>
                <SelectItem value="AMC">AMC</SelectItem>
                <SelectItem value="CAMC">CAMC</SelectItem>
                <SelectItem value="Chargeable Service">Chargeable Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Chargeable Service Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Chargeable <span className="text-destructive">*</span>
              </label>
              {assets.length > 0 && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  Auto-set
                </span>
              )}
            </div>
            <Select 
              value={form.chargeableService} 
              onValueChange={(v) => setForm(prev => ({ ...prev, chargeableService: v }))} 
              disabled={isSaving || assets.length > 0}
            >
              <SelectTrigger className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100">
                <SelectValue placeholder="Select Chargeable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes (Chargeable)</SelectItem>
                <SelectItem value="No">No (Warranty Scope)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Service Charge Amount Field */}
          {form.chargeableService === "Yes" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Service Charge (₹) <span className="text-destructive">*</span>
                </label>
                {assets.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    Asset sum
                  </span>
                )}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount (e.g. 500)"
                value={form.serviceCharge || ""}
                onChange={(e) => setForm(prev => ({ ...prev, serviceCharge: parseFloat(e.target.value) || 0 }))}
                disabled={isSaving || assets.length > 0}
                className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100 font-medium"
                required
              />
            </div>
          )}

          {/* Assigned Supervisor */}
          {isAdminOrSupervisor && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Assigned Supervisor
              </label>
              <Select 
                value={selectedSupervisorId || "clear_unassigned"} 
                onValueChange={(v) => {
                  const actualVal = v === "clear_unassigned" ? "" : v;
                  if (!actualVal) {
                    if (form.assignedSupervisor && form.status === "assigned") {
                      const confirmed = window.confirm("Unassigning supervisor will revert status to Unassigned. Continue?");
                      if (!confirmed) return;
                    }
                    setSelectedSupervisorId("");
                    setForm(prev => ({ ...prev, assignedSupervisor: "", status: "unassigned" }));
                    setSupervisorError("");
                  } else {
                    const match = supervisors?.find((s: any) => s.id === actualVal);
                    if (match) {
                      setSelectedSupervisorId(match.id);
                      setForm(prev => ({ ...prev, assignedSupervisor: match.full_name, status: "assigned" }));
                      setSupervisorError("");
                      toast.success("Status automatically updated to 'Assigned'");
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

          {/* Current Status */}
          {isAdminOrSupervisor && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Current Status</label>
              <div className="px-3 h-10 bg-muted/50 rounded-md border border-border flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  autoStatus === 'assigned' ? 'bg-indigo-100 text-indigo-700' :
                  autoStatus === 'dispatched' ? 'bg-orange-100 text-orange-700' :
                  autoStatus === 'in-progress' ? 'bg-yellow-100 text-yellow-700' :
                  autoStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  autoStatus === 'closed' ? 'bg-slate-200 text-slate-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {autoStatus.charAt(0).toUpperCase() + autoStatus.slice(1).replace('-', ' ')}
                </span>
              </div>
            </div>
          )}

          {/* Scheduled Date & Time - Shown after technician is assigned to complaint */}
          {!isNew && (Boolean(form.assignedTechnician) || Boolean(selectedTechnicianId) || (selectedTechnicianIds && selectedTechnicianIds.length > 0) || Boolean(existingComplaint?.assigned_technician) || Boolean(existingComplaint?.assigned_to) || (existingComplaint?.complaint_technicians && existingComplaint.complaint_technicians.length > 0)) && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Scheduled Date & Time</label>
              <Input 
                type="datetime-local" 
                value={(() => {
                  if (!form.scheduledDate) return "";
                  const d = new Date(form.scheduledDate);
                  if (isNaN(d.getTime())) return "";
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const yyyy = d.getFullYear();
                  const mm = pad(d.getMonth() + 1);
                  const dd = pad(d.getDate());
                  const time = form.scheduledTime ? form.scheduledTime.slice(0, 5) : "09:00";
                  return `${yyyy}-${mm}-${dd}T${time}`;
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setForm(prev => ({ ...prev, scheduledDate: null, scheduledTime: "" }));
                    return;
                  }
                  const [datePart, timePart] = val.split("T");
                  if (datePart) {
                    const [y, m, d] = datePart.split("-").map(Number);
                    const parsedDate = new Date(y, m - 1, d);
                    setForm(prev => ({
                      ...prev,
                      scheduledDate: parsedDate,
                      scheduledTime: timePart ? `${timePart}:00` : "09:00:00"
                    }));
                  }
                }}
                disabled={isSaving}
                className="h-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
              />
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* 📝 SECTION 4: DESCRIPTION & ATTACHMENTS (FULL WIDTH)                 */}
        {/* ==================================================================== */}
        <div className="space-y-5">
          {/* Problem Description */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Problem Description <span className="text-destructive">*</span></label>
              {!form.description.trim() && hasValidAssets && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Required to create complaint
                </span>
              )}
            </div>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} 
              rows={4} 
              maxLength={2000}
              placeholder={isCustomer ? "Describe the issue in detail. What happened? When did it start?" : "Describe the issue..."} 
              required 
              disabled={isSaving || (!isNew && !isAdminOrSupervisor)} 
              className={`disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100 transition-all ${
                !form.description.trim() && hasValidAssets
                  ? 'border-amber-400 dark:border-amber-500 focus-visible:ring-amber-400 ring-1 ring-amber-400/40 bg-amber-50/10'
                  : ''
              }`} 
            />
          </div>

          {/* Supervisor Notes */}
          {isSupervisor && form.assignedSupervisor && form.assignedTechnician && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Supervisor Notes / Key Points for Technician</label>
              <Textarea
                value={form.supervisor_notes}
                onChange={(e) => setForm(prev => ({ ...prev, supervisor_notes: e.target.value }))}
                rows={3}
                placeholder="Optional: Add key symptoms or instructions for the technician."
                disabled={isSaving}
                className="w-full resize-y break-words"
              />
            </div>
          )}

          {/* Assigned Technicians */}
          {!isNew && (existingComplaint?.current_phase || 1) >= 3 && isRole("supervisor", "admin") && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  Assigned Technicians
                  {form.fieldOfWork && (<span className="text-xs font-normal text-muted-foreground">— Filtered by "{form.fieldOfWork}"</span>)}
                </label>
                <span className="text-xs font-semibold text-primary">
                  {selectedTechnicianIds.length} selected
                  {leadTechnicianId && " • 👑 Lead designated"}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 max-h-56 overflow-y-auto space-y-1.5 bg-slate-50/50">
                {technicians && technicians.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No technician profiles found.</p>
                )}
                {technicians && technicians.map((t: any) => {
                  const isChecked = selectedTechnicianIds.includes(t.id);
                  const isLead = leadTechnicianId === t.id;
                  const techIdDisplay = t.technician_id || t.employeeId || t.employee_id || (t.id ? `TECH-${String(t.id).replace(/-/g, '').slice(0, 4).toUpperCase()}` : "");
                  const desigDisplay = t.designation || t.expertise || t.department || "Field Technician";

                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-md text-xs transition-colors ${
                        isChecked
                          ? (isLead ? "bg-amber-500/10 border border-amber-300 font-semibold" : "bg-primary/10 border border-primary/30 text-primary font-semibold")
                          : "hover:bg-slate-100 border border-transparent text-slate-700 bg-white"
                      }`}
                    >
                      <label className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          value={t.id}
                          checked={isChecked}
                          disabled={isSaving}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            let nextIds = checked
                              ? [...selectedTechnicianIds, t.id]
                              : selectedTechnicianIds.filter((id) => id !== t.id);
                            setSelectedTechnicianIds(nextIds);
                            if (checked && (nextIds.length === 1 || !leadTechnicianId)) {
                              setLeadTechnicianId(t.id);
                            } else if (!checked && leadTechnicianId === t.id) {
                              setLeadTechnicianId(nextIds.length > 0 ? nextIds[0] : null);
                            }
                            const names = nextIds
                              .map((id) => technicians.find((tech: any) => tech.id === id)?.full_name)
                              .filter(Boolean)
                              .join(", ");
                            setForm((prev) => ({
                              ...prev,
                              assignedTechnician: names,
                              status: nextIds.length > 0 ? "dispatched" : prev.assignedSupervisor ? "assigned" : "unassigned",
                            }));
                          }}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="flex-1 truncate">
                          {t.full_name} {techIdDisplay ? `(${techIdDisplay})` : ""} — {desigDisplay}
                        </span>
                      </label>

                      {isChecked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLeadTechnicianId(t.id);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 font-semibold transition-colors shrink-0 ${
                            isLead
                              ? "bg-amber-500 text-white shadow-xs"
                              : "bg-slate-200 text-slate-600 hover:bg-amber-100 hover:text-amber-800"
                          }`}
                          title={isLead ? "Designated Lead Technician" : "Click to set as Lead"}
                        >
                          <Crown className={`w-3 h-3 ${isLead ? "fill-white text-white" : "text-amber-600"}`} />
                          {isLead ? "Lead" : "Make Lead"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Evidence */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Evidence (Photos/Videos) - Optional
            </label>
            <input type="file" multiple accept="image/*,video/*,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.mkv" onChange={async (e) => {
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
                const successfulUrls = results.filter((url): url is string => !!url);
                if (successfulUrls.length > 0) {
                  setEvidenceUrls(prev => [...prev, ...successfulUrls]);
                  toast.success(`${successfulUrls.length} evidence file(s) optimized & uploaded!`);
                }
              } finally {
                setIsUploading(false);
                setUploadProgressText("");
                e.target.value = '';
              }
            }} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isSaving || isUploading || (!isNew && !isAdminOrSupervisor)} />
            {isUploading && (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-2 rounded-xl border border-primary/20 animate-pulse mt-1">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{uploadProgressText || "Compressing & uploading evidence... Please wait."}</span>
              </div>
            )}
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isFormValid && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>To {isNew ? (isCustomer ? "submit" : "create complaint") : "save changes"}, please fill: <strong>{missingRequiredFields.join(", ")}</strong></span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end w-full sm:w-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel} 
              disabled={isSaving} 
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 w-full sm:w-auto" 
              disabled={isSaving || !isFormValid}
              title={!isFormValid ? `Required: ${missingRequiredFields.join(', ')}` : undefined}
            >
              {isSaving ? (<span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving...</span>) : (
                <><Save className="w-4 h-4 mr-2" />{isNew ? (isCustomer ? "Submit Complaint" : "Create Complaint") : "Save Changes"}</>
              )}
            </Button>
          </div>
        </div>
      </motion.form>
    </div>
  );
};

export default ComplaintEdit;
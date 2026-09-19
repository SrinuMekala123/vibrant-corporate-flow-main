import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, Mail, Phone, Shield, Wrench, Search, ShieldAlert, Trash2, Eye, EyeOff, Edit, X, Download, Upload, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StaffImportModal from "@/components/StaffImportModal";
import { downloadCSV, generateSampleCSV } from "@/utils/csvHelpers";
import ExportButton from "@/components/ExportButton";
import { isValidEmail, isValidFullName, isValidPhone, normalizePhone } from "@/lib/validation";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserRole = "customer" | "technician" | "supervisor" | "admin";
type StaffRole = Exclude<UserRole, "customer" | "admin">;

const TECHNICIAN_DESIGNATIONS = [
  "Field Technician",
  "Senior Technician",
  "Team Lead",
  "Service Engineer",
];

const DEFAULT_FIELDS_OF_WORK = [
  "General",
  "Solar PV",
  "Networking",
  "Security Systems",
  "Power Systems",
  "CCTV & Surveillance Installation",
];

const LOCAL_TECH_STORAGE_KEY = "technician_profile_overrides_v1";

const getLocalTechOverrides = (): Record<string, { technician_id?: string; employee_id?: string; designation?: string; expertise?: string }> => {
  try {
    const raw = localStorage.getItem(LOCAL_TECH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setLocalTechOverride = (
  id: string,
  data: { technician_id?: string | null; employee_id?: string | null; designation?: string | null; expertise?: string | null }
) => {
  try {
    const current = getLocalTechOverrides();
    current[id] = {
      ...current[id],
      ...(data.technician_id !== undefined ? { technician_id: data.technician_id || "" } : {}),
      ...(data.employee_id !== undefined ? { employee_id: data.employee_id || "" } : {}),
      ...(data.designation !== undefined ? { designation: data.designation || "" } : {}),
      ...(data.expertise !== undefined ? { expertise: data.expertise || "" } : {}),
    };
    localStorage.setItem(LOCAL_TECH_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn("Could not write local technician override:", e);
  }
};

const isValidTechnicianId = (id: string) => {
  if (!id) return false;
  return /^[a-zA-Z0-9-]+$/.test(id.trim());
};

export default function UsersPage() {
  const { user, session, signUp } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [technicianId, setTechnicianId] = useState("");
  const [designation, setDesignation] = useState("");
  const [staffImportRole, setStaffImportRole] = useState<StaffRole | "">("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal states
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("customer");
  const [editTechnicianId, setEditTechnicianId] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editExpertise, setEditExpertise] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isStaffImportOpen, setIsStaffImportOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [customerType, setCustomerType] = useState("Retail");
  const [editCustomerType, setEditCustomerType] = useState("Retail");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const isNameValid = (name: string) => {
    if (!name) return true;
    return isValidFullName(name);
  };

  const isPhoneValid = (num: string) => {
    if (!num) return true;
    return isValidPhone(num);
  };

  const createUserDraft = useFormDraft({
    key: 'draft_create_user',
    enabled: true,
    excludeFields: ['password'],
    fields: {
      fullName: { value: fullName, setter: setFullName },
      email: { value: email, setter: setEmail },
      phone: { value: phone, setter: setPhone },
      role: { value: role, setter: setRole },
      technicianId: { value: technicianId, setter: setTechnicianId },
      designation: { value: designation, setter: setDesignation },
      selectedExpertise: { value: selectedExpertise, setter: setSelectedExpertise },
      branchId: { value: branchId, setter: setBranchId },
      customerType: { value: customerType, setter: setCustomerType },
    },
  });

  useEffect(() => {
    createUserDraft.restore();
  }, []);

  // Scroll to/create form section when a draft exists on mount
  useEffect(() => {
    if (createUserDraft.hasDraft()) {
      const formEl = document.getElementById('create-user-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  useEffect(() => {
    return createUserDraft.save();
  }, [fullName, email, phone, role, technicianId, designation, selectedExpertise, branchId, customerType]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      createUserDraft.clear();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [createUserDraft]);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null;
    const requirements = [
      { id: "length", label: "At least 8 characters", met: pwd.length >= 8 },
      { id: "uppercase", label: "At least 1 uppercase letter", met: /[A-Z]/.test(pwd) },
      { id: "lowercase", label: "At least 1 lowercase letter", met: /[a-z]/.test(pwd) },
      { id: "number", label: "At least 1 number", met: /[0-9]/.test(pwd) },
      { id: "special", label: "At least 1 special character", met: /[!@#$%^&*(),.?":{}|<>_\-']/.test(pwd) },
    ];
    const metCount = requirements.filter(r => r.met).length;
    let strength = "Weak";
    let colorClass = "text-destructive";
    if (metCount === 5) {
      strength = "Strong";
      colorClass = "text-success";
    } else if (metCount >= 3) {
      strength = "Moderate";
      colorClass = "text-warning";
    }
    return { strength, colorClass, requirements };
  };


  // Fetch all profiles
  const { data: profiles = [], isLoading: isLoadingProfiles, refetch, error: profilesError } = useQuery({
    queryKey: ['admin-profiles-list'],
    queryFn: async () => {
      try {
        let rawProfiles: any[] = [];
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true, nullsFirst: false });
        if (error) {
          console.warn("Retrying profiles select without ordering:", error);
          const fallback = await supabase.from('profiles').select('*');
          if (fallback.error) {
            console.error("Profiles select error:", fallback.error);
            return [];
          }
          rawProfiles = fallback.data || [];
        } else {
          rawProfiles = data || [];
        }

        const overrides = getLocalTechOverrides();
        return rawProfiles.map((p: any) => {
          const over = overrides[p.id] || {};
          const resolvedTechId = p.technician_id || p.employee_id || over.technician_id || over.employee_id || null;
          const resolvedDesignation = p.designation || over.designation || null;
          const resolvedExpertise = p.expertise || over.expertise || null;

          return {
            ...p,
            technician_id: resolvedTechId,
            employee_id: resolvedTechId,
            designation: resolvedDesignation,
            expertise: resolvedExpertise,
          };
        });
      } catch (err) {
        console.error("Failed to load profiles in Users.tsx:", err);
        return [];
      }
    }
  });

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('branch_name', { ascending: true });
        if (error) {
          console.warn("Branches query error:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const handleExpertiseChange = (field: string) => {
    setSelectedExpertise((prev) =>
      prev.includes(field)
        ? prev.filter((item) => item !== field)
        : [...prev, field]
    );
  };

  const handleEditExpertiseChange = (field: string) => {
    setEditExpertise((prev) =>
      prev.includes(field)
        ? prev.filter((item) => item !== field)
        : [...prev, field]
    );
  };

  const downloadSample = (type: "technician" | "supervisor") => {
    const csv = generateSampleCSV(type);
    downloadCSV(csv, `${type}_sample.csv`);
  };

  const handleOpenModal = (profile: any, mode: "view" | "edit" = "view") => {
    const overrides = getLocalTechOverrides()[profile.id] || {};
    const techId = profile.technician_id || profile.employee_id || overrides.technician_id || overrides.employee_id || "";
    const designationVal = profile.designation || overrides.designation || "";
    const rawExpertise = profile.expertise || overrides.expertise || "";

    const enrichedProfile = {
      ...profile,
      technician_id: techId || null,
      employee_id: techId || null,
      designation: designationVal || null,
      expertise: rawExpertise || null,
    };

    setSelectedUser(enrichedProfile);
    setModalMode(mode);
    setEditFullName(profile.full_name || "");
    setEditEmail(profile.email || "");
    setEditPhone(profile.phone || "");
    setEditRole(profile.role || "customer");
    setEditTechnicianId(techId);
    setEditDesignation(designationVal);

    let parsedExpertise: string[] = [];
    if (Array.isArray(rawExpertise)) {
      parsedExpertise = rawExpertise.map(String).map((item) => item.trim()).filter(Boolean);
    } else if (typeof rawExpertise === "string" && rawExpertise.trim()) {
      parsedExpertise = rawExpertise.split(/,\s*/).map((item) => item.trim()).filter(Boolean);
    }
    setEditExpertise(parsedExpertise);
    setEditPassword("");
    setEditConfirmPassword("");
    setShowPassword(false);
    setShowEditPassword(false);
    setEditBranchId(profile.branch_id || "");
    setEditCustomerType(profile.customer_type || "Retail");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") {
      toast.error("Only admins can create users");
      return;
    }

    if (!role) {
      toast.error("Please select a system role");
      return;
    }

    // 1. Full Name Validation
    const trimmedName = fullName.trim();
    if (!isValidFullName(trimmedName)) {
      toast.error("Name must be 3-100 characters and contain only letters and spaces");
      return;
    }

    // 2. Email Validation
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || trimmedEmail.length > 100) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // 3. Password Validation
    const strength = getPasswordStrength(password);
    if (!strength || strength.requirements.some(r => !r.met)) {
      toast.error("Password must be at least 8 characters with uppercase, lowercase, number, and special character");
      return;
    }

    // 4. Phone Number Validation
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !isValidPhone(phone)) {
      toast.error("Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210)");
      return;
    }

    // 5. Technician ID Validation
    const trimmedTechId = technicianId.trim();
    if (role === "technician") {
      if (!trimmedTechId) {
        toast.error("Technician ID (Login ID) is required for technicians");
        return;
      }
      if (!isValidTechnicianId(trimmedTechId)) {
        toast.error("Technician ID must be alphanumeric and can include hyphens (e.g., BT-1250)");
        return;
      }
    }

    // 6. System Role and Field of Work Validation
    if (role === "supervisor" || role === "technician") {
      if (selectedExpertise.length === 0) {
        toast.error("Please select at least one field of work");
        return;
      }
    }

    setLoading(true);
    try {
      // Check duplicate email
      const { data: existingUser, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle();
      
      if (checkError) throw checkError;
      if (existingUser) {
        toast.error("An account with this email already exists");
        setLoading(false);
        return;
      }

      // Check duplicate technician ID if role is technician
      if (role === "technician") {
        const { data: existingTech } = await supabase
          .from("profiles")
          .select("id")
          .or(`technician_id.eq.${trimmedTechId},employee_id.eq.${trimmedTechId}`)
          .maybeSingle();
        
        if (existingTech) {
          toast.error(`Technician ID "${trimmedTechId}" is already assigned to another technician.`);
          setLoading(false);
          return;
        }
      }

      const expertiseString = (role === "supervisor" || role === "technician") && selectedExpertise.length > 0
        ? selectedExpertise.join(", ")
        : undefined;

      const { data: createdUser, error: createUserError } = await supabase.functions.invoke("create-user", {
        body: {
          email: trimmedEmail,
          password,
          fullName: trimmedName,
          role,
          phone: cleanPhone,
          expertise: expertiseString,
          technicianId: role === "technician" ? trimmedTechId : null,
          technician_id: role === "technician" ? trimmedTechId : null,
          employee_id: role === "technician" ? trimmedTechId : null,
          designation: role === "technician" ? (designation || null) : null,
          branchId: branchId || null,
          customerType: role === "customer" ? customerType : null,
        },
      });
      if (createUserError) {
        let errorMessage = createUserError.message || "";
        const errorResponse = createUserError.context as Response | undefined;
        if (errorResponse && typeof errorResponse.clone === "function") {
          try {
            const errorBody = await errorResponse.clone().json();
            errorMessage = String(errorBody?.error || errorBody?.message || errorMessage);
          } catch {
            // Keep the client error message when the Edge Function body is unavailable.
          }
        }
        if (/already exists|email.*(duplicate|exists)|user.*already/i.test(errorMessage)) {
          throw new Error("An account with this email already exists.");
        }
        throw new Error(errorMessage || "Failed to create user");
      }
      const newUserId = createdUser?.user?.id;
      if (!newUserId) throw new Error("User was created but no user ID was returned");
      if (role === "customer" && !createdUser?.customer?.id) {
        throw new Error("User created but customer record was not created");
      }

      // Explicitly update profiles to guarantee technician_id and designation persistence
      if (role === "technician") {
        try {
          const techUpdate: any = {
            technician_id: trimmedTechId,
            employee_id: trimmedTechId,
          };
          if (designation) techUpdate.designation = designation;
          const { error: techUpErr } = await supabase
            .from("profiles")
            .update(techUpdate)
            .eq("id", newUserId);
          if (techUpErr && techUpErr.message?.includes("designation")) {
            await supabase
              .from("profiles")
              .update({
                technician_id: trimmedTechId,
                employee_id: trimmedTechId,
              })
              .eq("id", newUserId);
          }
        } catch (techProfileErr) {
          console.warn("Could not set technician_id/designation on profiles:", techProfileErr);
        }
      }

      if (role === "technician" || role === "supervisor") {
        setLocalTechOverride(newUserId, {
          technician_id: trimmedTechId || null,
          employee_id: trimmedTechId || null,
          designation: designation || null,
          expertise: expertiseString,
        });
      }

      console.log("User and related records created:", {
        userId: newUserId,
        customerId: createdUser?.customer?.id || null,
      });

      toast.success(`User ${trimmedName} created successfully!`);
      
      // Clear draft
      createUserDraft.clear();
      
      // Clear form
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setRole("");
      setTechnicianId("");
      setDesignation("");
      setSelectedExpertise([]);
      setBranchId("");
      setCustomerType("Retail");
      
      // Refresh user list
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // 1. Full Name Validation
    const trimmedName = editFullName.trim();
    if (!isValidFullName(trimmedName)) {
      toast.error("Name must be 3-100 characters and contain only letters and spaces");
      return;
    }

    // 2. Email Validation
    const trimmedEmail = editEmail.trim().toLowerCase();
    if (!trimmedEmail || trimmedEmail.length > 100) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // 3. Phone Number Validation
    const cleanPhone = normalizePhone(editPhone);
    if (!cleanPhone || !isValidPhone(editPhone)) {
      toast.error("Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210)");
      return;
    }

    // 4. Technician ID Validation
    const trimmedEditTechId = editTechnicianId.trim();
    if (editRole === "technician") {
      if (!trimmedEditTechId) {
        toast.error("Technician ID (Login ID) is required for technicians");
        return;
      }
      if (!isValidTechnicianId(trimmedEditTechId)) {
        toast.error("Technician ID must be alphanumeric and can include hyphens (e.g., BT-1250)");
        return;
      }
    }

    // 5. Field of Work Validation (System Role is read-only editRole)
    if (editRole === "supervisor" || editRole === "technician") {
      if (editExpertise.length === 0) {
        toast.error("Please select at least one field of work");
        return;
      }
    }

    // 6. Password Validation (Optional in Edit mode)
    if (editPassword) {
      const strength = getPasswordStrength(editPassword);
      if (!strength || strength.requirements.some(r => !r.met)) {
        toast.error("Password must be at least 8 characters with uppercase, lowercase, number, and special character");
        return;
      }
      if (editPassword !== editConfirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setSavingEdit(true);
    try {
      // Check duplicate email (if email has changed)
      if (trimmedEmail !== selectedUser.email?.toLowerCase()) {
        const { data: existingUser, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", trimmedEmail)
          .maybeSingle();
        
        if (checkError) throw checkError;
        if (existingUser) {
          toast.error("An account with this email already exists");
          setSavingEdit(false);
          return;
        }
      }

      // Check duplicate technician ID (if changed)
      if (editRole === "technician" && trimmedEditTechId !== (selectedUser.technician_id || selectedUser.employee_id)) {
        const { data: existingTech } = await supabase
          .from("profiles")
          .select("id")
          .or(`technician_id.eq.${trimmedEditTechId},employee_id.eq.${trimmedEditTechId}`)
          .neq("id", selectedUser.id)
          .maybeSingle();
        if (existingTech) {
          toast.error(`Technician ID "${trimmedEditTechId}" is already assigned to another user.`);
          setSavingEdit(false);
          return;
        }
      }

      const expertiseString = (editRole === "supervisor" || editRole === "technician") && editExpertise.length > 0
        ? editExpertise.join(", ")
        : null;

      // Update auth password via Edge Function if provided
      if (editPassword) {
        const { error: pwdError } = await supabase.functions.invoke("create-user", {
          body: { userId: selectedUser.id, password: editPassword },
        });
        if (pwdError) throw pwdError;
      }

      let updatePayload: Record<string, any> = {
        full_name: trimmedName,
        email: trimmedEmail,
        phone: cleanPhone || null,
        branch_id: editBranchId || null,
        role: editRole,
        avatar_url: trimmedName.charAt(0).toUpperCase()
      };

      if (editRole === "technician" || editRole === "supervisor") {
        updatePayload.technician_id = trimmedEditTechId || null;
        updatePayload.employee_id = trimmedEditTechId || null;
        updatePayload.designation = editDesignation || null;
        updatePayload.expertise = expertiseString;
      }

      if (editRole === "customer" && editCustomerType) {
        updatePayload.customer_type = editCustomerType;
      }

      // Always save to local fallback override cache immediately to guarantee UI persistence
      if (editRole === "technician" || editRole === "supervisor") {
        setLocalTechOverride(selectedUser.id, {
          technician_id: trimmedEditTechId || null,
          employee_id: trimmedEditTechId || null,
          designation: editDesignation || null,
          expertise: expertiseString,
        });
      }

      // Attempt to save to Supabase profiles table
      let payloadToSave = { ...updatePayload };
      let missingColumnsEncountered: string[] = [];
      let lastErr: any = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const { error: upErr } = await supabase
          .from('profiles')
          .update(payloadToSave)
          .eq('id', selectedUser.id);

        if (!upErr) {
          lastErr = null;
          break;
        }

        lastErr = upErr;
        const missingColMatch = upErr.message?.match(/Could not find the '([^']+)' column of 'profiles'/i)
          || upErr.details?.match(/column "([^"]+)" of relation "profiles" does not exist/i);

        if (missingColMatch && missingColMatch[1]) {
          const colToRemove = missingColMatch[1];
          missingColumnsEncountered.push(colToRemove);
          delete payloadToSave[colToRemove];
          console.warn(`Stripped missing column '${colToRemove}' from profiles update and retrying...`);
          continue;
        }
        break;
      }

      if (lastErr && Object.keys(payloadToSave).length === 0) {
        throw lastErr;
      }

      // If user is a customer, keep customers table synchronized with phone, name, email
      if (editRole === "customer" || selectedUser.role === "customer") {
        try {
          await supabase
            .from("customers")
            .update({
              full_name: trimmedName,
              email: trimmedEmail || null,
              phone: cleanPhone || null,
              customer_type: editCustomerType || "Retail",
              branch_id: editBranchId || null
            })
            .eq("user_id", selectedUser.id);
          console.log("✅ Synchronized customers table for user:", selectedUser.id);
        } catch (syncCustErr) {
          console.warn("Could not sync customers table from Users.tsx:", syncCustErr);
        }
      }

      if (missingColumnsEncountered.length > 0) {
        toast.success("Profile saved! (Note: Please run the SQL migration in Supabase to permanently store technician_id & designation in the database)");
      } else {
        toast.success("User profile updated successfully");
      }

      setSelectedUser(null);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProfileOnly = async (profileId: string, profileName: string) => {
    if (!confirm(`Are you sure you want to delete profile for ${profileName}? This will permanently remove the account and auth user.`)) {
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: profileId, tableName: 'profiles' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      toast.success("User and auth account deleted successfully");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete user");
    }
  };

  const filteredProfiles = (profiles || []).filter((p: any) => {
    const q = searchQuery.toLowerCase().trim();
    const name = (p.full_name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const phone = (p.phone || '').toLowerCase();
    const role = (p.role || '').toLowerCase();
    const expertise = (p.expertise || '').toLowerCase();
    const techId = (p.technician_id || p.employee_id || '').toLowerCase();
    const designation = (p.designation || '').toLowerCase();

    const matchesSearch = !q ||
      name.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      role.includes(q) ||
      expertise.includes(q) ||
      techId.includes(q) ||
      designation.includes(q);
    
    const matchesRole = roleFilter === "all" || role === roleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  });

  const handleBulkDelete = async () => {
    const isCurrentUserAdmin = user?.role === "admin";
    if (!isCurrentUserAdmin) {
      toast.error("Only administrators can delete users.");
      return;
    }

    const selectedCount = selectedUserIds.size;
    if (selectedCount === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCount} selected user(s)? This will permanently remove profiles, linked customer records, and auth accounts.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-delete-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedUserIds) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk delete users');
      }

      const result = await response.json();
      if (result.failedCount > 0) {
        toast.warning(`Deleted ${result.deletedCount} user(s). ${result.failedCount} failed.`);
      } else {
        toast.success(`${result.deletedCount} user(s) deleted successfully.`);
      }
      setSelectedUserIds(new Set());
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to bulk delete users.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAllUsers = () => {
    if (selectedUserIds.size === filteredProfiles.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredProfiles.map((p: any) => p.id)));
    }
  };

  const toggleSelectUser = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearUserSelection = () => setSelectedUserIds(new Set());

  const userStats = {
    total: profiles?.length || 0,
    technicians: profiles?.filter((p: any) => p.role === "technician").length || 0,
    supervisors: profiles?.filter((p: any) => p.role === "supervisor").length || 0,
    admins: profiles?.filter((p: any) => p.role === "admin").length || 0,
    customers: profiles?.filter((p: any) => p.role === "customer").length || 0,
  };

  return (
    <div className="space-y-8 overflow-x-hidden pb-12 relative">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-indigo-500/10" />

      {/* Header Section with Title and Buttons */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-indigo-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Shield className="w-3.5 h-3.5" /> ACCESS CONTROL & IDENTITY
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              User Directory & Role Governance
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Create and manage enterprise staff profiles, assign technical specializations, configure branch permissions, and provision client access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
            <ExportButton variant="staff" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
                >
                  <Download className="w-4 h-4 text-primary" />
                  <span>Sample CSV</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-1.5 shadow-xl border-border/60">
                <DropdownMenuItem onClick={() => downloadSample("technician")} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
                  <Wrench className="w-4 h-4 text-amber-500" /> Technician Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadSample("supervisor")} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
                  <Shield className="w-4 h-4 text-indigo-500" /> Supervisor Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
                >
                  <Upload className="w-4 h-4 text-indigo-500" />
                  <span>Import Staff</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-1.5 shadow-xl border-border/60">
                <DropdownMenuItem onClick={() => { setStaffImportRole('technician'); setIsStaffImportOpen(true); }} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
                  <Wrench className="w-4 h-4 text-amber-500" /> Import Technicians
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setStaffImportRole('supervisor'); setIsStaffImportOpen(true); }} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
                  <Shield className="w-4 h-4 text-indigo-500" /> Import Supervisors
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* 📊 Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">Total Personnel</span>
            <span className="text-2xl font-black text-foreground mt-0.5 block">{userStats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Technicians</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{userStats.technicians}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">Supervisors</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">{userStats.supervisors}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Administrators</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{userStats.admins}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        {/* Create User Form */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-card rounded-3xl p-6 lg:col-span-5 space-y-4 border border-border/60 shadow-md"
        >
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" /> Create New User Profile
          </h2>
          <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600">Full Name</label>
                <span className="text-[10px] font-medium text-slate-400">{fullName.length} / 100</span>
              </div>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                maxLength={100}
                disabled={loading}
              />
              {!isNameValid(fullName) && fullName.length > 0 && (
                <p className="text-[10px] text-destructive font-medium mt-1">Name must be 3-100 characters and contain only letters and spaces</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600">Email Address</label>
                <span className="text-[10px] font-medium text-slate-400">{email.length} / 100</span>
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@brihaspathi.com"
                required
                maxLength={100}
                disabled={loading}
                autoComplete="new-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="pr-10"
                />
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {password.length > 0 && (
                (() => {
                  const strengthInfo = getPasswordStrength(password);
                  return strengthInfo && (
                    <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs mt-1">
                      <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/40">
                        <span className="font-semibold text-slate-600">Password Strength:</span>
                        <span className={`font-bold ${strengthInfo.colorClass}`}>{strengthInfo.strength}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5 text-[11px]">
                        {strengthInfo.requirements.map(req => (
                          <div key={req.id} className="flex items-center gap-1.5">
                            <span className={req.met ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                              {req.met ? "✓" : "✗"}
                            </span>
                            <span className={req.met ? "text-slate-400 line-through font-medium" : "text-slate-600 font-medium"}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Phone Number</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={loading}
              />
              {!isPhoneValid(phone) && phone.length > 0 && (
                <p className="text-[10px] text-destructive font-medium mt-1">Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210)</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Branch Location</label>
              <Select value={branchId} onValueChange={setBranchId} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">System Role</label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "technician" && (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-600">Technician ID (Login ID) <span className="text-destructive">*</span></label>
                  </div>
                  <Input
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    placeholder="e.g., BT-1250"
                    required
                    disabled={loading}
                  />
                  {technicianId.length > 0 && !isValidTechnicianId(technicianId) && (
                    <p className="text-[10px] text-destructive font-medium mt-1">Technician ID must be alphanumeric and can include hyphens (e.g., BT-1250)</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Designation</label>
                  <Select value={designation} onValueChange={setDesignation} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {TECHNICIAN_DESIGNATIONS.map((desig) => (
                        <SelectItem key={desig} value={desig}>{desig}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {role === "customer" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Customer Type</label>
                <Select value={customerType} onValueChange={setCustomerType} disabled={loading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                    <SelectItem value="Government">Government</SelectItem>
                    <SelectItem value="Partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(role === "supervisor" || role === "technician") && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">Field of Work (Expertise - Select all that apply) <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_FIELDS_OF_WORK.map((field) => {
                    const isChecked = selectedExpertise.includes(field);
                    return (
                      <button
                        type="button"
                        key={field}
                        onClick={() => handleExpertiseChange(field)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                          isChecked
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                        disabled={loading}
                      >
                        <span>{field}</span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                          isChecked
                            ? "bg-primary border-primary text-white"
                            : "border-slate-300 bg-transparent"
                        }`}>
                          {isChecked && (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">Used for matching complaints to appropriate supervisors & technicians.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {createUserDraft.hasDraft() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    createUserDraft.clear();
                    setEmail("");
                    setPassword("");
                    setFullName("");
                    setPhone("");
                    setRole("");
                    setSelectedExpertise([]);
                    setBranchId("");
                    setCustomerType("Retail");
                    toast.success("Draft cleared");
                  }}
                  className="text-xs text-slate-500 hover:text-destructive"
                >
                  Clear Draft
                </Button>
              )}
              <Button 
                type="submit" 
                className="flex-1 gradient-primary text-primary-foreground shadow-glow" 
                disabled={loading}
              >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Account...
                </>
              ) : (
                "Create User Account"
              )}
            </Button>
          </div>
        </form>
        </motion.div>

        {/* Users List */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6 lg:col-span-7 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Shield className="w-5 h-5" /> Registered Users
            </h2>
            <div className="flex flex-wrap items-center gap-1 bg-muted/65 p-1 rounded-lg text-xs font-medium w-full sm:w-auto justify-start sm:justify-end">
              {[
                { id: 'all', label: 'All', count: (profiles || []).length },
                { id: 'customer', label: 'Customer', count: (profiles || []).filter((p: any) => (p.role || '').toLowerCase() === 'customer').length },
                { id: 'supervisor', label: 'Supervisor', count: (profiles || []).filter((p: any) => (p.role || '').toLowerCase() === 'supervisor').length },
                { id: 'technician', label: 'Technician', count: (profiles || []).filter((p: any) => (p.role || '').toLowerCase() === 'technician').length },
                { id: 'admin', label: 'Admin', count: (profiles || []).filter((p: any) => (p.role || '').toLowerCase() === 'admin').length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setRoleFilter(id)}
                  className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded transition-all capitalize text-center text-xs flex items-center gap-1 ${roleFilter === id ? 'bg-white text-primary shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${roleFilter === id ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email or expertise..."
              className="pl-9 text-sm"
            />
          </div>

          {isLoadingProfiles ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <span>Loading profiles...</span>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
              No matching users found.
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredProfiles.map((p: any) => (
                <div 
                  key={p.id} 
                  onClick={() => handleOpenModal(p, "view")}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-colors gap-3 ${selectedUserIds.has(p.id) ? 'bg-blue-50/60 border-blue-200' : 'bg-muted/40 border-slate-100 hover:border-slate-200 hover:bg-muted/70'}`}
                >
                  <div className="flex items-start gap-3 w-full sm:w-auto min-w-0">
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectUser(p.id, e);
                        }}
                        className="text-slate-500 hover:text-slate-700 shrink-0 mt-0.5"
                      >
                        {selectedUserIds.has(p.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 ${
                      p.role === 'admin' ? 'bg-rose-500' :
                      p.role === 'supervisor' ? 'bg-indigo-500' :
                      p.role === 'technician' ? 'bg-amber-500' : 'bg-teal-500'
                    }`}>
                      {p.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-800 truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">{p.full_name || 'No Name'}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          p.role === 'admin' ? 'bg-rose-50 border border-rose-200 text-rose-600' :
                          p.role === 'supervisor' ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' :
                          p.role === 'technician' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                          'bg-teal-50 border border-teal-200 text-teal-600'
                        }`}>
                          {p.role}
                        </span>
                        {p.role === 'technician' && (p.technician_id || p.employee_id) && (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            ID: {p.technician_id || p.employee_id}
                          </span>
                        )}
                        {p.role === 'technician' && p.designation && (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                            {p.designation}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 mt-0.5 min-w-0">
                        <span className="flex items-center gap-1 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{p.email}</span></span>
                        {p.phone && <span className="flex items-center gap-1 shrink-0"><Phone className="w-3.5 h-3.5 shrink-0" /> {p.phone}</span>}
                        {p.expertise && <span className="flex items-center gap-1 text-primary truncate"><Wrench className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{p.expertise}</span></span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 sm:border-t-0 sm:pt-0 w-full sm:w-auto shrink-0">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(p, "view");
                      }}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg flex items-center gap-1 px-2 py-1 text-xs"
                      title="View user details"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="sm:hidden text-[10px] font-medium">View</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(p, "edit");
                      }}
                      className="text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 px-2 py-1 text-xs"
                      title="Edit user profile"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="sm:hidden text-[10px] font-medium">Edit</span>
                    </Button>
                    {p.id !== user?.id && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfileOnly(p.id, p.full_name);
                        }}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg flex items-center gap-1 px-2 py-1 text-xs"
                        title="Delete profile record"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden text-[10px] font-medium">Delete</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Bulk Action Bar */}
        {user?.role === 'admin' && selectedUserIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
            <span className="text-sm font-medium">{selectedUserIds.size} selected</span>
            <button
              onClick={clearUserSelection}
              className="text-xs font-semibold text-slate-300 hover:text-white uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {isBulkDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete
            </button>
          </div>
        )}
      </div>

      {/* View & Edit Overlay Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="glass-card w-full max-w-xl h-full rounded-none p-6 md:p-8 relative flex flex-col gap-6 overflow-y-auto shadow-2xl border-l border-border/40"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedUser(null)}
                aria-label="Close modal"
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 p-1.5 rounded-lg transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase ${
                  (modalMode === 'edit' ? editRole : selectedUser.role) === 'admin' ? 'bg-rose-500' :
                  (modalMode === 'edit' ? editRole : selectedUser.role) === 'supervisor' ? 'bg-indigo-500' :
                  (modalMode === 'edit' ? editRole : selectedUser.role) === 'technician' ? 'bg-amber-500' : 'bg-teal-500'
                }`}>
                  {(modalMode === 'edit' ? editFullName : selectedUser.full_name)?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-800">
                    {modalMode === 'view' ? "User Profile Details" : "Edit User Account"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modalMode === 'view' ? selectedUser.email : editEmail}
                  </p>
                </div>
              </div>

              {modalMode === 'view' ? (
                /* View Mode */
                <div className="space-y-6">
                  <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Account Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Full Name</span>
                        <span className="text-sm font-semibold text-slate-800 truncate max-w-[calc(100%-80px)]" title={selectedUser.full_name}>{selectedUser.full_name || "No Name"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Role</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-0.5 ${
                          selectedUser.role === 'admin' ? 'bg-rose-50 border border-rose-200 text-rose-600' :
                          selectedUser.role === 'supervisor' ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' :
                          selectedUser.role === 'technician' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                          'bg-teal-50 border border-teal-200 text-teal-600'
                        }`}>
                          {selectedUser.role}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Email Address</span>
                        <span className="text-xs font-medium text-slate-700 block truncate">{selectedUser.email}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Phone Contact</span>
                        <span className="text-xs font-semibold text-slate-700">{selectedUser.phone || "Not provided"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Branch</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {selectedUser.branch_id ? (branches?.find((b: any) => b.id === selectedUser.branch_id)?.branch_name || selectedUser.branch_id) : "Not assigned"}
                        </span>
                      </div>
                      {selectedUser.role === 'customer' && (
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Customer Type</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedUser.customer_type || 'Retail'}</span>
                        </div>
                      )}
                      {selectedUser.role === 'technician' && (
                        <>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Technician ID (Login ID)</span>
                            <span className="text-xs font-semibold text-slate-700 font-mono">{selectedUser.technician_id || selectedUser.employee_id || "Not assigned"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Designation</span>
                            <span className="text-xs font-semibold text-slate-700">{selectedUser.designation || "Not assigned"}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {(selectedUser.role === 'supervisor' || selectedUser.role === 'technician') && (
                      <div className="pt-3 border-t border-slate-200">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Fields of Work / Expertise</span>
                        {selectedUser.expertise ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(Array.isArray(selectedUser.expertise)
                              ? selectedUser.expertise
                              : typeof selectedUser.expertise === 'string'
                              ? selectedUser.expertise.split(/,\s*/)
                              : []
                            ).filter(Boolean).map((exp: string) => (
                              <span key={exp} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-full">
                                <Wrench className="w-3 h-3 text-primary" /> {exp}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">No fields assigned</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 rounded-xl h-11 font-bold text-sm"
                      onClick={() => setSelectedUser(null)}
                    >
                      Close Details
                    </Button>
                    <Button 
                      type="button" 
                      className="flex-1 rounded-xl h-11 font-bold text-sm bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm"
                      onClick={() => setModalMode('edit')}
                    >
                      <Edit className="w-4 h-4" /> Edit Profile
                    </Button>
                  </div>
                </div>
              ) : (
                /* Edit Mode */
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Full Name <span className="text-destructive">*</span></label>
                      <Input 
                        value={editFullName} 
                        onChange={(e) => setEditFullName(e.target.value)} 
                        disabled={savingEdit} 
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Email Address <span className="text-destructive">*</span></label>
                      <Input 
                        type="email" 
                        value={editEmail} 
                        onChange={(e) => setEditEmail(e.target.value)} 
                        disabled={savingEdit} 
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Phone Number</label>
                      <Input 
                        value={editPhone} 
                        onChange={(e) => setEditPhone(e.target.value)} 
                        placeholder="+91 9876543210" 
                        disabled={savingEdit} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Branch</label>
                      <Select value={editBranchId} onValueChange={setEditBranchId} disabled={savingEdit}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">System Role (Read-only)</label>
                    <Input 
                      value={editRole} 
                      disabled 
                      className="bg-muted capitalize text-muted-foreground font-semibold" 
                    />
                  </div>

                  {editRole === "technician" && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 block">Technician ID (Login ID) <span className="text-destructive">*</span></label>
                        <Input 
                          value={editTechnicianId} 
                          onChange={(e) => setEditTechnicianId(e.target.value.toUpperCase())} 
                          placeholder="e.g. BT-1250" 
                          disabled={savingEdit} 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 block">Designation</label>
                        <Select value={editDesignation} onValueChange={setEditDesignation} disabled={savingEdit}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                          <SelectContent>
                            {TECHNICIAN_DESIGNATIONS.map((desig) => (
                              <SelectItem key={desig} value={desig}>{desig}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {editRole === "customer" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Customer Type</label>
                      <Select value={editCustomerType} onValueChange={setEditCustomerType} disabled={savingEdit}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Corporate">Corporate</SelectItem>
                          <SelectItem value="Government">Government</SelectItem>
                          <SelectItem value="Partner">Partner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editRole === "supervisor" || editRole === "technician") && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">Field of Work (Expertise - Select all that apply) <span className="text-destructive">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from(new Set([...DEFAULT_FIELDS_OF_WORK, ...editExpertise])).filter(Boolean).map((field) => {
                          const isChecked = editExpertise.includes(field);
                          return (
                            <button
                              type="button"
                              key={field}
                              onClick={() => handleEditExpertiseChange(field)}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                isChecked
                                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              disabled={savingEdit}
                            >
                              <span>{field}</span>
                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                isChecked
                                  ? "bg-primary border-primary text-white"
                                  : "border-slate-300 bg-transparent"
                              }`}>
                                {isChecked && (
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Change Password (Optional)</h5>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">New Password</label>
                      <div className="relative">
                        <Input
                          type={showEditPassword ? "text" : "password"}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Minimum 8 characters (uppercase, lowercase, number, special)"
                          disabled={savingEdit}
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        {editPassword.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                          >
                            {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                      {editPassword.length > 0 && (
                        (() => {
                          const editStrengthInfo = getPasswordStrength(editPassword);
                          return editStrengthInfo && (
                            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs mt-1">
                              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/40">
                                <span className="font-semibold text-slate-600">Password Strength:</span>
                                <span className={`font-bold ${editStrengthInfo.colorClass}`}>{editStrengthInfo.strength}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5 text-[11px]">
                                {editStrengthInfo.requirements.map(req => (
                                  <div key={req.id} className="flex items-center gap-1.5">
                                    <span className={req.met ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                                      {req.met ? "✓" : "✗"}
                                    </span>
                                    <span className={req.met ? "text-slate-400 line-through font-medium" : "text-slate-600 font-medium"}>
                                      {req.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Confirm Password</label>
                      <Input
                        type={showEditPassword ? "text" : "password"}
                        value={editConfirmPassword}
                        onChange={(e) => setEditConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        disabled={savingEdit}
                        autoComplete="new-password"
                      />
                      {editPassword && editPassword !== editConfirmPassword && editConfirmPassword.length > 0 && (
                        <p className="text-[10px] text-destructive font-medium mt-1">Passwords do not match</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 rounded-xl h-11 font-bold text-sm"
                      onClick={() => setModalMode("view")}
                      disabled={savingEdit}
                    >
                      Back to View
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 gradient-primary text-primary-foreground shadow-glow rounded-xl h-11 font-bold text-sm"
                      disabled={savingEdit}
                    >
                      {savingEdit ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
       </AnimatePresence>

      <StaffImportModal
        open={isStaffImportOpen}
        onOpenChange={setIsStaffImportOpen}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["customers-list"] });
          queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
        }}
        role={staffImportRole}
        onRoleChange={setStaffImportRole}
      />
    </div>
  );
}

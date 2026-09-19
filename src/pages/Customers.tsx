import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import CustomerImportModal from "@/components/CustomerImportModal";
import CustomerLocationManager from "@/components/CustomerLocationManager";
import { 
  Loader2, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  X, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  Building,
  ShieldCheck,
  UserCheck,
  Lock,
  Download,
  Upload,
  CheckSquare,
  Square,
  UserPlus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { downloadCSV, generateSampleCSV } from "@/utils/csvHelpers";
import ExportButton from "@/components/ExportButton";
import { isValidEmail, isValidFullName, isValidPhone, normalizePhone } from "@/lib/validation";
import { useFormDraft } from "@/hooks/useFormDraft";

export default function Customers() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Modal / Side-panel states
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "add" | "edit">("view");

  // Form States
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isCustomerImportOpen, setIsCustomerImportOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customerType, setCustomerType] = useState("Retail");
  const [branchId, setBranchId] = useState("");
  const [profileUserId, setProfileUserId] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Primary location fields
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationPincode, setLocationPincode] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationContactPerson, setLocationContactPerson] = useState("");
  const [locationContactPhone, setLocationContactPhone] = useState("");
  const [isLocationManagerOpen, setIsLocationManagerOpen] = useState(false);
  const [locationManagerOpen, setLocationManagerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");

  const openLocationManager = (customerId: string, customerName?: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName || "");
    const found = customers?.find((c: any) => c.id === customerId);
    if (found) setSelectedCustomer(found);
    setLocationManagerOpen(true);
    setIsLocationManagerOpen(true);
  };

  // Login account creation states
  const [createLoginAccount, setCreateLoginAccount] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const customerDraft = useFormDraft({
    key: 'draft_create_customer',
    enabled: modalMode === "add",
    excludeFields: ['loginPassword'],
    fields: {
      fullName: { value: fullName, setter: setFullName },
      phone: { value: phone, setter: setPhone },
      email: { value: email, setter: setEmail },
      address: { value: address, setter: setAddress },
      customerType: { value: customerType, setter: setCustomerType },
      branchId: { value: branchId, setter: setBranchId },
      createLoginAccount: { value: createLoginAccount, setter: setCreateLoginAccount },
      locationName: { value: locationName, setter: setLocationName },
      locationCity: { value: locationCity, setter: setLocationCity },
      locationState: { value: locationState, setter: setLocationState },
      locationPincode: { value: locationPincode, setter: setLocationPincode },
      locationAddress: { value: locationAddress, setter: setLocationAddress },
      locationContactPerson: { value: locationContactPerson, setter: setLocationContactPerson },
      locationContactPhone: { value: locationContactPhone, setter: setLocationContactPhone },
    },
  });

  useEffect(() => {
    if (modalMode === "add") {
      customerDraft.restore();
    }
  }, [modalMode]);

  useEffect(() => {
    return customerDraft.save();
  }, [fullName, phone, email, address, customerType, branchId, createLoginAccount, locationName, locationCity, locationState, locationPincode, locationAddress, locationContactPerson, locationContactPhone]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      customerDraft.clear();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [customerDraft]);

  // Role permissions
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canModify = isAdmin || isSupervisor;
  const isViewOnly = !canModify;

  const downloadSample = () => {
    const csv = generateSampleCSV("customer");
    downloadCSV(csv, "customer_sample.csv");
  };

  // React Query: Fetch Branches
  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // React Query: Fetch Customers
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['customers-list', user?.role, user?.id],
    queryFn: async () => {
      if (user?.role === 'technician') {
        // Fetch complaints assigned to this technician
        const { data: assignedComplaints, error: complaintsError } = await supabase
          .from('complaints')
          .select('customer_id')
          .eq('assigned_technician', user.id);

        if (complaintsError) throw complaintsError;

        if (!assignedComplaints || assignedComplaints.length === 0) {
          return [];
        }

        const customerProfileIds = [...new Set(assignedComplaints.map(c => c.customer_id).filter(Boolean))];
        if (customerProfileIds.length === 0) {
          return [];
        }

        // Fetch customers whose user_id is in customerProfileIds
        const { data, error } = await supabase
          .from('customers')
          .select('*, branches(branch_name)')
          .in('user_id', customerProfileIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      }

      let query = supabase.from('customers').select('*, branches(branch_name)');
      if (user?.role === 'customer') {
        // Enforce customer constraint explicitly
        query = query.eq('user_id', user.id);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // React Query: Fetch Customer-role User Profiles to link with Customer records
  const { data: customerProfiles } = useQuery({
    queryKey: ['customer-profiles-to-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'customer')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: canModify
  });

   const handleOpenModal = async (customer: any, mode: "view" | "add" | "edit") => {
     setModalMode(mode);
     setCreateLoginAccount(mode === "add");
     setLoginPassword("");
     setShowPassword(false);
     setCreatingAccount(false);
     if (mode === "add") {
       setSelectedCustomer({});
       setFullName("");
       setPhone("");
       setEmail("");
       setAddress("");
       setCustomerType("Retail");
       setBranchId("");
       setProfileUserId("");
       setLocationName("");
       setLocationCity("");
       setLocationState("");
       setLocationPincode("");
       setLocationAddress("");
       setLocationContactPerson("");
       setLocationContactPhone("");
    } else {
      if (!customer) return;
      const initialCust = { ...customer };
      setSelectedCustomer(initialCust);
      setFullName(initialCust.full_name || initialCust.name || "");
      setPhone(initialCust.phone || initialCust.mobile || "");
      setEmail(initialCust.email || "");
      setAddress(initialCust.address || "");
      setCustomerType(initialCust.customer_type || initialCust.type || "Retail");
      setBranchId(initialCust.branch_id || "");
      setProfileUserId(initialCust.user_id || "");

      // Ensure full fresh customer record is fetched if ID is available
      if (initialCust.id) {
        try {
          const { data: freshData, error: freshErr } = await supabase
            .from("customers")
            .select("*, branches(branch_name)")
            .eq("id", initialCust.id)
            .maybeSingle();

          if (!freshErr && freshData) {
            setSelectedCustomer(freshData);
            setFullName(freshData.full_name || freshData.name || "");
            setPhone(freshData.phone || freshData.mobile || "");
            setEmail(freshData.email || "");
            setAddress(freshData.address || "");
            setCustomerType(freshData.customer_type || freshData.type || "Retail");
            setBranchId(freshData.branch_id || "");
            setProfileUserId(freshData.user_id || "");
          }
        } catch (e) {
          console.warn("Could not reload customer fresh details:", e);
        }
      }
    }
  };

  // Fetch primary location when editing an existing customer
  useEffect(() => {
    const fetchPrimaryLocation = async () => {
      if (modalMode !== "edit" || !selectedCustomer?.id) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from("customer_locations")
          .select("*")
          .eq("customer_id", selectedCustomer.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (error) {
          console.error("Failed to fetch primary location:", error);
          return;
        }

        if (data) {
          setLocationName(data.location_name || "");
          setLocationCity(data.city || "");
          setLocationState(data.state || "");
          setLocationPincode(data.pincode || "");
          setLocationAddress(data.address || "");
          setLocationContactPerson(data.contact_person || "");
          setLocationContactPhone(data.contact_phone || "");
          console.log("Primary location loaded for edit:", data);
        } else {
          // No primary location found, clear fields
          setLocationName("");
          setLocationCity("");
          setLocationState("");
          setLocationPincode("");
          setLocationAddress("");
          setLocationContactPerson("");
          setLocationContactPhone("");
        }
      } catch (err) {
        console.error("Error fetching primary location:", err);
      }
    };

    fetchPrimaryLocation();
  }, [selectedCustomer?.id, modalMode]);

  const savePrimaryLocation = async (customerId: string) => {
     console.log("=== ATTEMPTING TO SAVE LOCATION ===");
     console.log("Customer ID for location:", customerId);
     console.log("Location Form Data:", {
       locationName,
       locationCity,
       locationState,
       locationPincode,
       locationAddress,
       locationContactPerson,
       locationContactPhone,
     });

     if (!customerId || !locationName.trim()) {
       console.log("⚠️ No location name provided or no customer ID");
       console.log("locationName:", locationName);
       console.log("customerId:", customerId);
       return false;
     }

     const locationData = {
       customer_id: customerId,
       location_name: locationName.trim(),
       address: locationAddress.trim() || null,
       city: locationCity.trim() || null,
       state: locationState.trim() || null,
       pincode: locationPincode.trim() || null,
       contact_person: locationContactPerson.trim() || null,
       contact_phone: locationContactPhone.trim() || null,
       is_primary: true,
     };

     console.log("Location data to save:", locationData);

     try {
       // First, try to delete any existing primary location for this customer
       const { error: deleteError } = await supabase
         .from("customer_locations")
         .delete()
         .eq("customer_id", customerId)
         .eq("is_primary", true);

       if (deleteError) {
         console.error("Failed to delete existing primary location:", deleteError);
       }

       // Then insert the new primary location
       const { data, error: insertError } = await supabase
         .from("customer_locations")
         .insert(locationData)
         .select()
         .single();

       if (insertError) {
         console.error("❌ LOCATION SAVE FAILED:", insertError);
         toast.warning("Customer saved, but primary location failed to save.");
         return false;
       }

       console.log("✅ LOCATION SAVED SUCCESSFULLY:", data);
       return true;
     } catch (err) {
       console.error("Unexpected error saving primary location:", err);
       toast.warning("Customer saved, but primary location failed to save.");
       return false;
     }
   };

    // No longer needed — replaced by integrated creation in handleSaveCustomer

   const handleSaveCustomer = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!canModify) {
       toast.error("You do not have permission to perform this action.");
       return;
     }

     console.log("=== STARTING CUSTOMER SAVE ===");
     console.log("Form data:", {
       fullName,
       phone,
       email,
       address,
       customerType,
       branchId,
       profileUserId,
       locationName,
       locationCity,
       locationState,
       locationPincode,
       locationAddress,
       locationContactPerson,
       locationContactPhone,
     });
     console.log("Is editing:", modalMode === "edit");

     let customerId: string | null = null;

     const trimmedName = fullName.trim();
     if (!isValidFullName(trimmedName)) {
       toast.error("Name must be 3-100 characters and contain only letters and spaces.");
       return;
     }

     const cleanPhone = normalizePhone(phone);
     if (!isValidPhone(phone)) {
       toast.error("Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210)");
       return;
     }

     // 🔴 Duplicate Customer Check (BUG 1 Fix)
     const last10Digits = cleanPhone.replace(/\D/g, '').slice(-10);
     if (last10Digits.length === 10) {
       try {
         let dupQuery = supabase
           .from('customers')
           .select('id, full_name, phone')
           .ilike('phone', `%${last10Digits}%`);

         if (modalMode === 'edit' && selectedCustomer?.id) {
           dupQuery = dupQuery.neq('id', selectedCustomer.id);
         }

         const { data: dupCust, error: dupErr } = await dupQuery.limit(1).maybeSingle();
         if (!dupErr && dupCust) {
           toast.error(`⚠️ Customer with this phone number already exists: ${dupCust.full_name}. Please use existing customer.`, {
             duration: 6000
           });
           return;
         }
       } catch (dupCheckErr) {
         console.warn("Duplicate phone verification error:", dupCheckErr);
       }
     }

     const trimmedEmail = email.trim().toLowerCase();
     if (trimmedEmail && !isValidEmail(trimmedEmail)) {
       toast.error("Please enter a valid email address");
       return;
     }

     // Validate login account fields when checkbox is checked
     if (createLoginAccount && !profileUserId) {
       if (!trimmedEmail) {
         toast.error("Email is required to create a login account.");
         return;
       }
       if (!loginPassword || loginPassword.length < 8) {
         toast.error("Password must be at least 8 characters.");
         return;
       }
     }

     setLoading(true);
     try {
       // --- Path A: Create Login Account + Customer in one Edge Function call ---
       if (createLoginAccount && !profileUserId) {
         setCreatingAccount(true);
         const { data, error: fnError } = await supabase.functions.invoke("create-customer-user", {
           body: {
             email: trimmedEmail,
             password: loginPassword,
             full_name: trimmedName,
             phone: cleanPhone,
             role: "customer",
             createCustomerRecord: modalMode === "add",
             customerData: modalMode === "add" ? {
               address: address.trim() || null,
               customer_type: customerType,
               branch_id: branchId || null,
             } : {},
           },
         });

         if (fnError) {
           let errorMessage = fnError.message || "";
           const errorResponse = fnError.context;
           if (errorResponse instanceof Response) {
             try {
               const errorBody = await errorResponse.clone().json();
               errorMessage = errorBody?.error || errorMessage;
             } catch {
               // Keep the client error message when the Edge Function body is unavailable.
             }
           }
           if (/already exists|email.*(duplicate|exists)|user.*already/i.test(errorMessage)) {
             throw new Error("An account with this email already exists.");
           }
           throw new Error(errorMessage || "Failed to create login account.");
         }
          if (data?.error) throw new Error(data.error);

          // The edge function returns { user, customer } — capture both IDs safely
          const authUserId = data?.user?.id || data?.userId;
          if (!authUserId) throw new Error("Did not receive user ID from server.");

          // If editing, update the existing customer record to link user_id
          if (modalMode === "edit" && selectedCustomer?.id) {
            const { error: updateError } = await supabase
              .from("customers")
              .update({
                full_name: trimmedName,
                phone: cleanPhone,
                email: trimmedEmail || null,
                address: address.trim() || null,
                customer_type: customerType,
                branch_id: branchId || null,
                user_id: authUserId,
              })
              .eq("id", selectedCustomer.id);
            if (updateError) throw updateError;

            customerId = selectedCustomer.id;
            console.log("Customer updated, ID:", customerId);

            // Synchronize linked profile in profiles table so phone updates take effect everywhere
            const linkedProfileId = authUserId;
            if (linkedProfileId) {
              try {
                await supabase
                  .from('profiles')
                  .update({
                    full_name: trimmedName,
                    phone: cleanPhone || null,
                    email: trimmedEmail || null,
                    customer_type: customerType || null,
                    branch_id: branchId || null,
                  })
                  .eq('id', linkedProfileId);
                console.log("✅ Customer profile synchronized with updated phone:", cleanPhone);
              } catch (profSyncErr) {
                console.warn("Could not sync profile table on customer update:", profSyncErr);
              }
            }
          } else if (modalMode === "add") {
            console.log("Edge function response:", data);
            // The edge function may return the created customer record directly
            customerId = data?.customer?.id || null;
            console.log("Customer created via edge function, ID from response:", customerId);

            // Fallback: If customer ID not in response, query by user_id
            if (!customerId && authUserId) {
              console.log("Customer ID not in edge response, querying by user_id:", authUserId);
              const { data: customerData, error: fetchError } = await supabase
                .from("customers")
                .select("id")
                .eq("user_id", authUserId)
                .single();

              if (fetchError) {
                console.error("Failed to fetch customer ID after edge function:", fetchError);
              } else if (customerData?.id) {
                customerId = customerData.id;
                console.log("✅ Successfully retrieved Customer ID from DB:", customerId);
              }
            }
          }

         toast.success(
           `Customer ${trimmedName} saved with login account!\nEmail: ${trimmedEmail}`,
           { duration: 6000 }
         );
         setCreatingAccount(false);
       } else {
         // --- Path B: Just save customer data (no login account creation) ---
         const payload = {
           full_name: trimmedName,
           phone: cleanPhone,
           email: trimmedEmail || null,
           address: address.trim() || null,
           customer_type: customerType,
           branch_id: branchId || null,
           user_id: (profileUserId && profileUserId !== "none_clear") ? profileUserId : null
         };

         if (modalMode === "add") {
           console.log("Inserting new customer...");
           const { data: insertedCustomer, error } = await supabase.from('customers').insert([payload]).select('id').single();
           if (error) throw error;
           customerId = insertedCustomer?.id || null;
           console.log("Customer created with ID:", customerId);
         } else {
           console.log("Updating existing customer:", selectedCustomer.id);
           const { error } = await supabase
             .from('customers')
             .update(payload)
             .eq('id', selectedCustomer.id);
           if (error) throw error;
           customerId = selectedCustomer.id;
           console.log("Customer updated, ID:", customerId);

           // Synchronize linked profile in profiles table so phone updates take effect everywhere
           const linkedProfileId = (profileUserId && profileUserId !== "none_clear") ? profileUserId : selectedCustomer.user_id;
           if (linkedProfileId) {
             try {
               await supabase
                 .from('profiles')
                 .update({
                   full_name: trimmedName,
                   phone: cleanPhone || null,
                   email: trimmedEmail || null,
                   customer_type: customerType || null,
                   branch_id: branchId || null,
                 })
                 .eq('id', linkedProfileId);
               console.log("✅ Customer profile synchronized with updated phone:", cleanPhone);
             } catch (profSyncErr) {
               console.warn("Could not sync profile table on customer update:", profSyncErr);
             }
           }
         }
       }

       // 5. CRITICAL: Save location with the customerId
       console.log("=== ATTEMPTING TO SAVE LOCATION ===");
       console.log("Customer ID:", customerId);
       console.log("Location name:", locationName);

       if (!customerId) {
         console.error("ERROR: customerId is null/undefined!");
         toast.warning("Customer saved, but could not determine customer ID for location.");
       } else if (locationName.trim()) {
         const locationSaved = await savePrimaryLocation(customerId);
         console.log("Location save result:", locationSaved);
       } else {
         console.log("No location name provided, skipping location save.");
       }

       setSelectedCustomer(null);
       customerDraft.clear();
       await refetch();
       await queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
       await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
     } catch (error: any) {
       console.error("=== SAVE FAILED ===");
       console.error("Error:", error);
       toast.error(error.message || "An error occurred while saving.");
       setCreatingAccount(false);
     } finally {
       setLoading(false);
     }
   };

  const handleDelete = async (customerId: string, userId: string | null, name: string) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete customer profiles.");
      return;
    }

    if (!confirm(`Are you sure you want to delete customer "${name}"? This will permanently remove the customer record and auth account.`)) {
      return;
    }

    setDeletingCustomerId(customerId);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId, customerId, tableName: 'customers' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer');
      }

      toast.success("Customer deleted successfully");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (e: any) {
      toast.error(e.message || "Error deleting customer");
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can delete customers.");
      return;
    }

    const selectedCount = selectedCustomerIds.size;
    if (selectedCount === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCount} selected customer(s)? This will permanently remove customer records, linked profiles, and auth accounts.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-delete-customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedCustomerIds) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk delete customers');
      }

      const result = await response.json();
      if (result.failedCount > 0) {
        toast.warning(`Deleted ${result.deletedCount} customer(s). ${result.failedCount} failed.`);
      } else {
        toast.success(`${result.deletedCount} customer(s) deleted successfully.`);
      }
      setSelectedCustomerIds(new Set());
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to bulk delete customers.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCustomerIds.size === filteredCustomers.length) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(filteredCustomers.map((c: any) => c.id)));
    }
  };

  const toggleSelectCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedCustomerIds(new Set());

  const filteredCustomers = customers?.filter((c: any) => {
    const matchesSearch = 
      (c.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || "").includes(searchQuery) ||
      (c.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.branches?.branch_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = 
      typeFilter === "all" || 
      (typeFilter === "Retail" && (!c.customer_type || c.customer_type === "Retail")) ||
      (typeFilter === "Government" && (c.customer_type === "Government" || c.customer_type === "Partner")) ||
      (typeFilter === "Walk-in" && (c.customer_type === "Walk-in" || (c.customer_type || "").toLowerCase().includes("walk-in"))) ||
      c.customer_type === typeFilter;

    return matchesSearch && matchesType;
  }) || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pageNumbers: Array<number | "ellipsis"> = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, 5, "ellipsis", totalPages]
      : currentPage >= totalPages - 3
        ? [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];

  const stats = {
    total: customers?.length || 0,
    retail: customers?.filter((c: any) => !c.customer_type || c.customer_type === 'Retail').length || 0,
    corporate: customers?.filter((c: any) => c.customer_type === 'Corporate').length || 0,
    government: customers?.filter((c: any) => c.customer_type === 'Government').length || 0,
    partner: customers?.filter((c: any) => c.customer_type === 'Partner').length || 0,
    walkin: customers?.filter((c: any) => {
      const t = (c.customer_type || "").toLowerCase();
      return t === "walk-in" || t.includes("walk-in");
    }).length || 0,
  };

  return (
    <div className="space-y-8 relative overflow-x-hidden pb-12">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10" />

      {/* Header Section with Title and Buttons */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-teal-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          {/* Page Title & Description */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Users className="w-3.5 h-3.5" /> CLIENT REGISTRY
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              Customer Profiles & Accounts
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Manage enterprise clients, retail accounts, multi-branch service addresses, and customer portal login credentials.
            </p>
          </div>
          
          {/* Action Buttons - Responsive Layout */}
          {canModify && (
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
              <ExportButton variant="customer" />
              
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSample}
                className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
                title="Download CSV Template"
              >
                <Download className="w-4 h-4 text-primary shrink-0" />
                <span>Sample CSV</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomerImportOpen(true)}
                className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
                title="Bulk Import Customers"
              >
                <Upload className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Import CSV</span>
              </Button>

              <Button 
                size="sm"
                onClick={() => handleOpenModal(null, "add")}
                className="gradient-primary text-white hover:opacity-95 rounded-xl h-10 px-4 gap-2 font-bold shadow-glow text-xs"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add Customer</span>
              </Button>
            </div>
          )}
          
          {isViewOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted border border-border/50 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-primary" /> View Only
            </div>
          )}
        </div>
      </div>

      {/* 📊 Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
        {/* Total Accounts */}
        <div 
          onClick={() => setTypeFilter("all")}
          className={`glass-card rounded-2xl p-4 border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            typeFilter === "all"
              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
              : "border-border/60 hover:border-primary/40"
          }`}
          title="Click to view all customers"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">Total Accounts</span>
            <span className="text-2xl font-black text-foreground mt-0.5 block">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Retail Clients */}
        <div 
          onClick={() => setTypeFilter(typeFilter === "Retail" ? "all" : "Retail")}
          className={`glass-card rounded-2xl p-4 border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            typeFilter === "Retail"
              ? "border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20 dark:bg-teal-950/20"
              : "border-border/60 hover:border-teal-400/50"
          }`}
          title="Click to filter by Retail clients"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-teal-600 dark:text-teal-400 block">Retail Clients</span>
            <span className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-0.5 block">{stats.retail}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Corporate */}
        <div 
          onClick={() => setTypeFilter(typeFilter === "Corporate" ? "all" : "Corporate")}
          className={`glass-card rounded-2xl p-4 border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            typeFilter === "Corporate"
              ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20"
              : "border-border/60 hover:border-indigo-400/50"
          }`}
          title="Click to filter by Corporate accounts"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">Corporate</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">{stats.corporate}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
        </div>

        {/* Gov / Partners */}
        <div 
          onClick={() => setTypeFilter(typeFilter === "Government" ? "all" : "Government")}
          className={`glass-card rounded-2xl p-4 border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            typeFilter === "Government" || typeFilter === "Partner"
              ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20 dark:bg-purple-950/20"
              : "border-border/60 hover:border-purple-400/50"
          }`}
          title="Click to filter by Government & Partners"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Gov / Partners</span>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 block">{stats.government + stats.partner}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Walk-in Clients */}
        <div 
          onClick={() => setTypeFilter(typeFilter === "Walk-in" ? "all" : "Walk-in")}
          className={`glass-card rounded-2xl p-4 border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            typeFilter === "Walk-in"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20"
              : "border-border/60 hover:border-amber-400/50"
          }`}
          title="Click to filter by Walk-in clients"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Walk-in Clients</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{stats.walkin}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter / Search section */}
      <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between relative z-10">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, branch..."
            className="pl-10 text-sm h-10 rounded-lg border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type:</span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-10 rounded-lg border-slate-200 bg-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Retail">Retail</SelectItem>
              <SelectItem value="Corporate">Corporate</SelectItem>
              <SelectItem value="Government">Government</SelectItem>
              <SelectItem value="Partner">Partner</SelectItem>
              <SelectItem value="Walk-in">Walk-in / Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <span className="text-sm font-medium">Loading customers directory...</span>
        </div>
      ) : paginatedCustomers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border-2 border-dashed rounded-xl bg-slate-50/50 border-slate-200/80">
          {user?.role === 'technician' && (!customers || customers.length === 0) ? (
            <>
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600">No customer data visible</p>
              <p className="text-xs text-slate-400 mt-1">You have no assigned complaints, so no customer data is visible.</p>
            </>
          ) : (
            <>
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600">No customers found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#f8fafc] text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  {isAdmin && (
                    <th className="py-3.5 px-4 w-10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {selectedCustomerIds.size === filteredCustomers.length && filteredCustomers.length > 0 ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Customer Name</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Phone</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Branch</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Type</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedCustomers.map((c: any) => (
                  <tr 
                    key={c.id} 
                    className={`${selectedCustomerIds.has(c.id) ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'} transition-colors cursor-pointer`}
                    onClick={() => handleOpenModal(c, "view")}
                  >
                    {isAdmin && (
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => toggleSelectCustomer(c.id, e)}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          {selectedCustomerIds.has(c.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                     <td className="py-3 px-4">
                       <div className="font-semibold text-slate-800 truncate max-w-[180px] sm:max-w-[260px]" title={c.full_name}>{c.full_name}</div>
                       {c.email && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px] sm:max-w-[260px]" title={c.email}>{c.email}</div>}
                     </td>
                    <td className="py-3 px-4 font-medium text-slate-600">
                      {c.phone}
                    </td>
                    <td className="py-3 px-4">
                      {c.branches?.branch_name ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200/50">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {c.branches.branch_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        c.customer_type === 'Walk-in' ? 'bg-amber-100/90 border border-amber-300 text-amber-800' :
                        c.customer_type === 'Corporate' ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' :
                        c.customer_type === 'Government' ? 'bg-rose-50 border border-rose-200 text-rose-600' :
                        c.customer_type === 'Partner' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                        'bg-teal-50 border border-teal-200 text-teal-600'
                      }`}>
                        {c.customer_type || 'Retail'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenModal(c, "view")}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg h-8 w-8 p-0"
                          title="View customer details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openLocationManager(c.id, c.full_name)}
                          className="text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-lg h-8 w-8 p-0"
                          title="Manage Multi-Locations"
                        >
                          <MapPin className="w-4 h-4 text-emerald-600" />
                        </Button>
                        {canModify && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenModal(c, "edit")}
                            className="text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg h-8 w-8 p-0"
                            title="Edit customer details"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(c.id, c.user_id, c.full_name)}
                            disabled={deletingCustomerId === c.id}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg h-8 w-8 p-0"
                            title="Delete customer"
                          >
                            {deletingCustomerId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk Action Bar */}
          {isAdmin && selectedCustomerIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
              <span className="text-sm font-medium">{selectedCustomerIds.size} selected</span>
              <button
                onClick={clearSelection}
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

          {/* Mobile Card List View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedCustomers.map((c: any) => {
              const isSelected = selectedCustomerIds.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col gap-3.5 cursor-pointer ${isSelected ? 'bg-blue-50/60 border-blue-200' : ''}`}
                  onClick={() => handleOpenModal(c, "view")}
                >
                  {isAdmin && (
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => toggleSelectCustomer(c.id, e)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-800 text-base truncate" title={c.full_name}>{c.full_name}</h3>
                      {c.email && <p className="text-xs text-slate-400 font-light mt-0.5 truncate" title={c.email}>{c.email}</p>}
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      c.customer_type === 'Walk-in' ? 'bg-amber-100/90 border border-amber-300 text-amber-800' :
                      c.customer_type === 'Corporate' ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' :
                      c.customer_type === 'Government' ? 'bg-rose-50 border border-rose-200 text-rose-600' :
                      c.customer_type === 'Partner' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                      'bg-teal-50 border border-teal-200 text-teal-600'
                    }`}>
                      {c.customer_type || 'Retail'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.branches?.branch_name || "No branch"}</span>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenModal(c, "view")}
                      className="text-xs rounded-lg h-8 font-semibold flex-1"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLocationManager(c.id, c.full_name)}
                      className="text-xs rounded-lg h-8 font-semibold flex-1 border-emerald-100 text-emerald-600 hover:bg-emerald-50/50"
                      title="Manage Multi-Locations"
                    >
                      <MapPin className="w-3.5 h-3.5 mr-1.5" /> Locations
                    </Button>
                    {canModify && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenModal(c, "edit")}
                        className="text-xs rounded-lg h-8 font-semibold flex-1 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(c.id, c.user_id, c.full_name)}
                        disabled={deletingCustomerId === c.id}
                        className="text-xs rounded-lg h-8 font-semibold text-destructive hover:bg-destructive/5 shrink-0"
                      >
                        {deletingCustomerId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {filteredCustomers.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} of {filteredCustomers.length}
            </p>
            <Pagination className="w-full sm:w-auto mx-0 justify-end overflow-x-auto">
              <PaginationContent className="flex-nowrap">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((p) => Math.max(1, p - 1));
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {pageNumbers.map((page, index) => (
                  <PaginationItem key={page === "ellipsis" ? `ellipsis-${index}` : page}>
                    {page === "ellipsis" ? <PaginationEllipsis /> : <PaginationLink
                      href="#"
                      isActive={currentPage === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                      }}
                    >
                      {page}
                    </PaginationLink>}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                    }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}

      {/* View & Add/Edit Overlay Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="bg-white w-full max-w-xl h-full rounded-lg p-4 sm:p-6 md:p-8 relative flex flex-col gap-6 overflow-y-auto shadow-xl border border-gray-200"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedCustomer(null)}
                aria-label="Close modal"
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 p-1.5 rounded-lg transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-4 border-b pb-4 pr-8 min-w-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase gradient-warm`}>
                  {(modalMode === 'add' ? 'N' : fullName)?.charAt(0) || 'C'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-display font-bold text-slate-800">
                    {modalMode === 'view' ? "Customer Profile Details" : modalMode === 'add' ? "Add New Customer" : "Edit Customer Details"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modalMode === 'view' ? selectedCustomer.email || "No email provided" : "Fill details below to save."}
                  </p>
                </div>
              </div>

              {modalMode === 'view' ? (
                /* View Mode */
                <div className="space-y-6 flex-1">
                  <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Profile Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Full Name</span>
                        <span className="text-sm font-semibold text-slate-800 block truncate max-w-[250px] sm:max-w-full" title={selectedCustomer.full_name}>{selectedCustomer.full_name}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Type</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-0.5 ${
                          selectedCustomer.customer_type === 'Corporate' ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' :
                          selectedCustomer.customer_type === 'Government' ? 'bg-rose-50 border border-rose-200 text-rose-600' :
                          selectedCustomer.customer_type === 'Partner' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                          'bg-teal-50 border border-teal-200 text-teal-600'
                        }`}>
                          {selectedCustomer.customer_type || 'Retail'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Email Address</span>
                        <span className="text-xs font-medium text-slate-700 block truncate">{selectedCustomer.email || "Not specified"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Phone Contact</span>
                        <span className="text-xs font-semibold text-slate-700">{selectedCustomer.phone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Branch</span>
                        <span className="text-xs font-semibold text-slate-700 block truncate">{selectedCustomer.branches?.branch_name || "Not assigned"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Address</span>
                        <span className="text-xs font-medium text-slate-600 leading-relaxed block max-h-24 overflow-y-auto whitespace-pre-wrap">{selectedCustomer.address || "No address provided."}</span>
                      </div>

                      {/* Linked Account Details */}
                      {selectedCustomer.user_id && (
                        <div className="col-span-2 pt-3 border-t border-slate-200/50 mt-1">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Linked Login Account
                          </span>
                          <span className="text-xs font-medium text-slate-500 block mt-1">
                            Associated UUID: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{selectedCustomer.user_id}</code>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 rounded-xl h-11 font-bold text-sm"
                      onClick={() => setSelectedCustomer(null)}
                    >
                      Close Details
                    </Button>
                    {(canModify || user?.role === 'customer') && (
                      <Button 
                        type="button" 
                        variant="outline"
                        className="flex-1 rounded-xl h-11 font-bold text-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setIsLocationManagerOpen(true)}
                      >
                        <MapPin className="w-4 h-4 mr-2 text-emerald-600" /> Manage Locations
                      </Button>
                    )}
                    {canModify && (
                      <Button 
                        type="button" 
                        className="flex-1 gradient-primary text-primary-foreground shadow-glow rounded-xl h-11 font-bold text-sm"
                        onClick={() => handleOpenModal(selectedCustomer, "edit")}
                      >
                        <Edit className="w-4 h-4 mr-2" /> Edit Profile
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* Add / Edit Form Mode */
                <form onSubmit={handleSaveCustomer} className="space-y-4 flex flex-col flex-1 justify-between">
                  <div className="space-y-4">
                    {modalMode === "edit" && selectedCustomer?.id && (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-emerald-800">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Need to manage multiple installation / service addresses?</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsLocationManagerOpen(true)}
                          className="h-8 text-xs font-semibold text-emerald-700 bg-white border-emerald-200 hover:bg-emerald-50 shrink-0"
                        >
                          Manage Multi-Locations
                        </Button>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Full Name <span className="text-destructive">*</span></label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Customer Full Name"
                        required
                        maxLength={100}
                        disabled={loading}
                        className="w-full rounded-lg border-slate-200 h-10"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Phone Number <span className="text-destructive">*</span></label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Contact phone"
                          required
                          disabled={loading}
                          className="w-full rounded-lg border-slate-200 h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Email Address</label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="customer@example.com"
                          disabled={loading}
                          className="w-full rounded-lg border-slate-200 h-10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Customer Type</label>
                        <Select value={customerType} onValueChange={setCustomerType} disabled={loading}>
                          <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Retail">Retail</SelectItem>
                            <SelectItem value="Corporate">Corporate</SelectItem>
                            <SelectItem value="Government">Government</SelectItem>
                            <SelectItem value="Partner">Partner</SelectItem>
                            <SelectItem value="Walk-in">Walk-in / Direct</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Branch Location</label>
                        <Select value={branchId} onValueChange={setBranchId} disabled={loading}>
                          <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches?.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Create Login Account section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="createLoginAccountCheckbox"
                          checked={createLoginAccount || !!profileUserId}
                          disabled={loading || !!profileUserId}
                          onChange={(e) => {
                            setCreateLoginAccount(e.target.checked);
                            if (!e.target.checked) {
                              setLoginPassword("");
                              setShowPassword(false);
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="createLoginAccountCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                          Create Login Account for Customer
                        </label>
                      </div>

                      {profileUserId ? (
                        <div className="flex items-center gap-1.5 text-xs text-success font-semibold pl-6">
                          <ShieldCheck className="w-4 h-4 text-success" />
                          Login Account Linked ({email || "linked"})
                        </div>
                      ) : createLoginAccount && (
                        <div className="space-y-2 pl-6">
                          <p className="text-[10px] text-muted-foreground">
                            A login account will be created with the email and password below when you save.
                          </p>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Password <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                required
                                disabled={loading}
                                autoComplete="new-password"
                                className="rounded-lg border-slate-200 h-10 pr-10"
                              />
                              {loginPassword.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                            {loginPassword.length > 0 && loginPassword.length < 8 && (
                              <p className="text-[10px] text-destructive font-medium">Password must be at least 8 characters</p>
                            )}
                            {loginPassword.length >= 8 && (
                              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Password meets minimum requirements
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                                         {/* Primary Location Fields */}
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                       <div className="flex items-center gap-2">
                         <MapPin className="w-4 h-4 text-primary" />
                         <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Primary Location</span>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-600">Location Name <span className="text-destructive">*</span></label>
                           <Input
                             value={locationName}
                             onChange={(e) => setLocationName(e.target.value)}
                             placeholder="Head Office, Warehouse, etc."
                             required={!!locationName}
                             disabled={loading}
                             className="w-full rounded-lg border-slate-200 h-9"
                           />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-600">City</label>
                           <Input
                             value={locationCity}
                             onChange={(e) => setLocationCity(e.target.value)}
                             placeholder="Hyderabad"
                             disabled={loading}
                             className="w-full rounded-lg border-slate-200 h-9"
                           />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-600">State</label>
                           <Input
                             value={locationState}
                             onChange={(e) => setLocationState(e.target.value)}
                             placeholder="Telangana"
                             disabled={loading}
                             className="w-full rounded-lg border-slate-200 h-9"
                           />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-600">Pincode</label>
                           <Input
                             value={locationPincode}
                             onChange={(e) => setLocationPincode(e.target.value)}
                             placeholder="500081"
                             disabled={loading}
                             className="w-full rounded-lg border-slate-200 h-9"
                           />
                         </div>
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-slate-600">Address</label>
                         <textarea
                           value={locationAddress}
                           onChange={(e) => setLocationAddress(e.target.value)}
                           placeholder="Street, Area, Landmark..."
                           disabled={loading}
                           rows={2}
                           className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none transition-all"
                         />
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-600">Contact Person</label>
                           <Input
                             value={locationContactPerson}
                             onChange={(e) => setLocationContactPerson(e.target.value)}
                             placeholder="Ravi Kumar"
                             disabled={loading}
                             className="w-full rounded-lg border-slate-200 h-9"
                           />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-600">Contact Phone</label>
                           <Input
                             value={locationContactPhone}
                             onChange={(e) => setLocationContactPhone(e.target.value)}
                             placeholder="9876543210"
                             disabled={loading}
                             className="w-full rounded-lg border-slate-200 h-9"
                           />
                         </div>
                       </div>
                     </div>

                     {/* Manual login-account linking is disabled. New accounts are linked automatically. */}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Physical Address</label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Customer residential/commercial address details..."
                        disabled={loading}
                        rows={3}
                        className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6">
                      {modalMode === "add" && customerDraft.hasDraft() && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            customerDraft.clear();
                            setFullName("");
                            setPhone("");
                            setEmail("");
                            setAddress("");
                            setCustomerType("Retail");
                            setBranchId("");
                            setProfileUserId("");
                            setCreateLoginAccount(false);
                            setLoginPassword("");
                            setLocationName("");
                            setLocationCity("");
                            setLocationState("");
                            setLocationPincode("");
                            setLocationAddress("");
                            setLocationContactPerson("");
                            setLocationContactPhone("");
                            toast.success("Draft cleared");
                          }}
                          className="text-xs text-slate-500 hover:text-destructive"
                        >
                          Clear Draft
                        </Button>
                      )}
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 rounded-xl h-11 font-bold text-sm"
                      onClick={() => {
                        setSelectedCustomer(null);
                        customerDraft.clear();
                        setFullName("");
                        setPhone("");
                        setEmail("");
                        setAddress("");
                        setCustomerType("Retail");
                        setBranchId("");
                        setProfileUserId("");
                        setCreateLoginAccount(false);
                        setLoginPassword("");
                        setLocationName("");
                        setLocationCity("");
                        setLocationState("");
                        setLocationPincode("");
                        setLocationAddress("");
                        setLocationContactPerson("");
                        setLocationContactPhone("");
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 gradient-primary text-primary-foreground shadow-glow rounded-xl h-11 font-bold text-sm"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {creatingAccount ? "Creating Account..." : "Saving..."}
                        </>
                      ) : (
                        createLoginAccount && !profileUserId ? "Create Account & Save" : "Save Customer"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <CustomerImportModal
        open={isCustomerImportOpen}
        onOpenChange={setIsCustomerImportOpen}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
          queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
        }}
      />
      <CustomerLocationManager
        customerId={selectedCustomerId || selectedCustomer?.id || ""}
        customerName={selectedCustomerName || selectedCustomer?.full_name}
        open={locationManagerOpen || isLocationManagerOpen}
        onOpenChange={(open) => {
          setLocationManagerOpen(open);
          setIsLocationManagerOpen(open);
        }}
        onSaved={() => {
          refetch();
        }}
      />
    </div>
  );
}

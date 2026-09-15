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
  CheckSquare,
  Square
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
    },
  });

  useEffect(() => {
    if (modalMode === "add") {
      customerDraft.restore();
    }
  }, [modalMode]);

  useEffect(() => {
    return customerDraft.save();
  }, [fullName, phone, email, address, customerType, branchId, createLoginAccount]);

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

  const handleOpenModal = (customer: any, mode: "view" | "add" | "edit") => {
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
    } else {
      setSelectedCustomer(customer);
      setFullName(customer.full_name || "");
      setPhone(customer.phone || "");
      setEmail(customer.email || "");
      setAddress(customer.address || "");
      setCustomerType(customer.customer_type || "Retail");
      setBranchId(customer.branch_id || "");
      setProfileUserId(customer.user_id || "");
    }
  };

  // No longer needed — replaced by integrated creation in handleSaveCustomer

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

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
        if (!data?.userId) throw new Error("Did not receive user ID from server.");

        const newUserId = data.userId;

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
              user_id: newUserId,
            })
            .eq("id", selectedCustomer.id);
          if (updateError) throw updateError;
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
          const { error } = await supabase.from('customers').insert([payload]);
          if (error) throw error;
          toast.success(`Customer ${trimmedName} added successfully!`);
        } else {
          const { error } = await supabase
            .from('customers')
            .update(payload)
            .eq('id', selectedCustomer.id);
          if (error) throw error;
          toast.success(`Customer ${trimmedName} updated successfully!`);
        }
      }

      setSelectedCustomer(null);
      customerDraft.clear();
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profiles-to-link"] });
    } catch (error: any) {
      console.error("Save customer error:", error);
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
    
    const matchesType = typeFilter === "all" || c.customer_type === typeFilter;

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

  return (
    <div className="space-y-8 relative overflow-x-hidden">
      {/* Header Section with Title and Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
        {/* Page Title & Description */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Customer Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer directory, branching details, and client configurations.
          </p>
        </div>
        
        {/* Action Buttons - Responsive Layout */}
        {canModify && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <ExportButton variant="customer" />
            <button
              onClick={downloadSample}
              className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap flex-1 sm:flex-none min-w-[80px] justify-center"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs sm:text-sm">Sample</span>
            </button>
            <button
              onClick={() => setIsCustomerImportOpen(true)}
              className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap flex-1 sm:flex-none min-w-[80px] justify-center"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-xs sm:text-sm">Import</span>
            </button>
            <Button 
              onClick={() => handleOpenModal(null, "add")}
              className="flex items-center gap-1.5 whitespace-nowrap flex-1 sm:flex-none min-w-[80px] justify-center bg-gradient-to-r from-blue-600 to-teal-600 text-white"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">Add</span>
            </Button>
          </div>
        )}
        
        {isViewOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-slate-500" /> View Only
          </div>
        )}
      </div>

      {/* Filter / Search section */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
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
                      onClick={() => setSelectedCustomer(null)}
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
    </div>
  );
}

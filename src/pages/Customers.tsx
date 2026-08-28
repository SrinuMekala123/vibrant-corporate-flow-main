import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Customers() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);

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

  // Login account creation states
  const [createLoginAccount, setCreateLoginAccount] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Role permissions
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canModify = isAdmin || isSupervisor;
  const isViewOnly = !canModify;

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
    setCreateLoginAccount(false);
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
    if (!trimmedName || trimmedName.length < 3) {
      toast.error("Full Name must be at least 3 characters.");
      return;
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error("Please enter a valid phone number.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validate login account fields when checkbox is checked
    if (createLoginAccount && !profileUserId) {
      if (!trimmedEmail) {
        toast.error("Email is required to create a login account.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        toast.error("Please enter a valid email address.");
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

        if (fnError) throw new Error(fnError.message || "Failed to create login account.");
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
      refetch();
    } catch (error: any) {
      console.error("Save customer error:", error);
      toast.error(error.message || "An error occurred while saving.");
      setCreatingAccount(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete customer profiles.");
      return;
    }

    if (!confirm(`Are you sure you want to delete customer "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      toast.success("Customer record deleted successfully.");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete customer.");
    }
  };

  const filteredCustomers = customers?.filter((c: any) => {
    const matchesSearch = 
      (c.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || "").includes(searchQuery) ||
      (c.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.branches?.branch_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === "all" || c.customer_type === typeFilter;

    return matchesSearch && matchesType;
  }) || [];

  return (
    <div className="space-y-8 relative">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6 relative z-10 pr-12 md:pr-16">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800">Customer Profiles</h1>
          <p className="text-muted-foreground font-light text-sm">
            {user?.role === "customer" 
              ? "View your registered customer details." 
              : "Manage customer directory, branching details, and client configurations."}
          </p>
        </div>

        {canModify && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsCustomerImportOpen(true)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>
            <Button 
              onClick={() => handleOpenModal(null, "add")}
              className="gradient-primary text-primary-foreground shadow-glow shrink-0 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Customer
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
      ) : filteredCustomers.length === 0 ? (
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
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Customer Name</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Phone</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Branch</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Type</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCustomers.map((c: any) => (
                  <tr 
                    key={c.id} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => handleOpenModal(c, "view")}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{c.full_name}</div>
                      {c.email && <div className="text-xs text-slate-400 mt-0.5">{c.email}</div>}
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
                            onClick={() => handleDelete(c.id, c.full_name)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg h-8 w-8 p-0"
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredCustomers.map((c: any) => (
              <div 
                key={c.id} 
                className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col gap-3.5 cursor-pointer"
                onClick={() => handleOpenModal(c, "view")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">{c.full_name}</h3>
                    {c.email && <p className="text-xs text-slate-400 font-light mt-0.5">{c.email}</p>}
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
                      onClick={() => handleDelete(c.id, c.full_name)}
                      className="text-xs rounded-lg h-8 font-semibold text-destructive hover:bg-destructive/5 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
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
              className="bg-white w-full max-w-xl h-full rounded-lg p-6 md:p-8 relative flex flex-col gap-6 overflow-y-auto shadow-xl border border-gray-200"
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
              <div className="flex items-center gap-4 border-b pb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase gradient-warm`}>
                  {(modalMode === 'add' ? 'N' : fullName)?.charAt(0) || 'C'}
                </div>
                <div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Full Name</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedCustomer.full_name}</span>
                      </div>
                      <div>
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
                        disabled={loading}
                        className="rounded-lg border-slate-200 h-10"
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
                          className="rounded-lg border-slate-200 h-10"
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
                          className="rounded-lg border-slate-200 h-10"
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

                    {/* Linking login profile (Admin/Supervisor Only) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Link Login Account (Optional)</label>
                      <Select value={profileUserId || "none_clear"} onValueChange={setProfileUserId} disabled={loading}>
                        <SelectTrigger className="w-full h-10 rounded-lg border-slate-200 bg-white">
                          <SelectValue placeholder="Choose a registered customer login account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none_clear">-- Do not link / Clear --</SelectItem>
                          {customerProfiles?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name} ({p.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Allows the customer to view their own profile and assets when they log in.
                        <br />
                        <span className="font-semibold text-slate-500">Note: If customer self-registers, link their account in the Customers table.</span>
                      </p>
                    </div>

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
    <CustomerImportModal open={isCustomerImportOpen} onOpenChange={setIsCustomerImportOpen} />
    </div>
  );
}

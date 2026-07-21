import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus, Mail, Phone, Shield, Wrench, Search, ShieldAlert, Trash2, Eye, Edit, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UsersPage() {
  const { user, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal states
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("customer");
  const [editExpertise, setEditExpertise] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");


  // Fetch all profiles
  const { data: profiles, isLoading: isLoadingProfiles, refetch } = useQuery({
    queryKey: ['admin-profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
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

  const handleOpenModal = (profile: any) => {
    setSelectedUser(profile);
    setEditFullName(profile.full_name || "");
    setEditEmail(profile.email || "");
    setEditPhone(profile.phone || "");
    setEditRole(profile.role || "customer");
    setEditExpertise(profile.expertise ? profile.expertise.split(", ").filter(Boolean) : []);
    setEditPassword("");
    setEditConfirmPassword("");
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

    setLoading(true);
    try {
      const expertiseString = (role === "supervisor" || role === "technician") && selectedExpertise.length > 0
        ? selectedExpertise.join(", ")
        : undefined;

      // Create user using our AuthContext signUp helper
      const { error: signUpError } = await signUp(
        email,
        password,
        fullName,
        role as any,
        phone || undefined,
        expertiseString
      );

      if (signUpError) throw signUpError;

      toast.success(`User ${fullName} created successfully!`);
      
      // Clear form
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setRole("");
      setSelectedExpertise([]);
      
      // Refresh user list
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (editPassword) {
      if (editPassword.length < 6) {
        toast.error("Password must be at least 6 characters long.");
        return;
      }
      if (editPassword !== editConfirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setSavingEdit(true);
    try {
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

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName,
          email: editEmail,
          phone: editPhone || null,
          role: editRole,
          expertise: expertiseString,
          avatar_url: editFullName.charAt(0).toUpperCase()
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success("User profile and password updated successfully");
      setSelectedUser(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingEdit(false);
    }
  };



  const handleDeleteProfileOnly = async (profileId: string, profileName: string) => {
    if (!confirm(`Are you sure you want to delete profile for ${profileName}? Note: This only deletes their profile record, not their Auth account.`)) {
      return;
    }
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) throw error;
      toast.success("Profile deleted successfully");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete profile");
    }
  };

  const filteredProfiles = profiles?.filter((p: any) => {
    const matchesSearch = 
      (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.expertise || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || p.role === roleFilter;

    return matchesSearch && matchesRole;
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">User Management</h1>
        <p className="text-muted-foreground font-light text-sm">Create and manage accounts for Customers, Supervisors, and Technicians.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create User Form */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-card rounded-xl p-6 lg:col-span-5 space-y-4"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
            <UserPlus className="w-5 h-5" /> Create New User
          </h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@brihaspathi.com"
                required
                disabled={loading}
                autoComplete="new-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                disabled={loading}
                autoComplete="new-password"
              />
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">System Role</label>
              <Select value={role} onValueChange={setRole} disabled={loading}>
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

            {(role === "supervisor" || role === "technician") && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">Field of Work (Expertise - Select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Solar PV", "Networking", "Security Systems", "Power Systems"].map((field) => {
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

            <Button type="submit" className="w-full mt-2 gradient-primary text-primary-foreground shadow-glow" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Account...
                </>
              ) : (
                "Create User Account"
              )}
            </Button>
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
              {['all', 'customer', 'supervisor', 'technician', 'admin'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded transition-all capitalize text-center text-xs flex-1 sm:flex-none ${roleFilter === r ? 'bg-white text-primary shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {r === 'all' ? 'All' : r}
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
                  onClick={() => handleOpenModal(p)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-muted/40 border border-slate-100 hover:border-slate-200 hover:bg-muted/70 cursor-pointer transition-colors gap-3"
                >
                  <div className="flex items-start gap-3 w-full sm:w-auto min-w-0">
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
                        handleOpenModal(p);
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
                        handleOpenModal(p);
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
      </div>

      {/* View & Edit Overlay Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-lg w-full rounded-2xl p-6 relative flex flex-col gap-6 overflow-y-auto max-h-[90vh]"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase ${
                  selectedUser.role === 'admin' ? 'bg-rose-500' :
                  selectedUser.role === 'supervisor' ? 'bg-indigo-500' :
                  selectedUser.role === 'technician' ? 'bg-amber-500' : 'bg-teal-500'
                }`}>
                  {selectedUser.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-800">User Profile Management</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedUser.email}</p>
                </div>
              </div>

              {/* 1st Section: View Details */}
              <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Current User Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Full Name</span>
                    <span className="text-sm font-semibold text-slate-800">{selectedUser.full_name || "No Name"}</span>
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
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Email</span>
                    <span className="text-xs font-medium text-slate-700 block truncate">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Phone Contact</span>
                    <span className="text-xs font-semibold text-slate-700">{selectedUser.phone || "Not provided"}</span>
                  </div>
                </div>

                {(selectedUser.role === 'supervisor' || selectedUser.role === 'technician') && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Fields of Work / Expertise</span>
                    {selectedUser.expertise ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedUser.expertise.split(", ").map((exp: string) => (
                          <span key={exp} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-full">
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

              {/* 2nd Section: Edit Form */}
              <form onSubmit={handleUpdateUser} className="space-y-4 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Update Account Settings</h4>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Full Name</label>
                  <Input
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="John Doe"
                    required
                    disabled={savingEdit}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Email Address</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="john@brihaspathi.com"
                    required
                    disabled={savingEdit}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Phone Number</label>
                  <Input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    disabled={savingEdit}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">System Role</label>
                  <Select value={editRole} onValueChange={setEditRole} disabled={true}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(editRole === "supervisor" || editRole === "technician") && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 block">Field of Work (Expertise - Select all that apply)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Solar PV", "Networking", "Security Systems", "Power Systems"].map((field) => {
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
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Change Password</h5>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">New Password</label>
                    <Input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Minimum 6 characters (leave blank to keep unchanged)"
                      disabled={savingEdit}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">Confirm Password</label>
                    <Input
                      type="password"
                      value={editConfirmPassword}
                      onChange={(e) => setEditConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      disabled={savingEdit}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setSelectedUser(null)}
                    disabled={savingEdit}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 gradient-primary text-primary-foreground shadow-glow"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

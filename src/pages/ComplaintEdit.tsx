// import { useParams, useNavigate } from "react-router-dom";
// import { useState, useMemo, useEffect } from "react";
// import { motion } from "framer-motion";
// import { ArrowLeft, Save, Filter, Loader2 } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { TicketStatus, SeverityTier } from "@/data/mockData";
// import { toast } from "sonner";
// import { useAuth } from "@/contexts/AuthContext";
// import { complaintService } from "@/services/complaintService";
// import { useQuery } from "@tanstack/react-query";
// import { supabase } from "@/lib/supabase";

// const ComplaintEdit = () => {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const { user } = useAuth();
//   const isNew = !id;

//   // Fetch complaint data if editing
//   const { data: existingComplaint, isLoading: isFetching } = useQuery({
//     queryKey: ['complaint', id],
//     queryFn: () => complaintService.getById(id!),
//     enabled: !!id && !!user,
//   });

//   // Fetch ALL Customers from Profiles table
//   const { data: customers } = useQuery({
//     queryKey: ['customers-list'],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('id, full_name, email, phone')
//         .eq('role', 'customer');
//       if (error) throw error;
//       return data;
//     }
//   });

//   // Fetch ALL Supervisors from Profiles table
//   const { data: supervisors } = useQuery({
//     queryKey: ['supervisors-list'],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('id, full_name, email, phone, expertise, available')
//         .eq('role', 'supervisor');
//       if (error) throw error;
//       return data;
//     }
//   });

//   // Fetch ALL Technicians from Profiles table
//   const { data: technicians } = useQuery({
//     queryKey: ['technicians-list'],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('id, full_name, email, phone, expertise, available')
//         .eq('role', 'technician');
//       if (error) throw error;
//       return data;
//     }
//   });

//   const [form, setForm] = useState({
//     title: "",
//     customerId: "",
//     customerName: "",
//     customerPhone: "",
//     location: "",
//     fieldOfWork: "",
//     status: "unassigned" as TicketStatus,
//     severity: "minor" as SeverityTier,
//     assignedSupervisor: "",
//     assignedTechnician: "",
//     description: "",
//     resolution: "",
//   });

//   const [isSaving, setIsSaving] = useState(false);

//   // Populate form with existing data
//   useEffect(() => {
//     if (existingComplaint) {
//       setForm({
//         title: existingComplaint.title || "",
//         customerId: existingComplaint.customer_id || "",
//         customerName: existingComplaint.customer_name || "",
//         customerPhone: existingComplaint.customer_phone || existingComplaint.profiles?.phone || "",
//         location: existingComplaint.location || "",
//         fieldOfWork: existingComplaint.field_of_work || "",
//         status: existingComplaint.status as TicketStatus || "unassigned",
//         severity: existingComplaint.severity as SeverityTier || "minor",
//         assignedSupervisor: existingComplaint.assigned_supervisor || "",
//         assignedTechnician: existingComplaint.assigned_technician || "",
//         description: existingComplaint.description || "",
//         resolution: existingComplaint.resolution || "",
//       });
//     }
//   }, [existingComplaint]);

//   // Filter technicians by expertise
//   const matchingTechnicians = useMemo(() => {
//     if (!form.fieldOfWork || !technicians) return technicians || [];
//     return technicians.filter(
//       (t: any) => t.expertise?.toLowerCase().includes(form.fieldOfWork.toLowerCase())
//     );
//   }, [form.fieldOfWork, technicians]);

//   const nonMatchingTechnicians = useMemo(() => {
//     if (!technicians) return [];
//     return technicians.filter((t: any) => !matchingTechnicians.includes(t));
//   }, [technicians, matchingTechnicians]);

//   // 🔥 FIXED: handleSave with automatic phase advancement
//   const handleSave = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!user) {
//       toast.error("Please log in to create a complaint");
//       return;
//     }

//     if (!form.title || !form.customerId || !form.description) {
//       toast.error("Please fill in Title, Customer, and Description");
//       return;
//     }

//     setIsSaving(true);

//     try {
//       // 🔥 Determine the next phase based on current state and actions
//       let nextPhase = isNew ? 1 : (existingComplaint?.current_phase || 1);
//       let nextStatus = form.status;

//       // 🔥 AUTO-ADVANCE LOGIC:
//       // If technician is assigned and we're in Phase 1 or 2, move to Phase 3 (Dispatch)
//       if (form.assignedTechnician && !isNew) {
//         if (existingComplaint?.current_phase === 1 || existingComplaint?.current_phase === 2) {
//           nextPhase = 3; // Move to Dispatch phase
//           nextStatus = "dispatched";
//           console.log("🚀 Auto-advancing to Phase 3 (Dispatch)");
//         }
//       }

//       if (isNew) {
//         const newComplaint = await complaintService.create({
//           customer_id: form.customerId,
//           customer_name: form.customerName || null,
//           customer_phone: form.customerPhone || null,
//           title: form.title,
//           description: form.description,
//           category: form.fieldOfWork || null,
//           priority: form.severity === "major" ? "high" : form.severity === "moderate" ? "medium" : "low",
//           status: form.assignedTechnician ? "dispatched" : "unassigned",
//           assigned_to: null,
//           assigned_supervisor: form.assignedSupervisor || null,
//           assigned_technician: form.assignedTechnician || null,
//           location: form.location || null,
//           field_of_work: form.fieldOfWork || null,
//           severity: form.severity || null,
//           current_phase: form.assignedTechnician ? 3 : 1,
//           resolution: null,
//         } as any);

//         console.log("✅ Complaint created successfully:", newComplaint);
//         toast.success("Complaint created successfully!");
//       } else {
//         const updatedComplaint = await complaintService.update(id!, {
//           customer_id: form.customerId,
//           customer_name: form.customerName || null,
//           customer_phone: form.customerPhone || null,
//           title: form.title,
//           description: form.description,
//           status: nextStatus,
//           assigned_supervisor: form.assignedSupervisor || null,
//           assigned_technician: form.assignedTechnician || null,
//           location: form.location || null,
//           field_of_work: form.fieldOfWork || null,
//           severity: form.severity || null,
//           resolution: form.resolution || null,
//           current_phase: nextPhase, // 🔥 KEY FIX: Advance the phase!
//         } as any);

//         console.log("✅ Complaint updated successfully:", updatedComplaint);
//         toast.success(`Saved! Ticket moved to Phase ${nextPhase}`);
//       }

//       navigate("/complaints");
//     } catch (error: any) {
//       console.error("❌ Error saving complaint:", error);
//       toast.error(error.message || "Failed to save complaint. Please check console for details.");
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   if (isFetching && !isNew) {
//     return (
//       <div className="flex items-center justify-center h-64">
//         <Loader2 className="w-8 h-8 animate-spin text-primary" />
//         <span className="ml-2">Loading complaint details...</span>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6 max-w-3xl">
//       <div className="flex items-center gap-3">
//         <button
//           onClick={() => navigate(-1)}
//           className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
//           disabled={isSaving || isFetching}
//         >
//           <ArrowLeft className="w-4 h-4" />
//         </button>
//         <h1 className="text-xl font-display font-bold">{isNew ? "New Complaint" : "Edit Complaint"}</h1>
//       </div>

//       <motion.form
//         initial={{ opacity: 0, y: 15 }}
//         animate={{ opacity: 1, y: 0 }}
//         onSubmit={handleSave}
//         className="glass-card rounded-xl p-6 space-y-6"
//       >
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="md:col-span-2 space-y-2">
//             <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
//             <Input
//               value={form.title}
//               onChange={(e) => setForm({ ...form, title: e.target.value })}
//               placeholder="Issue title..."
//               required
//               disabled={isSaving || isFetching}
//             />
//           </div>

//           {/* Customer Dropdown */}
//           <div className="space-y-2">
//             <label className="text-sm font-medium">Customer <span className="text-destructive">*</span></label>
//             <Select
//               value={form.customerId}
//               onValueChange={(v) => {
//                 const selectedCustomer = customers?.find((c: any) => c.id === v);
//                 setForm({
//                   ...form,
//                   customerId: v,
//                   customerName: selectedCustomer?.full_name || "",
//                   customerPhone: selectedCustomer?.phone || form.customerPhone
//                 });
//               }}
//               disabled={isSaving || isFetching || !customers}
//             >
//               <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
//               <SelectContent>
//                 {customers?.map((c: any) => (
//                   <SelectItem key={c.id} value={c.id}>
//                     {c.full_name} ({c.email})
//                   </SelectItem>
//                 ))}
//                 {(!customers || customers.length === 0) && (
//                   <SelectItem value="none" disabled>No customers found</SelectItem>
//                 )}
//               </SelectContent>
//             </Select>
//           </div>

//           <div className="space-y-2">
//             <label className="text-sm font-medium">Phone</label>
//             <Input
//               value={form.customerPhone}
//               onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
//               placeholder="+91 ..."
//               disabled={isSaving || isFetching}
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium">Location</label>
//             <Input
//               value={form.location}
//               onChange={(e) => setForm({ ...form, location: e.target.value })}
//               placeholder="City, State"
//               disabled={isSaving || isFetching}
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium">Field of Work</label>
//             <Select
//               value={form.fieldOfWork}
//               onValueChange={(v) => setForm({ ...form, fieldOfWork: v, assignedTechnician: "" })}
//               disabled={isSaving || isFetching}
//             >
//               <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="Solar PV">Solar PV</SelectItem>
//                 <SelectItem value="Networking">Networking</SelectItem>
//                 <SelectItem value="Security Systems">Security Systems</SelectItem>
//                 <SelectItem value="Power Systems">Power Systems</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium">Severity</label>
//             <Select
//               value={form.severity}
//               onValueChange={(v) => setForm({ ...form, severity: v as SeverityTier })}
//               disabled={isSaving || isFetching}
//             >
//               <SelectTrigger><SelectValue /></SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="minor">Minor</SelectItem>
//                 <SelectItem value="moderate">Moderate</SelectItem>
//                 <SelectItem value="major">Major</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium">Status</label>
//             <Select
//               value={form.status}
//               onValueChange={(v) => setForm({ ...form, status: v as TicketStatus })}
//               disabled={isSaving || isFetching}
//             >
//               <SelectTrigger><SelectValue /></SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="unassigned">Unassigned</SelectItem>
//                 <SelectItem value="assigned">Assigned</SelectItem>
//                 <SelectItem value="in-progress">In Progress</SelectItem>
//                 <SelectItem value="dispatched">Dispatched</SelectItem>
//                 <SelectItem value="completed">Completed</SelectItem>
//                 <SelectItem value="closed">Closed</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>

//           {/* Supervisor Dropdown */}
//           <div className="space-y-2">
//             <label className="text-sm font-medium">Supervisor</label>
//             <Select
//               value={form.assignedSupervisor}
//               onValueChange={(v) => setForm({ ...form, assignedSupervisor: v })}
//               disabled={isSaving || isFetching || !supervisors}
//             >
//               <SelectTrigger><SelectValue placeholder="Assign supervisor" /></SelectTrigger>
//               <SelectContent>
//                 {supervisors?.map((s: any) => (
//                   <SelectItem key={s.id} value={s.full_name}>
//                     <div className="flex items-center gap-2">
//                       <span>{s.full_name}</span>
//                       {s.expertise && (
//                         <span className="text-xs text-muted-foreground">— {s.expertise}</span>
//                       )}
//                     </div>
//                   </SelectItem>
//                 ))}
//                 {(!supervisors || supervisors.length === 0) && (
//                   <SelectItem value="none" disabled>No supervisors found</SelectItem>
//                 )}
//               </SelectContent>
//             </Select>
//           </div>

//           {/* Technician Dropdown */}
//           <div className="md:col-span-2 space-y-2">
//             <label className="text-sm font-medium flex items-center gap-2">
//               <Filter className="w-3.5 h-3.5 text-primary" />
//               Technician
//               {form.fieldOfWork && (
//                 <span className="text-xs font-normal text-muted-foreground">
//                   — Filtered by "{form.fieldOfWork}" expertise
//                 </span>
//               )}
//             </label>
//             <Select
//               value={form.assignedTechnician}
//               onValueChange={(v) => setForm({ ...form, assignedTechnician: v })}
//               disabled={isSaving || isFetching || !technicians}
//             >
//               <SelectTrigger><SelectValue placeholder="Assign technician" /></SelectTrigger>
//               <SelectContent>
//                 {matchingTechnicians.length > 0 && (
//                   <>
//                     <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
//                       Matching Expertise {form.fieldOfWork && `(${form.fieldOfWork})`}
//                     </div>
//                     {matchingTechnicians.map((t: any) => (
//                       <SelectItem key={t.id} value={t.full_name}>
//                         <div className="flex items-center gap-2">
//                           <span>{t.full_name}</span>
//                           {t.expertise && (
//                             <span className="text-xs text-muted-foreground">• {t.expertise}</span>
//                           )}
//                           <span className={`w-2 h-2 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
//                           <span className="text-xs text-muted-foreground">{t.available ? "Available" : "Busy"}</span>
//                         </div>
//                       </SelectItem>
//                     ))}
//                   </>
//                 )}
//                 {nonMatchingTechnicians.length > 0 && (
//                   <>
//                     <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">
//                       Other Technicians
//                     </div>
//                     {nonMatchingTechnicians.map((t: any) => (
//                       <SelectItem key={t.id} value={t.full_name}>
//                         <div className="flex items-center gap-2">
//                           <span className="text-muted-foreground">{t.full_name}</span>
//                           {t.expertise && (
//                             <span className="text-xs text-muted-foreground">• {t.expertise}</span>
//                           )}
//                           <span className={`w-2 h-2 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
//                         </div>
//                       </SelectItem>
//                     ))}
//                   </>
//                 )}
//                 {(!technicians || technicians.length === 0) && (
//                   <SelectItem value="none" disabled>No technicians found</SelectItem>
//                 )}
//               </SelectContent>
//             </Select>
//           </div>

//           <div className="md:col-span-2 space-y-2">
//             <label className="text-sm font-medium">Description <span className="text-destructive">*</span></label>
//             <Textarea
//               value={form.description}
//               onChange={(e) => setForm({ ...form, description: e.target.value })}
//               rows={3}
//               placeholder="Describe the issue..."
//               required
//               disabled={isSaving || isFetching}
//             />
//           </div>
//           <div className="md:col-span-2 space-y-2">
//             <label className="text-sm font-medium">Resolution Notes</label>
//             <Textarea
//               value={form.resolution}
//               onChange={(e) => setForm({ ...form, resolution: e.target.value })}
//               rows={3}
//               placeholder="Resolution details..."
//               disabled={isSaving || isFetching}
//             />
//           </div>
//         </div>
//         <div className="flex gap-3 justify-end">
//           <Button
//             type="button"
//             variant="outline"
//             onClick={() => navigate(-1)}
//             disabled={isSaving || isFetching}
//           >
//             Cancel
//           </Button>
//           <Button
//             type="submit"
//             className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
//             disabled={isSaving || isFetching}
//           >
//             {isSaving ? (
//               <span className="flex items-center gap-2">
//                 <Loader2 className="w-4 h-4 animate-spin" />
//                 Saving...
//               </span>
//             ) : (
//               <>
//                 <Save className="w-4 h-4 mr-2" />
//                 {isNew ? "Create" : "Save Changes"}
//               </>
//             )}
//           </Button>
//         </div>
//       </motion.form>
//     </div>
//   );
// };

// export default ComplaintEdit;

import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Filter, Loader2, Upload, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeverityTier } from "@/data/mockData";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { complaintService } from "@/services/complaintService";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import browserImageCompression from "browser-image-compression";

const ComplaintEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isRole } = useAuth();
  const isNew = !id;
  const isCustomer = isRole("customer");
  const isAdminOrSupervisor = isRole("admin", "supervisor");

  // Fetch existing complaint if editing
  const { data: existingComplaint, isLoading: isFetching } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintService.getById(id!),
    enabled: !!id && !!user,
  });

  // Fetch customers (Admin/Supervisor only)
  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'customer');
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrSupervisor,
  });

  // Fetch supervisors (Admin/Supervisor only)
  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, expertise, available')
        .eq('role', 'supervisor');
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrSupervisor,
  });

  // Fetch technicians (Admin/Supervisor only)
  const { data: technicians } = useQuery({
    queryKey: ['technicians-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, expertise, available')
        .eq('role', 'technician');
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrSupervisor,
  });

  // Fetch current user's profile (for customer auto-fill)
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, email')
        .eq('id', user.id)
        .single();
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
    resolution: "",
  });

  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Populate form with existing data
  useEffect(() => {
    if (existingComplaint) {
      setForm({
        title: existingComplaint.title || "",
        customerId: existingComplaint.customer_id || "",
        customerName: existingComplaint.customer_name || "",
        customerPhone: existingComplaint.customer_phone || "",
        location: existingComplaint.location || "",
        fieldOfWork: existingComplaint.field_of_work || "",
        status: existingComplaint.status || "unassigned",
        severity: existingComplaint.severity as SeverityTier || "minor",
        assignedSupervisor: existingComplaint.assigned_supervisor || "",
        assignedTechnician: existingComplaint.assigned_technician || "",
        description: existingComplaint.description || "",
        resolution: existingComplaint.resolution || "",
      });
      setEvidenceUrls(existingComplaint.evidence_urls || []);
    }
  }, [existingComplaint]);

  // Auto-fill customer info when customer creates new complaint
  useEffect(() => {
    if (isNew && isCustomer && userProfile && user) {
      setForm(prev => ({
        ...prev,
        customerId: user.id!,
        customerName: userProfile.full_name || user.email?.split('@')[0] || "",
        customerPhone: userProfile.phone || "",
      }));
    }
  }, [isNew, isCustomer, userProfile, user]);

  // Filter technicians by expertise
  const matchingTechnicians = useMemo(() => {
    if (!form.fieldOfWork || !technicians) return technicians || [];
    return technicians.filter(
      (t: any) => t.expertise?.toLowerCase().includes(form.fieldOfWork.toLowerCase())
    );
  }, [form.fieldOfWork, technicians]);

  const nonMatchingTechnicians = useMemo(() => {
    if (!technicians) return [];
    return technicians.filter((t: any) => !matchingTechnicians.includes(t));
  }, [technicians, matchingTechnicians]);

  // Upload file with compression
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
        } catch (err) {
          console.warn('Image compression failed, using original:', err);
        }
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('complaint-media')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('complaint-media')
        .getPublicUrl(fileName);

      return publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  // 🔥 Handle form submission with auto-advance to Phase 3
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in");
      return;
    }

    if (!form.title || !form.customerId || !form.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      if (isNew) {
        // Create new complaint
        const newComplaint = await complaintService.create({
          customer_id: form.customerId,
          customer_name: form.customerName || null,
          customer_phone: form.customerPhone || null,
          title: form.title,
          description: form.description,
          status: "unassigned",
          assigned_supervisor: isCustomer ? null : (form.assignedSupervisor || null),
          assigned_technician: isCustomer ? null : (form.assignedTechnician || null),
          location: form.location || null,
          field_of_work: form.fieldOfWork || null,
          severity: form.severity || null,
          current_phase: 1,
          resolution: null,
          evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
        } as any);

        console.log("✅ Complaint created:", newComplaint);

        if (isCustomer) {
          toast.success("Complaint submitted! Our team will contact you soon.");
          navigate("/dashboard");
        } else {
          toast.success("Complaint created successfully!");
          navigate("/complaints");
        }
      } else {
        // 🔥 EDITING EXISTING COMPLAINT - Auto-advance to Phase 3 if technician assigned
        let nextPhase = existingComplaint?.current_phase || 1;
        let nextStatus = form.status;

        // 🔥 AUTO-ADVANCE LOGIC:
        // If technician is assigned and we're in Phase 1 or 2, move to Phase 3 (Dispatch)
        if (form.assignedTechnician && !isCustomer) {
          if (existingComplaint?.current_phase === 1 || existingComplaint?.current_phase === 2) {
            nextPhase = 3; // Move to Dispatch phase
            nextStatus = "dispatched";
            console.log("🚀 Auto-advancing to Phase 3 (Dispatch)");
            toast.success("Technician assigned! Moving to Phase 3: Dispatch");
          }
        }

        // Update complaint with phase advancement
        await complaintService.update(id!, {
          title: form.title,
          description: form.description,
          location: form.location || null,
          field_of_work: form.fieldOfWork || null,
          severity: form.severity || null,
          status: nextStatus,
          assigned_supervisor: form.assignedSupervisor || null,
          assigned_technician: form.assignedTechnician || null,
          resolution: form.resolution || null,
          evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
          current_phase: nextPhase, // 🔥 KEY: Update the phase!
        } as any);

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

  if (isFetching && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading complaint details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
          disabled={isSaving}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold">
          {isNew
            ? (isCustomer ? "Submit New Complaint" : "New Complaint")
            : "Edit Complaint"
          }
        </h1>
      </div>

      {/* Customer Info Banner */}
      {isCustomer && isNew && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4 border-l-4 border-l-primary"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Submitting a Service Request</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your complaint will be reviewed within 24 hours. A supervisor will contact you to assess the issue.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave}
        className="glass-card rounded-xl p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Issue Title - Required for All */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium">
              Issue Title <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief description of the problem..."
              required
              disabled={isSaving}
            />
          </div>

          {/* Customer Section - Different for Customer vs Admin/Supervisor */}
          {isCustomer ? (
            <>
              {/* Customer View: Read-only fields */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name</label>
                <Input
                  value={form.customerName}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Contact Phone <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  placeholder="+91 9876543210"
                  required
                  disabled={isSaving}
                />
              </div>
            </>
          ) : (
            <>
              {/* Admin/Supervisor View: Customer dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Customer <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.customerId}
                  onValueChange={(v) => {
                    const selectedCustomer = customers?.find((c: any) => c.id === v);
                    setForm({
                      ...form,
                      customerId: v,
                      customerName: selectedCustomer?.full_name || "",
                      customerPhone: selectedCustomer?.phone || ""
                    });
                  }}
                  disabled={isSaving || !customers}
                >
                  <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} ({c.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  placeholder="+91 ..."
                  disabled={isSaving}
                />
              </div>
            </>
          )}

          {/* Location - Required for All */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Location <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Site address..."
              required
              disabled={isSaving}
            />
          </div>

          {/* Field of Work - Required for All */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Field of Work <span className="text-destructive">*</span>
            </label>
            <Select
              value={form.fieldOfWork}
              onValueChange={(v) => setForm({ ...form, fieldOfWork: v })}
              disabled={isSaving}
            >
              <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Solar PV">Solar PV</SelectItem>
                <SelectItem value="Networking">Networking</SelectItem>
                <SelectItem value="Security Systems">Security Systems</SelectItem>
                <SelectItem value="Power Systems">Power Systems</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity - Required for All */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Severity Level <span className="text-destructive">*</span>
            </label>
            <Select
              value={form.severity}
              onValueChange={(v) => setForm({ ...form, severity: v as SeverityTier })}
              disabled={isSaving}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor - Low priority</SelectItem>
                <SelectItem value="moderate">Moderate - Needs attention</SelectItem>
                <SelectItem value="major">Major - Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Admin/Supervisor Only Fields */}
          {isAdminOrSupervisor && !isNew && (
            <>
              {/* Status - Only for editing */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                  disabled={isSaving}
                >
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

              {/* Supervisor Assignment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned Supervisor</label>
                <Select
                  value={form.assignedSupervisor}
                  onValueChange={(v) => setForm({ ...form, assignedSupervisor: v })}
                  disabled={isSaving || !supervisors}
                >
                  <SelectTrigger><SelectValue placeholder="Assign supervisor" /></SelectTrigger>
                  <SelectContent>
                    {supervisors?.map((s: any) => (
                      <SelectItem key={s.id} value={s.full_name}>
                        <div className="flex items-center gap-2">
                          <span>{s.full_name}</span>
                          {s.expertise && (
                            <span className="text-xs text-muted-foreground">— {s.expertise}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Technician Assignment */}
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  Assigned Technician
                  {form.fieldOfWork && (
                    <span className="text-xs font-normal text-muted-foreground">
                      — Filtered by "{form.fieldOfWork}" expertise
                    </span>
                  )}
                </label>
                <Select
                  value={form.assignedTechnician}
                  onValueChange={(v) => setForm({ ...form, assignedTechnician: v })}
                  disabled={isSaving || !technicians}
                >
                  <SelectTrigger><SelectValue placeholder="Assign technician" /></SelectTrigger>
                  <SelectContent>
                    {matchingTechnicians.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                          Matching Expertise {form.fieldOfWork && `(${form.fieldOfWork})`}
                        </div>
                        {matchingTechnicians.map((t: any) => (
                          <SelectItem key={t.id} value={t.full_name}>
                            <div className="flex items-center gap-2">
                              <span>{t.full_name}</span>
                              {t.expertise && (
                                <span className="text-xs text-muted-foreground">• {t.expertise}</span>
                              )}
                              <span className={`w-2 h-2 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
                              <span className="text-xs text-muted-foreground">{t.available ? "Available" : "Busy"}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {nonMatchingTechnicians.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">
                          Other Technicians
                        </div>
                        {nonMatchingTechnicians.map((t: any) => (
                          <SelectItem key={t.id} value={t.full_name}>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{t.full_name}</span>
                              {t.expertise && (
                                <span className="text-xs text-muted-foreground">• {t.expertise}</span>
                              )}
                              <span className={`w-2 h-2 rounded-full ${t.available ? "bg-success" : "bg-muted-foreground"}`} />
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Description - Required for All */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium">
              Problem Description <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder={isCustomer
                ? "Describe the issue in detail. What happened? When did it start?"
                : "Describe the issue..."
              }
              required
              disabled={isSaving}
            />
          </div>

          {/* Resolution Notes - Only for Admin/Supervisor editing */}
          {isAdminOrSupervisor && !isNew && (
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                value={form.resolution}
                onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                rows={3}
                placeholder="Resolution details..."
                disabled={isSaving}
              />
            </div>
          )}

          {/* Evidence Upload - Available for All */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Evidence (Photos/Videos) - Optional
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={async (e) => {
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
              }}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              disabled={isSaving || isUploading}
            />
            {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
            {evidenceUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {evidenceUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                    >
                      Evidence {i + 1}
                    </a>
                    <button
                      type="button"
                      onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isNew
                  ? (isCustomer ? "Submit Complaint" : "Create Complaint")
                  : "Save Changes"
                }
              </>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
};

export default ComplaintEdit;
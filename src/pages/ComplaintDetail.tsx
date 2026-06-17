// import { useParams, Link, useNavigate } from "react-router-dom";
// import { useState, useEffect, useRef } from "react";
// import { motion } from "framer-motion";
// import { ArrowLeft, Edit, Phone, MapPin, Clock, User, Wrench, FileText, ShieldCheck, CheckCircle2, XCircle, Loader2, Play, CheckSquare, Upload } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { StatusBadge, SeverityBadge } from "@/components/Badges";
// import { PhaseTimeline } from "@/components/PhaseTimeline";
// import { phaseLabels, TicketStatus } from "@/data/mockData";
// import { useAuth } from "@/contexts/AuthContext";
// import { toast } from "sonner";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { complaintService, type Complaint } from "@/services/complaintService";
// import { supabase } from "@/lib/supabase";
// import SignatureCanvas from "react-signature-canvas";
// import browserImageCompression from "browser-image-compression";

// const ComplaintDetail = () => {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const queryClient = useQueryClient();
//   const { user, isRole } = useAuth();
//   const sigRef = useRef<SignatureCanvas>(null);

//   // Form states
//   const [verificationNote, setVerificationNote] = useState("");
//   const [resolutionNote, setResolutionNote] = useState("");
//   const [pirFindings, setPirFindings] = useState("");
//   const [pirAudioUrl, setPirAudioUrl] = useState("");
//   const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
//   const [showVerification, setShowVerification] = useState(false);
//   const [showResolution, setShowResolution] = useState(false);
//   const [showPIRForm, setShowPIRForm] = useState(false);
//   const [showSignOff, setShowSignOff] = useState(false);
//   const [currentUserFullName, setCurrentUserFullName] = useState("");
//   const [isUploading, setIsUploading] = useState(false);

//   // TESTING MODE: All emails go to your verified email
//   const TEST_EMAIL = "sm3129741@gmail.com";

//   // Fetch complaint from Supabase
//   const { data: ticket, isLoading, error } = useQuery({
//     queryKey: ['complaint', id],
//     queryFn: () => complaintService.getById(id!),
//     enabled: !!id && !!user,
//   });

//   // Fetch user's name
//   useEffect(() => {
//     if (user?.id) {
//       supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
//         .then(({ data }) => {
//           const name = (data as any)?.full_name || user.email?.split('@')[0] || '';
//           setCurrentUserFullName(name);
//         });
//     }
//   }, [user?.id]);

//   // Helper: Send email via Edge Function
//   const sendNotification = async (email: string, subject: string, message: string, ticketId?: string) => {
//     try {
//       console.log("📧 Sending email to:", email, "| Subject:", subject);
//       const { data, error } = await supabase.functions.invoke("send-notification", {
//         body: { email, subject, message, ticketId },
//       });
//       if (error) {
//         console.error("❌ Email send error:", error);
//         toast.error("Failed to send email");
//       } else {
//         console.log("✅ Email sent successfully!");
//         toast.success(`Email sent to ${email}`);
//       }
//     } catch (err) {
//       console.error("Failed to invoke function:", err);
//     }
//   };

//   // Helper: Upload file with compression
//   const uploadToSupabase = async (file: File, folder: string): Promise<string> => {
//     setIsUploading(true);
//     try {
//       if (file.type.startsWith('image/')) {
//         file = await browserImageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true });
//       }
//       const fileExt = file.name.split('.').pop();
//       const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
//       const { data, error } = await supabase.storage.from('complaint-media').upload(fileName, file);
//       if (error) throw error;
//       const { data: { publicUrl } } = supabase.storage.from('complaint-media').getPublicUrl(fileName);
//       return publicUrl;
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   // Helper: GPS Verification
//   const verifyGPS = async (): Promise<{ lat: number, lng: number, accuracy: number } | null> => {
//     return new Promise((resolve) => {
//       if (!navigator.geolocation) { resolve(null); return; }
//       navigator.geolocation.getCurrentPosition(
//         (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
//         () => resolve(null),
//         { enableHighAccuracy: true, timeout: 10000 }
//       );
//     });
//   };

//   // Mutation
//   const updateMutation = useMutation({
//     mutationFn: (updates: Partial<Complaint>) => complaintService.update(id!, updates),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['complaint', id] });
//       queryClient.invalidateQueries({ queryKey: ['complaints'] });
//       toast.success("Ticket updated!");
//     },
//     onError: (err: any) => toast.error(err.message || "Update failed"),
//   });

//   if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
//   if (error || !ticket) return <div className="text-center py-20"><p>Complaint not found.</p><Link to="/complaints" className="text-primary">Back</Link></div>;

//   const customerName = ticket.profiles?.full_name || ticket.customer_name || 'Unknown';
//   const supervisorName = ticket.assigned_supervisor;
//   const technicianName = ticket.assigned_technician;

//   const canVerify = isRole("admin", "supervisor") && ticket.status === "completed";
//   const canEdit = isRole("admin", "supervisor");
//   const isAssignedTechnician = currentUserFullName === technicianName;

//   //  FIXED: Technician can act in Phase 3, 4, AND 5
//   const canTechnicianAct = isRole("technician") && isAssignedTechnician &&
//     ticket.status !== "closed" &&
//     (ticket.current_phase === 3 || ticket.current_phase === 4 || ticket.current_phase === 5);

//   // ==========================================
//   // 🔥 WORKFLOW HANDLERS
//   // ==========================================

//   const handleTriageDecision = (outcome: 'remote_fixed' | 'field_required') => {
//     if (outcome === 'remote_fixed') {
//       sendNotification(TEST_EMAIL, "📞 Issue Resolved Remotely",
//         `Dear ${customerName},\n\nYour ticket #${ticket.id.slice(0, 8)} was resolved via phone by ${supervisorName}.`, ticket.id);
//       updateMutation.mutate({ status: 'completed', current_phase: 6, triage_outcome: outcome, resolution: 'Resolved remotely via telephonic triage.' });
//     } else {
//       sendNotification(TEST_EMAIL, "🚐 Field Visit Required",
//         `Ticket #${ticket.id.slice(0, 8)} requires field visit.`, ticket.id);
//       updateMutation.mutate({ status: 'assigned', current_phase: 2, triage_outcome: outcome, assignment_timestamp: new Date().toISOString() });
//     }
//   };

//   const handleStartJourney = async () => {
//     const gps = await verifyGPS();
//     sendNotification(TEST_EMAIL, " Journey Started",
//       `${currentUserFullName} started journey to #${ticket.id.slice(0, 8)}. GPS: ${gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Unknown'}`, ticket.id);
//     updateMutation.mutate({
//       status: "in-progress",
//       current_phase: 4,
//       start_journey_timestamp: new Date().toISOString(),
//       arrival_lat: gps?.lat || null,
//       arrival_lng: gps?.lng || null
//     });
//   };

//   const handleSubmitPIR = async () => {
//     if (!pirFindings.trim()) { toast.error("Add PIR findings"); return; }
//     sendNotification(TEST_EMAIL, "📋 PIR Submitted",
//       `${currentUserFullName} submitted PIR for #${ticket.id.slice(0, 8)}. Findings: ${pirFindings}`, ticket.id);
//     updateMutation.mutate({
//       pir_findings: pirFindings,
//       pir_audio_url: pirAudioUrl || null,
//       arrival_timestamp: new Date().toISOString()
//     });
//     setShowPIRForm(false);
//     toast.success("PIR submitted");
//   };

//   // 🔥 FIXED: Save Resolution and Show Sign Off Form
//   const handleSaveResolution = async () => {
//     if (!resolutionNote.trim()) {
//       toast.error("Please add resolution notes");
//       return;
//     }

//     // Save resolution to database (stay in Phase 4, in-progress)
//     await updateMutation.mutateAsync({
//       resolution: resolutionNote
//     });

//     // Show Sign Off form
//     setShowResolution(false);
//     setShowSignOff(true);
//     toast.success("Resolution saved! Now complete the sign-off.");
//   };

//   // 🔥 FIXED: Final Sign Off with Evidence and Signature
//   const handleFinalSignOff = async () => {
//     const signatureData = sigRef.current?.getCanvas().toDataURL('image/png');
//     let signatureUrl = null;
//     if (signatureData) {
//       const blob = await fetch(signatureData).then(res => res.blob());
//       signatureUrl = await uploadToSupabase(new File([blob], 'signature.png', { type: 'image/png' }), 'signatures');
//     }

//     sendNotification(TEST_EMAIL, "✅ Job Completed with Evidence",
//       `${currentUserFullName} completed #${ticket.id.slice(0, 8)}.\nResolution: ${resolutionNote}\nEvidence: ${evidenceUrls.length} files\nSignature: ${signatureUrl ? 'Captured' : 'N/A'}`, ticket.id);

//     updateMutation.mutate({
//       status: "completed",
//       current_phase: 5,
//       resolution: resolutionNote,
//       evidence_urls: evidenceUrls,
//       signature_url: signatureUrl,
//       signoff_timestamp: new Date().toISOString()
//     });

//     setShowSignOff(false);
//     toast.success("Job completed and signed off!");
//   };

//   const handleApprove = () => {
//     sendNotification(TEST_EMAIL, " Ticket Closed",
//       `Dear ${customerName},\n\nYour ticket #${ticket.id.slice(0, 8)} is resolved and closed.`, ticket.id);
//     updateMutation.mutate({ status: "closed", current_phase: 6 });
//     setShowVerification(false);
//   };

//   const handleReject = () => {
//     if (!verificationNote.trim()) { toast.error("Add reason"); return; }
//     sendNotification(TEST_EMAIL, "🔄 Rework Required",
//       `Ticket #${ticket.id.slice(0, 8)} sent back. Reason: ${verificationNote}`, ticket.id);
//     updateMutation.mutate({ status: "in-progress", current_phase: 4, resolution: `Rejected: ${verificationNote}` });
//     setShowVerification(false);
//   };

//   return (
//     <div className="space-y-6 max-w-4xl">
//       {/* Header */}
//       <div className="flex items-center gap-3">
//         <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80"><ArrowLeft className="w-4 h-4" /></button>
//         <div className="flex-1">
//           <div className="flex items-center gap-2 mb-0.5">
//             <span className="text-sm font-mono text-primary font-semibold">{ticket.id.slice(0, 8)}...</span>
//             {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
//             {ticket.status && <StatusBadge status={ticket.status} />}
//           </div>
//           <h1 className="text-xl font-display font-bold">{ticket.title}</h1>
//         </div>
//         <div className="flex gap-2">
//           {canVerify && <Button size="sm" variant="outline" className="border-warning text-warning" onClick={() => setShowVerification(!showVerification)}><ShieldCheck className="w-4 h-4 mr-2" /> Verify</Button>}
//           {canEdit && <Link to={`/complaints/${ticket.id}/edit`}><Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-2" /> Edit</Button></Link>}
//         </div>
//       </div>

//       {/* Phase 1: Supervisor Triage */}
//       {isRole("admin", "supervisor") && ticket.current_phase === 1 && (
//         <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
//           <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary"><Phone className="w-5 h-5" /> Phase 2: Telephonic Triage</h2>
//           <div className="bg-muted/50 p-4 rounded-lg space-y-3">
//             <div className="flex gap-2">
//               <Button variant="outline" className="flex-1 border-success text-success" onClick={() => handleTriageDecision('remote_fixed')}>
//                 <CheckCircle2 className="w-4 h-4 mr-2" /> 📞 Remote Fix
//               </Button>
//               <Button className="flex-1 gradient-primary" onClick={() => handleTriageDecision('field_required')}>
//                 <Wrench className="w-4 h-4 mr-2" />  Field Visit
//               </Button>
//             </div>
//           </div>
//         </motion.div>
//       )}

//       {/* Phase 2: Supervisor Dispatch */}
//       {isRole("admin", "supervisor") && ticket.current_phase === 2 && (
//         <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
//           <h2 className="font-semibold mb-3 flex items-center gap-2 text-warning"><Phone className="w-5 h-5" /> Phase 3: Dispatch</h2>
//           <div className="bg-muted/50 p-4 rounded-lg">
//             <Link to={`/complaints/${ticket.id}/edit`}>
//               <Button className="w-full"><Edit className="w-4 h-4 mr-2" /> Assign Technician & Dispatch</Button>
//             </Link>
//           </div>
//         </motion.div>
//       )}

//       {/* 🔥 Technician Actions */}
//       {canTechnicianAct && (
//         <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
//           <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary"><Wrench className="w-5 h-5" /> Technician Actions</h2>

//           {/* Phase 3: Start Journey */}
//           {ticket.current_phase === 3 && (ticket.status === "assigned" || ticket.status === "dispatched") && (
//             <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
//               <div>
//                 <p className="font-medium">Ready to start journey?</p>
//                 <p className="text-sm text-muted-foreground">GPS will verify your arrival.</p>
//               </div>
//               <Button onClick={handleStartJourney} className="gradient-primary" disabled={updateMutation.isPending}>
//                 {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
//                 Start Journey
//               </Button>
//             </div>
//           )}

//           {/* Phase 4: Submit PIR */}
//           {ticket.current_phase === 4 && ticket.status === "in-progress" && !showPIRForm && !showResolution && !showSignOff && (
//             <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
//               <div>
//                 <p className="font-medium">Submit Primary Information Report (PIR)</p>
//                 <p className="text-sm text-muted-foreground">Document your findings at the site.</p>
//               </div>
//               <Button onClick={() => setShowPIRForm(true)} variant="outline"><FileText className="w-4 h-4 mr-2" /> Submit PIR</Button>
//             </div>
//           )}

//           {/* PIR Form */}
//           {showPIRForm && (
//             <div className="bg-muted/50 p-4 rounded-lg space-y-3">
//               <label className="text-sm font-medium">PIR Findings *</label>
//               <Textarea value={pirFindings} onChange={e => setPirFindings(e.target.value)} placeholder="Describe field findings..." rows={3} />
//               <label className="text-sm font-medium">Audio Note (Optional)</label>
//               <input type="file" accept="audio/*" onChange={async (e) => {
//                 const file = e.target.files?.[0];
//                 if (file) { const url = await uploadToSupabase(file, 'pir-audio'); setPirAudioUrl(url); toast.success("Audio uploaded"); }
//               }} className="text-sm" />
//               <div className="flex gap-2 justify-end">
//                 <Button variant="outline" size="sm" onClick={() => setShowPIRForm(false)}>Cancel</Button>
//                 <Button size="sm" onClick={handleSubmitPIR} disabled={updateMutation.isPending}>
//                   {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
//                   Submit PIR
//                 </Button>
//               </div>
//             </div>
//           )}

//           {/* Phase 4: Add Resolution */}
//           {ticket.current_phase === 4 && ticket.status === "in-progress" && !showPIRForm && !showSignOff && (
//             <div className="space-y-3 bg-muted/50 p-4 rounded-lg mt-3">
//               {showResolution ? (
//                 <div className="space-y-2">
//                   <label className="text-sm font-medium">Resolution Notes *</label>
//                   <Textarea placeholder="Describe work done, parts replaced, tests performed..." value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} rows={3} />
//                   <div className="flex gap-2 justify-end">
//                     <Button variant="outline" size="sm" onClick={() => setShowResolution(false)}>Cancel</Button>
//                     <Button size="sm" onClick={handleSaveResolution} disabled={updateMutation.isPending} className="bg-primary text-primary-foreground">
//                       {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
//                       Save & Continue to Sign Off
//                     </Button>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <p className="font-medium">Job in progress</p>
//                     <p className="text-sm text-muted-foreground">Add resolution notes when work is done.</p>
//                   </div>
//                   <Button onClick={() => setShowResolution(true)} variant="outline"><CheckSquare className="w-4 h-4 mr-2" /> Add Resolution</Button>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* 🔥 Sign Off Form - Shows when showSignOff is true */}
//           {showSignOff && (
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               className="bg-muted/50 p-4 rounded-lg space-y-4 border-l-4 border-l-success mt-3"
//             >
//               <h3 className="font-semibold text-lg text-success flex items-center gap-2">
//                 <CheckCircle2 className="w-5 h-5" /> Final Sign-Off
//               </h3>
//               <p className="text-sm text-muted-foreground">Upload evidence and capture customer signature to complete the job.</p>

//               {/* Show saved resolution */}
//               {resolutionNote && (
//                 <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
//                   <p className="text-xs text-muted-foreground mb-1 font-medium">Resolution Notes</p>
//                   <p className="text-sm">{resolutionNote}</p>
//                 </div>
//               )}

//               {/* Evidence Upload */}
//               <div className="space-y-2">
//                 <label className="text-sm font-medium flex items-center gap-2">
//                   <Upload className="w-4 h-4" /> Upload Evidence (Photos/Videos)
//                 </label>
//                 <input
//                   type="file"
//                   multiple
//                   accept="image/*,video/*"
//                   onChange={async (e) => {
//                     const files = Array.from(e.target.files || []);
//                     const urls: string[] = [];
//                     for (const file of files) {
//                       try {
//                         const url = await uploadToSupabase(file, 'evidence');
//                         urls.push(url);
//                       } catch (err) {
//                         toast.error(`Failed to upload ${file.name}`);
//                       }
//                     }
//                     setEvidenceUrls(prev => [...prev, ...urls]);
//                     if (urls.length > 0) toast.success(`${urls.length} file(s) uploaded`);
//                   }}
//                   className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
//                   disabled={isUploading}
//                 />
//                 {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
//                 {evidenceUrls.length > 0 && (
//                   <div className="flex flex-wrap gap-2 mt-2">
//                     {evidenceUrls.map((url, i) => (
//                       <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded">
//                         Evidence {i + 1}
//                       </a>
//                     ))}
//                   </div>
//                 )}
//               </div>

//               {/* Digital Signature */}
//               <div className="space-y-2">
//                 <label className="text-sm font-medium">Customer Signature *</label>
//                 <div className="border-2 border-dashed rounded-lg p-2 bg-white">
//                   <SignatureCanvas
//                     ref={sigRef}
//                      canvasProps={{ width: '100%', height: 200, className: 'signature-canvas' }}
//                   />
//                 </div>
//                 <Button variant="ghost" size="sm" onClick={() => sigRef.current?.clear()} className="text-xs">
//                   Clear Signature
//                 </Button>
//               </div>

//               {/* Finalize Button */}
//               <div className="flex gap-2 justify-end pt-2 border-t">
//                 <Button variant="outline" size="sm" onClick={() => setShowSignOff(false)}>
//                   Cancel
//                 </Button>
//                 <Button
//                   size="sm"
//                   onClick={handleFinalSignOff}
//                   disabled={updateMutation.isPending}
//                   className="bg-success hover:bg-success/90 text-success-foreground"
//                 >
//                   {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
//                   Finalize & Complete Job
//                 </Button>
//               </div>
//             </motion.div>
//           )}

//           {/* Message if technician can't act yet */}
//           {ticket.current_phase < 3 && (
//             <div className="bg-muted/50 p-4 rounded-lg text-center">
//               <p className="text-sm text-muted-foreground">⏳ Waiting for supervisor to dispatch this ticket.</p>
//             </div>
//           )}
//         </motion.div>
//       )}

//       {/* Verification Panel (Phase 6) */}
//       {showVerification && canVerify && (
//         <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
//           <h2 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-warning" /> Verification</h2>
//           {ticket.resolution && <div className="p-3 rounded-lg bg-success/10 border border-success/20 mb-4"><p className="text-xs text-muted-foreground mb-1">Resolution</p><p className="text-sm">{ticket.resolution}</p></div>}
//           {ticket.evidence_urls && ticket.evidence_urls.length > 0 && (
//             <div className="p-3 rounded-lg bg-muted/50 mb-4">
//               <p className="text-xs text-muted-foreground mb-1">Evidence ({ticket.evidence_urls.length})</p>
//               <div className="flex flex-wrap gap-2">
//                 {ticket.evidence_urls.map((url: string, i: number) => (
//                   <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View {i + 1}</a>
//                 ))}
//               </div>
//             </div>
//           )}
//           {ticket.signature_url && (
//             <div className="p-3 rounded-lg bg-muted/50 mb-4">
//               <p className="text-xs text-muted-foreground mb-1">Customer Signature</p>
//               <img src={ticket.signature_url} alt="Signature" className="max-w-xs border rounded" />
//             </div>
//           )}
//           <Textarea placeholder="Verification notes..." value={verificationNote} onChange={e => setVerificationNote(e.target.value)} rows={2} />
//           <div className="flex gap-3 mt-3">
//             <Button onClick={handleApprove} className="bg-success text-success-foreground"><CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Close</Button>
//             <Button variant="outline" onClick={handleReject} className="border-destructive text-destructive"><XCircle className="w-4 h-4 mr-2" /> Reject & Rework</Button>
//           </div>
//         </motion.div>
//       )}

//       {/* Timeline & Details */}
//       <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
//         <h2 className="font-semibold mb-5">Phase {ticket.current_phase}: {phaseLabels[ticket.current_phase as keyof typeof phaseLabels]}</h2>
//         <PhaseTimeline currentPhase={ticket.current_phase as any || 1} />
//       </motion.div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
//           <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Details</h2>
//           <div className="space-y-3 text-sm">
//             <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium ml-2">{customerName}</span></div>
//             {ticket.location && <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-muted-foreground" /> <span>{ticket.location}</span></div>}
//             <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Created {new Date(ticket.created_at).toLocaleString()}</div>
//           </div>
//         </motion.div>

//         <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
//           <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Team</h2>
//           {supervisorName && <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"><div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center text-xs font-bold">{supervisorName.charAt(0)}</div><div><p className="font-medium text-sm">{supervisorName}</p><p className="text-xs text-muted-foreground">Supervisor</p></div></div>}
//           {technicianName ? <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"><div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-xs font-bold">{technicianName.charAt(0)}</div><div><p className="font-medium text-sm">{technicianName}</p><p className="text-xs text-muted-foreground">Technician</p></div></div> : <p className="text-sm text-muted-foreground italic">No technician assigned</p>}
//         </motion.div>
//       </div>
//     </div>
//   );
// };

// export default ComplaintDetail;

import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Phone, MapPin, Clock, User, Wrench, FileText, ShieldCheck, CheckCircle2, XCircle, Loader2, Play, CheckSquare, Upload, PenTool, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { saveOfflineDraft, syncOfflineDrafts, getOfflineDraft } from '@/lib/offlineStorage';

// 🔥 Signature mode type
type SignatureMode = "draw" | "upload";

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isRole } = useAuth();
  const sigRef = useRef<SignatureCanvas>(null);
  const channelRef = useRef<any>(null);

  // 🔥 Signature states
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string | null>(null);
  const [uploadedSignaturePreview, setUploadedSignaturePreview] = useState<string | null>(null);

  // Form states
  const [verificationNote, setVerificationNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [pirFindings, setPirFindings] = useState("");
  const [pirAudioUrl, setPirAudioUrl] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [showVerification, setShowVerification] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [showPIRForm, setShowPIRForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [currentUserFullName, setCurrentUserFullName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);

  const TEST_EMAIL = "sm3129741@gmail.com";

  // Fetch complaint from Supabase
  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintService.getById(id!),
    enabled: !!id && !!user,
  });

  // Fetch user's name
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name, role, phone').eq('id', user.id).single()
        .then(({ data }) => {
          const name = (data as any)?.full_name || user.email?.split('@')[0] || '';
          setCurrentUserFullName(name);
        });
    }
  }, [user?.id]);

  // Fetch customer phone number
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
          evidence_urls: evidenceUrls,
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
          if (draft.evidence_urls) setEvidenceUrls(draft.evidence_urls);
          toast.info('Restored offline draft');
        }
      }
    };

    loadDraft();
  }, [id]);

  // OFFLINE STORAGE - Sync when coming back online
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

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    if (!id) return;

    console.log(`📡 Setting up realtime subscription for complaint: ${id}`);

    const channel = supabase
      .channel(`complaint-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaints',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('🔄 Realtime update received:', payload);

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
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [id, queryClient]);

  // Helper: Send email via Edge Function
  const sendNotification = async (email: string, subject: string, message: string, ticketId?: string) => {
    try {
      console.log(" Sending email to:", email, "| Subject:", subject);
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: { email, subject, message, ticketId },
      });
      if (error) {
        console.error("❌ Email send error:", error);
        toast.error("Failed to send email");
      } else {
        console.log("✅ Email sent successfully!");
        toast.success(`Email sent to ${email}`);
      }
    } catch (err) {
      console.error("Failed to invoke function:", err);
      toast.error("Failed to send email");
    }
  };

  // Helper: Upload file with compression
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

      if (file.type.startsWith('video/')) {
        const sizeMB = file.size / 1024 / 1024;
        if (sizeMB > 50) {
          toast.warning(`Video is ${sizeMB.toFixed(1)}MB. Large videos may take time to upload.`);
        } else {
          console.log(`Uploading video (${sizeMB.toFixed(1)}MB)...`);
        }
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
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Helper: GPS Verification
  const verifyGPS = async (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Mutation
  const updateMutation = useMutation({
    mutationFn: (updates: any) => complaintService.update(id!, updates),
    onSuccess: () => {
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

  const canVerify = isRole("admin", "supervisor") && ticket.status === "completed";
  const canEdit = isRole("admin", "supervisor");
  const isAssignedTechnician = currentUserFullName === technicianName;

  const canTechnicianAct = isRole("technician") && isAssignedTechnician &&
    ticket.status !== "closed" &&
    (ticket.current_phase === 3 || ticket.current_phase === 4 || ticket.current_phase === 5);

  // Handler functions
  const handleTriageDecision = (outcome: 'remote_fixed' | 'field_required') => {
    if (outcome === 'remote_fixed') {
      sendNotification(TEST_EMAIL, "📞 Issue Resolved Remotely",
        `Dear ${customerName},\n\nYour ticket #${ticket.id.slice(0, 8)} was resolved via phone by ${supervisorName}.`, ticket.id);
      updateMutation.mutate({
        status: 'completed',
        current_phase: 6,
        triage_outcome: outcome,
        resolution: 'Resolved remotely via telephonic triage.'
      } as any);
    } else {
      sendNotification(TEST_EMAIL, "🚐 Field Visit Required",
        `Ticket #${ticket.id.slice(0, 8)} requires field visit.`, ticket.id);
      updateMutation.mutate({
        status: 'assigned',
        current_phase: 2,
        triage_outcome: outcome,
        assignment_timestamp: new Date().toISOString()
      } as any);
    }
  };

  const handleStartJourney = async () => {
    const gps = await verifyGPS();
    sendNotification(TEST_EMAIL, "🚀 Journey Started",
      `${currentUserFullName} started journey to #${ticket.id.slice(0, 8)}. GPS: ${gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Unknown'}`, ticket.id);
    updateMutation.mutate({
      status: "in-progress",
      current_phase: 4,
      start_journey_timestamp: new Date().toISOString(),
      arrival_lat: gps?.lat || null,
      arrival_lng: gps?.lng || null
    } as any);
  };

  const handleSubmitPIR = async () => {
    if (!pirFindings.trim()) {
      toast.error("Add PIR findings");
      return;
    }
    sendNotification(TEST_EMAIL, "📋 PIR Submitted",
      `${currentUserFullName} submitted PIR for #${ticket.id.slice(0, 8)}. Findings: ${pirFindings}`, ticket.id);
    updateMutation.mutate({
      pir_findings: pirFindings,
      pir_audio_url: pirAudioUrl || null,
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

    await updateMutation.mutateAsync({
      resolution: resolutionNote
    } as any);

    setShowResolution(false);
    setShowSignOff(true);
    toast.success("Resolution saved! Now complete the sign-off.");
  };

  // 🔥 Handle signature upload
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (PNG, JPG, JPEG)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Signature image must be less than 5MB");
      return;
    }

    try {
      // Show preview
      const previewUrl = URL.createObjectURL(file);
      setUploadedSignaturePreview(previewUrl);

      // Upload to Supabase
      const url = await uploadToSupabase(file, 'signatures');
      setUploadedSignatureUrl(url);
      toast.success("Signature uploaded successfully!");
    } catch (err) {
      console.error('Signature upload failed:', err);
      toast.error("Failed to upload signature");
      setUploadedSignaturePreview(null);
    }
  };

  // 🔥 Clear uploaded signature
  const clearUploadedSignature = () => {
    setUploadedSignatureUrl(null);
    setUploadedSignaturePreview(null);
    toast.info("Uploaded signature cleared");
  };

  // 🔥 Handle final sign-off with dual signature options
  const handleFinalSignOff = async () => {
    let signatureUrl = null;

    // 🔥 Get signature based on selected mode
    if (signatureMode === "draw") {
      // Draw mode: Get from canvas
      const signatureData = sigRef.current?.getCanvas().toDataURL('image/png');
      if (signatureData) {
        const blob = await fetch(signatureData).then(res => res.blob());
        signatureUrl = await uploadToSupabase(new File([blob], 'signature.png', { type: 'image/png' }), 'signatures');
      }
    } else if (signatureMode === "upload") {
      // Upload mode: Use uploaded signature
      signatureUrl = uploadedSignatureUrl;
    }

    // Validate that at least one signature is provided
    if (!signatureUrl) {
      toast.error("Please provide a customer signature (draw or upload)");
      return;
    }

    sendNotification(TEST_EMAIL, "✅ Job Completed with Evidence",
      `${currentUserFullName} completed #${ticket.id.slice(0, 8)}.\nResolution: ${resolutionNote}\nEvidence: ${evidenceUrls.length} files\nSignature: Captured (${signatureMode})`, ticket.id);

    updateMutation.mutate({
      status: "completed",
      current_phase: 5,
      resolution: resolutionNote,
      evidence_urls: evidenceUrls,
      signature_url: signatureUrl,
      signoff_timestamp: new Date().toISOString()
    } as any);

    setShowSignOff(false);
    toast.success("Job completed and signed off!");
  };

  const handleApprove = () => {
    sendNotification(TEST_EMAIL, "🎉 Ticket Closed",
      `Dear ${customerName},\n\nYour ticket #${ticket.id.slice(0, 8)} is resolved and closed.`, ticket.id);
    updateMutation.mutate({ status: "closed", current_phase: 6 } as any);
    setShowVerification(false);
  };

  const handleReject = () => {
    if (!verificationNote.trim()) {
      toast.error("Add reason");
      return;
    }
    sendNotification(TEST_EMAIL, " Rework Required",
      `Ticket #${ticket.id.slice(0, 8)} sent back. Reason: ${verificationNote}`, ticket.id);
    updateMutation.mutate({
      status: "in-progress",
      current_phase: 4,
      resolution: `Rejected: ${verificationNote}`
    } as any);
    setShowVerification(false);
  };

  const handleCallCustomer = () => {
    if (customerPhone) {
      window.location.href = `tel:${customerPhone}`;
    } else {
      toast.error("No phone number available for this customer");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-primary font-semibold">{ticket.id.slice(0, 8)}...</span>
            {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
            {ticket.status && <StatusBadge status={ticket.status} />}
          </div>
          <h1 className="text-xl font-display font-bold">{ticket.title}</h1>
        </div>
        <div className="flex gap-2">
          {canVerify && (
            <Button size="sm" variant="outline" className="border-warning text-warning" onClick={() => setShowVerification(!showVerification)}>
              <ShieldCheck className="w-4 h-4 mr-2" /> Verify
            </Button>
          )}
          {canEdit && (
            <Link to={`/complaints/${ticket.id}/edit`}>
              <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Phase 1: Supervisor Triage */}
      {isRole("admin", "supervisor") && ticket.current_phase === 1 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary"><Phone className="w-5 h-5" /> Phase 2: Telephonic Triage</h2>
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-success text-success" onClick={() => handleTriageDecision('remote_fixed')}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> 📞 Remote Fix
              </Button>
              <Button className="flex-1 gradient-primary" onClick={() => handleTriageDecision('field_required')}>
                <Wrench className="w-4 h-4 mr-2" />  Field Visit
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 2: Supervisor Dispatch */}
      {isRole("admin", "supervisor") && ticket.current_phase === 2 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-warning"><Phone className="w-5 h-5" /> Phase 3: Dispatch</h2>
          <div className="bg-muted/50 p-4 rounded-lg">
            <Link to={`/complaints/${ticket.id}/edit`}>
              <Button className="w-full"><Edit className="w-4 h-4 mr-2" /> Assign Technician & Dispatch</Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Technician Actions */}
      {canTechnicianAct && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-primary">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-primary"><Wrench className="w-5 h-5" /> Technician Actions</h2>

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

          {/* PIR Form */}
          {showPIRForm && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <label className="text-sm font-medium">PIR Findings *</label>
              <Textarea value={pirFindings} onChange={e => setPirFindings(e.target.value)} placeholder="Describe field findings..." rows={3} />
              <label className="text-sm font-medium">Audio Note (Optional)</label>
              <input type="file" accept="audio/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = await uploadToSupabase(file, 'pir-audio');
                  setPirAudioUrl(url);
                  toast.success("Audio uploaded");
                }
              }} className="text-sm" />
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

          {/* 🔥 Sign Off Form - WITH DUAL SIGNATURE OPTIONS */}
          {showSignOff && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-muted/50 p-4 rounded-lg space-y-4 border-l-4 border-l-success mt-3"
            >
              <h3 className="font-semibold text-lg text-success flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Final Sign-Off
              </h3>
              <p className="text-sm text-muted-foreground">Upload evidence and capture customer signature to complete the job.</p>

              {/* Show saved resolution */}
              {resolutionNote && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Resolution Notes</p>
                  <p className="text-sm">{resolutionNote}</p>
                </div>
              )}

              {/* Evidence Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload Evidence (Photos/Videos)
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
                  disabled={isUploading}
                />
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

              {/* 🔥 Customer Signature - DUAL OPTIONS (Draw OR Upload) */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Customer Signature *</label>

                {/* 🔥 Mode Toggle Tabs */}
                <div className="flex gap-2 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setSignatureMode("draw")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${signatureMode === "draw"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <PenTool className="w-4 h-4" />
                    Draw Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureMode("upload")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${signatureMode === "upload"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload Signature
                  </button>
                </div>

                {/* 🔥 Option 1: Draw Signature */}
                {signatureMode === "draw" && (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-primary/50 rounded-lg p-2 bg-white w-full overflow-hidden">
                      <SignatureCanvas
                        ref={sigRef}
                        penColor="black"
                        canvasProps={{
                          width: 750,
                          height: 150,
                          className: 'signature-canvas rounded'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sigRef.current?.clear()}
                        className="text-xs"
                      >
                        Clear Signature
                      </Button>
                    </div>
                  </div>
                )}

                {/* 🔥 Option 2: Upload Signature */}
                {signatureMode === "upload" && (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-primary/50 rounded-lg p-4 bg-white">
                      {uploadedSignaturePreview ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <img
                              src={uploadedSignaturePreview}
                              alt="Uploaded Signature Preview"
                              className="max-h-32 border rounded bg-gray-50"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-success font-medium">
                              ✅ Signature uploaded successfully
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearUploadedSignature}
                              className="text-xs text-destructive"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground mb-3">
                            Upload customer's signature image
                          </p>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg"
                            onChange={handleSignatureUpload}
                            disabled={isUploading}
                            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Supported: PNG, JPG, JPEG (Max 5MB)
                          </p>
                        </div>
                      )}
                    </div>
                    {isUploading && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading signature...
                      </p>
                    )}
                  </div>
                )}


              </div>

              {/* Finalize Button */}
              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowSignOff(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleFinalSignOff}
                  disabled={updateMutation.isPending}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Finalize & Complete Job
                </Button>
              </div>
            </motion.div>
          )}

          {/* Message if technician can't act yet */}
          {ticket.current_phase < 3 && (
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">⏳ Waiting for supervisor to dispatch this ticket.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Verification Panel (Phase 6) */}
      {showVerification && canVerify && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-warning" /> Verification</h2>
          {ticket.resolution && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Resolution</p>
              <p className="text-sm">{ticket.resolution}</p>
            </div>
          )}
          {ticket.evidence_urls && ticket.evidence_urls.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Evidence ({ticket.evidence_urls.length})</p>
              <div className="flex flex-wrap gap-2">
                {ticket.evidence_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View {i + 1}</a>
                ))}
              </div>
            </div>
          )}
          {ticket.signature_url && (
            <div className="p-3 rounded-lg bg-muted/50 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Customer Signature</p>
              <img src={ticket.signature_url} alt="Signature" className="max-w-xs border rounded" />
            </div>
          )}
          <Textarea placeholder="Verification notes..." value={verificationNote} onChange={e => setVerificationNote(e.target.value)} rows={2} />
          <div className="flex gap-3 mt-3">
            <Button onClick={handleApprove} className="bg-success text-success-foreground"><CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Close</Button>
            <Button variant="outline" onClick={handleReject} className="border-destructive text-destructive"><XCircle className="w-4 h-4 mr-2" /> Reject & Rework</Button>
          </div>
        </motion.div>
      )}

      {/* Timeline & Details */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <h2 className="font-semibold mb-5">Phase {ticket.current_phase}: {phaseLabels[ticket.current_phase as keyof typeof phaseLabels]}</h2>
        <PhaseTimeline currentPhase={ticket.current_phase as any || 1} />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details Section */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Details</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium ml-2">{customerName}</span>
            </div>

            {/* Click-to-Call Phone Number */}
            {customerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <a href={`tel:${customerPhone}`} className="text-primary hover:underline font-medium">
                  {customerPhone}
                </a>
                <Button variant="outline" size="sm" onClick={handleCallCustomer} className="ml-auto">
                  <Phone className="w-3 h-3 mr-1" /> Call
                </Button>
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
            <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Created {new Date(ticket.created_at).toLocaleString()}</div>
            <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Updated {new Date(ticket.updated_at).toLocaleString()}</div>
          </div>
        </motion.div>

        {/* Team Section */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Assigned Team</h2>

          {/* Supervisor */}
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

          {/* Technician */}
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
  );
};

export default ComplaintDetail;
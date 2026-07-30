import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ClipboardList, Users, AlertTriangle, ArrowRight, Clock, ShieldCheck, Loader2, X, Mail, Phone, Wrench, Shield } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

const formatIndianDateTime = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    let normalized = dateString;
    if (normalized.includes(" ")) {
      normalized = normalized.replace(" ", "T");
    }
    return new Date(normalized).toLocaleString("en-IN", {
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

const SupervisorDashboard = () => {
  const { user } = useAuth();
  const [supervisorName, setSupervisorName] = useState(user?.name || "");
  const [supervisorExpertise, setSupervisorExpertise] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<any | null>(null);

  // Fetch Current Supervisor details
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name, expertise').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.full_name) setSupervisorName(data.full_name);
          if (data?.expertise) setSupervisorExpertise(data.expertise);
        });
    }
  }, [user]);

  // Fetch Complaints
  const { data: allComplaints, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['complaints-dashboard'],
    queryFn: () => complaintService.getAll(),
  });

  // Fetch Technicians
  const { data: allTechnicians, isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'technician');
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
    }
  });

  if (isLoadingComplaints || isLoadingTechnicians) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // Filter Logic using Real Data
  const myTickets = allComplaints?.filter((t) => t.assigned_supervisor === supervisorName) || [];
  const pendingVerification = myTickets.filter((t) => t.status === "completed" || t.status === "pir_pending");
  const activeTickets = myTickets.filter((t) => !["completed", "closed"].includes(t.status));
  const urgentTickets = myTickets.filter((t) => t.severity === "major" && t.status !== "closed");

  // Filter technicians based on expertise overlap or general category
  const myTechnicians = (allTechnicians || []).filter((tech: any) => {
    if (!tech.expertise || tech.expertise.trim() === "" || tech.expertise.toLowerCase().includes("general")) {
      return true; // General technician
    }
    if (!supervisorExpertise) {
      return false; // Supervisor has no expertise to match
    }
    const supFields = supervisorExpertise.split(",").map(f => f.trim().toLowerCase()).filter(Boolean);
    const techFields = tech.expertise.split(",").map(f => f.trim().toLowerCase()).filter(Boolean);
    return techFields.some(tf => supFields.includes(tf));
  });

  const getGreetingText = () => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 17) {
      timeGreeting = "Good evening";
    }
    return `${timeGreeting}, ${supervisorName || user?.name || "Supervisor"}! 👋`;
  };

  return (
    <div className="space-y-8 relative">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-10 right-10 bg-primary/10" />
      <div className="bg-ambient-blur bottom-20 left-20 bg-amber-500/10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6 relative z-10">
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-3.5 w-fit uppercase tracking-wider shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            System Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-slate-900 break-words leading-tight">{getGreetingText()}</h1>
          <p className="text-slate-500 text-[13px] font-medium mt-2 max-w-3xl leading-relaxed">
            Welcome to your smart tracking dashboard. Monitor live field complaints, manage scheduled service tasks, download system metrics, and track updates dynamically.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
        <StatCard label="My Active Tickets" value={activeTickets.length} icon={ClipboardList} gradient="primary" delay={0} />
        <StatCard label="Urgent Issues" value={urgentTickets.length} icon={AlertTriangle} gradient="warm" delay={0.05} />
        <StatCard label="Pending Verification" value={pendingVerification.length} icon={ShieldCheck} gradient="cool" delay={0.1} />
        <StatCard label="My Technicians" value={myTechnicians.length} icon={Users} gradient="primary" delay={0.15} />
      </div>

      {/* Pending Verification */}
      {pendingVerification.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-6 border-l-4 border-l-amber-500 relative z-10 shadow-glow bg-amber-500/5"
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
            <h2 className="font-display font-extrabold text-lg tracking-tight">Awaiting Your Verification</h2>
          </div>
          <div className="space-y-3">
            {pendingVerification.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-amber-500/20 bg-card hover:bg-amber-500/10 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-600">FSM-{t.id.slice(0, 4).toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="font-bold text-sm text-foreground truncate max-w-[200px] sm:max-w-[400px] inline-block" title={t.title}>{t.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.status === "pir_pending" ? (
                      <>PIR submitted by <span className="font-semibold text-foreground">{t.assigned_technician || 'Technician'}</span> — pending approval</>
                    ) : (
                      <>Completed by <span className="font-semibold text-foreground">{t.assigned_technician || 'Technician'}</span></>
                    )} • Customer: <span className="font-semibold text-primary">{t.customer_name || t.profiles?.full_name || t.created_by_name || 'Customer'}</span>
                  </p>
                </div>
                <Link to={`/complaints/${t.id}`} className="shrink-0 self-end sm:self-auto">
                  <Button size="sm" className="gradient-primary text-white text-xs font-bold rounded-lg h-9 shadow-sm">
                    {t.status === "pir_pending" ? "Review & Approve PIR" : "Review & Verify"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Tickets */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card rounded-2xl p-6 border border-border/60 relative z-10"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-0.5">
            <h2 className="font-display font-extrabold text-lg tracking-tight">Active Team Workload</h2>
            <p className="text-xs text-muted-foreground">Complaints currently assigned under your supervision.</p>
          </div>
          <Link to="/complaints" className="text-xs text-primary font-bold hover:underline flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-3.5">
          {activeTickets.length > 0 ? (
            activeTickets.map((t) => (
              <Link
                key={t.id}
                to={`/complaints/${t.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 hover:border-primary/20 bg-card hover:bg-muted/10 transition-all group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-primary">FSM-{t.id.slice(0, 4).toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    {t.severity && <SeverityBadge severity={t.severity as any} />}
                    {t.status && <StatusBadge status={t.status} />}
                  </div>
                  <p className="font-bold text-sm text-foreground truncate mt-1 group-hover:text-primary transition-colors" title={t.title}>{t.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
                    <span>Customer: <span className="font-semibold text-primary">{t.customer_name || t.profiles?.full_name || t.created_by_name || 'Customer'}</span></span>
                    <span>•</span>
                    <span>Tech: <span className="font-semibold text-indigo-600">{t.assigned_technician || "Unassigned"}</span></span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Updated {new Date(t.updated_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No active complaints under your scope.</p>
          )}
        </div>
      </motion.div>

      {/* My Technicians */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-6 border border-border/60 relative z-10"
      >
        <div className="space-y-0.5 mb-5">
          <h2 className="font-display font-extrabold text-lg tracking-tight">Assigned Field Technicians</h2>
          <p className="text-xs text-muted-foreground">Technicians qualified for your work specialties or general duties.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myTechnicians.map((m: any) => (
            <div
              key={m.id}
              onClick={() => setSelectedTech(m)}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-card hover:bg-muted/10 transition-all group cursor-pointer hover:border-primary/20"
            >
              <div className="w-11 h-11 rounded-xl gradient-warm flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 transition-transform group-hover:scale-105">
                {m.full_name?.charAt(0) || 'T'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{m.full_name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.expertise?.split(",").slice(0, 2).map((exp: string) => (
                    <span key={exp} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize truncate max-w-[80px]">
                      {exp.trim()}
                    </span>
                  )) || <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">General</span>}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <div className={`w-2.5 h-2.5 rounded-full ${m.available ? "bg-success" : "bg-muted-foreground"}`} />
                <span className="text-[10px] font-semibold text-muted-foreground capitalize">{m.available ? "Ready" : "On duty"}</span>
              </div>
            </div>
          ))}
          {myTechnicians.length === 0 && (
            <div className="col-span-full py-8 text-center glass-card rounded-xl">
              <p className="text-sm text-muted-foreground">No field technicians mapped to your profile.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Technician Details Modal */}
      <AnimatePresence>
        {selectedTech && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-md w-full rounded-2xl p-6 relative flex flex-col gap-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedTech(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase bg-amber-500 shadow-sm shrink-0">
                  {selectedTech.full_name?.charAt(0) || selectedTech.email?.charAt(0).toUpperCase() || 'T'}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-800">{selectedTech.full_name || "No Name"}</h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block mt-1 bg-amber-50 border border-amber-200 text-amber-600">
                    {selectedTech.role}
                  </span>
                </div>
              </div>

              {/* Details Body */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Email Address</span>
                    <span className="block truncate font-medium">{selectedTech.email || "N/A"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Phone Contact</span>
                    <span className="font-semibold">{selectedTech.phone || "Not provided"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Availability Status</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${selectedTech.available ? "bg-success" : "bg-muted-foreground"}`} />
                      <span className="font-medium capitalize">{selectedTech.available ? "Ready (Available for dispatch)" : "Busy (On active duty)"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-150">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Expertise / Specialties</span>
                  {selectedTech.expertise ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTech.expertise.split(",").map((exp: string) => (
                        <span key={exp} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-muted border border-slate-200 text-slate-700 rounded-full">
                          <Wrench className="w-3 h-3 text-primary" /> {exp.trim()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">General / Unspecified</span>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-2 border-t pt-4 flex justify-end">
                <Button 
                  onClick={() => setSelectedTech(null)}
                  className="gradient-primary text-white text-xs font-bold rounded-xl px-4 py-2"
                >
                  Close Details
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupervisorDashboard;
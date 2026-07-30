import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { MapPin, Clock, CheckCircle2, AlertTriangle, Wrench, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const formatIndianDateTime = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    let normalized = dateString;
    if (
      typeof dateString === "string" &&
      !dateString.endsWith("Z") &&
      !/[+-]\d{2}:\d{2}$/.test(dateString)
    ) {
      normalized = `${dateString}Z`;
    }
    return new Date(normalized).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
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

const phaseLabels: Record<number, string> = {
  1: "Ticket Registered",
  2: "Supervisor Triage",
  3: "Technician Dispatch",
  4: "Service Journey Started",
  5: "Customer Signature / PIR",
  6: "Final Ticket Sign-off"
};

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed" | "closed">("active");

  // Fetch technician profile to get full name
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const technicianName = userProfile?.full_name || user?.email?.split("@")[0];

  // Fetch complaints
  const { data: allComplaints, isLoading } = useQuery({
    queryKey: ["technician-complaints", technicianName],
    queryFn: async () => {
      if (!technicianName) return [];
      const data = await complaintService.getAll();
      return data.filter(c => c.assigned_technician === technicianName);
    },
    enabled: !!technicianName,
  });

  // Filter based on active tab
  const filteredComplaints = allComplaints?.filter((c) => {
    if (activeTab === "active") return c.status !== "pending_verification" && c.status !== "closed";
    if (activeTab === "completed") return c.status === "pending_verification";
    if (activeTab === "closed") return c.status === "closed";
    return true;
  }) || [];

  // Calculate Stats
  const activeJobsCount = allComplaints?.filter(c => c.status !== "pending_verification" && c.status !== "closed").length || 0;
  const urgentJobsCount = allComplaints?.filter(c => (c.priority === "high" || c.priority === "urgent") && c.status !== "pending_verification" && c.status !== "closed").length || 0;
  const completedJobsCount = allComplaints?.filter(c => c.status === "pending_verification" || c.status === "closed").length || 0;

  const getGreetingText = () => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 17) {
      timeGreeting = "Good evening";
    }
    return `${timeGreeting}, ${technicianName || "Technician"}! 👋`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2.5 font-medium text-muted-foreground">Loading job queues...</span>
      </div>
    );
  }

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
            Welcome to your field service queue. View your active tasks, update completion phases, and coordinate resolutions.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 relative z-10">
        <StatCard label="Active Work Orders" value={activeJobsCount} icon={Wrench} gradient="primary" delay={0} />
        <StatCard label="Urgent Actions" value={urgentJobsCount} icon={AlertTriangle} gradient="warm" delay={0.05} />
        <StatCard label="Completed Orders" value={completedJobsCount} icon={CheckCircle2} gradient="cool" delay={0.1} />
      </div>

      {/* Segmented Filter Switcher */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/65 max-w-md border border-border/40 relative z-10">
        {(["active", "completed", "closed", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-center py-2 text-xs font-bold capitalize rounded-lg transition-all ${
              activeTab === tab
                ? "bg-card text-foreground shadow-sm border border-border/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Job List */}
      <div className="space-y-4 relative z-10">
        <AnimatePresence mode="wait">
          {filteredComplaints.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 glass-card rounded-2xl border border-border/60"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-pulse" />
              <p className="font-bold text-foreground">All Clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No jobs match the selected filter category.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filteredComplaints.map((ticket, i) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-2xl p-6 border border-border/60 hover:border-primary/20 hover:shadow-glow transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left Info */}
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-primary">FSM-{ticket.id.slice(0, 4).toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <SeverityBadge severity={ticket.severity as any} />
                        <StatusBadge status={ticket.status} />
                      </div>

                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate" title={ticket.title}>{ticket.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>Customer: <span className="font-semibold text-foreground">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || 'Customer'}</span></span>
                        {ticket.assigned_supervisor && (
                          <>
                            <span>•</span>
                            <span>Supervisor: <span className="font-semibold text-indigo-600">{ticket.assigned_supervisor}</span></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Raised on {formatIndianDateTime(ticket.created_at)}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1.5 border-t border-border/20">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {ticket.location || "No Address Captured"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Updated {new Date(ticket.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Right Action/Progress */}
                    <div className="flex flex-col items-stretch lg:items-end justify-between gap-4 shrink-0 lg:min-w-[240px] p-4 rounded-xl bg-muted/30 border border-border/30">
                      <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                          <span className="text-muted-foreground">Completion Progress</span>
                          <span className="text-primary">
                            {ticket.status === "pending_verification" || ticket.status === "closed" ? 100 : Math.round((ticket.current_phase || 1) * (100 / 6))}%
                          </span>
                        </div>
                        <Progress value={ticket.status === "pending_verification" || ticket.status === "closed" ? 100 : (ticket.current_phase || 1) * (100 / 6)} className="h-2 bg-muted/65" />
                        <p className="text-[10px] text-muted-foreground truncate font-semibold italic text-center lg:text-right">
                          {ticket.status === "pending_verification" || ticket.status === "closed" ? "Ticket Signed-off" : (phaseLabels[ticket.current_phase || 1] || "Phase Active")}
                        </p>
                      </div>

                      <Link to={`/complaints/${ticket.id}`} className="w-full">
                        <Button size="sm" className="w-full gradient-primary text-white font-bold rounded-lg h-9 shadow-sm hover:opacity-95">
                          View Work Order <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TechnicianDashboard;
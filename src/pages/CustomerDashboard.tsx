import { motion as m } from "framer-motion";
import { Zap, Plus, ShieldCheck, Clock, CheckCircle2, AlertCircle, FileText, ArrowRight, Loader2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { complaintService, formatComplaintTicketId } from "@/services/complaintService";
import { StatusBadge } from "@/components/Badges";

const CustomerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getGreetingText = () => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 17) {
      timeGreeting = "Good evening";
    }
    return `${timeGreeting}, ${user?.name || "Valued Customer"}! 👋`;
  };

  // Fetch customer's complaints
  const { data: myComplaints = [], isLoading } = useQuery({
    queryKey: ["customer-dashboard-complaints", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: custRec } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const custTableId = custRec?.id;

      const all = await complaintService.getAll();
      return all.filter((t: any) =>
        t.customer_id === user.id ||
        (custTableId && t.customer_id === custTableId) ||
        (user.email && t.customer_email?.toLowerCase() === user.email.toLowerCase())
      );
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  const activeComplaints = myComplaints.filter(
    (c: any) => c.status !== "closed" && c.status !== "verified"
  );
  const resolvedComplaints = myComplaints.filter(
    (c: any) => c.status === "closed" || c.status === "verified"
  );

  return (
    <div className="space-y-6 relative max-w-5xl mx-auto py-2 pb-12">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10 pointer-events-none" />
      <div className="bg-ambient-blur bottom-20 left-10 bg-emerald-500/10 pointer-events-none" />

      {/* 1️⃣ Header Greeting Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-emerald-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit uppercase tracking-wider shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              CUSTOMER SUPPORT PORTAL
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-foreground">
              {getGreetingText()}
            </h1>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
              Welcome to your dedicated self-service hub. Raise support requests, view warranty status for registered equipment, and track live complaint resolutions.
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={() => navigate("/complaints/new")}
              className="gradient-primary text-white shadow-glow hover:opacity-95 rounded-xl h-11 px-5 font-bold text-xs gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Raise Complaint
            </Button>
          </div>
        </div>
      </div>

      {/* 2️⃣ Quick Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        <div className="glass-card rounded-2xl p-5 border border-border/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Requests</p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : activeComplaints.length}
            </h3>
            <p className="text-[11px] text-amber-500 font-medium mt-0.5">In progress or triage</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resolved Tickets</p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : resolvedComplaints.length}
            </h3>
            <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Successfully closed</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Lifetime</p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : myComplaints.length}
            </h3>
            <p className="text-[11px] text-primary font-medium mt-0.5">All service logs</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3️⃣ My Recent Service Requests */}
      <div className="glass-card rounded-3xl p-6 border border-border/60 shadow-sm relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Recent Service Requests</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/complaints")}
            className="text-xs font-semibold text-primary hover:text-primary/80 gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : myComplaints.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl bg-muted/30 border border-dashed border-border/80 space-y-3">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-bold text-foreground">No complaints filed yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">If you encounter any electrical or solar issue, raise a ticket here anytime.</p>
            </div>
            <Button
              onClick={() => navigate("/complaints/new")}
              size="sm"
              className="gradient-primary text-white text-xs font-bold rounded-lg h-9 px-4 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Raise Your First Complaint
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {myComplaints.slice(0, 5).map((ticket: any) => {
              const displayId = formatComplaintTicketId(ticket);
              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/complaints/${ticket.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-3 rounded-xl hover:bg-muted/40 cursor-pointer transition-all group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-primary">{displayId}</span>
                      <StatusBadge status={ticket.status} ticket={ticket} />
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Phase {ticket.current_phase || 1}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {ticket.title}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                      {ticket.location && <span>• {ticket.location}</span>}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold shrink-0 group-hover:bg-primary group-hover:text-white transition-all"
                  >
                    View Status <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4️⃣ Priority Service Dispatch Section */}
      <m.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 relative overflow-hidden group flex flex-col justify-between gap-6 z-10 shadow-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none" />

        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            <span>Priority Service Dispatch</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-black text-foreground">
            Experiencing power backup, solar or electrical issues?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Submit a support ticket with your site details. Our operations desk will match a qualified supervisor and map live technician travel routes to your premises.
          </p>
        </div>

        {/* Operational Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-border/40 relative z-10">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-border/40">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Rapid SLA Response</p>
              <p className="text-[11px] text-muted-foreground">Within 2 to 4 business hours</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-border/40">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Certified Field Crew</p>
              <p className="text-[11px] text-muted-foreground">Verified OEM specialists</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-border/40">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Turn-by-Turn GPS Tracking</p>
              <p className="text-[11px] text-muted-foreground">Live technician arrival ETA</p>
            </div>
          </div>
        </div>
      </m.div>
    </div>
  );
};

export default CustomerDashboard;
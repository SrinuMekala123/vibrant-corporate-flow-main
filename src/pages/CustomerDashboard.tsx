import { motion as m } from "framer-motion";
import { Zap, Plus, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

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

  return (
    <div className="space-y-6 relative max-w-5xl mx-auto py-2 pb-12">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10 pointer-events-none" />
      <div className="bg-ambient-blur bottom-20 left-10 bg-emerald-500/10 pointer-events-none" />

      {/* 1️⃣ Header Greeting Banner with ONLY ONE Primary "Raise Complaint" Button */}
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
              Welcome to your dedicated self-service hub. Raise support requests, view warranty status for registered equipment, and track complaint resolutions.
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

      {/* 2️⃣ Priority Service Dispatch Section (Clean, Informational & Clutter-Free) */}
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
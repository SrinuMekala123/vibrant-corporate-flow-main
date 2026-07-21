import { motion as m } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
    return `${timeGreeting}, ${user?.name || "Customer"}! 👋`;
  };

  return (
    <div className="space-y-8 relative max-w-4xl mx-auto py-4">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-10 right-10 bg-primary/10" />
      <div className="bg-ambient-blur bottom-20 left-20 bg-emerald-500/10" />

      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/40 pb-6 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit uppercase tracking-wider shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          System Active
        </div>
        <h1 className="text-3xl font-display font-black tracking-tight text-slate-900">{getGreetingText()}</h1>
        <p className="text-slate-500 text-[13px] font-medium mt-1 leading-relaxed">
          Welcome to your customer portal. You can raise a new complaint or service request to dispatch our engineering team immediately.
        </p>
      </div>

      {/* Greeting Banner / Central Action Card */}
      <m.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 border border-border/60 relative overflow-hidden group flex flex-col justify-between gap-8 z-10 shadow-glow"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
        
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <span>Operational Notice</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Need technical assistance or service?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Submit a support request with your physical address. Our system matches specialized supervisors and maps technician routes dynamically.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
          <Button
            onClick={() => navigate("/complaints/new")}
            className="w-full sm:w-auto gradient-primary text-white shadow-glow hover:opacity-95 rounded-xl h-12 px-6 font-bold flex items-center justify-center gap-2 text-base transition-all"
          >
            Raise Complaint Now <ArrowRight className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/complaints")}
            className="w-full sm:w-auto rounded-xl h-12 px-6 font-bold border-border bg-card hover:bg-muted text-foreground transition-all"
          >
            View My Complaints
          </Button>
        </div>
      </m.div>
    </div>
  );
};

export default CustomerDashboard;
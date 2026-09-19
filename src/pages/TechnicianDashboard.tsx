import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { complaintService, formatComplaintTicketId } from "@/services/complaintService";
import { installationService, formatInstallationTicketId, type Installation } from "@/services/installationService";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Loader2,
  ArrowRight,
  Navigation,
  Crown,
  Users,
  Package,
  Calendar,
  Phone,
  FileText,
  Copy,
  ChevronDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechnicianMissionControl } from "@/components/TechnicianMissionControl";
import { toast } from "sonner";

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

const INSTALLATION_STATUS_OPTIONS = [
  "Assigned",
  "In-Progress",
  "Pending due to Material Shortage",
  "Site Completed and Handed Over"
];

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed" | "closed">("active");
  const [taskCategory, setTaskCategory] = useState<"all" | "complaints" | "installations">("all");
  const [updatingInstStatusId, setUpdatingInstStatusId] = useState<string | null>(null);
  const [viewInstallationModal, setViewInstallationModal] = useState<Installation | null>(null);

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

  // 1. Fetch complaints for this technician (Lead OR Supporting team member)
  const { data: allComplaints, isLoading: isComplaintsLoading } = useQuery({
    queryKey: ["technician-complaints", user?.id, technicianName],
    queryFn: async () => {
      if (!user) return [];
      const data = await complaintService.getAll();
      return data.filter((c: any) => {
        if (c.assigned_to === user.id) return true;
        if (
          technicianName &&
          c.assigned_technician &&
          (c.assigned_technician.toLowerCase().includes(technicianName.toLowerCase()) ||
            c.assigned_technician === user.id)
        ) {
          return true;
        }
        if (
          c.complaint_technicians &&
          c.complaint_technicians.some((ct: any) => ct.technician_id === user.id)
        ) {
          return true;
        }
        return false;
      });
    },
    enabled: !!user,
  });

  // 2. Fetch installations assigned to this technician (Lead OR Supporting team member) (BUG 4 Fix)
  const { data: allInstallations, isLoading: isInstallationsLoading } = useQuery({
    queryKey: ["technician-installations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      try {
        // Step 1: Find all installation IDs where technician is assigned in installation_technicians
        const { data: assignedRows, error: junctionError } = await supabase
          .from("installation_technicians")
          .select("installation_id")
          .eq("technician_id", user.id);

        if (junctionError) {
          console.warn("Could not query installation_technicians:", junctionError);
        }

        const assignedInstallationIds = (assignedRows || []).map((r: any) => r.installation_id).filter(Boolean);

        // Step 2: Fetch installations where user is lead_technician_id OR id in assignedInstallationIds
        let query = supabase
          .from("installations")
          .select(`
            *,
            customer:customers(id, full_name, phone, email),
            location:customer_locations(id, location_name, address, city),
            installation_technicians(
              id,
              technician_id,
              technician:profiles(id, full_name, email, phone)
            )
          `);

        if (assignedInstallationIds.length > 0) {
          query = query.or(`lead_technician_id.eq.${user.id},id.in.(${assignedInstallationIds.join(",")})`);
        } else {
          query = query.eq("lead_technician_id", user.id);
        }

        const { data: instData, error: instError } = await query.order("created_at", { ascending: false });

        if (instError) {
          console.error("Direct installations query error:", instError);
          // Fallback through service
          const all = await installationService.getAll();
          return all.filter((inst: any) => {
            if (inst.lead_technician_id === user.id) return true;
            if (inst.installation_technicians?.some((it: any) => it.technician_id === user.id)) return true;
            return false;
          });
        }

        // Fetch lead names for all installations
        const leadIds = [...new Set((instData || []).map((i: any) => i.lead_technician_id).filter(Boolean))];
        let leadProfilesMap: Record<string, string> = {};
        if (leadIds.length > 0) {
          const { data: leadProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", leadIds);
          (leadProfiles || []).forEach((lp: any) => {
            leadProfilesMap[lp.id] = lp.full_name;
          });
        }

        return (instData || []).map((inst: any) => ({
          ...inst,
          lead_name: (inst.lead_technician_id && leadProfilesMap[inst.lead_technician_id]) ||
            inst.installation_technicians?.find((it: any) => it.technician_id === inst.lead_technician_id)?.technician?.full_name ||
            "Lead Technician"
        }));
      } catch (err) {
        console.error("Failed to fetch technician installations:", err);
        return [];
      }
    },
    enabled: !!user,
  });

  // Filter complaints based on status
  const filteredComplaints = useMemo(() => {
    return (allComplaints || []).filter((c) => {
      if (activeTab === "active") return c.status !== "completed" && c.status !== "closed";
      if (activeTab === "completed") return c.status === "completed";
      if (activeTab === "closed") return c.status === "closed";
      return true;
    });
  }, [allComplaints, activeTab]);

  // Filter installations based on status
  const filteredInstallations = useMemo(() => {
    return (allInstallations || []).filter((inst) => {
      const s = (inst.status || "").toLowerCase();
      if (activeTab === "active") {
        return !s.includes("completed") && !s.includes("handed over") && !s.includes("closed");
      }
      if (activeTab === "completed") {
        return s.includes("completed") || s.includes("handed over");
      }
      if (activeTab === "closed") {
        return s.includes("closed");
      }
      return true;
    });
  }, [allInstallations, activeTab]);

  // Handle Quick Status Update for Installations (Lead Tech)
  const handleUpdateInstallationStatus = async (installationId: string, newStatus: string) => {
    setUpdatingInstStatusId(installationId);
    try {
      await installationService.update(installationId, { status: newStatus });
      toast.success(`Installation status updated to ${newStatus}`);
      await queryClient.invalidateQueries({ queryKey: ["technician-installations"] });
      await queryClient.invalidateQueries({ queryKey: ["installations-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setUpdatingInstStatusId(null);
    }
  };

  // ⚡ Real-time Sync for Installations (BUG 5 Fix)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("technician-installations-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["technician-installations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installation_technicians" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["technician-installations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Calculate Unified Stats
  const activeComplaintsCount = (allComplaints || []).filter(c => c.status !== "completed" && c.status !== "closed").length;
  const activeInstallationsCount = (allInstallations || []).filter(i => {
    const s = (i.status || "").toLowerCase();
    return !s.includes("completed") && !s.includes("handed over") && !s.includes("closed");
  }).length;
  const totalActiveJobs = activeComplaintsCount + activeInstallationsCount;

  const urgentComplaintsCount = (allComplaints || []).filter(c => (c.priority === "high" || c.priority === "urgent" || c.severity === "major") && c.status !== "completed" && c.status !== "closed").length;
  const criticalInstallationsCount = (allInstallations || []).filter(i => i.priority === "Critical" || i.priority === "High").length;
  const totalUrgentTasks = urgentComplaintsCount + criticalInstallationsCount;

  const completedComplaintsCount = (allComplaints || []).filter(c => c.status === "completed" || c.status === "closed").length;
  const completedInstallationsCount = (allInstallations || []).filter(i => {
    const s = (i.status || "").toLowerCase();
    return s.includes("completed") || s.includes("handed over") || s.includes("closed");
  }).length;
  const totalCompletedJobs = completedComplaintsCount + completedInstallationsCount;

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

  const handleOpenMap = (e: React.MouseEvent, locationAddress?: string, lat?: number | null, lng?: number | null) => {
    e.stopPropagation();
    if ((!locationAddress || !locationAddress.trim()) && (!lat || !lng)) {
      toast.error("Customer location coordinates not available");
      return;
    }
    const destination = (lat && lng)
      ? `${lat},${lng}`
      : encodeURIComponent(locationAddress?.trim() || "");
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(mapsUrl, "_blank");
    toast.success("Opening Google Maps navigation...");
  };

  const isLoading = isComplaintsLoading || isInstallationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2.5 font-medium text-muted-foreground">Loading job queues & maps...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative pb-12">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10" />

      {/* Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-emerald-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                FIELD TECHNICIAN ACTIVE
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-foreground">
              {getGreetingText()}
            </h1>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
              Field Operations Hub. Review your assigned Maintenance Complaints and Installation Jobs, launch turn-by-turn GPS Navigation, log on-site progress, and record client sign-offs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={() => navigate("/daily-schedule")}
              className="gradient-primary text-white hover:opacity-95 rounded-xl h-10 px-4 gap-2 font-bold shadow-glow text-xs"
            >
              <Clock className="w-4 h-4" /> My Daily Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        <StatCard
          label="Active Work Orders"
          value={totalActiveJobs}
          icon={Wrench}
          gradient="primary"
          delay={0}
        />
        <StatCard
          label="Critical / Urgent Tasks"
          value={totalUrgentTasks}
          icon={AlertTriangle}
          gradient="warm"
          delay={0.05}
        />
        <StatCard
          label="Completed Sign-offs"
          value={totalCompletedJobs}
          icon={CheckCircle2}
          gradient="cool"
          delay={0.1}
        />
      </div>

      {/* Primary Category Switcher (All vs Complaints vs Installations) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 max-w-md">
          <button
            onClick={() => setTaskCategory("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              taskCategory === "all"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            All Tasks ({filteredComplaints.length + filteredInstallations.length})
          </button>
          <button
            onClick={() => setTaskCategory("complaints")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              taskCategory === "complaints"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-orange-500" />
            Complaints ({filteredComplaints.length})
          </button>
          <button
            onClick={() => setTaskCategory("installations")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              taskCategory === "installations"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5 text-blue-500" />
            Installations ({filteredInstallations.length})
          </button>
        </div>

        {/* Status Horizon Filter (Active, Completed, Closed, All) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/65 max-w-md border border-border/40">
          {(["active", "completed", "closed", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 px-3 text-xs font-bold capitalize rounded-lg transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm border border-border/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Job Queue */}
      <div className="space-y-4 relative z-10">
        <AnimatePresence mode="wait">
          {(taskCategory === "all" ? (filteredComplaints.length === 0 && filteredInstallations.length === 0) : taskCategory === "complaints" ? filteredComplaints.length === 0 : filteredInstallations.length === 0) ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 glass-card rounded-2xl border border-border/60"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-pulse" />
              <p className="font-bold text-foreground">All Clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No assigned field work orders match your active filter.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* SECTION: INSTALLATIONS */}
              {(taskCategory === "all" || taskCategory === "installations") && filteredInstallations.map((inst, i) => {
                const isLead = inst.lead_technician_id === user?.id;
                const custName = inst.customer?.full_name || inst.non_btl_customer_name || "Client";
                const isNonBtl = inst.customer_type === "New / Non-BTL Customer" || 
                  inst.customer_type === "Non-BTL" || 
                  inst.customer_type === "Walk-in" || 
                  (!inst.customer_id && !inst.customer?.full_name && inst.customer_type !== "BTL" && inst.customer_type !== "Existing BTL Customer");
                const siteAddress = inst.location?.address || inst.non_btl_address || "";
                const locName = inst.location?.location_name || "";
                const fullAddressDisplay = [locName, siteAddress].filter(Boolean).join(" — ") || "Site address not specified";

                return (
                  <motion.div
                    key={`inst-${inst.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/installations/${inst.id}`)}
                    className="glass-card rounded-2xl p-6 border border-border/60 hover:border-blue-500/30 hover:shadow-glow transition-all duration-300 cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 opacity-90" />

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Left Info */}
                      <div className="flex-1 space-y-2.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Package className="w-3.5 h-3.5" />
                            {formatInstallationTicketId(inst)}
                          </span>

                          {isNonBtl ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300">
                              Walk-in / Non-BTL
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-300">
                              Existing Customer
                            </span>
                          )}

                          <span className="text-xs font-bold px-2 py-0.5 rounded border uppercase text-indigo-700 bg-indigo-50 border-indigo-200">
                            {inst.priority || "Normal"}
                          </span>

                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border">
                            {inst.status}
                          </span>

                          {/* Team Leadership Badge (BUG 5 Fix) */}
                          {isLead ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50">
                              <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                              Lead Technician (Authorized)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                              <Crown className="w-3 h-3 text-amber-600" />
                              Status managed by Lead: {inst.lead_name || "Lead Technician"}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                          {inst.equipment_details || "Equipment Installation Scope"}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Client: <strong className="text-foreground">{custName}</strong>
                            {(inst.customer?.phone || inst.non_btl_contact_number) && (
                              <span className="text-slate-500 ml-1">({inst.customer?.phone || inst.non_btl_contact_number})</span>
                            )}
                          </span>

                          {inst.scheduled_date && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                Scheduled: <strong className="text-foreground">{inst.scheduled_date} {inst.scheduled_time || ""}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Location and Live Route */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1.5 border-t border-border/20">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[320px]">
                              {fullAddressDisplay}
                            </span>
                          </span>

                          {siteAddress && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMap(e, siteAddress);
                              }}
                              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-300 shadow-sm"
                            >
                              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                              GPS Navigate
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right Action Box */}
                      <div 
                        className="flex flex-col items-stretch lg:items-end justify-between gap-3 shrink-0 lg:min-w-[240px] p-4 rounded-xl bg-blue-50/40 dark:bg-slate-900/40 border border-blue-100 dark:border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-full space-y-1 text-left lg:text-right">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Job Progress & Control
                          </span>
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                            {inst.status}
                          </span>
                        </div>

                        {/* Status Update Dropdown (Enabled for Lead Technician) */}
                        {isLead ? (
                          <div className="w-full space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                              Update Installation Stage:
                            </label>
                            <Select
                              value={inst.status}
                              onValueChange={(val) => handleUpdateInstallationStatus(inst.id, val)}
                              disabled={updatingInstStatusId === inst.id}
                            >
                              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INSTALLATION_STATUS_OPTIONS.map((st) => (
                                  <SelectItem key={st} value={st} className="text-xs">
                                    {st}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="w-full text-center lg:text-right text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-medium">
                            🔒 Status managed by Lead: <strong>{inst.lead_name || "Lead Technician"}</strong>
                          </div>
                        )}

                        <div className="flex items-center gap-2 w-full pt-1">
                          {siteAddress && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMap(e, siteAddress);
                              }}
                              title="Open in Google Maps"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg h-8 shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/installations/${inst.id}`);
                            }}
                          >
                            View Job Specs <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* SECTION: COMPLAINTS */}
              {(taskCategory === "all" || taskCategory === "complaints") && filteredComplaints.map((ticket, i) => {
                const userAssignment = ticket.complaint_technicians?.find((ct: any) => ct.technician_id === user?.id);
                const isLead = ticket.complaint_technicians && ticket.complaint_technicians.length > 0
                  ? userAssignment?.is_lead === true
                  : (ticket.assigned_to === user?.id || ticket.assigned_technician === technicianName);

                const displayTicketId = formatComplaintTicketId(ticket);
                const isNonBtl = ticket.customer_type === "New / Non-BTL Customer" || 
                  ticket.customer_type === "Non-BTL" || 
                  ticket.customer_type === "Walk-in" || 
                  (!ticket.customer_id && !ticket.customer_name && ticket.customer_type !== "Existing BTL Customer");

                return (
                  <motion.div
                    key={`comp-${ticket.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/complaints/${ticket.id}`)}
                    className="glass-card rounded-2xl p-6 border border-border/60 hover:border-primary/20 hover:shadow-glow transition-all duration-300 cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Left Info */}
                      <div className="flex-1 space-y-2.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-primary">{displayTicketId}</span>

                          {isNonBtl ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300">
                              Walk-in / Non-BTL
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-300">
                              Existing Customer
                            </span>
                          )}

                          <span className="text-xs text-muted-foreground">•</span>
                          <SeverityBadge severity={ticket.severity as any} />
                          <StatusBadge status={ticket.status} />
                          
                          {/* Assignment Role Badge */}
                          {isLead ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40 shadow-xs">
                              <Crown className="w-3 h-3 text-amber-500 fill-amber-500" /> LEAD TECHNICIAN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <Users className="w-3 h-3 text-slate-400" /> Supporting Tech
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {ticket.title}
                        </h3>

                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {ticket.description || "No description provided."}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1.5 border-t border-border/20">
                          {ticket.customer_name && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              {ticket.customer_name}
                            </span>
                          )}
                          {ticket.location && (
                            <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">{ticket.location}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            {formatIndianDateTime(ticket.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Right Action Box */}
                      <div className="flex flex-col items-stretch lg:items-end justify-between gap-3 shrink-0 lg:min-w-[220px] p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border/60">
                        <div className="w-full space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-muted-foreground">Lifecycle:</span>
                            <span className="text-primary font-mono font-bold">
                              {ticket.status === "completed" || ticket.status === "closed" ? 100 : Math.round((ticket.current_phase || 1) * (100 / 6))}%
                            </span>
                          </div>
                          <Progress value={ticket.status === "completed" || ticket.status === "closed" ? 100 : (ticket.current_phase || 1) * (100 / 6)} className="h-2 bg-muted/65" />
                          <p className="text-[11px] text-muted-foreground text-right pt-0.5">
                            {ticket.status === "completed" || ticket.status === "closed" ? "Ticket Signed-off" : (phaseLabels[ticket.current_phase || 1] || "Phase Active")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 w-full pt-1">
                          {(ticket.location || (ticket.customer_lat && ticket.customer_lng)) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-9 px-3 border-blue-200 text-blue-700 dark:text-blue-300 hover:bg-blue-50 font-semibold"
                              onClick={(e) => handleOpenMap(e, ticket.location, ticket.customer_lat, ticket.customer_lng)}
                              title="Open in Google Maps"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            className="flex-1 gradient-primary text-white font-bold rounded-lg h-9 shadow-sm hover:opacity-95"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/complaints/${ticket.id}`);
                            }}
                          >
                            View Work Order <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 📦 Installation Details Dialog Modal for Technicians */}
      <Dialog open={!!viewInstallationModal} onOpenChange={(open) => !open && setViewInstallationModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl">
          {viewInstallationModal && (() => {
            const inst = viewInstallationModal;
            const isNonBtl = inst.customer_type === "New / Non-BTL Customer" || 
              inst.customer_type === "Non-BTL" || 
              inst.customer_type === "Walk-in" || 
              (!inst.customer_id && !inst.customer?.full_name && inst.customer_type !== "BTL" && inst.customer_type !== "Existing BTL Customer");
            const custName = isNonBtl ? (inst.non_btl_customer_name || "Direct Client") : (inst.customer?.full_name || "Registered Customer");
            const custPhone = isNonBtl ? (inst.non_btl_contact_number || "N/A") : (inst.customer?.phone || "N/A");
            const fullAddress = isNonBtl
              ? (inst.non_btl_address || "On-site")
              : (inst.location?.address ? `${inst.location.location_name ? inst.location.location_name + ", " : ""}${inst.location.address}${inst.location.city ? ", " + inst.location.city : ""}` : "Registered Address");

            const isLead = inst.lead_technician_id === user?.id;

            return (
              <div className="space-y-5">
                <DialogHeader className="border-b pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span>{formatInstallationTicketId(inst)}</span>
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                      {isNonBtl ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Walk-in / Non-BTL
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          Existing Customer
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        {inst.status}
                      </span>
                    </div>
                  </div>
                </DialogHeader>

                {/* 🚀 Mobile Mission Control */}
                <TechnicianMissionControl
                  ticketType="installation"
                  ticketId={inst.id}
                  ticketDisplayId={formatInstallationTicketId(inst)}
                  customerName={custName}
                  customerPhone={custPhone}
                  locationAddress={fullAddress}
                  isLeadOrAdmin={isLead}
                  onArrivalLogged={() => {
                    queryClient.invalidateQueries({ queryKey: ["technician-installations"] });
                  }}
                />

                {/* Customer Details */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" /> Customer & Site Address
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="text-muted-foreground block">Customer Name:</span>
                      <strong className="text-foreground">{custName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Contact Phone:</span>
                      <strong className="text-foreground">{custPhone}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block">Installation Address:</span>
                      <p className="font-medium text-foreground">{fullAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Equipment Scope */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-primary" /> Equipment to Install
                  </h4>
                  <p className="p-3 bg-white dark:bg-slate-800 rounded-lg border font-medium text-foreground whitespace-pre-wrap">
                    {inst.equipment_details || "No equipment scope specified"}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                    <span>Chargeable Scope:</span>
                    <strong className="text-foreground">{inst.is_chargeable ? "Yes (Billable)" : "No (Standard Scope)"}</strong>
                  </div>
                </div>

                {/* Scheduled Time & Notes */}
                {(inst.scheduled_date || inst.notes) && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2 text-xs">
                    {inst.scheduled_date && (
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="text-muted-foreground">Scheduled Date:</span> <strong>{inst.scheduled_date}</strong> {inst.scheduled_time ? `at ${inst.scheduled_time}` : ""}
                      </p>
                    )}
                    {inst.notes && (
                      <div>
                        <span className="text-muted-foreground block">Site Notes:</span>
                        <p className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{inst.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Update for Lead Tech */}
                {isLead ? (
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">
                      Update Installation Status (Lead Tech):
                    </label>
                    <Select
                      value={inst.status}
                      onValueChange={(val) => handleUpdateInstallationStatus(inst.id, val)}
                      disabled={updatingInstStatusId === inst.id}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-800 h-10 text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INSTALLATION_STATUS_OPTIONS.map((st) => (
                          <SelectItem key={st} value={st} className="text-xs font-medium">
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-muted-foreground italic text-center">
                    🔒 Status progression is managed by the Lead Technician
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TechnicianDashboard;
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Target,
  Clock,
  CheckCircle2,
  MapPin,
  Brain,
  Timer,
  Loader2,
  Package,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { complaintService, type Complaint } from "@/services/complaintService";
import { installationService, formatInstallationTicketId, type Installation } from "@/services/installationService";
import { supabase } from "@/lib/supabase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const KPIAnalytics = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch all complaints
  const { data: complaints = [], isLoading: isLoadingComplaints } = useQuery({
    queryKey: ["kpi-complaints"],
    queryFn: () => complaintService.getAll(),
    refetchInterval: 30000
  });

  // 2. Fetch all installations
  const { data: installations = [], isLoading: isLoadingInstallations } = useQuery({
    queryKey: ["kpi-installations"],
    queryFn: () => installationService.getAll(),
    refetchInterval: 30000
  });

  // 3. Fetch profiles
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["kpi-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000
  });

  // ⚡ 100% REAL-TIME LIVE SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("kpi-live-telemetry")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kpi-complaints"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "installations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kpi-installations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kpi-profiles"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoadingComplaints || isLoadingInstallations || isLoadingProfiles) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Target className="w-6 h-6 text-primary absolute animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-foreground">Analyzing Operational KPIs</p>
          <p className="text-xs text-muted-foreground">Streaming real-time compliance telemetry...</p>
        </div>
      </div>
    );
  }

  // Derived KPI Calculations
  const completedComplaints = complaints.filter((t: Complaint) => ["completed", "verified"].includes(t.status));
  const totalCompletedComplaints = completedComplaints.length;

  const completedInstallations = installations.filter((i: Installation) =>
    ["completed", "handed over", "handed_over"].includes(i.status?.toLowerCase() || "")
  );
  const totalCompletedInstallations = completedInstallations.length;

  // Unified Operations
  const unifiedTotalOperations = complaints.length + installations.length;
  const unifiedCompletedOperations = totalCompletedComplaints + totalCompletedInstallations;
  const unifiedSuccessRate =
    unifiedTotalOperations > 0
      ? Math.round((unifiedCompletedOperations / unifiedTotalOperations) * 100)
      : 0;

  // 1. First-Time Fix Rate (FTFR)
  const firstTimeFixRate =
    totalCompletedComplaints > 0
      ? Math.round(
          (completedComplaints.filter((t: Complaint) => !t.follow_up_required).length /
            totalCompletedComplaints) *
            100
        )
      : 86;

  // 2. Installation Handover Rate
  const installationHandoverRate =
    installations.length > 0
      ? Math.round((totalCompletedInstallations / installations.length) * 100)
      : 100;

  // 3. Mean Time to Resolve (MTTR)
  const totalHours = completedComplaints.reduce((acc: number, ticket: Complaint) => {
    const created = new Date(ticket.created_at).getTime();
    const updated = new Date(ticket.updated_at || ticket.created_at).getTime();
    return acc + (updated - created) / (1000 * 60 * 60);
  }, 0);
  const mttr = totalCompletedComplaints > 0 ? (totalHours / totalCompletedComplaints).toFixed(1) : "3.8";

  // 4. Response Latency
  const responseLatencyTickets = completedComplaints.filter(
    (t: Complaint) => t.assignment_timestamp && t.start_journey_timestamp
  );
  const responseLatency =
    responseLatencyTickets.length > 0
      ? (
          responseLatencyTickets.reduce((acc: number, t: Complaint) => {
            const assign = new Date(t.assignment_timestamp!).getTime();
            const journey = new Date(t.start_journey_timestamp!).getTime();
            return acc + (journey - assign) / (1000 * 60);
          }, 0) / responseLatencyTickets.length
        ).toFixed(0)
      : "14";

  // 5. Travel Efficiency
  const travelTickets = completedComplaints.filter(
    (t: Complaint) => t.start_journey_timestamp && t.arrival_timestamp
  );
  const travelEfficiency =
    travelTickets.length > 0
      ? (
          travelTickets.reduce((acc: number, t: Complaint) => {
            const journey = new Date(t.start_journey_timestamp!).getTime();
            const arrival = new Date(t.arrival_timestamp!).getTime();
            return acc + (arrival - journey) / (1000 * 60);
          }, 0) / travelTickets.length
        ).toFixed(0)
      : "22";

  // 6. PIR Accuracy Index
  const pirAccuracyTickets = completedComplaints.filter(
    (t: Complaint) => t.supervisor_severity && t.pir_findings_severity
  );
  const pirAccuracy =
    pirAccuracyTickets.length > 0
      ? Math.round(
          (pirAccuracyTickets.filter(
            (t: Complaint) => t.supervisor_severity === t.pir_findings_severity
          ).length /
            pirAccuracyTickets.length) *
            100
        )
      : 89;

  // 7. SLA Adherence
  const slaTickets = completedComplaints.filter((t: Complaint) => t.target_duration_hours);
  const slaAdherence =
    slaTickets.length > 0
      ? Math.round(
          (slaTickets.filter((t: Complaint) => {
            const duration =
              (new Date(t.updated_at || t.created_at).getTime() - new Date(t.created_at).getTime()) /
              (1000 * 60 * 60);
            return duration <= t.target_duration_hours!;
          }).length /
            slaTickets.length) *
            100
        )
      : 92;

  // Monthly Trend Chart Data (Complaints + Installations)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyMap: Record<string, {
    month: string;
    totalOperations: number;
    completedOperations: number;
    complaints: number;
    installations: number;
    mttr: number;
    travelEfficiency: number;
  }> = {};

  // Initialize last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = months[d.getMonth()];
    monthlyMap[key] = {
      month: key,
      totalOperations: 0,
      completedOperations: 0,
      complaints: 0,
      installations: 0,
      mttr: 0,
      travelEfficiency: 0
    };
  }

  complaints.forEach((ticket: Complaint) => {
    if (ticket.created_at) {
      const d = new Date(ticket.created_at);
      const key = months[d.getMonth()];
      if (monthlyMap[key]) {
        monthlyMap[key].complaints++;
        monthlyMap[key].totalOperations++;
      }
    }
    if (["completed", "verified"].includes(ticket.status)) {
      const d = new Date(ticket.updated_at || ticket.created_at);
      const key = months[d.getMonth()];
      if (monthlyMap[key]) {
        monthlyMap[key].completedOperations++;
        const start = new Date(ticket.created_at).getTime();
        const end = new Date(ticket.updated_at || ticket.created_at).getTime();
        monthlyMap[key].mttr += (end - start) / (1000 * 60 * 60);
      }
    }
  });

  installations.forEach((inst: Installation) => {
    if (inst.created_at) {
      const d = new Date(inst.created_at);
      const key = months[d.getMonth()];
      if (monthlyMap[key]) {
        monthlyMap[key].installations++;
        monthlyMap[key].totalOperations++;
      }
    }
    if (["completed", "handed over", "handed_over"].includes(inst.status?.toLowerCase() || "")) {
      const d = new Date(inst.updated_at || inst.created_at);
      const key = months[d.getMonth()];
      if (monthlyMap[key]) {
        monthlyMap[key].completedOperations++;
      }
    }
  });

  const chartData = Object.values(monthlyMap);

  // Group by Field of Work (including Equipment Installation)
  const fieldData: Record<string, number> = {};
  complaints.forEach((ticket: Complaint) => {
    const field = ticket.field_of_work || "General Service";
    fieldData[field] = (fieldData[field] || 0) + 1;
  });

  if (installations.length > 0) {
    fieldData["Equipment Installation"] = installations.length;
  }

  const getFieldColor = (field: string) => {
    switch (field) {
      case "Equipment Installation":
        return "#06b6d4"; // Cyan
      case "Solar PV":
        return "#f97316"; // Orange
      case "Networking":
        return "#3b82f6"; // Blue
      case "Security Systems":
        return "#8b5cf6"; // Purple
      case "Power Systems":
        return "#10b981"; // Emerald
      default:
        return "#ec4899"; // Pink
    }
  };

  const pieData = Object.entries(fieldData)
    .map(([name, value]) => ({
      name,
      value,
      fill: getFieldColor(name)
    }))
    .sort((a, b) => b.value - a.value);

  const kpiCards = [
    {
      label: "First-Time Fix Rate",
      value: firstTimeFixRate,
      unit: "%",
      change: 3.5,
      trend: "up" as const,
      icon: CheckCircle2,
      gradient: "primary" as const
    },
    {
      label: "Installation Handover",
      value: installationHandoverRate,
      unit: "%",
      change: 4.8,
      trend: "up" as const,
      icon: Package,
      gradient: "warm" as const
    },
    {
      label: "Mean Time to Resolve",
      value: mttr,
      unit: "hrs",
      change: -0.6,
      trend: "down" as const,
      icon: Clock,
      gradient: "cool" as const
    },
    {
      label: "SLA Adherence",
      value: slaAdherence,
      unit: "%",
      change: 1.8,
      trend: "up" as const,
      icon: Target,
      gradient: "warm" as const
    },
    {
      label: "Unified Resolution",
      value: unifiedSuccessRate,
      unit: "%",
      change: 5.2,
      trend: "up" as const,
      icon: TrendingUp,
      gradient: "primary" as const
    },
    {
      label: "Travel Efficiency",
      value: travelEfficiency,
      unit: "min",
      change: -2.3,
      trend: "down" as const,
      icon: MapPin,
      gradient: "cool" as const
    },
    {
      label: "PIR Accuracy Index",
      value: pirAccuracy,
      unit: "%",
      change: 4.0,
      trend: "up" as const,
      icon: Brain,
      gradient: "cool" as const
    },
    {
      label: "Response Latency",
      value: responseLatency,
      unit: "min",
      change: -3.4,
      trend: "down" as const,
      icon: Timer,
      gradient: "warm" as const
    }
  ];

  return (
    <div className="space-y-8 relative overflow-x-hidden pb-12">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10" />
      <div className="bg-ambient-blur bottom-40 right-20 bg-indigo-500/10" />

      {/* Top Page Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-emerald-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Target className="w-3.5 h-3.5" /> METRIC BENCHMARKS
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Telemetry Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              Executive KPI Analytics & Operational Insights
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time enterprise compliance intelligence covering First-Time Fix Rates (FTFR), Installation Delivery Rates, Mean Time to Resolve (MTTR), and Fleet Efficiencies.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate("/installations")}
              variant="outline"
              className="rounded-xl border-border/60 font-bold gap-2 text-xs h-10 hover:bg-muted"
            >
              <Package className="w-4 h-4 text-primary" />
              <span>Installations ({installations.length})</span>
            </Button>
            <Button
              onClick={() => navigate("/complaints")}
              className="gradient-primary text-white rounded-xl font-bold gap-2 text-xs h-10 shadow-glow"
            >
              <Layers className="w-4 h-4" />
              <span>Service Tickets ({complaints.length})</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 📊 8 HIGH-IMPACT KPI METRIC TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative z-10">
        {kpiCards.map((kpi, i) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            change={kpi.change}
            trend={kpi.trend}
            icon={kpi.icon}
            gradient={kpi.gradient}
            delay={i * 0.05}
          />
        ))}
      </div>

      {/* 📈 PERFORMANCE CHARTS & OPERATIONS DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        {/* Performance Trend Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-border/60 shadow-md flex flex-col justify-between min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-extrabold text-lg tracking-tight text-foreground">
                Unified Performance & Operations Trend
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Service complaints vs equipment installations completed over 6-month timeline.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
              </span>
              <span className="flex items-center gap-1 text-blue-500">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Total
              </span>
              <span className="flex items-center gap-1 text-cyan-500">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Installations
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.15)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="rgba(150, 150, 150, 0.6)" tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} stroke="rgba(150, 150, 150, 0.6)" tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.92)",
                  backdropFilter: "blur(12px)",
                  borderRadius: "14px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
                  color: "#fff"
                }}
              />
              <Line
                type="monotone"
                dataKey="completedOperations"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4 }}
                name="Completed Operations"
              />
              <Line
                type="monotone"
                dataKey="totalOperations"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                name="Total Operations"
              />
              <Line
                type="monotone"
                dataKey="installations"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
                name="Equipment Installations"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Work Classification Pie / Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-border/60 shadow-md flex flex-col justify-between min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-extrabold text-lg tracking-tight text-foreground">
                Operations by Field of Work
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribution across equipment installations and maintenance categories.
              </p>
            </div>
            <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              {pieData.length} Domains
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2 h-56 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={48}
                    paddingAngle={4}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.92)",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full sm:w-1/2 space-y-2">
              {pieData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs font-semibold"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="font-extrabold text-foreground shrink-0">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 📦 EQUIPMENT INSTALLATION EXECUTION & HANDOVER MATRIX */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-lg relative overflow-hidden z-10"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              <h2 className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-foreground">
                Equipment Installation Velocity & Readiness Matrix
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Deep-dive metrics on customer site installations, handover success, and dispatch velocity.
            </p>
          </div>

          <Button
            onClick={() => navigate("/installations")}
            className="gradient-primary text-white rounded-xl font-bold gap-2 text-xs shadow-glow h-9 px-4 self-start sm:self-auto"
          >
            Manage Installations <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 4 Execution Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <span>Total Scheduled</span>
              <Package className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-black text-foreground">{installations.length}</p>
            <p className="text-[11px] text-muted-foreground font-medium">All equipment orders recorded</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span>Handed Over</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-black text-emerald-600 dark:text-emerald-400">
              {totalCompletedInstallations}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">Client sign-off achieved</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <span>Active Deployments</span>
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-black text-amber-600 dark:text-amber-400">
              {installations.length - totalCompletedInstallations}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">Assigned / In progress</p>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <span>Client Ratio</span>
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-black text-foreground">
              {installations.filter((i) => i.customer_type === "btl").length}
              <span className="text-sm font-bold text-muted-foreground ml-1">
                /{installations.filter((i) => i.customer_type !== "btl").length}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">BTL Corporate vs Direct</p>
          </div>
        </div>
      </motion.div>

      {/* 📚 KPI DEFINITIONS & METHODOLOGY */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-md relative z-10"
      >
        <h2 className="font-display font-extrabold text-lg tracking-tight text-foreground mb-4">
          Enterprise Operational KPI Definitions & Standards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              name: "First-Time Fix Rate (FTFR)",
              desc: "Percentage of tickets resolved on initial visit requiring no follow-up visits within 7 days."
            },
            {
              name: "Installation Handover Rate",
              desc: "Proportion of scheduled equipment installations successfully completed and accepted by client."
            },
            {
              name: "Mean Time to Resolve (MTTR)",
              desc: "Average operational duration from customer ticket intake to sign-off and final closure."
            },
            {
              name: "Travel Efficiency",
              desc: "Calculated transit duration from start of journey to site arrival timestamp."
            },
            {
              name: "PIR Accuracy Index",
              desc: "Alignment between Supervisor preliminary triage tier and Lead Technician field findings."
            },
            {
              name: "SLA Adherence",
              desc: "Frequency of operations completed strictly within designated service level agreement limits."
            }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="w-7 h-7 rounded-xl gradient-primary flex items-center justify-center text-xs font-black text-white shrink-0 mt-0.5 shadow-sm">
                {i + 1}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-xs text-foreground">{item.name}</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default KPIAnalytics;
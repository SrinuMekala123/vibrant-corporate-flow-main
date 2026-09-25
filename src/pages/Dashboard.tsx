import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Zap,
  MapPin,
  Loader2,
  Plus,
  X,
  Mail,
  Phone,
  Shield,
  Wrench,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Layers,
  Activity,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ExternalLink,
  SlidersHorizontal,
  Flame,
  CheckCircle,
  Eye,
  Send,
  Building2,
  UserCheck,
  Radio,
  BarChart3,
  PieChart as PieChartIcon,
  Sparkles,
  Timer,
  Navigation,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { complaintService, formatComplaintTicketId, type Complaint } from "@/services/complaintService";
import { installationService, formatInstallationTicketId, type Installation } from "@/services/installationService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { toast } from "sonner";

// Format Indian Date & Time with Asia/Kolkata timezone
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
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch (e) {
    return new Date(dateString).toLocaleString();
  }
};

const formatRelativeTime = (dateString?: string) => {
  if (!dateString) return "";
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
};

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [quickViewTicket, setQuickViewTicket] = useState<Complaint | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [activeTab, setActiveTab] = useState<"complaints" | "installations" | "urgent" | "technicians">("complaints");
  const [chartCategory, setChartCategory] = useState<"all" | "complaints" | "installations">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Display limit & pagination states
  const [complaintsLimit, setComplaintsLimit] = useState(5);
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [complaintsPagingMode, setComplaintsPagingMode] = useState<"load_more" | "paged">("load_more");

  const [installationsLimit, setInstallationsLimit] = useState(5);
  const [installationsPage, setInstallationsPage] = useState(1);
  const [installationsPagingMode, setInstallationsPagingMode] = useState<"load_more" | "paged">("load_more");

  const [criticalLimit, setCriticalLimit] = useState(5);
  const [staffRadarLimit, setStaffRadarLimit] = useState(6);

  // Live real-time clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // ⚡ 100% LIVE REAL-TIME DATABASE TELEMETRY SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-live-telemetry")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-complaints"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-installations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-profiles"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installation_technicians" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-installations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaint_technicians" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-complaints"] });
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [queryClient]);

  const getGreetingText = () => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 17) {
      timeGreeting = "Good evening";
    }

    let nameTitle = user?.name || "Admin";
    if (user?.role === "admin") {
      nameTitle = "Administrator";
    }

    return `${timeGreeting}, ${nameTitle}`;
  };

  // Fetch all complaints from Supabase
  const {
    data: allComplaints = [],
    isLoading: isLoadingComplaints,
    refetch: refetchComplaints
  } = useQuery({
    queryKey: ["dashboard-complaints"],
    queryFn: () => complaintService.getAll(),
    refetchInterval: 30000 // auto-refresh every 30s
  });

  // Fetch all installations from Supabase
  const {
    data: allInstallations = [],
    isLoading: isLoadingInstallations,
    refetch: refetchInstallations
  } = useQuery({
    queryKey: ["dashboard-installations"],
    queryFn: () => installationService.getAll(),
    refetchInterval: 30000
  });

  // Fetch all profiles (technicians/supervisors/admins)
  const {
    data: profiles = [],
    isLoading: isLoadingProfiles,
    refetch: refetchProfiles
  } = useQuery({
    queryKey: ["dashboard-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "customer");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchComplaints(), refetchProfiles(), refetchInstallations()]);
      toast.success("Dashboard telemetry synchronized with database");
    } catch {
      toast.error("Failed to refresh live data");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Filter complaints based on Time Filter (Timezone-Safe Timestamp)
  const timeFilteredComplaints = useMemo(() => {
    if (!allComplaints) return [];
    if (timeFilter === "all") return allComplaints;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime();

    return allComplaints.filter((c: Complaint) => {
      if (!c.created_at) return false;
      const createdTime = new Date(c.created_at).getTime();

      if (timeFilter === "today") {
        return createdTime >= startOfToday;
      }
      if (timeFilter === "week") {
        return createdTime >= startOfWeek;
      }
      if (timeFilter === "month") {
        return createdTime >= startOfMonth;
      }
      return true;
    });
  }, [allComplaints, timeFilter]);

  // Filter installations based on Time Filter (Timezone-Safe Timestamp)
  const timeFilteredInstallations = useMemo(() => {
    if (!allInstallations) return [];
    if (timeFilter === "all") return allInstallations;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime();

    return allInstallations.filter((inst: Installation) => {
      if (!inst.created_at) return false;
      const createdTime = new Date(inst.created_at).getTime();

      if (timeFilter === "today") {
        return createdTime >= startOfToday;
      }
      if (timeFilter === "week") {
        return createdTime >= startOfWeek;
      }
      if (timeFilter === "month") {
        return createdTime >= startOfMonth;
      }
      return true;
    });
  }, [allInstallations, timeFilter]);

  // Derived Key Metrics
  const totalComplaintsCount = timeFilteredComplaints.length;
  const totalInstallationsCount = timeFilteredInstallations.length;
  const activeInstallationsCount = timeFilteredInstallations.filter(
    (i: Installation) => !["completed", "handed_over", "handed over", "cancelled"].includes(i.status?.toLowerCase() || "")
  ).length;
  const completedInstallationsCount = timeFilteredInstallations.filter(
    (i: Installation) => ["completed", "handed_over", "handed over"].includes(i.status?.toLowerCase() || "")
  ).length;

  const openTickets = timeFilteredComplaints.filter(
    (t: Complaint) => !["completed", "closed"].includes(t.status)
  ).length;
  const urgentTickets = timeFilteredComplaints.filter(
    (t: Complaint) => t.severity === "major" && t.status !== "closed"
  ).length;

  const todayStr = new Date().toDateString();
  const completedToday = allComplaints.filter(
    (t: Complaint) =>
      ["completed", "closed"].includes(t.status) &&
      t.updated_at &&
      new Date(t.updated_at).toDateString() === todayStr
  ).length;

  const totalCompleted = timeFilteredComplaints.filter((t: Complaint) =>
    ["completed", "closed"].includes(t.status)
  ).length;

  const resolutionRate =
    totalComplaintsCount > 0
      ? Math.round((totalCompleted / totalComplaintsCount) * 100)
      : 0;

  const allTechnicians = useMemo(
    () => profiles.filter((m: any) => m.role === "technician"),
    [profiles]
  );
  const availableTechs = allTechnicians.filter((m: any) => m.available).length;
  const busyTechs = allTechnicians.length - availableTechs;

  // KPI Calculations
  const firstTimeFixRate =
    totalCompleted > 0
      ? Math.round(
          (timeFilteredComplaints.filter(
            (t: Complaint) =>
              ["completed", "closed"].includes(t.status) && !t.follow_up_required
          ).length /
            totalCompleted) *
            100
        )
      : 84;

  const avgResolutionHours = useMemo(() => {
    const resolved = timeFilteredComplaints.filter((t: Complaint) =>
      ["completed", "closed"].includes(t.status)
    );
    if (resolved.length === 0) return "3.8";
    const total = resolved.reduce((acc: number, t: Complaint) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.updated_at || t.created_at).getTime();
      return acc + (end - start) / (1000 * 60 * 60);
    }, 0);
    return (total / resolved.length).toFixed(1);
  }, [timeFilteredComplaints]);

  // Chart Data: Dynamic Intake vs Resolved Velocity Curve based on active Time Horizon
  const trendChartData = useMemo(() => {
    const now = new Date();
    const map: Record<string, {
      label: string;
      received: number;
      resolved: number;
      complaintsReceived: number;
      complaintsResolved: number;
      installationsReceived: number;
      installationsResolved: number;
    }> = {};

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (timeFilter === "today") {
      // 6 time slots throughout today
      const slots = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
      slots.forEach((s) => {
        map[s] = {
          label: s,
          received: 0,
          resolved: 0,
          complaintsReceived: 0,
          complaintsResolved: 0,
          installationsReceived: 0,
          installationsResolved: 0
        };
      });

      const assignToSlot = (dateStr?: string, isComplaint = true, isResolved = false) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (d.toDateString() !== now.toDateString()) return;
        const h = d.getHours();
        let targetSlot = "06:00";
        if (h >= 21) targetSlot = "21:00";
        else if (h >= 18) targetSlot = "18:00";
        else if (h >= 15) targetSlot = "15:00";
        else if (h >= 12) targetSlot = "12:00";
        else if (h >= 9) targetSlot = "09:00";

        if (map[targetSlot]) {
          if (isResolved) {
            map[targetSlot].resolved++;
            if (isComplaint) map[targetSlot].complaintsResolved++;
            else map[targetSlot].installationsResolved++;
          } else {
            map[targetSlot].received++;
            if (isComplaint) map[targetSlot].complaintsReceived++;
            else map[targetSlot].installationsReceived++;
          }
        }
      };

      allComplaints.forEach((c) => {
        assignToSlot(c.created_at, true, false);
        if (["completed", "closed"].includes(c.status)) assignToSlot(c.updated_at || c.created_at, true, true);
      });
      allInstallations.forEach((i) => {
        assignToSlot(i.created_at, false, false);
        if (["completed", "handed over", "handed_over"].includes(i.status?.toLowerCase() || "")) {
          assignToSlot(i.updated_at || i.created_at, false, true);
        }
      });
    } else if (timeFilter === "week") {
      // 7 past days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayLabel = `${daysOfWeek[d.getDay()]} ${d.getDate()}`;
        map[d.toDateString()] = {
          label: dayLabel,
          received: 0,
          resolved: 0,
          complaintsReceived: 0,
          complaintsResolved: 0,
          installationsReceived: 0,
          installationsResolved: 0
        };
      }

      const assignToDay = (dateStr?: string, isComplaint = true, isResolved = false) => {
        if (!dateStr) return;
        const key = new Date(dateStr).toDateString();
        if (map[key]) {
          if (isResolved) {
            map[key].resolved++;
            if (isComplaint) map[key].complaintsResolved++;
            else map[key].installationsResolved++;
          } else {
            map[key].received++;
            if (isComplaint) map[key].complaintsReceived++;
            else map[key].installationsReceived++;
          }
        }
      };

      allComplaints.forEach((c) => {
        assignToDay(c.created_at, true, false);
        if (["completed", "closed"].includes(c.status)) assignToDay(c.updated_at || c.created_at, true, true);
      });
      allInstallations.forEach((i) => {
        assignToDay(i.created_at, false, false);
        if (["completed", "handed over", "handed_over"].includes(i.status?.toLowerCase() || "")) {
          assignToDay(i.updated_at || i.created_at, false, true);
        }
      });
    } else if (timeFilter === "month") {
      // 4 Weekly buckets over the past 30 days
      const weeks = ["W-4 (Oldest)", "W-3", "W-2", "W-1 (Recent)"];
      weeks.forEach((w) => {
        map[w] = {
          label: w,
          received: 0,
          resolved: 0,
          complaintsReceived: 0,
          complaintsResolved: 0,
          installationsReceived: 0,
          installationsResolved: 0
        };
      });

      const assignToWeek = (dateStr?: string, isComplaint = true, isResolved = false) => {
        if (!dateStr) return;
        const timeDiff = now.getTime() - new Date(dateStr).getTime();
        const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        if (daysAgo > 30 || daysAgo < 0) return;
        let w = "W-1 (Recent)";
        if (daysAgo >= 21) w = "W-4 (Oldest)";
        else if (daysAgo >= 14) w = "W-3";
        else if (daysAgo >= 7) w = "W-2";

        if (map[w]) {
          if (isResolved) {
            map[w].resolved++;
            if (isComplaint) map[w].complaintsResolved++;
            else map[w].installationsResolved++;
          } else {
            map[w].received++;
            if (isComplaint) map[w].complaintsReceived++;
            else map[w].installationsReceived++;
          }
        }
      };

      allComplaints.forEach((c) => {
        assignToWeek(c.created_at, true, false);
        if (["completed", "closed"].includes(c.status)) assignToWeek(c.updated_at || c.created_at, true, true);
      });
      allInstallations.forEach((i) => {
        assignToWeek(i.created_at, false, false);
        if (["completed", "handed over", "handed_over"].includes(i.status?.toLowerCase() || "")) {
          assignToWeek(i.updated_at || i.created_at, false, true);
        }
      });
    } else {
      // All Time: past 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${months[d.getMonth()]}`;
        map[key] = {
          label: key,
          received: 0,
          resolved: 0,
          complaintsReceived: 0,
          complaintsResolved: 0,
          installationsReceived: 0,
          installationsResolved: 0
        };
      }

      allComplaints.forEach((t: Complaint) => {
        if (t.created_at) {
          const d = new Date(t.created_at);
          const key = `${months[d.getMonth()]}`;
          if (map[key]) {
            map[key].received += 1;
            map[key].complaintsReceived += 1;
          }
        }
        if (t.updated_at && ["completed", "closed"].includes(t.status)) {
          const d = new Date(t.updated_at);
          const key = `${months[d.getMonth()]}`;
          if (map[key]) {
            map[key].resolved += 1;
            map[key].complaintsResolved += 1;
          }
        }
      });

      allInstallations.forEach((i: Installation) => {
        if (i.created_at) {
          const d = new Date(i.created_at);
          const key = `${months[d.getMonth()]}`;
          if (map[key]) {
            map[key].received += 1;
            map[key].installationsReceived += 1;
          }
        }
        if (i.updated_at && ["completed", "handed over", "handed_over"].includes(i.status?.toLowerCase() || "")) {
          const d = new Date(i.updated_at);
          const key = `${months[d.getMonth()]}`;
          if (map[key]) {
            map[key].resolved += 1;
            map[key].installationsResolved += 1;
          }
        }
      });
    }

    return Object.values(map);
  }, [allComplaints, allInstallations, timeFilter]);

  // Donut Chart: Field of Work Distribution (Complaints + Installations)
  const categoryChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    timeFilteredComplaints.forEach((t: Complaint) => {
      const cat = t.field_of_work || "General Service";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    if (timeFilteredInstallations.length > 0) {
      counts["Equipment Installation"] = timeFilteredInstallations.length;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [timeFilteredComplaints, timeFilteredInstallations]);

  // Severity Distribution Counts
  const severityCounts = useMemo(() => {
    return {
      major: timeFilteredComplaints.filter((t: Complaint) => t.severity === "major").length,
      moderate: timeFilteredComplaints.filter((t: Complaint) => t.severity === "moderate").length,
      minor: timeFilteredComplaints.filter((t: Complaint) => t.severity === "minor").length
    };
  }, [timeFilteredComplaints]);

  // 1. Sorted Complaints: Always newest first (created_at DESC)
  const sortedAllComplaints = useMemo(() => {
    return [...timeFilteredComplaints]
      .filter((ticket: Complaint) => {
        // Severity filter
        if (severityFilter !== "all" && ticket.severity !== severityFilter) return false;

        // Status filter
        if (statusFilter !== "all") {
          if (statusFilter === "open" && ["completed", "closed"].includes(ticket.status)) return false;
          if (statusFilter === "completed" && !["completed", "closed"].includes(ticket.status)) return false;
          if (statusFilter === "in_progress" && ticket.status !== "in_progress") return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const ticketId = formatComplaintTicketId(ticket).toLowerCase();
          const title = (ticket.title || "").toLowerCase();
          const customer = (
            ticket.customer_name ||
            ticket.profiles?.full_name ||
            ""
          ).toLowerCase();
          const location = (ticket.location || "").toLowerCase();
          const tech = (ticket.assigned_technician || "").toLowerCase();
          const field = (ticket.field_of_work || "").toLowerCase();

          return (
            ticketId.includes(query) ||
            title.includes(query) ||
            customer.includes(query) ||
            location.includes(query) ||
            tech.includes(query) ||
            field.includes(query)
          );
        }

        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [timeFilteredComplaints, severityFilter, statusFilter, searchQuery]);

  // 2. Critical Issues: Severity === "major" or Priority === "urgent", sorted newest first (created_at DESC)
  const sortedCriticalIssues = useMemo(() => {
    return sortedAllComplaints.filter(
      (t: Complaint) => t.severity === "major" || t.priority === "urgent"
    );
  }, [sortedAllComplaints]);

  // 3. Sorted Installations: Always newest first (created_at DESC)
  const sortedAllInstallations = useMemo(() => {
    return [...timeFilteredInstallations]
      .filter((inst: Installation) => {
        // Status filter
        if (statusFilter !== "all") {
          const s = (inst.status || "").toLowerCase();
          if (statusFilter === "open" && ["completed", "handed over", "handed_over", "cancelled"].includes(s)) return false;
          if (statusFilter === "completed" && !["completed", "handed over", "handed_over"].includes(s)) return false;
          if (statusFilter === "in_progress" && !["in_progress", "in progress", "assigned", "scheduled"].includes(s)) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const ticketId = formatInstallationTicketId(inst).toLowerCase();
          const customerName = (
            inst.customer?.full_name ||
            inst.non_btl_customer_name ||
            ""
          ).toLowerCase();
          const contact = (
            inst.customer?.phone ||
            inst.non_btl_contact_number ||
            ""
          ).toLowerCase();
          const address = (
            inst.location?.address ||
            inst.non_btl_address ||
            inst.location?.location_name ||
            ""
          ).toLowerCase();
          const equipment = (inst.equipment_details || "").toLowerCase();
          const notes = (inst.notes || "").toLowerCase();

          return (
            ticketId.includes(query) ||
            customerName.includes(query) ||
            contact.includes(query) ||
            address.includes(query) ||
            equipment.includes(query) ||
            notes.includes(query)
          );
        }

        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [timeFilteredInstallations, statusFilter, searchQuery]);

  // 4. Sorted Staff: Most recently active first (last_active DESC)
  const sortedAllTechnicians = useMemo(() => {
    return [...allTechnicians].sort((a: any, b: any) => {
      const timeA = new Date(a.last_active || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_active || b.updated_at || b.created_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      if (a.available !== b.available) return a.available ? -1 : 1;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [allTechnicians]);

  // Visible Items Based on Limits / Pagination
  const visibleComplaints = useMemo(() => {
    if (complaintsPagingMode === "paged" && sortedAllComplaints.length > 20) {
      const start = (complaintsPage - 1) * 20;
      return sortedAllComplaints.slice(start, start + 20);
    }
    return sortedAllComplaints.slice(0, complaintsLimit);
  }, [sortedAllComplaints, complaintsLimit, complaintsPagingMode, complaintsPage]);

  const visibleInstallations = useMemo(() => {
    if (installationsPagingMode === "paged" && sortedAllInstallations.length > 20) {
      const start = (installationsPage - 1) * 20;
      return sortedAllInstallations.slice(start, start + 20);
    }
    return sortedAllInstallations.slice(0, installationsLimit);
  }, [sortedAllInstallations, installationsLimit, installationsPagingMode, installationsPage]);

  const visibleCriticalIssues = useMemo(() => {
    if (sortedCriticalIssues.length <= 5) return sortedCriticalIssues;
    return sortedCriticalIssues.slice(0, criticalLimit);
  }, [sortedCriticalIssues, criticalLimit]);

  const visibleTechnicians = useMemo(() => {
    return sortedAllTechnicians.slice(0, staffRadarLimit);
  }, [sortedAllTechnicians, staffRadarLimit]);

  // Load More, View All & Show Less Handlers
  const handleLoadMoreComplaints = () => {
    setComplaintsPagingMode("load_more");
    const remaining = sortedAllComplaints.length - complaintsLimit;
    const step = remaining <= 5 ? remaining : (sortedAllComplaints.length >= 50 ? 20 : 5);
    setComplaintsLimit((prev) => Math.min(prev + step, sortedAllComplaints.length));
  };

  const handleViewAllComplaints = () => {
    setComplaintsPagingMode("load_more");
    setComplaintsLimit(sortedAllComplaints.length);
  };

  const handleShowLessComplaints = () => {
    setComplaintsPagingMode("load_more");
    setComplaintsLimit(5);
    setComplaintsPage(1);
  };

  const handleLoadMoreInstallations = () => {
    setInstallationsPagingMode("load_more");
    const remaining = sortedAllInstallations.length - installationsLimit;
    const step = remaining <= 5 ? remaining : (sortedAllInstallations.length >= 50 ? 20 : 5);
    setInstallationsLimit((prev) => Math.min(prev + step, sortedAllInstallations.length));
  };

  const handleViewAllInstallations = () => {
    setInstallationsPagingMode("load_more");
    setInstallationsLimit(sortedAllInstallations.length);
  };

  const handleShowLessInstallations = () => {
    setInstallationsPagingMode("load_more");
    setInstallationsLimit(5);
    setInstallationsPage(1);
  };

  const handleLoadMoreCritical = () => {
    const remaining = sortedCriticalIssues.length - criticalLimit;
    const step = remaining <= 5 ? remaining : 5;
    setCriticalLimit((prev) => Math.min(prev + step, sortedCriticalIssues.length));
  };

  const handleViewAllCritical = () => {
    setCriticalLimit(sortedCriticalIssues.length);
  };

  const handleShowLessCritical = () => {
    setCriticalLimit(5);
  };

  const handleLoadMoreStaff = () => {
    const remaining = sortedAllTechnicians.length - staffRadarLimit;
    const step = remaining <= 6 ? remaining : 6;
    setStaffRadarLimit((prev) => Math.min(prev + step, sortedAllTechnicians.length));
  };

  const handleViewAllStaff = () => {
    setStaffRadarLimit(sortedAllTechnicians.length);
  };

  const handleShowLessStaff = () => {
    setStaffRadarLimit(6);
  };

  // Render Helpers for Cards
  const renderComplaintCard = (ticket: Complaint, index: number) => {
    const displayTicketId = formatComplaintTicketId(ticket);
    const isCritical = ticket.severity === "major";

    return (
      <motion.div
        key={ticket.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={`glass-card rounded-2xl p-4 sm:p-5 border transition-all duration-200 group relative overflow-hidden ${
          isCritical
            ? "border-rose-500/30 hover:border-rose-500 bg-rose-500/[0.015]"
            : "border-border/60 hover:border-primary/30 hover:shadow-md"
        }`}
      >
        {/* Left accent border */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${
            isCritical
              ? "bg-rose-500 opacity-100"
              : ticket.status === "completed" || ticket.status === "closed"
              ? "bg-emerald-500 opacity-60"
              : "bg-primary opacity-0 group-hover:opacity-100"
          }`}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Main Info */}
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                isCritical
                  ? "bg-gradient-to-tr from-rose-600 to-amber-500"
              : ticket.status === "completed" || ticket.status === "closed"
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500"
                  : "gradient-primary"
              }`}
            >
              <Zap className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-black text-primary px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                  {displayTicketId}
                </span>
                {ticket.field_of_work && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase tracking-wider">
                    {ticket.field_of_work}
                  </span>
                )}
                <span className="text-[11px] font-medium text-muted-foreground ml-auto sm:ml-0">
                  {formatRelativeTime(ticket.created_at)}
                </span>
              </div>

              <h3
                onClick={() => navigate(`/complaints/${ticket.id}`)}
                className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors cursor-pointer truncate"
                title={ticket.title}
              >
                {ticket.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  {ticket.customer_name ||
                    ticket.profiles?.full_name ||
                    ticket.created_by_name ||
                    "Registered Client"}
                </span>

                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {ticket.location?.split(",")[0] || "Location specified"}
                </span>

                {ticket.assigned_technician && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Tech: {ticket.assigned_technician}
                  </span>
                )}

                {ticket.complaint_technicians && ticket.complaint_technicians.length > 0 && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {(() => {
                      const list = ticket.complaint_technicians.slice().sort((a: any, b: any) => {
                        if (a.is_lead === b.is_lead) return 0;
                        return a.is_lead ? -1 : 1;
                      });
                      const lead = list.filter((t: any) => t.is_lead).map((t: any) => t.technician?.full_name).filter(Boolean);
                      const crew = list.filter((t: any) => !t.is_lead).map((t: any) => t.technician?.full_name).filter(Boolean);
                      const parts = [...lead.map(n => `👑 ${n}`), ...crew];
                      return parts.length > 0 ? parts.join(", ") : "Unassigned";
                    })()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Badges & Quick Action */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
            <div className="flex items-center gap-2">
              {ticket.severity && (
                <SeverityBadge severity={ticket.severity as any} />
              )}
              {ticket.status && <StatusBadge status={ticket.status} />}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickViewTicket(ticket)}
                className="h-8 w-8 p-0 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Quick Preview"
              >
                <Eye className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/complaints/${ticket.id}`)}
                className="h-8 px-3 rounded-xl border-border/70 text-xs font-bold gap-1 hover:bg-primary hover:text-white transition-all"
              >
                Details
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderInstallationCard = (inst: Installation, index: number) => {
    const displayTicketId = formatInstallationTicketId(inst);
    const isDone = ["completed", "handed over", "handed_over"].includes(inst.status?.toLowerCase() || "");

    return (
      <motion.div
        key={inst.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={`glass-card rounded-2xl p-4 sm:p-5 border transition-all duration-200 group relative overflow-hidden ${
          isDone
            ? "border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/[0.015]"
            : "border-border/60 hover:border-blue-500/30 hover:shadow-md"
        }`}
      >
        {/* Left accent border */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${
            isDone
              ? "bg-emerald-500 opacity-80"
              : "bg-blue-600 opacity-0 group-hover:opacity-100"
          }`}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Main Info */}
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                isDone
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500"
                  : "bg-gradient-to-tr from-blue-600 to-indigo-600"
              }`}
            >
              <Package className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  {displayTicketId}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase tracking-wider">
                  {inst.customer_type === "btl" ? "BTL Customer" : "Direct / Walk-in"}
                </span>
                {inst.priority && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      inst.priority === "high" || inst.priority === "urgent"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {inst.priority}
                  </span>
                )}
                <span className="text-[11px] font-medium text-muted-foreground ml-auto sm:ml-0">
                  {formatRelativeTime(inst.created_at)}
                </span>
              </div>

              <h3
                onClick={() => navigate(`/installations/${inst.id}`)}
                className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors cursor-pointer truncate"
              >
                {inst.equipment_details || inst.notes || "Equipment Installation"}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  {inst.customer?.full_name || inst.non_btl_customer_name || "Customer specified"}
                </span>

                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {inst.location?.address || inst.non_btl_address || inst.location?.location_name || "Address on file"}
                </span>

                {inst.scheduled_date && (
                  <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {inst.scheduled_date} {inst.scheduled_time || ""}
                  </span>
                )}

                {inst.installation_technicians && inst.installation_technicians.length > 0 && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {(() => {
                      const list = inst.installation_technicians.slice().sort((a: any, b: any) => {
                        if (a.is_lead === b.is_lead) return 0;
                        return a.is_lead ? -1 : 1;
                      });
                      const lead = list.filter((t: any) => t.is_lead).map((t: any) => t.technician?.full_name).filter(Boolean);
                      const crew = list.filter((t: any) => !t.is_lead).map((t: any) => t.technician?.full_name).filter(Boolean);
                      const parts = [...lead.map(n => `👑 ${n}`), ...crew];
                      return parts.length > 0 ? parts.join(", ") : "Unassigned";
                    })()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Badges & Quick Action */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
            <StatusBadge status={inst.status || "unassigned"} />

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/installations/${inst.id}`)}
              className="h-8 px-3 rounded-xl border-border/70 text-xs font-bold gap-1 hover:bg-primary hover:text-white transition-all"
            >
              View Workflow
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTechnicianCard = (tech: any) => {
    return (
      <motion.div
        key={tech.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-5 border border-border/60 hover:border-indigo-500/40 hover:shadow-glow transition-all group flex flex-col justify-between gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-primary flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              {tech.full_name?.charAt(0) || tech.email?.charAt(0).toUpperCase() || "T"}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-foreground truncate">
                {tech.full_name || tech.email}
              </h4>
              <span className="text-[11px] text-muted-foreground block truncate">
                {tech.email}
              </span>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
              tech.available
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tech.available ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            {tech.available ? "Available" : "On Task"}
          </span>
        </div>

        {/* Expertise Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Specialties
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tech.expertise ? (
              tech.expertise.split(",").map((exp: string) => (
                <span
                  key={exp}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/40"
                >
                  {exp.trim()}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground italic">
                General Systems
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">{tech.phone || "No phone"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMember(tech)}
              className="h-8 px-2.5 text-xs font-bold rounded-xl"
            >
              Profile
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/assignments")}
              className="gradient-primary text-white h-8 px-3 text-xs font-bold rounded-xl gap-1 shadow-sm"
            >
              Assign
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  if (isLoadingComplaints || isLoadingProfiles || isLoadingInstallations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Zap className="w-6 h-6 text-primary absolute animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-foreground">Initializing Command Center</p>
          <p className="text-xs text-muted-foreground">Streaming real-time operational telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative pb-12">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10" />
      <div className="bg-ambient-blur bottom-40 right-20 bg-indigo-500/10" />

      {/* 🌟 EXECUTIVE HEADER & LIVE TELEMETRY BAR */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-indigo-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left Column: Greeting & Status */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LIVE DISPATCH ONLINE
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted/80 text-muted-foreground border border-border/50">
                <Clock className="w-3.5 h-3.5 text-primary" />
                {currentTime || "IST"} (Asia/Kolkata)
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Radio className="w-3 h-3 animate-pulse" />
                Auto-Sync 30s
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
              {getGreetingText()}!
              <span className="inline-block animate-bounce">👋</span>
            </h1>

            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
              Enterprise Operations Control Center. Real-time telemetry on service tickets, field staff readiness, SLA adherence, and customer resolution pipelines.
            </p>
          </div>

          {/* Right Column: Actions & Time Horizon Filter */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-3 shrink-0">
            {/* Time Filter Pills */}
            <div className="inline-flex p-1 bg-muted/70 backdrop-blur-md rounded-2xl border border-border/60 shadow-inner">
              {[
                { key: "all", label: "All Time" },
                { key: "month", label: "Month" },
                { key: "week", label: "Week" },
                { key: "today", label: "Today" }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTimeFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    timeFilter === tab.key
                      ? "bg-card text-primary shadow-sm border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold"
                title="Force refresh database telemetry"
              >
                <RefreshCw className={`w-4 h-4 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/installations")}
                className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-foreground"
              >
                <Package className="w-4 h-4 text-primary" />
                <span>Installations</span>
              </Button>

              <Button
                size="sm"
                onClick={() => navigate("/assignments")}
                className="rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 h-10 px-4 gap-2 font-bold shadow-md"
              >
                <Users className="w-4 h-4" />
                <span>Dispatch</span>
              </Button>

              <Button
                size="sm"
                onClick={() => navigate("/complaints/new")}
                className="gradient-primary text-white hover:opacity-95 rounded-xl h-10 px-4 gap-2 font-bold shadow-glow"
              >
                <Plus className="w-4 h-4" />
                <span>New Ticket</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 7 HIGH-IMPACT EXECUTIVE METRIC TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4 relative z-10">
        {/* Card 1: Complaints Volume */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-border/60 hover:border-primary/40 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden"
          onClick={() => {
            setActiveTab("complaints");
            setStatusFilter("all");
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Complaints
            </span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-foreground">
              {totalComplaintsCount}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Service tickets</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Installations */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-border/60 hover:border-blue-500/40 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden"
          onClick={() => {
            setActiveTab("installations");
            setStatusFilter("all");
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Installations
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-foreground">
              {totalInstallationsCount}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
              <span>{activeInstallationsCount} active · {completedInstallationsCount} done</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Active & Open Tickets */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-border/60 hover:border-amber-500/40 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden"
          onClick={() => {
            setActiveTab("complaints");
            setStatusFilter("open");
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              In-Flight Open
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-amber-600 dark:text-amber-400">
              {openTickets}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              Requiring resolution
            </p>
          </div>
        </motion.div>

        {/* Card 3: Critical & Major Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-rose-500/30 hover:border-rose-500 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden bg-rose-500/[0.03]"
          onClick={() => {
            setActiveTab("urgent");
            setSeverityFilter("major");
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              Critical Escalations
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-rose-600 dark:text-rose-400">
              {urgentTickets}
            </p>
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
              {urgentTickets > 0 ? "Requires supervisor action" : "All clear & stable"}
            </p>
          </div>
        </motion.div>

        {/* Card 4: Resolved / Completed */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-border/60 hover:border-emerald-500/40 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden"
          onClick={() => {
            setActiveTab("complaints");
            setStatusFilter("completed");
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Resolved & Closed
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {totalCompleted}
            </p>
            <p className="text-[11px] font-bold text-muted-foreground">
              {resolutionRate}% success rate
            </p>
          </div>
        </motion.div>

        {/* Card 5: Field Fleet Availability */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-border/60 hover:border-indigo-500/40 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden"
          onClick={() => setActiveTab("technicians")}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Fleet Readiness
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-foreground">
              {availableTechs}
              <span className="text-sm font-bold text-muted-foreground ml-1">
                /{allTechnicians.length}
              </span>
            </p>
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {busyTechs} on active missions
            </p>
          </div>
        </motion.div>

        {/* Card 6: MTTR Resolution Speed */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-4 sm:p-5 border border-border/60 hover:border-cyan-500/40 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden"
          onClick={() => navigate("/kpi")}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Avg Resolution
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-display font-black tracking-tight text-foreground">
              {avgResolutionHours}
              <span className="text-sm font-bold text-muted-foreground ml-1">hrs</span>
            </p>
            <p className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
              FTFR: {firstTimeFixRate}%
            </p>
          </div>
        </motion.div>
      </div>

      {/* 📈 INTERACTIVE CHARTS & INTELLIGENCE MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Velocity Trend Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 min-w-0 overflow-hidden glass-card rounded-3xl p-5 sm:p-7 border border-border/60 shadow-md flex flex-col justify-between"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="font-display font-extrabold text-lg tracking-tight text-foreground">
                  Operational Velocity & Resolution Curve
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Intake volume vs successfully completed operations over {timeFilter === "today" ? "today's hourly timeline" : timeFilter === "week" ? "past 7 days" : timeFilter === "month" ? "past 30 days" : "6-month timeline"}.
              </p>
            </div>

            {/* Scope Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 bg-muted/80 backdrop-blur-md rounded-xl border border-border/60">
                <button
                  onClick={() => setChartCategory("all")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    chartCategory === "all"
                      ? "bg-card text-primary shadow-sm border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({totalComplaintsCount + totalInstallationsCount})
                </button>
                <button
                  onClick={() => setChartCategory("complaints")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    chartCategory === "complaints"
                      ? "bg-card text-primary shadow-sm border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Complaints ({totalComplaintsCount})
                </button>
                <button
                  onClick={() => setChartCategory("installations")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                    chartCategory === "installations"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-blue-600"
                  }`}
                >
                  <Package className="w-3 h-3" />
                  Installations ({totalInstallationsCount})
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-border/40">
                <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Received
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Resolved
                </div>
              </div>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartCategory === "installations" ? "#2563eb" : "#3b82f6"} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartCategory === "installations" ? "#2563eb" : "#3b82f6"} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(150, 150, 150, 0.6)" tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(150, 150, 150, 0.6)" tickLine={false} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0]?.payload;
                      return (
                        <div className="glass-card p-3 rounded-2xl border border-white/15 bg-slate-950/90 text-white shadow-2xl space-y-1.5 min-w-[170px] text-xs">
                          <div className="font-extrabold border-b border-white/10 pb-1 flex items-center justify-between text-[11px] text-slate-300">
                            <span>{label}</span>
                            <span className="text-[10px] text-primary uppercase font-bold tracking-wider">{timeFilter}</span>
                          </div>
                          <div className="flex items-center justify-between font-bold text-blue-400">
                            <span>📥 Received:</span>
                            <span>
                              {chartCategory === "complaints"
                                ? dataPoint?.complaintsReceived
                                : chartCategory === "installations"
                                ? dataPoint?.installationsReceived
                                : dataPoint?.received}
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-bold text-emerald-400">
                            <span>✅ Resolved:</span>
                            <span>
                              {chartCategory === "complaints"
                                ? dataPoint?.complaintsResolved
                                : chartCategory === "installations"
                                ? dataPoint?.installationsResolved
                                : dataPoint?.resolved}
                            </span>
                          </div>
                          {chartCategory === "all" && (
                            <div className="pt-1 border-t border-white/10 text-[10px] text-slate-400 space-y-0.5">
                              <div className="flex justify-between">
                                <span>Complaints:</span>
                                <span className="text-slate-200 font-semibold">{dataPoint?.complaintsReceived} in · {dataPoint?.complaintsResolved} done</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Installations:</span>
                                <span className="text-slate-200 font-semibold">{dataPoint?.installationsReceived} in · {dataPoint?.installationsResolved} done</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={
                    chartCategory === "complaints"
                      ? "complaintsReceived"
                      : chartCategory === "installations"
                      ? "installationsReceived"
                      : "received"
                  }
                  stroke={chartCategory === "installations" ? "#2563eb" : "#3b82f6"}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorReceived)"
                  name={chartCategory === "installations" ? "Installations Scheduled" : chartCategory === "complaints" ? "Complaints Received" : "Total Intake"}
                />
                <Area
                  type="monotone"
                  dataKey={
                    chartCategory === "complaints"
                      ? "complaintsResolved"
                      : chartCategory === "installations"
                      ? "installationsResolved"
                      : "resolved"
                  }
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorResolved)"
                  name={chartCategory === "installations" ? "Installations Handed Over" : chartCategory === "complaints" ? "Complaints Closed" : "Total Resolved"}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Categories Donut + Severity Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="min-w-0 overflow-hidden glass-card rounded-3xl p-5 sm:p-7 border border-border/60 shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-500" />
                <h2 className="font-display font-extrabold text-lg tracking-tight text-foreground">
                  Work Classification
                </h2>
              </div>
              <Link
                to="/kpi"
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
              >
                KPIs <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Donut Chart */}
            <div className="w-full h-44 relative flex items-center justify-center">
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                    >
                      {categoryChartData.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.92)",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#fff"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground">No classification data recorded.</p>
              )}
            </div>

            {/* Category Badges Grid */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {categoryChartData.slice(0, 6).map((item, i) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/40 text-xs"
                >
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    {item.name}
                  </span>
                  <span className="font-bold text-foreground shrink-0">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Severity Progress Bars */}
          <div className="mt-5 pt-4 border-t border-border/40 space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Severity Distribution
            </span>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-rose-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Major Priority
                </span>
                <span>{severityCounts.major} tickets</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{
                    width: `${
                      totalComplaintsCount > 0 ? (severityCounts.major / totalComplaintsCount) * 100 : 0
                    }%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold pt-1">
                <span className="text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Moderate
                </span>
                <span>{severityCounts.moderate} tickets</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{
                    width: `${
                      totalComplaintsCount > 0 ? (severityCounts.moderate / totalComplaintsCount) * 100 : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 🕹️ OPERATIONS CENTER: TABS, SEARCH, AND INTERACTIVE TICKETS FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Main Feed Column (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header & Controls */}
          <div className="glass-card rounded-3xl p-6 border border-border/60 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
              <div className="space-y-0.5">
                <h2 className="font-display font-extrabold text-xl tracking-tight text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Live Operational Tickets
                </h2>
                <p className="text-xs text-muted-foreground">
                  Real-time ticket stream with triage details, assigned field teams, and actions.
                </p>
              </div>

              {/* Tab Selector */}
              <div className="inline-flex p-1 bg-muted/80 backdrop-blur-md rounded-2xl border border-border/60 self-start sm:self-auto flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("complaints")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "complaints"
                      ? "bg-primary text-white shadow-md shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Complaints ({sortedAllComplaints.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("installations")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "installations"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Installations ({sortedAllInstallations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("urgent")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === "urgent"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                      : "text-muted-foreground hover:text-rose-600 hover:bg-muted/60"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Critical ({sortedCriticalIssues.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("technicians")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === "technicians"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                      : "text-muted-foreground hover:text-indigo-600 hover:bg-muted/60"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Staff Radar ({allTechnicians.length})
                </button>
              </div>
            </div>

            {/* Search & Filter Bar */}
            {activeTab !== "technicians" && (
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Ticket ID, Customer, Title, Location, Equipment..."
                    className="w-full pl-10 pr-4 py-2 text-xs font-medium bg-muted/40 hover:bg-muted/70 focus:bg-card rounded-xl border border-border/60 focus:border-primary/50 focus:outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-card rounded-xl border border-border/60 text-foreground focus:outline-none focus:border-primary/50 shrink-0"
                  >
                    <option value="all">Status: All</option>
                    <option value="open">Status: Open / Pending</option>
                    <option value="in_progress">Status: In Progress</option>
                    <option value="completed">Status: Completed</option>
                  </select>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-card rounded-xl border border-border/60 text-foreground focus:outline-none focus:border-primary/50 shrink-0"
                  >
                    <option value="all">Severity: All</option>
                    <option value="major">Major / Critical</option>
                    <option value="moderate">Moderate</option>
                    <option value="minor">Minor</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 🌟 1. COMPLAINTS TAB CONTENT */}
          {activeTab === "complaints" && (
            <div className="glass-card rounded-3xl border border-border/60 shadow-sm overflow-hidden transition-all">
              <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      Recent Complaints ({sortedAllComplaints.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Showing top {Math.min(visibleComplaints.length, sortedAllComplaints.length)} sorted by newest intake
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5">
                {visibleComplaints.length > 0 ? (
                  visibleComplaints.map((ticket, index) => renderComplaintCard(ticket, index))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs glass-card rounded-2xl border border-dashed border-border/60">
                    No service complaints match your current search criteria or active filters.
                  </div>
                )}

                {/* Footer: View All / Show Less */}
                {sortedAllComplaints.length > 5 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedAllComplaints.length > visibleComplaints.length ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleViewAllComplaints}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-2 hover:bg-primary hover:text-white border-border/70 shadow-xs transition-all"
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                          View All Complaints ({sortedAllComplaints.length})
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleShowLessComplaints}
                          className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Show Less
                        </Button>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-muted-foreground ml-auto">
                      Showing {Math.min(visibleComplaints.length, sortedAllComplaints.length)} of {sortedAllComplaints.length} complaints
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🔧 2. INSTALLATIONS TAB CONTENT */}
          {activeTab === "installations" && (
            <div className="glass-card rounded-3xl border border-border/60 shadow-sm overflow-hidden transition-all">
              <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      Recent Installations ({sortedAllInstallations.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Showing top {Math.min(visibleInstallations.length, sortedAllInstallations.length)} sorted by newest installation tasks
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5">
                {visibleInstallations.length > 0 ? (
                  visibleInstallations.map((inst, index) => renderInstallationCard(inst, index))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs glass-card rounded-2xl border border-dashed border-border/60">
                    No installation tasks match your current filter or search criteria.
                  </div>
                )}

                {/* Footer: View All / Show Less */}
                {sortedAllInstallations.length > 5 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedAllInstallations.length > visibleInstallations.length ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleViewAllInstallations}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-2 hover:bg-blue-600 hover:text-white border-border/70 shadow-xs transition-all"
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                          View All Installations ({sortedAllInstallations.length})
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleShowLessInstallations}
                          className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Show Less
                        </Button>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-muted-foreground ml-auto">
                      Showing {Math.min(visibleInstallations.length, sortedAllInstallations.length)} of {sortedAllInstallations.length} installations
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ⚠️ 3. CRITICAL ISSUES TAB CONTENT */}
          {activeTab === "urgent" && (
            <div className="glass-card rounded-3xl border border-rose-500/30 shadow-sm overflow-hidden transition-all bg-rose-500/[0.015]">
              <div className="p-4 sm:p-5 border-b border-rose-500/20 bg-rose-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Flame className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-rose-600 dark:text-rose-400 tracking-tight">
                      Critical Issues ({sortedCriticalIssues.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Major severity & urgent priority tickets requiring immediate dispatch attention
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5">
                {visibleCriticalIssues.length > 0 ? (
                  visibleCriticalIssues.map((ticket, index) => renderComplaintCard(ticket, index))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs glass-card rounded-2xl border border-dashed border-border/60">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-foreground">No Critical Tickets Active</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      All major priority equipment failures have been triaged or resolved.
                    </p>
                  </div>
                )}

                {/* Footer: View All / Show Less */}
                {sortedCriticalIssues.length > 5 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedCriticalIssues.length > visibleCriticalIssues.length ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleViewAllCritical}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-2 hover:bg-rose-500 hover:text-white border-border/70 shadow-xs transition-all"
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                          View All Critical ({sortedCriticalIssues.length})
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleShowLessCritical}
                          className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Show Less
                        </Button>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-muted-foreground ml-auto">
                      Showing {Math.min(visibleCriticalIssues.length, sortedCriticalIssues.length)} of {sortedCriticalIssues.length} critical issues
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 👥 4. STAFF RADAR TAB CONTENT */}
          {activeTab === "technicians" && (
            <div className="glass-card rounded-3xl border border-border/60 shadow-sm overflow-hidden transition-all">
              <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground tracking-tight">
                      Staff Radar ({sortedAllTechnicians.length} Active Technicians)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Field engineering crew sorted by most recently active first (last_active DESC)
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {visibleTechnicians.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleTechnicians.map((tech) => renderTechnicianCard(tech))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs glass-card rounded-2xl border border-dashed border-border/60">
                    No technician profiles registered in database.
                  </div>
                )}

                {/* Footer: View All / Show Less */}
                {sortedAllTechnicians.length > 6 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedAllTechnicians.length > visibleTechnicians.length ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleViewAllStaff}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-2 hover:bg-indigo-600 hover:text-white border-border/70 shadow-xs transition-all"
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                          View All Staff ({sortedAllTechnicians.length})
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleShowLessStaff}
                          className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Show Less
                        </Button>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-muted-foreground ml-auto">
                      Showing {Math.min(visibleTechnicians.length, sortedAllTechnicians.length)} of {sortedAllTechnicians.length} technicians
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Operations Hub & Shortcuts (1 col) */}
        <div className="space-y-5">
          {/* Quick Dispatch & System Matrix Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-card rounded-3xl p-6 border border-border/60 shadow-md space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-extrabold text-base tracking-tight text-foreground">
                  Operational Health
                </h3>
              </div>
              <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                98.6% SLA
              </span>
            </div>

            {/* SLA Progress Metrics */}
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">First-Time Fix Rate</span>
                  <span className="font-bold text-foreground">{firstTimeFixRate}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${firstTimeFixRate}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Technician Fleet Utilization</span>
                  <span className="font-bold text-foreground">
                    {allTechnicians.length > 0
                      ? Math.round((busyTechs / allTechnicians.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${
                        allTechnicians.length > 0 ? (busyTechs / allTechnicians.length) * 100 : 0
                      }%`
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Resolution Speed Index</span>
                  <span className="font-bold text-foreground">92% Optimal</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: "92%" }} />
                </div>
              </div>
            </div>

            {/* Live Status Indicators */}
            <div className="pt-4 border-t border-border/40 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Completed Today
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  +{completedToday}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Field Technicians
                </span>
                <span className="text-xl font-black text-primary mt-1 block">
                  {allTechnicians.length}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Quick Management Shortcuts */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card rounded-3xl p-6 border border-border/60 shadow-md space-y-3"
          >
            <h3 className="font-display font-extrabold text-base tracking-tight text-foreground">
              Direct Management Portals
            </h3>

            <div className="space-y-2">
              {[
                {
                  label: "Field Assignments & Dispatch",
                  desc: "Allocate tasks & map routes",
                  icon: Users,
                  path: "/assignments",
                  color: "text-blue-500 bg-blue-500/10"
                },
                {
                  label: "Daily Service Schedule",
                  desc: "Timetable & journey markers",
                  icon: Calendar,
                  path: "/daily-schedule",
                  color: "text-emerald-500 bg-emerald-500/10"
                },
                {
                  label: "Asset & Equipment Vault",
                  desc: "Track serials, models, warranty",
                  icon: Wrench,
                  path: "/assets",
                  color: "text-purple-500 bg-purple-500/10"
                },
                {
                  label: "Enterprise Customer Registry",
                  desc: "Client accounts & multi-locations",
                  icon: Building2,
                  path: "/customers",
                  color: "text-amber-500 bg-amber-500/10"
                },
                {
                  label: "Deep KPI Analytics",
                  desc: "SLA, MTTR, PIR compliance",
                  icon: BarChart3,
                  path: "/kpi",
                  color: "text-cyan-500 bg-cyan-500/10"
                }
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center justify-between p-3 rounded-2xl border border-border/40 hover:border-primary/40 bg-card hover:bg-muted/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* 🔍 MODAL 1: TICKET QUICK PREVIEW */}
      <AnimatePresence>
        {quickViewTicket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-xl w-full rounded-3xl p-6 sm:p-7 relative border border-border/80 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setQuickViewTicket(null)}
                className="absolute top-5 right-5 text-muted-foreground hover:text-foreground rounded-xl p-1.5 hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-black text-primary px-3 py-1 rounded-xl bg-primary/10 border border-primary/20">
                  {formatComplaintTicketId(quickViewTicket)}
                </span>
                {quickViewTicket.severity && (
                  <SeverityBadge severity={quickViewTicket.severity as any} />
                )}
                {quickViewTicket.status && <StatusBadge status={quickViewTicket.status} />}
              </div>

              <div>
                <h3 className="text-xl font-display font-extrabold text-foreground">
                  {quickViewTicket.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Registered on {formatIndianDateTime(quickViewTicket.created_at)}
                </p>
              </div>

              {/* Description */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 text-xs text-foreground leading-relaxed">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Problem Description
                </span>
                {quickViewTicket.description || "No description provided."}
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-card border border-border/40 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Customer Account
                  </span>
                  <p className="font-bold text-foreground">
                    {quickViewTicket.customer_name ||
                      quickViewTicket.profiles?.full_name ||
                      "Registered Client"}
                  </p>
                  <p className="text-muted-foreground">{quickViewTicket.customer_phone || "No phone"}</p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/40 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Service Location
                  </span>
                  <p className="font-bold text-foreground">
                    {quickViewTicket.location || "Location not specified"}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/40 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Assigned Field Team
                  </span>
                  {quickViewTicket.complaint_technicians && quickViewTicket.complaint_technicians.length > 0 ? (
                    <div className="space-y-1">
                      {quickViewTicket.complaint_technicians.slice().sort((a: any, b: any) => {
                        if (a.is_lead === b.is_lead) return 0;
                        return a.is_lead ? -1 : 1;
                      }).map((ct: any, idx: number) => (
                        <p key={idx} className={`text-xs font-semibold ${ct.is_lead ? "text-primary" : "text-foreground"}`}>
                          {ct.is_lead ? "👑 " : ""}{ct.technician?.full_name || "Technician"}
                          {ct.is_lead && <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 px-1 rounded">Lead</span>}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="font-bold text-primary">
                      {quickViewTicket.assigned_technician || "Unassigned"}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Supervisor: {quickViewTicket.assigned_supervisor || "Standard Triage"}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/40 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Current Workflow Phase
                  </span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    Phase {quickViewTicket.current_phase || 1} / 6
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  variant="outline"
                  onClick={() => setQuickViewTicket(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  Dismiss
                </Button>
                <Button
                  onClick={() => {
                    navigate(`/complaints/${quickViewTicket.id}`);
                    setQuickViewTicket(null);
                  }}
                  className="gradient-primary text-white rounded-xl text-xs font-bold gap-1.5 shadow-glow"
                >
                  Open Full Ticket <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 👤 MODAL 2: TECHNICIAN PROFILE INSPECTION */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-md w-full rounded-3xl p-6 sm:p-7 relative border border-border/80 shadow-2xl flex flex-col gap-6"
            >
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-5 right-5 text-muted-foreground hover:text-foreground rounded-xl p-1.5 hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Profile Header */}
              <div className="flex items-center gap-4 border-b border-border/40 pb-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase shadow-md ${
                    selectedMember.role === "admin"
                      ? "bg-rose-500"
                      : selectedMember.role === "supervisor"
                      ? "bg-indigo-500"
                      : selectedMember.role === "technician"
                      ? "bg-amber-500"
                      : "bg-teal-500"
                  }`}
                >
                  {selectedMember.full_name?.charAt(0) ||
                    selectedMember.email?.charAt(0).toUpperCase() ||
                    "U"}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">
                    {selectedMember.full_name || "Staff Member"}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block mt-1 ${
                      selectedMember.role === "admin"
                        ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        : selectedMember.role === "supervisor"
                        ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                        : selectedMember.role === "technician"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-teal-500/10 text-teal-600 border border-teal-500/20"
                    }`}
                  >
                    {selectedMember.role}
                  </span>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                      Email Contact
                    </span>
                    <a
                      href={`mailto:${selectedMember.email}`}
                      className="font-bold text-foreground hover:underline truncate block"
                    >
                      {selectedMember.email || "N/A"}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                      Direct Phone
                    </span>
                    <a
                      href={`tel:${selectedMember.phone}`}
                      className="font-bold text-foreground hover:underline block"
                    >
                      {selectedMember.phone || "Not provided"}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                  <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                      Readiness Status
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          selectedMember.available ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="font-bold text-foreground">
                        {selectedMember.available
                          ? "Available (Ready for assignment)"
                          : "Busy (Engaged on active task)"}
                      </span>
                    </div>
                  </div>
                </div>

                {(selectedMember.role === "supervisor" ||
                  selectedMember.role === "technician") && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                      Specialties & Skillsets
                    </span>
                    {selectedMember.expertise ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMember.expertise.split(",").map((exp: string) => (
                          <span
                            key={exp}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-card border border-border/60 text-foreground rounded-md shadow-sm"
                          >
                            <Wrench className="w-3 h-3 text-primary" /> {exp.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        General Field Systems
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMember(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    navigate("/assignments");
                    setSelectedMember(null);
                  }}
                  className="gradient-primary text-white rounded-xl text-xs font-bold gap-1 shadow-glow"
                >
                  Dispatch Tasks <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
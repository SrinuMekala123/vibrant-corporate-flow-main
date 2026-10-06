import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, MapPin, Clock, Loader2, X, Calendar, Upload, Download, FileText, Trash2, CheckSquare, Square, Eye, Wrench, UserPlus, Navigation, Edit2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge, SeverityBadge, getEffectiveComplaintStatus } from "@/components/Badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { complaintService, formatComplaintTicketId } from "@/services/complaintService";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ExportButton from "@/components/ExportButton";
import ComplaintImportModal from "@/components/ComplaintImportModal";
import { generateSampleCSV, downloadCSV } from "@/utils/csvHelpers";
import { toast } from "sonner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

const statusFilters = [
  "all",
  "unassigned",
  "assigned",
  "reassigned",
  "in-progress",
  "dispatched",
  "completed",
  "closed"
];

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

const ComplaintsList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isComplaintImportOpen, setIsComplaintImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const downloadSample = () => {
    const csv = generateSampleCSV("complaint");
    downloadCSV(csv, "complaint_sample.csv");
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setBulkDeleteConfirmOpen(false);
    setIsBulkDeleting(true);
    try {
      const { deleted, blocked, failed } = await complaintService.deleteMany(Array.from(selectedIds));

      if (deleted.length > 0) {
        const currentData = queryClient.getQueryData(["complaints", user?.id, user?.role]);
        if (currentData && Array.isArray(currentData)) {
          const updatedData = currentData.filter((item: any) => deleted.includes(item.id));
          queryClient.setQueryData(["complaints", user?.id, user?.role], updatedData);
        }
        await queryClient.invalidateQueries({ queryKey: ["complaints"] });
      }

      if (deleted.length > 0 && blocked.length === 0 && failed.length === 0) {
        toast.success(`Successfully deleted ${deleted.length} complaint(s)`);
      } else if (deleted.length > 0 && blocked.length > 0) {
        toast.warning(`${deleted.length} deleted, ${blocked.length} blocked by database permissions. Removed from current view.`);
      } else if (blocked.length > 0) {
        toast.error(`Delete blocked by database permissions for ${blocked.length} complaint(s). Contact administrator.`);
      } else {
        toast.error(`Failed to delete ${failed.length} complaint(s).`);
      }

      setSelectedIds(new Set());
    } catch (e: any) {
      console.error("Bulk delete error:", e);
      toast.error(e.message || "Failed to delete complaints.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    setIsDeletingId(id);
    try {
      await complaintService.delete(id);

      const currentData = queryClient.getQueryData(["complaints", user?.id, user?.role]);
      if (currentData && Array.isArray(currentData)) {
        const updatedData = currentData.filter((item: any) => item.id !== id);
        queryClient.setQueryData(["complaints", user?.id, user?.role], updatedData);
      }
      await queryClient.invalidateQueries({ queryKey: ["complaints"] });

      toast.success("Complaint deleted successfully.");
      setDeleteConfirmId(null);
    } catch (e: any) {
      console.error(`Failed to delete complaint ${id}:`, e);
      if (e?.message === "DELETE_BLOCKED") {
        toast.error("Delete blocked by database permissions. Contact administrator.");
      } else {
        toast.error(e.message || "Failed to delete complaint.");
      }
    } finally {
      setIsDeletingId(null);
    }
  };

  const { user, isRole } = useAuth();

  // If a technician navigates to All Complaints list, redirect to their dedicated dashboard
  useEffect(() => {
    if (isRole("technician")) {
      navigate("/technician-dashboard", { replace: true });
    }
  }, [user, navigate]);

  // Fetch complaints based on role (Unified across all status tabs)
  const { data: complaints, isLoading, error, refetch } = useQuery({
    queryKey: ["complaints", user?.id, user?.role],
    queryFn: async () => {
      let allComplaints = await complaintService.getAll();

      if (isRole("customer")) {
        const { data: custRec } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', user?.id)
          .maybeSingle();
        const custTableId = custRec?.id;

        allComplaints = allComplaints.filter(t =>
          t.customer_id === user?.id ||
          (custTableId && t.customer_id === custTableId) ||
          (user?.email && t.customer_email?.toLowerCase() === user.email.toLowerCase())
        );
      } else if (isRole("technician")) {
        const techName = user?.name?.toLowerCase().trim() || "";
        allComplaints = allComplaints.filter(t => {
          if (t.assigned_to === user?.id) return true;
          if (techName && t.assigned_technician && t.assigned_technician.toLowerCase().includes(techName)) return true;
          if (t.assigned_technician === user?.id) return true;
          if (t.complaint_technicians && t.complaint_technicians.some((ct: any) => ct.technician_id === user?.id)) return true;
          return false;
        });
      } else if (isRole("supervisor")) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id)
          .single();
        const supervisorName = (profile?.full_name || user?.name || '').toLowerCase().trim();
        allComplaints = allComplaints.filter(t => 
          t.assigned_supervisor && t.assigned_supervisor.toLowerCase().includes(supervisorName)
        );
      }
      return allComplaints;
    },
    enabled: !!user,
    staleTime: 15000,
  });

  // ⚡ Live Real-time listener for Complaints List
  useEffect(() => {
    const channel = supabase
      .channel("complaints-list-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["complaints"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch customers lookup to accurately distinguish registered/admin-created BTL customers from walk-ins
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers-lookup', user?.id],
    queryFn: async () => {
      try {
        const [{ data: customersData }, { data: profilesData }] = await Promise.all([
          supabase.from('customers').select('id, user_id, full_name, phone, customer_type'),
          supabase.from('profiles').select('id, full_name, phone, role, customer_type').eq('role', 'customer')
        ]);
        const combined = [
          ...(customersData || []),
          ...(profilesData || []).map((p: any) => ({
            id: p.id,
            user_id: p.id,
            full_name: p.full_name,
            phone: p.phone,
            customer_type: p.customer_type || 'Retail'
          }))
        ];
        return combined;
      } catch (e) {
        console.warn("Failed to fetch customer lookup:", e);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return String(dateStr);
    }
  };

  const getAssignedTechNames = (ticket: any): string[] => {
    const names: string[] = [];
    if (Array.isArray(ticket.complaint_technicians) && ticket.complaint_technicians.length > 0) {
      ticket.complaint_technicians.forEach((ct: any) => {
        const name = ct.technician?.full_name || ct.profiles?.full_name || ct.full_name;
        if (name && !names.includes(name)) {
          names.push(name);
        }
      });
    }
    if (ticket.assigned_technician) {
      ticket.assigned_technician.split(",").forEach((t: string) => {
        const clean = t.trim();
        if (clean && !names.includes(clean)) {
          names.push(clean);
        }
      });
    }
    return names;
  };

  const getCustomerBadgeInfo = (ticket: any) => {
    const rawCoverage = (ticket.coverage || "").toLowerCase().trim();
    const rawChargeable = String(ticket.chargeable_service || "").toLowerCase().trim();
    const explicitType = (ticket.customer_type || "").toLowerCase().trim();

    // 1. Explicit Walk-in / Non-BTL flag on ticket
    if (explicitType === "walk-in" || explicitType.includes("non-btl") || explicitType === "new / non-btl customer") {
      return { isNonBtl: true, label: "Walk-in / Non-BTL" };
    }

    // 2. Explicit BTL customer flag on ticket
    if (explicitType === "existing btl customer" || explicitType === "btl") {
      return { isNonBtl: false, label: "BTL Customer" };
    }

    // 3. Under Warranty / Non-chargeable service -> By definition BTL Customer
    if (
      rawCoverage.includes("under warranty") || 
      rawCoverage === "warranty" || 
      rawChargeable === "no" || 
      rawChargeable === "false"
    ) {
      return { isNonBtl: false, label: "BTL Customer" };
    }

    // 4. Check if linked via customer_id in customers or profiles
    if (ticket.customer_id) {
      const matchedCust = allCustomers.find((c: any) => c.id === ticket.customer_id || c.user_id === ticket.customer_id);
      if (matchedCust) {
        const cType = (matchedCust.customer_type || "").toLowerCase().trim();
        if (cType === "walk-in" || cType.includes("non-btl")) {
          return { isNonBtl: true, label: "Walk-in / Non-BTL" };
        }
        return { isNonBtl: false, label: "BTL Customer" };
      }
      return { isNonBtl: false, label: "BTL Customer" };
    }

    // 5. Check by customer phone in directory
    if (ticket.customer_phone) {
      const last10 = ticket.customer_phone.replace(/\D/g, "").slice(-10);
      if (last10.length === 10) {
        const matchedCust = allCustomers.find((c: any) => (c.phone || "").replace(/\D/g, "").slice(-10) === last10);
        if (matchedCust) {
          const cType = (matchedCust.customer_type || "").toLowerCase().trim();
          if (cType === "walk-in" || cType.includes("non-btl")) {
            return { isNonBtl: true, label: "Walk-in / Non-BTL" };
          }
          return { isNonBtl: false, label: "BTL Customer" };
        }
      }
    }

    // 6. Check by customer name
    if (ticket.customer_name) {
      const normName = ticket.customer_name.trim().toLowerCase();
      const matchedCust = allCustomers.find((c: any) => (c.full_name || "").trim().toLowerCase() === normName);
      if (matchedCust) {
        const cType = (matchedCust.customer_type || "").toLowerCase().trim();
        if (cType === "walk-in" || cType.includes("non-btl")) {
          return { isNonBtl: true, label: "Walk-in / Non-BTL" };
        }
        return { isNonBtl: false, label: "BTL Customer" };
      }
    }

    // 7. If Out of warranty + Chargeable service + not in directory -> Walk-in / Non-BTL
    if (rawCoverage.includes("out of warranty") && (rawChargeable === "yes" || rawChargeable === "true" || ticket.service_charge > 0)) {
      return { isNonBtl: true, label: "Walk-in / Non-BTL" };
    }

    // Default for standard enterprise customer tickets
    return { isNonBtl: false, label: "BTL Customer" };
  };

  const debouncedSearch = useDebounce(search, 300);

  // Reset pagination on search, status filter or date filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, fromDate, toDate]);

  // Client-side search, status, and date range filters
  const filtered = complaints?.filter((t) => {
    const techNames = getAssignedTechNames(t).join(" ").toLowerCase();
    const matchSearch =
      t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.id?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.ticket_id?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.assigned_technician?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      techNames.includes(debouncedSearch.toLowerCase()) ||
      t.assigned_supervisor?.toLowerCase().includes(debouncedSearch.toLowerCase());

    const effectiveStatus = getEffectiveComplaintStatus(t);

    let matchStatus = false;
    if (statusFilter === "all") {
      matchStatus = true;
    } else if (statusFilter === "active") {
      matchStatus = effectiveStatus !== "completed" && effectiveStatus !== "closed";
    } else if (statusFilter === "completed") {
      matchStatus = effectiveStatus === "completed";
    } else if (statusFilter === "closed") {
      matchStatus = effectiveStatus === "closed";
    } else if (statusFilter === "reassigned") {
      matchStatus = effectiveStatus === "reassigned";
    } else if (statusFilter === "in-progress" || statusFilter === "in_progress") {
      matchStatus = (effectiveStatus === "in-progress" || effectiveStatus === "in_progress");
    } else {
      matchStatus = effectiveStatus === statusFilter;
    }

    let matchDate = true;
    if (fromDate || toDate) {
      const ticketDate = new Date(t.created_at);
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        if (ticketDate < start) matchDate = false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (ticketDate > end) matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchDate;
  }) || [];

  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const saved = localStorage.getItem('complaints_items_per_page');
    return saved ? Number(saved) : 10;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Always include page 1
    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2.5 font-medium text-muted-foreground">Loading complaints database...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive border border-destructive/20 bg-destructive/5 rounded-2xl">
        <p className="font-bold">Error loading complaints</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Retry Request
        </Button>
      </div>
    );
  }

  // Complaint Stats Calculation
  const complaintStats = {
    total: complaints?.length || 0,
    open: complaints?.filter(c => !["completed", "closed"].includes(c.status)).length || 0,
    reassigned: complaints?.filter(c => getEffectiveComplaintStatus(c) === "reassigned").length || 0,
    urgent: complaints?.filter(c => c.severity === "major" && c.status !== "closed").length || 0,
    completed: complaints?.filter(c => ["completed", "closed"].includes(c.status)).length || 0,
  };

  return (
    <div className="space-y-8 relative pb-12">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10" />

      {/* Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-amber-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Clock className="w-3.5 h-3.5" /> SERVICE OPERATIONS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              {isRole("customer") ? "My Service Requests" : "Complaints & Service Center"}
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
              {isRole("customer")
                ? "Track and manage your registered complaints, technician visits, and resolution proofs."
                : isRole("technician")
                  ? "View your assigned field work orders, update live workflow phases, and upload service evidence."
                  : "Central dispatch hub to triage incoming tickets, monitor SLAs, and verify field completion sign-offs."
              }
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3 shrink-0">
            {/* Export & Import Actions for Admin & Supervisors */}
            {!isRole("customer") && (
              <>
                <ExportButton variant="complaint" />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSample}
                  className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
                  title="Download Sample CSV Template"
                >
                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Sample CSV</span>
                </Button>

                {isRole("admin") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsComplaintImportOpen(true)}
                    className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
                    title="Bulk Import Complaints from CSV"
                  >
                    <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Import CSV</span>
                  </Button>
                )}
              </>
            )}

            {/* New Complaint Button */}
            {isRole("admin", "customer") && (
              <Link to="/complaints/new">
                <Button className="gradient-primary text-white shadow-glow hover:opacity-95 rounded-xl h-10 px-4 font-bold text-xs gap-1.5">
                  <Plus className="w-4 h-4" /> New Complaint
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 📊 Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
        <div 
          onClick={() => setStatusFilter("all")}
          className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between cursor-pointer hover:border-primary/40 hover:shadow-glow transition-all"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">Total Registered</span>
            <span className="text-2xl font-black text-foreground mt-0.5 block">{complaintStats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter("active")}
          className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500/40 hover:shadow-glow transition-all"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 block">In-Flight Tasks</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{complaintStats.open}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Loader2 className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter("all")}
          className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between cursor-pointer hover:border-rose-500/40 hover:shadow-glow transition-all"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Critical Issues</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{complaintStats.urgent}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <Plus className="w-5 h-5 rotate-45 text-rose-500" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter("completed")}
          className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500/40 hover:shadow-glow transition-all"
        >
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Resolved</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{complaintStats.completed}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Filters (Admin / Supervisor Only) */}
      {isRole("admin", "supervisor") && (
        <div className="glass-card rounded-2xl p-5 space-y-4 relative z-10 border border-border/60">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by ticket ID, title, customer, technician, or supervisor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 rounded-xl border-border/60"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                <div className="relative w-full sm:w-auto">
                  <Input
                    type={fromDate ? "date" : "text"}
                    placeholder="dd/mm/yyyy"
                    value={fromDate}
                    onFocus={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onBlur={(e) => {
                      if (!fromDate) e.currentTarget.type = "text";
                    }}
                    onClick={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFromDate(val);
                      if (toDate && val > toDate) {
                        setToDate("");
                      }
                    }}
                    className="rounded-xl border-border/60 text-xs w-full sm:w-[140px] h-10 pl-8 pr-2.5 bg-slate-950/20 cursor-pointer"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                <div className="relative w-full sm:w-auto">
                  <Input
                    type={toDate ? "date" : "text"}
                    placeholder="dd/mm/yyyy"
                    value={toDate}
                    min={fromDate}
                    onFocus={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onBlur={(e) => {
                      if (!toDate) e.currentTarget.type = "text";
                    }}
                    onClick={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-xl border-border/60 text-xs w-full sm:w-[140px] h-10 pl-8 pr-2.5 bg-slate-950/20 cursor-pointer"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              {(fromDate || toDate) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFromDate(""); setToDate(""); }}
                      className="text-xs h-9 px-2 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-start"
                    >
                      <X className="w-3.5 h-3.5" /> Clear
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Clear date filter</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                  statusFilter === s
                    ? "gradient-primary text-white border-primary/20 shadow-glow"
                    : "bg-muted text-muted-foreground border-border/40 hover:bg-muted/80"
                }`}
              >
              {s === "all" ? "All Tickets" : s.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex justify-end">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "table" | "card")} className="bg-muted/60 p-0.5 rounded-lg border border-border/60">
            <ToggleGroupItem value="table" size="sm" className="text-[11px] font-semibold h-8 px-2.5 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
              List View
            </ToggleGroupItem>
            <ToggleGroupItem value="card" size="sm" className="text-[11px] font-semibold h-8 px-2.5 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
              Card View
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      )}

      {/* Filters (Customer / Technician Only) */}
      {isRole("customer", "technician") && (
        <div className="glass-card rounded-2xl p-5 space-y-4 relative z-10 border border-border/60">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isRole("customer") ? "Search my service requests..." : "Search my assigned complaints..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 rounded-xl border-border/60"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                <div className="relative w-full sm:w-auto">
                  <Input
                    type={fromDate ? "date" : "text"}
                    placeholder="dd/mm/yyyy"
                    value={fromDate}
                    onFocus={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onBlur={(e) => {
                      if (!fromDate) e.currentTarget.type = "text";
                    }}
                    onClick={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFromDate(val);
                      if (toDate && val > toDate) {
                        setToDate("");
                      }
                    }}
                    className="rounded-xl border-border/60 text-xs w-full sm:w-[140px] h-10 pl-8 pr-2.5 bg-slate-950/20 cursor-pointer"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                <div className="relative w-full sm:w-auto">
                  <Input
                    type={toDate ? "date" : "text"}
                    placeholder="dd/mm/yyyy"
                    value={toDate}
                    min={fromDate}
                    onFocus={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onBlur={(e) => {
                      if (!toDate) e.currentTarget.type = "text";
                    }}
                    onClick={(e) => {
                      e.currentTarget.type = "date";
                      try { e.currentTarget.showPicker(); } catch (err) {}
                    }}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-xl border-border/60 text-xs w-full sm:w-[140px] h-10 pl-8 pr-2.5 bg-slate-950/20 cursor-pointer"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              {(fromDate || toDate) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFromDate(""); setToDate(""); }}
                      className="text-xs h-9 px-2 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-start"
                    >
                      <X className="w-3.5 h-3.5" /> Clear
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Clear date filter</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "reassigned", label: "Reassigned" },
              { id: "completed", label: "Completed" },
              { id: "closed", label: "Closed" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                  statusFilter === tab.id
                    ? "gradient-primary text-white border-primary/20 shadow-glow"
                    : "bg-muted text-muted-foreground border-border/40 hover:bg-muted/80"
                }`}
              >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex justify-end">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "table" | "card")} className="bg-muted/60 p-0.5 rounded-lg border border-border/60">
            <ToggleGroupItem value="table" size="sm" className="text-[11px] font-semibold h-8 px-2.5 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
              List View
            </ToggleGroupItem>
            <ToggleGroupItem value="card" size="sm" className="text-[11px] font-semibold h-8 px-2.5 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
              Card View
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      )}

      {/* Tickets Content */}
      <div className="relative z-10">
        <div className="space-y-4">
        {/* Selection Bar */}
        {isRole("admin", "supervisor") && selectedIds.size > 0 && (
          <div className="sticky top-2 z-20 flex items-center justify-between p-3 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl mb-4 shadow-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-slate-600 hover:text-slate-800"
              >
                {selectedIds.size === filtered.length ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <span className="text-sm font-medium text-slate-700">
                {selectedIds.size} of {filtered.length} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-600 hover:text-slate-800"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                disabled={isBulkDeleting}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9 px-4 shadow-sm"
              >
                {isBulkDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1.5" />
                )}
                Delete {selectedIds.size} rows
              </Button>
            </div>
          </div>
        )}
          
          {viewMode === "table" && (
            <div>
              <div className="relative overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-foreground font-semibold border-b border-border/60 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          {selectedIds.size === filtered.length ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Ticket ID</th>
                      <th className="py-3 px-4">Customer &amp; Site</th>
                      <th className="py-3 px-4">Technician(s)</th>
                      <th className="py-3 px-4">Scheduled Visit</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginatedItems.map((ticket) => {
                      const assignedTechs = getAssignedTechNames(ticket);
                      const badgeInfo = getCustomerBadgeInfo(ticket);
                      const custName = ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || 'Customer';
                      const siteAddress = ticket.location || "";

                      return (
                        <tr key={ticket.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(ticket.id) ? 'bg-blue-50/60' : ''}`}>
                          {/* Checkbox */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(ticket.id);
                              }}
                              className="text-slate-600 hover:text-slate-800"
                            >
                              {selectedIds.has(ticket.id) ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Ticket ID & Badges */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/complaints/${ticket.id}`); }}
                              className="font-mono font-bold text-primary hover:underline text-xs"
                            >
                              {formatComplaintTicketId(ticket)}
                            </button>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
                              {(ticket.chargeable_service === "Yes" || (ticket as any).is_chargeable) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Chargeable
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Customer & Site */}
                          <td className="py-3 px-4 min-w-[180px]">
                            <div
                              className="flex items-center gap-1.5 flex-wrap cursor-pointer"
                              onClick={() => navigate(`/complaints/${ticket.id}`)}
                            >
                              <span className="font-semibold text-slate-800 hover:text-primary transition-colors">
                                {custName}
                              </span>
                              {badgeInfo.isNonBtl ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300">
                                  Walk-in / Non-BTL
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  BTL Customer
                                </span>
                              )}
                            </div>
                            {siteAddress && (
                              <p className="text-slate-500 text-[11px] truncate mt-0.5 max-w-[220px]" title={siteAddress}>
                                <MapPin className="w-3 h-3 inline mr-1 text-slate-400 shrink-0" />
                                {siteAddress}
                              </p>
                            )}
                          </td>

                          {/* Technician(s) */}
                          <td className="py-3 px-4">
                            {assignedTechs.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {assignedTechs.map((name: string, i: number) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  >
                                    <Wrench className="w-2.5 h-2.5" /> {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unassigned</span>
                            )}
                          </td>

                          {/* Scheduled Visit */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {ticket.scheduled_date ? (
                              <div className="text-xs">
                                <p className="font-semibold text-slate-700 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {formatDate(ticket.scheduled_date)}
                                </p>
                                {ticket.scheduled_time && (
                                  <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {ticket.scheduled_time}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Not scheduled</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {ticket.status && <StatusBadge status={getEffectiveComplaintStatus(ticket)} ticket={ticket} />}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/complaints/${ticket.id}`);
                                }}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-primary"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/complaints/${ticket.id}`);
                                }}
                                className="h-8 px-2.5 text-xs text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold rounded-lg"
                                title="Open workflow"
                              >
                                <Wrench className="w-3.5 h-3.5 mr-1" /> Workflow
                              </Button>
                              {isRole("admin", "supervisor") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/complaints/${ticket.id}/edit`);
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                  title="Edit complaint"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              {(ticket.customer_lat && ticket.customer_lng) || (ticket.location && ticket.location.trim() !== "") ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const cleanLoc = ticket.location?.trim();
                                    const hasCoords =
                                      typeof ticket.customer_lat === 'number' && typeof ticket.customer_lng === 'number' &&
                                      ticket.customer_lat >= 6 && ticket.customer_lat <= 38 && ticket.customer_lng >= 68 && ticket.customer_lng <= 98;
                                    const dest = cleanLoc ? encodeURIComponent(cleanLoc) : (hasCoords ? `${ticket.customer_lat},${ticket.customer_lng}` : '');
                                    if (dest) {
                                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, '_blank');
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                  title="Navigate to site"
                                >
                                  <Navigation className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {isRole("admin", "supervisor") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(ticket.id);
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                  title="Delete complaint"
                                >
                                  {isDeletingId === ticket.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No records match filters
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center md:hidden">
                Swipe horizontally to see more columns →
              </p>
            </div>
          )}
          
          {viewMode === "card" && (
            <div className="space-y-4">
              {paginatedItems.map((ticket, i) => {
                const assignedTechs = getAssignedTechNames(ticket);
                const badgeInfo = getCustomerBadgeInfo(ticket);

                return (
                  <Link
                    key={ticket.id}
                    to={`/complaints/${ticket.id}`}
                    className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/25 hover:shadow-glow transition-all duration-300 block group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    {(isRole("admin", "supervisor")) && (
                      <div className="absolute right-3 top-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(ticket.id);
                          }}
                          className={`shrink-0 ${selectedIds.has(ticket.id) ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {selectedIds.has(ticket.id) ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono text-primary font-bold">
                          {formatComplaintTicketId(ticket)}
                        </span>
                        {badgeInfo.isNonBtl ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300">
                            Walk-in / Non-BTL
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            BTL Customer
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">•</span>
                        {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
                        {(ticket.chargeable_service === "Yes" || (ticket as any).is_chargeable) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Chargeable
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">•</span>
                        {ticket.status && <StatusBadge status={getEffectiveComplaintStatus(ticket)} ticket={ticket} />}
                      </div>
                      
                      <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate" title={ticket.title}>{ticket.title}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-1 leading-relaxed">
                        {ticket.description}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-2.5">
                        <span>Customer: <span className="font-semibold text-primary">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || 'Customer'}</span></span>
                        <span>•</span>
                        <span>Raised on {formatIndianDateTime(ticket.created_at)}</span>
                      </div>

                      {(ticket.assigned_supervisor || assignedTechs.length > 0 || ticket.assigned_technician) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2 border-t border-border/20 pt-1.5">
                          {ticket.assigned_supervisor && (
                            <span>Supervisor: <span className="font-semibold text-foreground">{ticket.assigned_supervisor}</span></span>
                          )}
                          {ticket.assigned_supervisor && (assignedTechs.length > 0 || ticket.assigned_technician) && <span>•</span>}
                          {assignedTechs.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-xs text-muted-foreground mr-0.5">Technicians:</span>
                              {assignedTechs.map((name: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                                >
                                  <Wrench className="w-2.5 h-2.5" /> {name}
                                </span>
                              ))}
                            </div>
                          ) : ticket.assigned_technician ? (
                            <span>Technician: <span className="font-semibold text-foreground">{ticket.assigned_technician}</span></span>
                          ) : null}
                        </div>
                      )}
                    </div>

                     <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 text-xs text-muted-foreground shrink-0 border-t sm:border-t-0 sm:border-l border-border/30 pt-3 sm:pt-0 sm:pl-4 min-w-[140px]">
                       {ticket.location && (
                         <span className="flex items-center gap-1.5 font-semibold text-foreground/80 truncate max-w-[160px]">
                           <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                           {ticket.location.split(",")[0]}
                         </span>
                       )}
                       <span className="flex items-center gap-1.5">
                         <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                         Updated {formatIndianDateTime(ticket.updated_at)}
                       </span>
                       <div className="flex items-center gap-1">
                         {(ticket.customer_lat && ticket.customer_lng) || (ticket.location && ticket.location.trim() !== "") ? (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               const cleanLoc = ticket.location?.trim();
                               const hasCoords =
                                 typeof ticket.customer_lat === 'number' && typeof ticket.customer_lng === 'number' &&
                                 ticket.customer_lat >= 6 && ticket.customer_lat <= 38 && ticket.customer_lng >= 68 && ticket.customer_lng <= 98;
                               const dest = cleanLoc ? encodeURIComponent(cleanLoc) : (hasCoords ? `${ticket.customer_lat},${ticket.customer_lng}` : '');
                               if (dest) {
                                 window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, '_blank');
                               }
                             }}
                             className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                             title="Navigate to site"
                           >
                             <Navigation className="w-4 h-4" />
                           </button>
                         ) : null}
                         {isRole("admin", "supervisor") && (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               navigate(`/complaints/${ticket.id}/edit`);
                             }}
                             className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                             title="Edit complaint"
                           >
                             <Edit2 className="w-4 h-4" />
                           </button>
                         )}
                         {isRole("admin", "supervisor") && (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setDeleteConfirmId(ticket.id);
                             }}
                             className="shrink-0 text-slate-400 hover:text-rose-600 transition-colors"
                             title="Delete complaint"
                           >
                             {isDeletingId === ticket.id ? (
                               <Loader2 className="w-4 h-4 animate-spin" />
                             ) : (
                               <Trash2 className="w-4 h-4" />
                             )}
                           </button>
                         )}
                       </div>
                     </div>
                  </Link>
                );
              })}
              </div>
            )}

          {/* Enhanced Enterprise Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-between border-t border-border/40 pt-4 mt-6 gap-4 text-xs">
              {/* Left: Summary & Rows Per Page */}
              <div className="flex items-center gap-4 flex-wrap text-muted-foreground w-full md:w-auto justify-between md:justify-start">
                <p>
                  Showing <span className="font-bold text-foreground">{startIndex + 1}</span> to{" "}
                  <span className="font-bold text-foreground">
                    {Math.min(startIndex + itemsPerPage, filtered.length)}
                  </span>{" "}
                  of <span className="font-bold text-foreground">{filtered.length}</span> complaints
                </p>

                <div className="flex items-center gap-2 border-l border-border/60 pl-4">
                  <span className="font-medium text-slate-500">Rows per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setItemsPerPage(newSize);
                      localStorage.setItem('complaints_items_per_page', String(newSize));
                      setCurrentPage(1);
                    }}
                    className="bg-white dark:bg-slate-900 border border-border/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Right: Navigation Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end w-full md:w-auto">
                  {/* First Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="rounded-xl h-8 w-8 p-0"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>

                  {/* Previous Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl h-8 px-2.5 gap-1 font-medium"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => {
                      if (page === "...") {
                        return (
                          <span key={`dots-${index}`} className="px-1.5 text-muted-foreground text-xs font-bold select-none">
                            ...
                          </span>
                        );
                      }
                      const isCurrent = currentPage === page;
                      return (
                        <Button
                          key={`page-${page}`}
                          variant={isCurrent ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page as number)}
                          className={`w-8 h-8 p-0 rounded-xl font-bold text-xs transition-all ${
                            isCurrent
                              ? "gradient-primary text-white border-primary/20 shadow-glow pointer-events-none"
                              : "hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl h-8 px-2.5 gap-1 font-medium"
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>

                  {/* Last Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="rounded-xl h-8 w-8 p-0"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 glass-card rounded-2xl border border-border/60">
              <Loader2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <h3 className="font-bold text-foreground">No records match filters</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {complaints?.length === 0
                  ? isRole("customer")
                    ? "You haven't submitted any complaints yet."
                    : isRole("technician")
                      ? "No complaints assigned to your workload."
                      : "No complaints found in system databases."
                  : "Refine search parameters or filter statuses."}
              </p>
            </div>
          )}
        </div>
      </div>
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Complaint</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this complaint? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={isDeletingId === deleteConfirmId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteComplaint(deleteConfirmId)}
              disabled={isDeletingId === deleteConfirmId}
            >
              {isDeletingId === deleteConfirmId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => !open && setBulkDeleteConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Complaints</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected complaint(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteConfirmOpen(false)} disabled={isBulkDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete {selectedIds.size} rows
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComplaintImportModal
        open={isComplaintImportOpen}
        onOpenChange={setIsComplaintImportOpen}
        onImportSuccess={refetch}
      />
    </div>
  );
};

export default ComplaintsList;
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, MapPin, Clock, Loader2, X, Calendar, Upload, Download, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useQuery } from "@tanstack/react-query";
import { complaintService, formatComplaintTicketId } from "@/services/complaintService";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ExportButton from "@/components/ExportButton";
import ComplaintImportModal from "@/components/ComplaintImportModal";
import { generateSampleCSV, downloadCSV } from "@/utils/csvHelpers";

const statusFilters = [
  "all",
  "unassigned",
  "assigned",
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
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isComplaintImportOpen, setIsComplaintImportOpen] = useState(false);

  const downloadSample = () => {
    const csv = generateSampleCSV("complaint");
    downloadCSV(csv, "complaint_sample.csv");
  };

  const { user, isRole } = useAuth();

  // If a technician navigates to All Complaints list, redirect to their dedicated dashboard
  useEffect(() => {
    if (isRole("technician")) {
      navigate("/technician-dashboard", { replace: true });
    }
  }, [user, navigate]);

  // Fetch complaints based on role
  const { data: complaints, isLoading, error, refetch } = useQuery({
    queryKey: ["complaints", statusFilter, user?.id, user?.role],
    queryFn: async () => {
      let allComplaints = await complaintService.getAll();

      if (isRole("customer")) {
        allComplaints = allComplaints.filter(t => t.customer_id === user?.id);
      } else if (isRole("technician")) {
        allComplaints = allComplaints.filter(t =>
          t.assigned_technician === user?.name
        );
      } else if (isRole("supervisor")) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id)
          .single();
        const supervisorName = profile?.full_name || '';
        allComplaints = allComplaints.filter(t => t.assigned_supervisor === supervisorName);
      }
      return allComplaints;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const debouncedSearch = useDebounce(search, 300);

  // Reset pagination on search, status filter or date filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, fromDate, toDate]);

  // Client-side search, status, and date range filters
  const filtered = complaints?.filter((t) => {
    const matchSearch =
      t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.id?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.assigned_technician?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.assigned_supervisor?.toLowerCase().includes(debouncedSearch.toLowerCase());

    let matchStatus = false;
    if (statusFilter === "all") {
      matchStatus = true;
    } else if (statusFilter === "active") {
      matchStatus = t.status !== "completed" && t.status !== "closed";
    } else if (statusFilter === "completed") {
      matchStatus = t.status === "completed";
    } else if (statusFilter === "closed") {
      matchStatus = t.status === "closed";
    } else {
      matchStatus = t.status === statusFilter;
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

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 1);
      let end = Math.min(totalPages, currentPage + 1);
      
      if (currentPage === 1) {
        end = 3;
      }
      if (currentPage === totalPages) {
        start = totalPages - 2;
      }
      
      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push("...");
        }
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages) {
        if (end < totalPages - 1) {
          pages.push("...");
        }
        pages.push(totalPages);
      }
    }
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
        </div>
      )}

      {/* Tickets Content */}
      <div className="relative z-10">
        <div className="space-y-4">
          {paginatedItems.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to={`/complaints/${ticket.id}`}
                className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/25 hover:shadow-glow transition-all duration-300 block group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-mono text-primary font-bold">
                      {formatComplaintTicketId(ticket)}
                    </span>
                    {ticket.customer_type === 'New / Non-BTL Customer' || ticket.customer_type === 'Non-BTL' || ticket.customer_type === 'Walk-in' || (!ticket.customer_id && !ticket.customer_name) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Walk-in / Non-BTL
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Existing Customer
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">•</span>
                    {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
                    {ticket.status && <StatusBadge status={ticket.status} />}
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

                  {(ticket.assigned_supervisor || ticket.assigned_technician) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1 border-t border-border/20 pt-1.5 max-w-fit">
                      {ticket.assigned_supervisor && (
                        <span>Supervisor: <span className="font-semibold text-foreground">{ticket.assigned_supervisor}</span></span>
                      )}
                      {ticket.assigned_supervisor && ticket.assigned_technician && <span>•</span>}
                      {ticket.assigned_technician && (
                        <span>Technician: <span className="font-semibold text-foreground">{ticket.assigned_technician}</span></span>
                      )}
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
                </div>
              </Link>
            </motion.div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-end border-t border-border/30 pt-4 mt-6 gap-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(startIndex + itemsPerPage, filtered.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filtered.length}</span> complaints
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl h-8 px-2.5"
                >
                  Previous
                </Button>
                {getPageNumbers().map((page, index) => {
                  if (page === "...") {
                    return (
                      <span key={`dots-${index}`} className="px-2 text-muted-foreground text-xs font-bold">
                        ...
                      </span>
                    );
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page as number)}
                      className={`w-8 h-8 p-0 rounded-xl font-bold text-xs ${
                        currentPage === page ? "gradient-primary text-white border-primary/20 shadow-glow" : ""
                      }`}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl h-8 px-2.5"
                >
                  Next
                </Button>
              </div>
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
      <ComplaintImportModal
        open={isComplaintImportOpen}
        onOpenChange={setIsComplaintImportOpen}
        onImportSuccess={refetch}
      />
    </div>
  );
};

export default ComplaintsList;
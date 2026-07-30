import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, MapPin, Clock, Loader2, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const statusFilters = [
  "all",
  "open",
  "assigned",
  "in_progress",
  "pir_pending",
  "pir_approved",
  "rework_required",
  "pending_verification",
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
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { user, isRole } = useAuth();

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
      matchStatus = t.status !== "pending_verification" && t.status !== "closed";
    } else if (statusFilter === "pending_verification") {
      matchStatus = t.status === "pending_verification";
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

  return (
    <div className="space-y-8 relative">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-10 right-10 bg-primary/10" />
      <div className="bg-ambient-blur bottom-20 left-20 bg-amber-500/10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6 relative z-10">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-gradient">
            {isRole("customer") ? "My Service Requests" : "Complaints Center"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRole("customer")
              ? "Track your power backup and electrical complaints."
              : isRole("technician")
                ? "View and log status logs for active field orders."
                : "Manage administrative workflows, route dispatches, and verify completions."
            }
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          {/* New Complaint Button */}
          {isRole("admin", "customer") && (
            <Link to="/complaints/new">
              <Button className="gradient-primary text-white shadow-glow hover:opacity-95 rounded-xl h-10 px-4">
                <Plus className="w-4 h-4 mr-1.5" /> New Complaint
              </Button>
            </Link>
          )}
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
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                  <div className="relative flex-1 sm:w-auto">
                    <Input
                      type="date"
                      value={fromDate}
                      onClick={(e) => e.currentTarget.showPicker()}
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
                    {!fromDate && (
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none select-none z-10 bg-background px-1">dd/mm/yyyy</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                  <div className="relative flex-1 sm:w-auto">
                    <Input
                      type="date"
                      value={toDate}
                      min={fromDate}
                      onClick={(e) => e.currentTarget.showPicker()}
                      onChange={(e) => setToDate(e.target.value)}
                      className="rounded-xl border-border/60 text-xs w-full sm:w-[140px] h-10 pl-8 pr-2.5 bg-slate-950/20 cursor-pointer"
                    />
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    {!toDate && (
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none select-none z-10 bg-background px-1">dd/mm/yyyy</span>
                    )}
                  </div>
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
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                  <div className="relative flex-1 sm:w-auto">
                    <Input
                      type="date"
                      value={fromDate}
                      onClick={(e) => e.currentTarget.showPicker()}
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
                    {!fromDate && (
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none select-none z-10 bg-background px-1">dd/mm/yyyy</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                  <div className="relative flex-1 sm:w-auto">
                    <Input
                      type="date"
                      value={toDate}
                      min={fromDate}
                      onClick={(e) => e.currentTarget.showPicker()}
                      onChange={(e) => setToDate(e.target.value)}
                      className="rounded-xl border-border/60 text-xs w-full sm:w-[140px] h-10 pl-8 pr-2.5 bg-slate-950/20 cursor-pointer"
                    />
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    {!toDate && (
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none select-none z-10 bg-background px-1">dd/mm/yyyy</span>
                    )}
                  </div>
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
              { id: "pending_verification", label: "Completed" },
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
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono text-primary font-bold">
                      FSM-{ticket.id.slice(0, 4).toUpperCase()}
                    </span>
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
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/30 pt-4 mt-6 gap-4">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{filtered.length}</span> complaints
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
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
    </div>
  );
};

export default ComplaintsList;
import { useState, useEffect, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Printer, Download, Wrench, AlertCircle, Layers, Navigation, Phone, Clock, MapPin, User } from "lucide-react";
import DatePicker from "react-datepicker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import "react-datepicker/dist/react-datepicker.css";
import { formatComplaintTicketId } from "@/services/complaintService";
import { formatInstallationTicketId } from "@/services/installationService";

export interface UnifiedScheduleTask {
  id: string;
  raw_id: string;
  task_type: "complaint" | "installation";
  ticket_id: string;
  scheduled_date: string;
  scheduled_time: string;
  technician_name: string;
  technician_id_display: string;
  assigned_technician_ids: string[];
  assigned_supervisor?: string | null;
  client_name: string;
  contact_number: string;
  address: string;
  notes_description: string;
  status: string;
}

const formatDateToYYYYMMDD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTechId = (t: any): string => {
  if (!t) return "";
  if (t.technician_id && String(t.technician_id).trim()) return String(t.technician_id).trim();
  if (t.employee_id && String(t.employee_id).trim()) return String(t.employee_id).trim();
  if (t.employeeId && String(t.employeeId).trim()) return String(t.employeeId).trim();
  if (t.id) {
    return `TECH-${String(t.id).replace(/-/g, "").slice(0, 4).toUpperCase()}`;
  }
  return "";
};

const formatText = (text?: string, maxLen = 45) => {
  if (!text) return "N/A";
  return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text;
};

const getStatusBadgeClass = (status?: string) => {
  const s = (status || "").toLowerCase().trim();
  if (["completed", "resolved", "closed", "site completed and handed over"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["in-progress", "in_progress", "inprogress", "work in progress", "configuration pending"].includes(s)) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (["assigned", "pending"].includes(s)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (["pending due to material shortage", "signature pending due to client unavailability"].includes(s)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
};

const DailySchedule = () => {
  const { user } = useAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Hide floating icons during print if present
  useEffect(() => {
    document.body.classList.add("hide-header-icons");
    return () => {
      document.body.classList.remove("hide-header-icons");
    };
  }, []);

  const [fromDate, setFromDate] = useState<Date>(today);
  const [toDate, setToDate] = useState<Date>(today);
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [technicianSearch, setTechnicianSearch] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState<"all" | "installation" | "complaint">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const ITEMS_PER_PAGE = 20;

  const fromDateStr = formatDateToYYYYMMDD(fromDate);
  const toDateStr = formatDateToYYYYMMDD(toDate);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [fromDateStr, toDateStr, selectedTechnician, taskTypeFilter]);

  // Fetch Technicians list
  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians-list-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "technician")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTechnicians = useMemo(() => {
    if (!technicianSearch.trim()) return technicians;
    const q = technicianSearch.toLowerCase();
    return technicians.filter((t: any) =>
      (t.full_name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.phone || "").toLowerCase().includes(q)
    );
  }, [technicians, technicianSearch]);

  // Fetch Scheduled Complaints
  const { data: complaintsData = [], isLoading: isComplaintsLoading, refetch: refetchComplaints } = useQuery({
    queryKey: ["daily-schedule-complaints", fromDateStr, toDateStr],
    queryFn: async () => {
      console.log("Querying complaints for schedule:", fromDateStr, toDateStr);
      let complaintsResult: any[] = [];
      try {
        const { data, error } = await supabase
          .from("complaints")
          .select(`
            id,
            ticket_id,
            title,
            description,
            status,
            scheduled_date,
            scheduled_time,
            assigned_to,
            assigned_technician,
            assigned_supervisor,
            customer_name,
            customer_phone,
            location,
            location_id,
            complaint_technicians (
              id,
              technician_id,
              is_lead,
              technician:technician_id (
                id,
                full_name,
                phone,
                email,
                technician_id,
                employee_id
              )
            )
          `)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", fromDateStr)
          .lte("scheduled_date", toDateStr)
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .order("scheduled_time", { ascending: true, nullsFirst: false });

        if (!error && data) {
          complaintsResult = data;
        } else {
          throw error;
        }
      } catch (err) {
        console.warn("Retrying complaints query without junction table:", err);
        const { data, error } = await supabase
          .from("complaints")
          .select(`
            id,
            title,
            description,
            status,
            scheduled_date,
            scheduled_time,
            assigned_to,
            assigned_technician,
            assigned_supervisor,
            customer_name,
            customer_phone,
            location,
            location_id
          `)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", fromDateStr)
          .lte("scheduled_date", toDateStr)
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .order("scheduled_time", { ascending: true, nullsFirst: false });

        if (error) {
          console.error("Error fetching scheduled complaints:", error);
          throw error;
        }
        complaintsResult = data || [];
      }
      return complaintsResult;
    },
  });

  // Fetch Scheduled Installations
  const { data: installationsData = [], isLoading: isInstallationsLoading, refetch: refetchInstallations } = useQuery({
    queryKey: ["daily-schedule-installations", fromDateStr, toDateStr],
    queryFn: async () => {
      console.log("Querying installations for schedule:", fromDateStr, toDateStr);
      try {
        const { data, error } = await supabase
          .from("installations")
          .select(`
            id,
            ticket_id,
            equipment_details,
            scheduled_date,
            scheduled_time,
            status,
            notes,
            customer_type,
            customer_id,
            location_id,
            non_btl_customer_name,
            non_btl_contact_number,
            non_btl_address,
            customer:customer_id (
              id,
              full_name,
              phone
            ),
            location:location_id (
              id,
              location_name,
              city,
              address
            ),
            installation_technicians (
              id,
              technician_id,
              technician:technician_id (
                id,
                full_name,
                phone,
                email,
                technician_id,
                employee_id
              )
            )
          `)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", fromDateStr)
          .lte("scheduled_date", toDateStr)
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .order("scheduled_time", { ascending: true, nullsFirst: false });

        if (!error && data) {
          return data;
        } else {
          throw error;
        }
      } catch (err) {
        console.warn("Retrying installations query without complex joins:", err);
        const { data, error } = await supabase
          .from("installations")
          .select(`
            id,
            ticket_id,
            equipment_details,
            scheduled_date,
            scheduled_time,
            status,
            notes,
            customer_type,
            customer_id,
            location_id,
            non_btl_customer_name,
            non_btl_contact_number,
            non_btl_address
          `)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", fromDateStr)
          .lte("scheduled_date", toDateStr)
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .order("scheduled_time", { ascending: true, nullsFirst: false });

        if (error) {
          console.error("Error in fallback scheduled installations query:", error);
          return [];
        }
        return data || [];
      }
    },
  });

  useEffect(() => {
    refetchComplaints();
    refetchInstallations();
  }, [fromDateStr, toDateStr, refetchComplaints, refetchInstallations]);

  const isLoading = isComplaintsLoading || isInstallationsLoading;

  // Transform and merge into Unified Tasks dataset
  const unifiedAllTasks: UnifiedScheduleTask[] = useMemo(() => {
    const currentYear = new Date().getFullYear();

    // 1. Process Complaints
    const formattedComplaints: UnifiedScheduleTask[] = complaintsData.map((c: any) => {
      const ctList = c.complaint_technicians || [];
      let techName = "";
      let techId = "";
      let assignedIds: string[] = [];

      if (ctList.length > 0) {
        assignedIds = ctList.map((ct: any) => ct.technician_id);
        techName = ctList
          .map((ct: any) => {
            const t = ct.technician || technicians.find((tech: any) => tech.id === ct.technician_id);
            const name = t?.full_name || "Technician";
            return ct.is_lead ? `👑 ${name}` : name;
          })
          .join(", ");
        techId = ctList
          .map((ct: any) => {
            const t = ct.technician || technicians.find((tech: any) => tech.id === ct.technician_id);
            return formatTechId(t);
          })
          .filter(Boolean)
          .join(", ");
      } else {
        const tech = technicians.find((t: any) => t.id === c.assigned_to);
        techName = tech?.full_name || c.assigned_technician || "Unassigned";
        techId = tech ? formatTechId(tech) : "";
        assignedIds = c.assigned_to ? [c.assigned_to] : [];
      }

      const ticketIdDisplay = formatComplaintTicketId(c);

      return {
        id: `complaint-${c.id}`,
        raw_id: c.id,
        task_type: "complaint",
        ticket_id: ticketIdDisplay,
        scheduled_date: c.scheduled_date || "",
        scheduled_time: c.scheduled_time ? c.scheduled_time.slice(0, 5) : "",
        technician_name: techName,
        technician_id_display: techId,
        assigned_technician_ids: assignedIds,
        assigned_supervisor: c.assigned_supervisor || null,
        client_name: c.customer_name || "N/A",
        contact_number: c.customer_phone || "N/A",
        address: c.location || "N/A",
        notes_description: c.title || c.description || "N/A",
        status: c.status || "Assigned",
      };
    });

    // 2. Process Installations
    const formattedInstallations: UnifiedScheduleTask[] = installationsData.map((inst: any) => {
      const itList = inst.installation_technicians || [];
      const assignedIds = itList.map((it: any) => it.technician_id);

      const assignedNames = itList
        .map((it: any) => {
          const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
          return t?.full_name || "Technician";
        })
        .join(", ");

      const assignedTechIds = itList
        .map((it: any) => {
          const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
          return formatTechId(t);
        })
        .filter(Boolean)
        .join(", ");

      // Client name & contact
      let clientName = "Non-BTL Customer";
      let contactNumber = "N/A";
      let addressStr = "N/A";

      if (inst.customer_type === "BTL") {
        clientName = inst.customer?.full_name || "Existing BTL Customer";
        contactNumber = inst.customer?.phone || "N/A";
        if (inst.location) {
          const locParts = [
            inst.location.location_name,
            inst.location.city,
            inst.location.address,
          ].filter(Boolean);
          addressStr = locParts.join(" - ") || "Primary Registered Address";
        } else {
          addressStr = "Primary Registered Address";
        }
      } else {
        clientName = inst.non_btl_customer_name || "New / Non-BTL Customer";
        contactNumber = inst.non_btl_contact_number || "N/A";
        addressStr = inst.non_btl_address || "N/A";
      }

      const ticketIdDisplay = formatInstallationTicketId(inst);

      return {
        id: `installation-${inst.id}`,
        raw_id: inst.id,
        task_type: "installation",
        ticket_id: ticketIdDisplay,
        scheduled_date: inst.scheduled_date || "",
        scheduled_time: inst.scheduled_time ? inst.scheduled_time.slice(0, 5) : "",
        technician_name: assignedNames || "Unassigned",
        technician_id_display: assignedTechIds,
        assigned_technician_ids: assignedIds,
        assigned_supervisor: inst.assigned_supervisor || null,
        client_name: clientName,
        contact_number: contactNumber,
        address: addressStr,
        notes_description: inst.equipment_details || inst.notes || "Installation Scope",
        status: inst.status || "Assigned",
      };
    });

    // Merge and sort by scheduled_date descending, then scheduled_time ascending
    const combined = [...formattedComplaints, ...formattedInstallations];
    combined.sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return b.scheduled_date.localeCompare(a.scheduled_date);
      }
      return (a.scheduled_time || "").localeCompare(b.scheduled_time || "");
    });

    return combined;
  }, [complaintsData, installationsData, technicians]);

  const isTechnician = user?.role === "technician";
  const isSupervisor = user?.role === "supervisor";

  // Scope tasks according to user role:
  // - Supervisor: ONLY show complaints and installations assigned to that supervisor
  // - Technician: ONLY show tasks assigned to that technician
  // - Admin / Manager: Show all tasks
  const userScopedTasks = useMemo(() => {
    if (isSupervisor) {
      const supName = (user?.name || "").trim().toLowerCase();
      const supEmail = (user?.email || "").trim().toLowerCase();
      const supId = (user?.id || "").trim().toLowerCase();

      return unifiedAllTasks.filter((item) => {
        const assignedSup = (item.assigned_supervisor || "").trim().toLowerCase();
        const isAssignedSupervisor = Boolean(
          (supName && (assignedSup === supName || assignedSup.includes(supName))) ||
          (supEmail && assignedSup === supEmail) ||
          (supId && assignedSup === supId)
        );

        if (item.task_type === "complaint") {
          return isAssignedSupervisor;
        }

        if (item.task_type === "installation") {
          return (
            isAssignedSupervisor ||
            (user?.id && item.assigned_technician_ids.includes(user.id))
          );
        }

        return false;
      });
    }

    if (isTechnician && user?.id) {
      return unifiedAllTasks.filter((item) => {
        if (item.assigned_technician_ids.includes(user.id)) return true;
        if (user.name && item.technician_name && item.technician_name.toLowerCase().includes(user.name.toLowerCase())) return true;
        return false;
      });
    }

    return unifiedAllTasks;
  }, [unifiedAllTasks, isSupervisor, isTechnician, user?.id, user?.name, user?.email]);

  // Counts for buttons
  const totalCount = userScopedTasks.length;
  const installationCount = useMemo(
    () => userScopedTasks.filter((t) => t.task_type === "installation").length,
    [userScopedTasks]
  );
  const complaintCount = useMemo(
    () => userScopedTasks.filter((t) => t.task_type === "complaint").length,
    [userScopedTasks]
  );

  // Filtered dataset by Task Type and Technician
  const filteredScheduleData = useMemo(() => {
    return userScopedTasks.filter((item) => {
      // 1. Task Type Filter
      if (taskTypeFilter !== "all" && item.task_type !== taskTypeFilter) {
        return false;
      }

      // 2. Technician Filter (Only for Admin / Supervisor)
      if (!isTechnician && selectedTechnician !== "all") {
        if (!item.assigned_technician_ids.includes(selectedTechnician)) {
          return false;
        }
      }

      return true;
    });
  }, [userScopedTasks, taskTypeFilter, selectedTechnician, isTechnician]);

  const totalPages = Math.ceil(filteredScheduleData.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredScheduleData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredScheduleData, currentPage]);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, "ellipsis", totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "ellipsis", currentPage, "ellipsis", totalPages];
  };

  const goToPrevDay = () => {
    const next = new Date(fromDate);
    next.setDate(next.getDate() - 1);
    setFromDate(next);
    setToDate(next);
  };

  const goToNextDay = () => {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + 1);
    setFromDate(next);
    setToDate(next);
  };

  const goToToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setFromDate(now);
    setToDate(now);
  };

  const getDateLabel = () => {
    if (fromDateStr === toDateStr) {
      return fromDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return `${fromDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} - ${toDate.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    setIsExporting(true);
    try {
      if (filteredScheduleData.length === 0) {
        toast.error("No scheduled tasks to download for this filter selection.");
        return;
      }

      const headers = [
        "Date",
        "Time",
        "Task Type",
        "Ticket ID",
        "Technician",
        "Tech ID",
        "Client Name",
        "Contact Number",
        "Address",
        "Notes / Description",
        "Status",
      ];

      const rows = filteredScheduleData.map((item) => [
        item.scheduled_date || "",
        item.scheduled_time || "",
        item.task_type === "installation" ? "Installation" : "Complaint",
        item.ticket_id || "",
        item.technician_name || "",
        item.technician_id_display || "",
        item.client_name || "",
        item.contact_number || "",
        item.address || "",
        item.notes_description || "",
        item.status || "",
      ]);

      const csvContent = [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const typeLabel = taskTypeFilter === "all" ? "all-tasks" : taskTypeFilter;
      link.download = `daily-schedule-${typeLabel}-${fromDateStr}-to-${toDateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredScheduleData.length} schedule records to CSV`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to download CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10 no-print" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10 no-print" />

      {/* Top Page Header - Above Buttons & Filters */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10 no-print">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-emerald-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <CalendarDays className="w-3.5 h-3.5" /> FIELD DISPATCH CALENDAR
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              Daily Service Timetable
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {isSupervisor
                ? `Supervisor Timetable: Displaying active complaints and installations assigned to you (${user?.name || "Supervisor"}).`
                : isTechnician
                ? "Technician Timetable: Displaying tasks assigned to you."
                : "Unified dispatch schedule of all active installations and maintenance complaints mapped per technician."}
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadCSV}
              disabled={isExporting}
              className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
            >
              <Download className="w-4 h-4 text-primary" /> {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              className="gradient-primary text-white hover:opacity-95 rounded-xl h-10 px-4 gap-2 font-bold shadow-glow text-xs"
            >
              <Printer className="w-4 h-4" /> Print Timetable
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar - Hidden during print */}
      <div className="glass-card rounded-2xl p-5 no-print shadow-sm border border-border/60 relative z-10">
        <div className="flex flex-wrap gap-3 justify-between items-end">
          <div className="flex flex-wrap gap-3 items-end">
            {/* From Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">From Date</label>
              <DatePicker
                selected={fromDate}
                onChange={(date) => date && setFromDate(date)}
                dateFormat="dd/MM/yyyy"
                showMonthDropdown
                showYearDropdown
                className="border border-border/60 rounded-xl h-10 px-3 text-xs w-[140px] bg-card text-foreground font-semibold"
                calendarClassName="shadow-xl border border-border/60 rounded-2xl overflow-hidden"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To Date</label>
              <DatePicker
                selected={toDate}
                onChange={(date) => date && setToDate(date)}
                dateFormat="dd/MM/yyyy"
                showMonthDropdown
                showYearDropdown
                className="border border-border/60 rounded-xl h-10 px-3 text-xs w-[140px] bg-card text-foreground font-semibold"
                calendarClassName="shadow-xl border border-border/60 rounded-2xl overflow-hidden"
              />
            </div>

            {/* Technician Dropdown (Only for Admin / Supervisor) */}
            {!isTechnician ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Technician</label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger className="w-[220px] h-10 rounded-xl border-border/60 bg-card text-xs font-semibold">
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-xl border-border/60 shadow-xl">
                    <div className="p-2">
                      <Input
                        placeholder="Search technician..."
                        value={technicianSearch}
                        onChange={(e) => setTechnicianSearch(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <SelectItem value="all">All Technicians</SelectItem>
                    {filteredTechnicians.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name || t.email} ({formatTechId(t)})
                      </SelectItem>
                    ))}
                    {filteredTechnicians.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">No technicians found.</p>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">My Schedule</label>
                <div className="h-10 px-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center gap-2 text-xs font-bold">
                  <Wrench className="w-3.5 h-3.5" /> {user?.name || "My Assigned Jobs"}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            {/* Navigation */}
            <Button type="button" variant="outline" onClick={goToPrevDay} className="h-10 rounded-xl border-border/60 text-xs font-bold">
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Button type="button" variant="outline" onClick={goToToday} className="h-10 rounded-xl border-border/60 text-xs font-bold">
              Today
            </Button>
            <Button type="button" variant="outline" onClick={goToNextDay} className="h-10 rounded-xl border-border/60 text-xs font-bold">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Task Type Filter Buttons (All Tasks, Installations Only, Complaints Only) */}
      <div className="flex flex-wrap items-center gap-2.5 no-print">
        <Button
          type="button"
          variant={taskTypeFilter === "all" ? "default" : "outline"}
          onClick={() => setTaskTypeFilter("all")}
          className={`h-9 px-4 font-semibold text-xs rounded-lg transition-all ${
            taskTypeFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Layers className="w-3.5 h-3.5 mr-1.5" /> All Tasks
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            taskTypeFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 font-bold"
          }`}>
            {totalCount}
          </span>
        </Button>

        <Button
          type="button"
          variant={taskTypeFilter === "installation" ? "default" : "outline"}
          onClick={() => setTaskTypeFilter("installation")}
          className={`h-9 px-4 font-semibold text-xs rounded-lg transition-all ${
            taskTypeFilter === "installation"
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50/50"
          }`}
        >
          <Wrench className="w-3.5 h-3.5 mr-1.5" /> Installations Only
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            taskTypeFilter === "installation" ? "bg-white/25 text-white" : "bg-blue-100 text-blue-800 font-bold"
          }`}>
            {installationCount}
          </span>
        </Button>

        <Button
          type="button"
          variant={taskTypeFilter === "complaint" ? "default" : "outline"}
          onClick={() => setTaskTypeFilter("complaint")}
          className={`h-9 px-4 font-semibold text-xs rounded-lg transition-all ${
            taskTypeFilter === "complaint"
              ? "bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
              : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50/50"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Complaints Only
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            taskTypeFilter === "complaint" ? "bg-white/25 text-white" : "bg-orange-100 text-orange-800 font-bold"
          }`}>
            {complaintCount}
          </span>
        </Button>
      </div>

      {/* Daily Field Schedule Section */}
      <div className="space-y-4">
        {/* On-screen Header (Hidden in Print) */}
        <div className="screen-only no-print flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-lg font-display font-bold uppercase tracking-wider text-slate-800">
            DAILY FIELD SCHEDULE — BRIHASPATHI TECHNOLOGIES
          </h2>
          <span className="text-sm text-muted-foreground font-medium">
            {getDateLabel()} · {filteredScheduleData.length} task(s)
          </span>
        </div>

        {selectedTechnician !== "all" && (
          <p className="screen-only no-print text-sm text-slate-600">
            Technician:{" "}
            <span className="font-semibold text-slate-900">
              {filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.full_name ||
                filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.email ||
                "Unknown"}
            </span>
          </p>
        )}

        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground bg-white border border-slate-200">
            <p className="text-sm font-medium">Loading schedule tasks...</p>
          </Card>
        ) : filteredScheduleData.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground bg-white border border-slate-200">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-medium">
              No {taskTypeFilter === "all" ? "scheduled tasks" : taskTypeFilter === "installation" ? "installations" : "complaints"} found for this date range and technician filter.
            </p>
          </Card>
        ) : (
          <>
            {/* Screen View (Paginated Unified Table) */}
            <div className="screen-only no-print space-y-4">
              {/* Desktop Table View */}
              <Card className="hidden md:block overflow-x-auto shadow-sm border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left py-3 px-3.5 whitespace-nowrap">Technician</th>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Tech ID</th>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Time</th>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Task Type</th>
                      <th className="text-left py-3 px-3.5 whitespace-nowrap">Ticket ID</th>
                      <th className="text-left py-3 px-3.5 whitespace-nowrap">Client Name</th>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Contact Number</th>
                      <th className="text-left py-3 px-3.5 whitespace-nowrap">Address</th>
                      <th className="text-left py-3 px-3.5 whitespace-nowrap">Notes / Description</th>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Technician */}
                        <td className="py-3 px-3.5 font-semibold text-slate-800 text-xs">
                          {item.technician_name}
                        </td>

                        {/* 2. Tech ID */}
                        <td className="py-3 px-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                          {item.technician_id_display || "—"}
                        </td>

                        {/* 3. Time */}
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-700 text-xs">
                          {item.scheduled_time || "—"}
                        </td>

                        {/* 4. Task Type Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.task_type === "installation" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Wrench className="w-3 h-3" /> Installation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              <AlertCircle className="w-3 h-3" /> Complaint
                            </span>
                          )}
                        </td>

                        {/* 5. Ticket ID */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-xs text-primary">
                          {item.ticket_id}
                        </td>

                        {/* 6. Client Name */}
                        <td className="py-3 px-3.5 text-slate-800 font-medium text-xs max-w-[150px] truncate" title={item.client_name}>
                          {item.client_name}
                        </td>

                        {/* 7. Contact Number */}
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap text-xs">
                          {item.contact_number}
                        </td>

                        {/* 8. Address */}
                        <td className="py-3 px-3.5 text-slate-600 text-xs max-w-[200px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" title={item.address}>{formatText(item.address, 30)}</span>
                            {item.address && item.address !== "N/A" && (
                              <button
                                type="button"
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`, '_blank')}
                                title="Open GPS Route"
                                className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded shrink-0 no-print"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 9. Notes / Description */}
                        <td className="py-3 px-3.5 text-slate-800 text-xs max-w-[200px] truncate" title={item.notes_description}>
                          {formatText(item.notes_description, 40)}
                        </td>

                        {/* 10. Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {paginatedData.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2.5"
                  >
                    {/* Header: Task type + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.task_type === "installation" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Wrench className="w-3 h-3" /> Installation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            <AlertCircle className="w-3 h-3" /> Complaint
                          </span>
                        )}
                        <span className="font-mono font-bold text-xs text-primary">
                          {item.ticket_id}
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Client Name & Contact */}
                    <div className="text-xs">
                      <p className="font-bold text-slate-900 text-sm">{item.client_name}</p>
                      {item.contact_number && item.contact_number !== "N/A" && (
                        <p className="text-slate-600 text-xs mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <a
                            href={`tel:${item.contact_number}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {item.contact_number}
                          </a>
                        </p>
                      )}
                    </div>

                    {/* Technician Info & Scheduled Time */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.technician_name}</span>
                        {item.technician_id_display && (
                          <span className="text-[10px] text-slate-400 font-mono">({item.technician_id_display})</span>
                        )}
                      </div>
                      {item.scheduled_time && (
                        <div className="flex items-center gap-1 text-slate-600 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{item.scheduled_time}</span>
                        </div>
                      )}
                    </div>

                    {/* Notes / Description */}
                    {item.notes_description && item.notes_description !== "—" && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                        {item.notes_description}
                      </p>
                    )}

                    {/* Address & Navigation Action */}
                    {item.address && item.address !== "N/A" && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500 line-clamp-1 flex items-center gap-1 min-w-0">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.address}</span>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`, '_blank')}
                          className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 gap-1 shrink-0 font-semibold"
                        >
                          <Navigation className="w-3 h-3 text-emerald-600" /> Map
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {filteredScheduleData.length > ITEMS_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 no-print">
                  <p className="text-xs text-muted-foreground font-medium">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredScheduleData.length)} of {filteredScheduleData.length} records
                  </p>
                  <Pagination className="w-full sm:w-auto mx-0 justify-end overflow-x-auto">
                    <PaginationContent className="flex-nowrap">
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((p) => Math.max(1, p - 1));
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, index) => (
                        <PaginationItem key={page === "ellipsis" ? `ellipsis-${index}` : page}>
                          {page === "ellipsis" ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page as number);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>

            {/* Print View (Executive-Grade Dispatch Sheet) */}
            <div className="print-only">
              {/* Document Header */}
              <div className="mb-4 pb-3 border-b-2 border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-extrabold uppercase tracking-wide text-slate-950">
                      BRIHASPATHI TECHNOLOGIES
                    </div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                      Daily Field Service Schedule & Dispatch Sheet
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-700">
                    <div><strong>Date Printed:</strong> {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
                    <div><strong>Total Tasks:</strong> {filteredScheduleData.length} (Complaints: {complaintCount}, Installations: {installationCount})</div>
                  </div>
                </div>

                {/* Metadata Strip */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-300 text-[10px] text-slate-700 bg-slate-50 p-2 rounded">
                  <div>
                    <span className="font-bold text-slate-900">Schedule Date:</span> {getDateLabel()}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Category Scope:</span>{" "}
                    {taskTypeFilter === "all" ? "All Tasks (Complaints & Installations)" : taskTypeFilter === "installation" ? "Installations Only" : "Complaints Only"}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Technician Filter:</span>{" "}
                    {selectedTechnician === "all"
                      ? "All Field Technicians"
                      : `${filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.full_name || "Assigned"} (${formatTechId(filteredTechnicians.find((t: any) => t.id === selectedTechnician))})`}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <table className="w-full text-[10px] border-collapse border border-slate-700">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-700">
                    <th className="py-1.5 px-1 border border-slate-700 text-center w-[3%]">#</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[13%]">Technician</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-left w-[7%]">Tech ID</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-center w-[6%]">Time</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-center w-[8%]">Type</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-left w-[13%]">Ticket ID</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[13%]">Client Name</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-left w-[9%]">Contact</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[14%]">Address / Site</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[14%]">Work Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScheduleData.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-300 page-break-inside-avoid">
                      <td className="py-1.5 px-1 border border-slate-300 text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-bold text-slate-900">{item.technician_name}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">{item.technician_id_display || "—"}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center font-medium text-slate-700 whitespace-nowrap">{item.scheduled_time || "—"}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center font-bold uppercase text-[9px]">
                        {item.task_type === "installation" ? (
                          <span className="text-blue-900">Installation</span>
                        ) : (
                          <span className="text-amber-900">Complaint</span>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300 font-mono font-bold text-slate-900 whitespace-nowrap">{item.ticket_id}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-medium text-slate-900">{item.client_name}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 whitespace-nowrap text-slate-700">{item.contact_number}</td>
                      <td className="py-1.5 px-2 border border-slate-300 text-slate-700 break-words">{item.address}</td>
                      <td className="py-1.5 px-2 border border-slate-300 text-slate-700 break-words">{item.notes_description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Sign-off / Verification Footer */}
              <div className="mt-8 pt-4 border-t border-slate-400 grid grid-cols-3 gap-8 text-[10px] text-slate-700 page-break-inside-avoid">
                <div>
                  <div className="font-bold text-slate-900">Prepared / Dispatched By:</div>
                  <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900">Field Supervisor:</div>
                  <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900">Operations Manager:</div>
                  <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Approval & Date</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print-only styles */}
      <style>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          .no-print,
          .screen-only,
          header,
          nav,
          aside,
          button,
          .fixed,
          footer {
            display: none !important;
          }
          .print-only {
            display: block !important;
            width: 100% !important;
          }
          .print-only table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 9px !important;
          }
          .print-only th, .print-only td {
            border: 1px solid #475569 !important;
            padding: 4px 6px !important;
            color: #0f172a !important;
            word-break: break-word !important;
          }
          .print-only th {
            background-color: #e2e8f0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: 700 !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          body, html, #root {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
        body.hide-header-icons button.fixed.top-4.left-4,
        body.hide-header-icons div.fixed.top-4.right-4 {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default DailySchedule;

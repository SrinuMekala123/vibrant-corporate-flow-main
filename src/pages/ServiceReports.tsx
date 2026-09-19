import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  DollarSign,
  CreditCard,
  Search,
  Filter,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Layers,
  User,
  Eye,
  Printer,
  Sparkles,
  TrendingUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
  MapPin,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  paymentService,
  type ChargeableTicket,
  type PaymentRecord,
  type PaymentStatistics,
  type AuditLedgerRecord,
  getStatusBadgeColor,
  generateInvoiceNumber
} from "@/services/paymentService";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { installationService } from "@/services/installationService";
import { generateCSV, downloadCSV } from "@/utils/csvHelpers";

type TabType = "dashboard" | "search" | "generate" | "payment" | "performance" | "history";

// ---------------------------------------------------------------------------
// Pagination Helpers & Components (20 records per page)
// ---------------------------------------------------------------------------
function getPageNumbers(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemName = "records"
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 border-t border-slate-200/70 dark:border-slate-800 text-xs">
      <div className="text-muted-foreground text-[11px] sm:text-xs text-center sm:text-left">
        Showing <span className="font-bold text-foreground">{start}</span> to{" "}
        <span className="font-bold text-foreground">{end}</span> of{" "}
        <span className="font-bold text-foreground">{totalItems}</span> {itemName}
        <span className="text-slate-400 mx-1.5">•</span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>

      {totalPages > 1 && (
        <Pagination className="w-full sm:w-auto mx-0 justify-center sm:justify-end overflow-x-auto">
          <PaginationContent className="flex-nowrap gap-1">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
                className={`h-8 px-2.5 text-xs rounded-lg transition-colors ${
                  currentPage === 1
                    ? "pointer-events-none opacity-40 cursor-not-allowed"
                    : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              />
            </PaginationItem>

            {pageNumbers.map((page, index) => (
              <PaginationItem key={page === "ellipsis" ? `ellipsis-${index}` : page}>
                {page === "ellipsis" ? (
                  <PaginationEllipsis className="h-8 w-8 text-xs text-muted-foreground" />
                ) : (
                  <PaginationLink
                    href="#"
                    isActive={currentPage === page}
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page);
                    }}
                    className={`h-8 min-w-[32px] px-2 text-xs font-semibold rounded-lg transition-all ${
                      currentPage === page
                        ? "bg-primary text-primary-foreground font-bold shadow-sm pointer-events-none hover:bg-primary hover:text-primary-foreground"
                        : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
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
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                className={`h-8 px-2.5 text-xs rounded-lg transition-colors ${
                  currentPage === totalPages
                    ? "pointer-events-none opacity-40 cursor-not-allowed"
                    : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export default function ServiceReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State
  const initialTab = (searchParams.get("tab") as TabType) || "dashboard";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ============================================================================
  // 1. DATA QUERIES (Chargeable Tickets & Payment Records)
  // ============================================================================
  const {
    data: chargeableTickets = [],
    isLoading: isLoadingChargeable,
    refetch: refetchChargeable
  } = useQuery({
    queryKey: ["chargeable-tickets"],
    queryFn: paymentService.fetchChargeableTickets,
    staleTime: 30000
  });

  const {
    data: paymentRecords = [],
    isLoading: isLoadingPayments,
    refetch: refetchPayments
  } = useQuery({
    queryKey: ["payment-records"],
    queryFn: () => paymentService.fetchPaymentReports(),
    staleTime: 15000
  });

  // Complaints & Installations for general reports
  const { data: allComplaints = [] } = useQuery({
    queryKey: ["all-complaints-reports"],
    queryFn: complaintService.getAll,
    staleTime: 60000
  });

  const { data: allInstallations = [] } = useQuery({
    queryKey: ["all-installations-reports"],
    queryFn: installationService.getAll,
    staleTime: 60000
  });

  // ============================================================================
  // 2. PAYMENT MANAGEMENT STATE & FORM
  // ============================================================================
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [paymentForm, setPaymentForm] = useState({
    ticket_id: "",
    raw_ticket_id: "",
    ticket_type: "complaint" as "complaint" | "installation",
    customer_name: "",
    customer_id: "",
    technician_name: "",
    service_charge: 0,
    quotation_estimate: 0,
    invoice_number: generateInvoiceNumber(),
    payment_status: "Pending" as "Pending" | "Partially Paid" | "Paid" | "Not Applicable",
    payment_received_date: new Date().toISOString().split("T")[0],
    payment_remarks: ""
  });

  // When a ticket is selected from the dropdown, auto-populate the form
  const handleSelectTicket = (ticketIdVal: string) => {
    setSelectedTicketId(ticketIdVal);
    const found = chargeableTickets.find((t) => t.ticket_id === ticketIdVal);
    if (found) {
      // Check if an existing payment record exists for this ticket
      const existingRecord = paymentRecords.find((r) => r.ticket_id === ticketIdVal);

      setPaymentForm({
        ticket_id: found.ticket_id,
        raw_ticket_id: found.raw_id,
        ticket_type: found.ticket_type,
        customer_name: found.customer_name,
        customer_id: found.customer_id || "",
        technician_name: found.assigned_technician || "",
        service_charge: existingRecord?.service_charge ?? (found.service_charge || 0),
        quotation_estimate:
          existingRecord?.quotation_estimate ??
          (found.quotation_estimate || (found.service_charge ? found.service_charge * 1.1 : 0)),
        invoice_number: existingRecord?.invoice_number || generateInvoiceNumber(),
        payment_status: existingRecord?.payment_status || found.payment_status || "Pending",
        payment_received_date:
          existingRecord?.payment_received_date || new Date().toISOString().split("T")[0],
        payment_remarks: existingRecord?.payment_remarks || ""
      });

      toast.info(`Loaded details for ticket ${found.ticket_id}`);
    }
  };

  const handleGenerateNewInvoice = () => {
    const newInv = generateInvoiceNumber();
    setPaymentForm((prev) => ({ ...prev, invoice_number: newInv }));
    toast.success(`Generated new invoice: ${newInv}`);
  };

  // Mutation to save payment
  const savePaymentMutation = useMutation({
    mutationFn: paymentService.savePayment,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Payment details saved & synchronized successfully!");
        queryClient.invalidateQueries({ queryKey: ["payment-records"] });
        queryClient.invalidateQueries({ queryKey: ["chargeable-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["all-complaints-reports"] });
        queryClient.invalidateQueries({ queryKey: ["all-installations-reports"] });
      } else {
        toast.error(`Failed to save payment: ${result.error?.message || "Unknown error"}`);
      }
    },
    onError: (err: any) => {
      toast.error(`Error: ${err.message || "Failed to save payment details"}`);
    }
  });

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.ticket_id) {
      toast.error("Please select a valid ticket first.");
      return;
    }
    if (!paymentForm.invoice_number) {
      toast.error("Invoice number is required.");
      return;
    }
    savePaymentMutation.mutate(paymentForm);
  };

  const handleResetForm = () => {
    setSelectedTicketId("");
    setPaymentForm({
      ticket_id: "",
      raw_ticket_id: "",
      ticket_type: "complaint",
      customer_name: "",
      customer_id: "",
      technician_name: "",
      service_charge: 0,
      quotation_estimate: 0,
      invoice_number: generateInvoiceNumber(),
      payment_status: "Pending",
      payment_received_date: new Date().toISOString().split("T")[0],
      payment_remarks: ""
    });
  };

  // ============================================================================
  // 3. PAYMENT REPORT FILTERING & TABLE SEARCH
  // ============================================================================
  const [filterStatus, setFilterStatus] = useState<string>("All Payment Status");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredPayments = useMemo(() => {
    return paymentRecords.filter((record) => {
      // Status filter
      if (filterStatus !== "All Payment Status" && record.payment_status !== filterStatus) {
        return false;
      }

      // Date range filter
      if (dateRange.from && record.payment_received_date) {
        if (record.payment_received_date < dateRange.from) return false;
      }
      if (dateRange.to && record.payment_received_date) {
        if (record.payment_received_date > dateRange.to) return false;
      }

      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matches =
          record.ticket_id?.toLowerCase().includes(q) ||
          record.customer_name?.toLowerCase().includes(q) ||
          record.invoice_number?.toLowerCase().includes(q) ||
          record.technician_name?.toLowerCase().includes(q) ||
          record.payment_remarks?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [paymentRecords, filterStatus, dateRange, searchQuery]);

  // Statistics
  const paymentStats: PaymentStatistics = useMemo(() => {
    return paymentService.calculatePaymentStatistics(paymentRecords);
  }, [paymentRecords]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredPayments.length === 0) {
      toast.warning("No records match the current filters to export.");
      return;
    }
    paymentService.exportPaymentToCSV(
      filteredPayments,
      `Payment_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    toast.success(`Exported ${filteredPayments.length} payment records to CSV.`);
  };

  // ============================================================================
  // 4. GENERAL SERVICE REPORTS CALCULATIONS
  // ============================================================================
  const totalTickets = allComplaints.length + allInstallations.length;
  const completedTickets =
    allComplaints.filter((c: any) => ["completed", "closed"].includes(c.status)).length +
    allInstallations.filter((i: any) =>
      ["completed", "handed over", "handed_over"].includes(i.status?.toLowerCase() || "")
    ).length;

  const resolutionRate = totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

  // Global Search State for 'search' tab
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalTypeFilter, setGlobalTypeFilter] = useState("all");

  const combinedServiceList = useMemo(() => {
    const list: any[] = [];
    allComplaints.forEach((c: any) => {
      list.push({
        id: c.id,
        ticket_id: c.ticket_id || c.id,
        type: "Complaint",
        customer: c.customer_name || c.profiles?.full_name || "Customer",
        technician: c.assigned_technician || "Unassigned",
        status: c.status,
        date: c.created_at,
        is_chargeable: c.chargeable_service === "Yes" || c.coverage === "Chargeable Service",
        service_charge: c.service_charge || 0,
        payment_status: c.payment_status || "Not Applicable",
        location: c.location || "Site location"
      });
    });

    allInstallations.forEach((i: any) => {
      list.push({
        id: i.id,
        ticket_id: i.ticket_id || i.id,
        type: "Installation",
        customer: i.customer?.full_name || i.non_btl_customer_name || "Customer",
        technician: "Field Crew",
        status: i.status,
        date: i.created_at,
        is_chargeable: i.is_chargeable || false,
        service_charge: i.service_charge || 0,
        payment_status: i.payment_status || "Not Applicable",
        location: i.location?.location_name || i.non_btl_address || "Site address"
      });
    });

    return list.filter((item) => {
      if (globalTypeFilter !== "all" && item.type.toLowerCase() !== globalTypeFilter.toLowerCase()) {
        return false;
      }
      if (globalSearchTerm.trim() !== "") {
        const q = globalSearchTerm.toLowerCase();
        return (
          item.ticket_id?.toLowerCase().includes(q) ||
          item.customer?.toLowerCase().includes(q) ||
          item.technician?.toLowerCase().includes(q) ||
          item.status?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allComplaints, allInstallations, globalTypeFilter, globalSearchTerm]);

  // ---------------------------------------------------------------------------
  // Universal Pagination Configuration (20 records per page)
  // ---------------------------------------------------------------------------
  const RECORDS_PER_PAGE = 20;

  // Tab 2: Detailed Payment Reports Ledger Pagination
  const [paymentPage, setPaymentPage] = useState<number>(1);
  useEffect(() => {
    setPaymentPage(1);
  }, [searchQuery, filterStatus, dateRange.from, dateRange.to]);

  const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / RECORDS_PER_PAGE));
  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * RECORDS_PER_PAGE;
    return filteredPayments.slice(start, start + RECORDS_PER_PAGE);
  }, [filteredPayments, paymentPage]);

  // Tab 3: Universal Service Ticket Index Pagination
  const [ticketSearchPage, setTicketSearchPage] = useState<number>(1);
  useEffect(() => {
    setTicketSearchPage(1);
  }, [globalSearchTerm, globalTypeFilter]);

  const totalTicketPages = Math.max(1, Math.ceil(combinedServiceList.length / RECORDS_PER_PAGE));
  const paginatedTickets = useMemo(() => {
    const start = (ticketSearchPage - 1) * RECORDS_PER_PAGE;
    return combinedServiceList.slice(start, start + RECORDS_PER_PAGE);
  }, [combinedServiceList, ticketSearchPage]);

  // Tab 6: Financial & Operational Audit Ledger State & Pagination
  const {
    data: rawAuditRecords = [],
    isLoading: isLoadingAudit,
    refetch: refetchAudit
  } = useQuery({
    queryKey: ["audit-ledger-events"],
    queryFn: () => paymentService.fetchAuditLedger(),
    staleTime: 15000
  });

  const [auditSearchQuery, setAuditSearchQuery] = useState<string>("");
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>("all");
  const [auditPage, setAuditPage] = useState<number>(1);

  const filteredAuditRecords = useMemo(() => {
    return rawAuditRecords.filter((record) => {
      // Category filter
      if (auditCategoryFilter !== "all" && record.category !== auditCategoryFilter) {
        return false;
      }
      // Search query
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase();
        return (
          record.ticket_id.toLowerCase().includes(q) ||
          record.customer_name.toLowerCase().includes(q) ||
          record.event_title.toLowerCase().includes(q) ||
          record.description.toLowerCase().includes(q) ||
          record.performed_by.toLowerCase().includes(q) ||
          (record.location && record.location.toLowerCase().includes(q)) ||
          record.status.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rawAuditRecords, auditCategoryFilter, auditSearchQuery]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditRecords.length / RECORDS_PER_PAGE));
  const paginatedAuditRecords = useMemo(() => {
    const start = (auditPage - 1) * RECORDS_PER_PAGE;
    return filteredAuditRecords.slice(start, start + RECORDS_PER_PAGE);
  }, [filteredAuditRecords, auditPage]);

  // ============================================================================
  // 5. REPORT GENERATOR STATE & DYNAMIC FILTERING
  // ============================================================================
  const [generateInterval, setGenerateInterval] = useState<string>("month");
  const [generateCategory, setGenerateCategory] = useState<string>("all");
  const [generateDateRange, setGenerateDateRange] = useState<{ from: string; to: string }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0]
  });

  // Calendar Popover states for Custom Date Range
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);

  // Parsed Date objects for interactive Calendar picker
  const fromDateObj = useMemo(() => {
    if (!generateDateRange.from) return undefined;
    const [y, m, d] = generateDateRange.from.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  }, [generateDateRange.from]);

  const toDateObj = useMemo(() => {
    if (!generateDateRange.to) return undefined;
    const [y, m, d] = generateDateRange.to.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  }, [generateDateRange.to]);

  const handleSelectFromDate = (selectedDate?: Date) => {
    if (selectedDate) {
      const iso = format(selectedDate, "yyyy-MM-dd");
      setGenerateDateRange((prev) => ({
        ...prev,
        from: iso,
        to: prev.to && prev.to < iso ? iso : prev.to
      }));
    }
    setFromCalendarOpen(false);
  };

  const handleSelectToDate = (selectedDate?: Date) => {
    if (selectedDate) {
      const iso = format(selectedDate, "yyyy-MM-dd");
      setGenerateDateRange((prev) => ({
        ...prev,
        to: iso,
        from: prev.from && prev.from > iso ? iso : prev.from
      }));
    }
    setToCalendarOpen(false);
  };

  // Month navigation states for the Popover Calendar pickers
  const [fromMonth, setFromMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [toMonth, setToMonth] = useState<Date>(() => new Date());

  useEffect(() => {
    if (fromDateObj) setFromMonth(fromDateObj);
  }, [fromDateObj]);

  useEffect(() => {
    if (toDateObj) setToMonth(toDateObj);
  }, [toDateObj]);

  // Calculate effective date bounds based on selected interval
  const effectiveDateBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (generateInterval === "today") {
      return { from: todayStr, to: todayStr };
    }
    if (generateInterval === "week") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: past7.toISOString().split("T")[0], to: todayStr };
    }
    if (generateInterval === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth.toISOString().split("T")[0], to: todayStr };
    }
    if (generateInterval === "quarter") {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { from: past90.toISOString().split("T")[0], to: todayStr };
    }
    // custom
    return {
      from: generateDateRange.from || "2000-01-01",
      to: generateDateRange.to || todayStr
    };
  }, [generateInterval, generateDateRange]);

  // Formatted date string for summary preview
  const formattedEffectiveDateLabel = useMemo(() => {
    try {
      const [fy, fm, fd] = effectiveDateBounds.from.split("-").map(Number);
      const [ty, tm, td] = effectiveDateBounds.to.split("-").map(Number);
      const fDate = new Date(fy, fm - 1, fd);
      const tDate = new Date(ty, tm - 1, td);
      return `${format(fDate, "dd MMM, yyyy")} to ${format(tDate, "dd MMM, yyyy")}`;
    } catch {
      return `${effectiveDateBounds.from} to ${effectiveDateBounds.to}`;
    }
  }, [effectiveDateBounds]);

  // Compute filtered data for generated report
  const generatedReportData = useMemo(() => {
    const { from, to } = effectiveDateBounds;

    const filteredTickets = combinedServiceList.filter((item) => {
      // Category filter
      if (generateCategory === "chargeable" && !item.is_chargeable) return false;
      if (generateCategory === "complaint" && item.type.toLowerCase() !== "complaint") return false;
      if (generateCategory === "installation" && item.type.toLowerCase() !== "installation") return false;

      // Date filter
      if (item.date) {
        const itemDateStr = item.date.split("T")[0];
        if (from && itemDateStr < from) return false;
        if (to && itemDateStr > to) return false;
      }
      return true;
    });

    const filteredPaymentsForReport = paymentRecords.filter((rec) => {
      const recDate = rec.payment_received_date || (rec.created_at ? rec.created_at.split("T")[0] : "");
      if (from && recDate && recDate < from) return false;
      if (to && recDate && recDate > to) return false;
      return true;
    });

    const activeOrders = filteredTickets.length;
    const completedOrders = filteredTickets.filter((t) =>
      ["completed", "closed", "handed over", "handed_over"].includes(t.status?.toLowerCase() || "")
    ).length;
    const chargeableOrders = filteredTickets.filter((t) => t.is_chargeable).length;
    const totalRevenueSum = filteredPaymentsForReport
      .filter((p) => p.payment_status === "Paid")
      .reduce((sum, p) => sum + (Number(p.service_charge) || 0), 0);

    return {
      tickets: filteredTickets,
      payments: filteredPaymentsForReport,
      activeOrders,
      completedOrders,
      chargeableOrders,
      totalRevenueSum
    };
  }, [combinedServiceList, paymentRecords, effectiveDateBounds, generateCategory]);

  const handleExportGeneratedReportCSV = () => {
    if (generatedReportData.tickets.length === 0) {
      toast.warning("No records match the selected report parameters.");
      return;
    }

    const csvRows = generatedReportData.tickets.map((t) => ({
      "Ticket ID": t.ticket_id,
      Type: t.type,
      Customer: t.customer,
      Location: t.location,
      Technician: t.technician,
      Status: t.status,
      Scope: t.is_chargeable ? "Chargeable" : "Standard",
      "Service Charge": `₹${t.service_charge || 0}`,
      "Payment Status": t.payment_status,
      Date: t.date ? new Date(t.date).toLocaleDateString("en-IN") : "N/A"
    }));

    const columns = [
      "Ticket ID",
      "Type",
      "Customer",
      "Location",
      "Technician",
      "Status",
      "Scope",
      "Service Charge",
      "Payment Status",
      "Date"
    ];

    const csvContent = generateCSV(csvRows, columns);
    downloadCSV(
      csvContent,
      `Service_Report_${generateInterval}_${new Date().toISOString().split("T")[0]}.csv`
    );
    toast.success(`Exported ${generatedReportData.tickets.length} report records to CSV.`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto pb-12">
      {/* ==================================================================== */}
      {/* 🌟 EXECUTIVE HEADER                                                  */}
      {/* ==================================================================== */}
      <div className="no-print glass-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-glow relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white shadow-md shrink-0 mt-0.5">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-foreground">
                Service & Payment Reports
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Enterprise Operations
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Comprehensive audit reports, field service diagnostics, chargeable invoicing & revenue recovery.
            </p>
          </div>
        </div>

        {/* Quick Tab Triggers & Refresh */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchChargeable();
              refetchPayments();
              toast.info("Refreshed reports telemetry");
            }}
            className="rounded-xl border-border/70 h-9 px-3 gap-1.5 text-xs font-semibold shadow-sm hover:bg-muted/80"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh Data</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleTabChange("payment")}
            className="gradient-primary text-white hover:opacity-95 rounded-xl h-9 px-4 gap-1.5 text-xs font-bold shadow-glow"
          >
            <CreditCard className="w-4 h-4" />
            <span>Manage Payments</span>
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 📑 NAVIGATION TABS BAR                                               */}
      {/* ==================================================================== */}
      <div className="no-print flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        {[
          { id: "dashboard", label: "Executive Dashboard", icon: BarChart3 },
          { id: "payment", label: "Payment Reports", icon: DollarSign, badge: paymentRecords.length },
          { id: "search", label: "Ticket Search", icon: Search, badge: combinedServiceList.length },
          { id: "generate", label: "Generate Report", icon: FileSpreadsheet },
          { id: "performance", label: "SLA & Crew Performance", icon: TrendingUp },
          { id: "history", label: "Audit Ledger", icon: Clock, badge: rawAuditRecords.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "opacity-70"}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: EXECUTIVE DASHBOARD                                           */}
      {/* ==================================================================== */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Total Work Orders</span>
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-black text-foreground">{totalTickets}</p>
              <p className="text-[11px] text-muted-foreground">Complaints & installations combined</p>
            </Card>

            <Card className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Resolution Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-black text-emerald-600 dark:text-emerald-400">
                {resolutionRate}%
              </p>
              <p className="text-[11px] text-muted-foreground">{completedTickets} closed orders to date</p>
            </Card>

            <Card className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Chargeable Services</span>
                <Receipt className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-black text-amber-600 dark:text-amber-400">
                {chargeableTickets.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Billable scope tickets logged</p>
            </Card>

            <Card className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Collected Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-black text-emerald-600 dark:text-emerald-400">
                ₹{paymentStats.totalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted-foreground">Direct payments cleared</p>
            </Card>
          </div>

          {/* Quick Shortcuts & Status Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-transparent to-transparent flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="w-3 h-3" /> Financial Control
                </span>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Chargeable Services & Invoicing Hub
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Log service charges, issue unique invoice identifiers, record partial or full receipts, and track overdue accounts automatically.
                </p>
              </div>
              <Button
                onClick={() => handleTabChange("payment")}
                className="w-full gradient-primary text-white font-bold text-xs rounded-xl h-9 gap-1.5 shadow-sm"
              >
                <CreditCard className="w-4 h-4" /> Open Payment Management
              </Button>
            </Card>

            <Card className="p-6 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Search className="w-3 h-3" /> Universal Index
                </span>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Comprehensive Ticket Lookup
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Search across all customer complaints, installation handovers, service phases, and technician dispatch records.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => handleTabChange("search")}
                className="w-full font-bold text-xs rounded-xl h-9 gap-1.5"
              >
                <Search className="w-4 h-4 text-primary" /> Search Ticket Registry
              </Button>
            </Card>

            <Card className="p-6 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Printer className="w-3 h-3" /> Documentation
                </span>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Generate Service Summary Report
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Export structured executive performance PDFs or CSV sheets filtered by date interval, branch location, and category.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => handleTabChange("generate")}
                className="w-full font-bold text-xs rounded-xl h-9 gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60"
              >
                <Download className="w-4 h-4 text-emerald-600" /> Configure & Export
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: PAYMENT REPORTS (Core User Requirement)                       */}
      {/* ==================================================================== */}
      {activeTab === "payment" && (
        <div className="space-y-6">
          {/* ================================================================ */}
          {/* ✅ REQUIREMENT 5: PAYMENT STATISTICS DASHBOARD                    */}
          {/* ================================================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Total Revenue */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-emerald-200/70 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span>Total Revenue</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-display font-black text-emerald-700 dark:text-emerald-400">
                ₹{paymentStats.totalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-emerald-600/80 font-medium">Sum of all fully paid services</p>
            </Card>

            {/* 2. Pending Payments */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-amber-200/70 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                <span>Pending Payments</span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-display font-black text-amber-700 dark:text-amber-400">
                ₹{paymentStats.pendingAmount.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-amber-600/80 font-medium">
                {paymentStats.pendingCount} pending invoice{paymentStats.pendingCount === 1 ? "" : "s"}
              </p>
            </Card>

            {/* 3. Partially Paid */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-blue-200/70 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                <span>Partially Paid</span>
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-display font-black text-blue-700 dark:text-blue-400">
                ₹{paymentStats.partiallyPaidAmount.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-blue-600/80 font-medium">
                {paymentStats.partiallyPaidCount} ongoing balance{paymentStats.partiallyPaidCount === 1 ? "" : "s"}
              </p>
            </Card>

            {/* 4. Overdue Invoices (>30 days pending) */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-rose-200/70 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                <span>Overdue Invoices</span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-display font-black text-rose-700 dark:text-rose-400">
                ₹{paymentStats.overdueAmount.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-rose-600/80 font-medium">
                {paymentStats.overdueCount} invoice{paymentStats.overdueCount === 1 ? "" : "s"} older than 30 days
              </p>
            </Card>
          </div>

          {/* ================================================================ */}
          {/* ✅ REQUIREMENT 3.A: CHARGEABLE SERVICE & PAYMENT MANAGEMENT FORM */}
          {/* ================================================================ */}
          <Card className="p-5 md:p-6 rounded-2xl border border-border/70 bg-white dark:bg-slate-900 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base md:text-lg font-display font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Chargeable Service & Payment Management
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a chargeable ticket to log quotation values, issue invoice identifiers, and record collection status.
                </p>
              </div>

              {selectedTicketId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForm}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear Form
                </Button>
              )}
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Select Ticket */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Ticket <span className="text-rose-500">*</span>
                  </label>
                  <Select value={selectedTicketId} onValueChange={handleSelectTicket}>
                    <SelectTrigger className="rounded-xl border-border/60 text-xs h-10 font-medium">
                      <SelectValue placeholder="Choose a chargeable ticket..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {chargeableTickets.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No chargeable tickets found
                        </SelectItem>
                      ) : (
                        chargeableTickets.map((t) => (
                          <SelectItem key={t.id} value={t.ticket_id}>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-primary">{t.ticket_id}</span>
                              <span className="text-slate-400">•</span>
                              <span className="font-medium text-slate-800 truncate max-w-[140px]">
                                {t.customer_name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase font-bold">
                                {t.ticket_type === "installation" ? "Inst" : "Comp"}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Only shows tickets with chargeable flag enabled.
                  </p>
                </div>

                {/* 2. Customer Name (Auto-populated) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Customer Name
                  </label>
                  <Input
                    readOnly
                    value={paymentForm.customer_name || "Auto-populates upon ticket selection"}
                    className="rounded-xl border-border/60 text-xs h-10 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Linked customer / site account
                  </p>
                </div>

                {/* 3. Technician (Auto-populated) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Assigned Technician
                  </label>
                  <Input
                    readOnly
                    value={paymentForm.technician_name || "Unassigned"}
                    className="rounded-xl border-border/60 text-xs h-10 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Field technician or crew lead
                  </p>
                </div>

                {/* 4. Service Charge (₹) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Service Charge (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={paymentForm.service_charge || ""}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          service_charge: parseFloat(e.target.value) || 0
                        }))
                      }
                      className="rounded-xl border-border/60 text-xs h-10 pl-7 font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Final billable amount to client</p>
                </div>

                {/* 5. Quotation / Estimate (₹) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Quotation / Estimate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentForm.quotation_estimate || ""}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          quotation_estimate: parseFloat(e.target.value) || 0
                        }))
                      }
                      className="rounded-xl border-border/60 text-xs h-10 pl-7 font-semibold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Preliminary estimated quotation</p>
                </div>

                {/* 6. Invoice Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Invoice Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <Input
                      required
                      placeholder="INV-2026-XXXXXX"
                      value={paymentForm.invoice_number}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({ ...prev, invoice_number: e.target.value }))
                      }
                      className="rounded-xl border-border/60 text-xs h-10 font-mono font-bold text-primary uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateNewInvoice}
                      title="Generate new unique invoice number"
                      className="h-10 px-2.5 rounded-xl border-border/60 hover:bg-muted shrink-0"
                    >
                      <RefreshCw className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Auto-generated or custom number</p>
                </div>

                {/* 7. Payment Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Payment Status <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={paymentForm.payment_status}
                    onValueChange={(val: any) =>
                      setPaymentForm((prev) => ({ ...prev, payment_status: val }))
                    }
                  >
                    <SelectTrigger className="rounded-xl border-border/60 text-xs h-10 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Pending</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Partially Paid">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Partially Paid</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Paid">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span>Paid</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Not Applicable">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          <span>Not Applicable</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Current reconciliation phase</p>
                </div>

                {/* 8. Payment Received Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Payment Received Date
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={paymentForm.payment_received_date}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          payment_received_date: e.target.value
                        }))
                      }
                      className="rounded-xl border-border/60 text-xs h-10"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Date of clearance or bank transfer</p>
                </div>

                {/* 9. Payment Remarks */}
                <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Payment Remarks
                  </label>
                  <Input
                    placeholder="e.g., Cheque No., UPI Ref, Cash handed to tech..."
                    value={paymentForm.payment_remarks}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, payment_remarks: e.target.value }))
                    }
                    className="rounded-xl border-border/60 text-xs h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">Transaction notes or reference ID</p>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetForm}
                  className="rounded-xl h-9 px-4 text-xs font-semibold"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={savePaymentMutation.isPending || !paymentForm.ticket_id}
                  className="gradient-primary text-white font-bold text-xs rounded-xl h-9 px-5 gap-1.5 shadow-glow"
                >
                  {savePaymentMutation.isPending ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Payment...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Payment Details</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* ================================================================ */}
          {/* ✅ REQUIREMENT 3.B: DETAILED PAYMENT REPORT TABLE                */}
          {/* ================================================================ */}
          <Card className="p-5 md:p-6 rounded-2xl border border-border/70 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            {/* Table Filter Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Detailed Payment Reports Ledger
                  <span className="text-xs font-semibold text-muted-foreground">
                    ({filteredPayments.length} records)
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audit trail of all registered invoices, charges, and settlement dates.
                </p>
              </div>

              {/* Export to CSV Action */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="rounded-xl border-border/70 h-9 px-3.5 gap-2 text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 shrink-0 shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export to CSV</span>
              </Button>
            </div>

            {/* Search & Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {/* Search Field */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search ticket, customer, invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border-border/60 text-xs h-9 pl-9"
                />
              </div>

              {/* Status Filter */}
              <div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="rounded-xl border-border/60 text-xs h-9 font-medium">
                    <SelectValue placeholder="All Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Payment Status">All Payment Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range: From */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">From:</span>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                  className="rounded-xl border-border/60 text-xs h-9"
                />
              </div>

              {/* Date Range: To */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">To:</span>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                  className="rounded-xl border-border/60 text-xs h-9"
                />
                {(dateRange.from || dateRange.to || filterStatus !== "All Payment Status" || searchQuery) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateRange({ from: "", to: "" });
                      setFilterStatus("All Payment Status");
                      setSearchQuery("");
                    }}
                    title="Clear filters"
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3.5 whitespace-nowrap">Ticket ID</th>
                    <th className="py-3 px-3.5">Customer Name</th>
                    <th className="py-3 px-3.5">Technician</th>
                    <th className="py-3 px-3 whitespace-nowrap text-right">Service Charge</th>
                    <th className="py-3 px-3 whitespace-nowrap text-right">Quotation</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Invoice Number</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-center">Status</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Received Date</th>
                    <th className="py-3 px-3.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-sm">No payment records found</p>
                        <p className="text-xs mt-0.5">
                          Log a payment above using the Chargeable Service & Payment Management form.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedPayments.map((record) => {
                      const isComplaint =
                        record.ticket_type === "complaint" ||
                        record.ticket_id?.startsWith("BTL-CMS");
                      const ticketLink = isComplaint
                        ? `/complaints/${record.raw_ticket_id || record.ticket_id}`
                        : `/installations`;

                      return (
                        <tr
                          key={record.id || record.ticket_id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Ticket ID */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold">
                            <Link
                              to={ticketLink}
                              className="text-primary hover:underline flex items-center gap-1"
                              title="Click to view ticket details"
                            >
                              {record.ticket_id}
                            </Link>
                          </td>

                          {/* Customer Name */}
                          <td className="py-3 px-3.5 font-semibold text-slate-800 dark:text-slate-200">
                            {record.customer_name || record.customer?.full_name || "N/A"}
                          </td>

                          {/* Technician */}
                          <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                            {record.technician_name || "Unassigned"}
                          </td>

                          {/* Service Charge (₹) */}
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            ₹{Number(record.service_charge ?? 0).toLocaleString("en-IN")}
                          </td>

                          {/* Quotation (₹) */}
                          <td className="py-3 px-3 text-right font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            ₹{Number(record.quotation_estimate ?? 0).toLocaleString("en-IN")}
                          </td>

                          {/* Invoice Number */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {record.invoice_number || "—"}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeColor(
                                record.payment_status
                              )}`}
                            >
                              {record.payment_status}
                            </span>
                          </td>

                          {/* Received Date */}
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                            {record.payment_received_date
                              ? new Date(record.payment_received_date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                })
                              : "—"}
                          </td>

                          {/* Remarks */}
                          <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={record.payment_remarks || ""}>
                            {record.payment_remarks || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden space-y-3">
              {filteredPayments.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm">No payment records found</p>
                  <p className="text-xs mt-0.5">Adjust your filters or log a payment above.</p>
                </div>
              ) : (
                paginatedPayments.map((record) => (
                  <div
                    key={record.id || record.ticket_id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2.5"
                  >
                    {/* Top Row: Ticket ID + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-sm text-primary">
                          {record.ticket_id}
                        </span>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          Inv: {record.invoice_number}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getStatusBadgeColor(
                          record.payment_status
                        )}`}
                      >
                        {record.payment_status}
                      </span>
                    </div>

                    {/* Customer & Technician */}
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {record.customer_name || record.customer?.full_name || "N/A"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Technician: <span className="font-medium text-slate-700 dark:text-slate-300">{record.technician_name || "Unassigned"}</span>
                      </p>
                    </div>

                    {/* Financial Numbers */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Service Charge</span>
                        <span className="text-base font-black text-emerald-700 dark:text-emerald-400 block">
                          ₹{Number(record.service_charge ?? 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Quotation</span>
                        <span className="text-base font-bold text-slate-700 dark:text-slate-300 block">
                          ₹{Number(record.quotation_estimate ?? 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Date & Remarks */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Received: {record.payment_received_date || "Pending"}
                      </span>
                      {record.payment_remarks && (
                        <span className="truncate max-w-[150px] italic">"{record.payment_remarks}"</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={paymentPage}
              totalPages={totalPaymentPages}
              totalItems={filteredPayments.length}
              itemsPerPage={RECORDS_PER_PAGE}
              onPageChange={setPaymentPage}
              itemName="payment records"
            />
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: TICKET SEARCH (Universal Registry)                             */}
      {/* ==================================================================== */}
      {activeTab === "search" && (
        <Card className="p-5 md:p-6 rounded-2xl border border-border/70 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Universal Service Ticket Index
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fast multi-criteria query across complaints and installation work orders.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Select value={globalTypeFilter} onValueChange={setGlobalTypeFilter}>
                <SelectTrigger className="w-36 h-9 rounded-xl border-border/60 text-xs font-semibold">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="complaint">Complaints Only</SelectItem>
                  <SelectItem value="installation">Installations Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticket ID, customer name, technician, location or status..."
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              className="pl-10 h-10 rounded-xl border-border/60 text-xs font-medium"
            />
          </div>

          {/* Combined List Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Site Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4 text-right">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No matching service tickets found</p>
                      <p className="text-xs mt-0.5">Try refining your search keyword or category filter.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                        {item.ticket_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.type === "Installation"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-orange-50 text-orange-700 border border-orange-200"
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {item.customer}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {item.location}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.is_chargeable ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Chargeable
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Standard</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeColor(item.payment_status)}`}>
                          {item.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <TablePagination
            currentPage={ticketSearchPage}
            totalPages={totalTicketPages}
            totalItems={combinedServiceList.length}
            itemsPerPage={RECORDS_PER_PAGE}
            onPageChange={setTicketSearchPage}
            itemName="service tickets"
          />
        </Card>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: GENERATE EXECUTIVE SERVICE REPORT                              */}
      {/* ==================================================================== */}
      {activeTab === "generate" && (
        <>
          <Card className="no-print p-6 rounded-2xl border border-border/70 bg-white dark:bg-slate-900 shadow-sm space-y-6 max-w-4xl mx-auto">
            <div className="space-y-1 text-center no-print">
              <div className="w-12 h-12 rounded-2xl gradient-primary text-white mx-auto flex items-center justify-center shadow-md mb-2">
                <Printer className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-display font-extrabold text-foreground">
                Executive Service Report Generator
              </h2>
              <p className="text-xs text-muted-foreground">
                Generate structured, printable compliance summaries for executive review.
              </p>
            </div>

            <div className="space-y-4 pt-2 no-print">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reporting Interval Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Reporting Interval
                  </label>
                  <Select value={generateInterval} onValueChange={setGenerateInterval}>
                    <SelectTrigger className="rounded-xl border-border/60 text-xs h-10 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today's Shift (24h)</SelectItem>
                      <SelectItem value="week">Past 7 Days</SelectItem>
                      <SelectItem value="month">Current Month</SelectItem>
                      <SelectItem value="quarter">Past 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Report Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Report Category
                  </label>
                  <Select value={generateCategory} onValueChange={setGenerateCategory}>
                    <SelectTrigger className="rounded-xl border-border/60 text-xs h-10 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Unified (Complaints & Installations)</SelectItem>
                      <SelectItem value="chargeable">Chargeable Revenue Only</SelectItem>
                      <SelectItem value="complaint">Complaints Only</SelectItem>
                      <SelectItem value="installation">Installations Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Date Range Selectors with Visual Calendar Popovers & Quick Presets */}
              {generateInterval === "custom" && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-4"
                >
                  {/* Quick Selection Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Quick Presets:
                    </span>
                    {[
                      {
                        label: "Today",
                        getRange: () => ({ from: new Date(), to: new Date() })
                      },
                      {
                        label: "Yesterday",
                        getRange: () => {
                          const yest = new Date(Date.now() - 86400000);
                          return { from: yest, to: yest };
                        }
                      },
                      {
                        label: "Last 7 Days",
                        getRange: () => ({ from: new Date(Date.now() - 7 * 86400000), to: new Date() })
                      },
                      {
                        label: "Last 30 Days",
                        getRange: () => ({ from: new Date(Date.now() - 30 * 86400000), to: new Date() })
                      },
                      {
                        label: "This Month",
                        getRange: () => {
                          const now = new Date();
                          return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
                        }
                      },
                      {
                        label: "Previous Month",
                        getRange: () => {
                          const now = new Date();
                          return {
                            from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                            to: new Date(now.getFullYear(), now.getMonth(), 0)
                          };
                        }
                      },
                      {
                        label: "Year to Date",
                        getRange: () => {
                          const now = new Date();
                          return { from: new Date(now.getFullYear(), 0, 1), to: now };
                        }
                      }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const { from, to } = preset.getRange();
                          setGenerateDateRange({
                            from: format(from, "yyyy-MM-dd"),
                            to: format(to, "yyyy-MM-dd")
                          });
                        }}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-border/70 hover:border-primary/50 hover:bg-primary/10 text-slate-700 dark:text-slate-300 transition-all shadow-2xs"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Dual Interactive Calendar Pickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* From Date Calendar Popover */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-primary" />
                        From Date (Start) <span className="text-rose-500">*</span>
                      </label>
                      <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between text-left font-normal rounded-xl h-11 border-border/70 bg-white dark:bg-slate-900 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-2xs"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Calendar className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {fromDateObj ? format(fromDateObj, "dd MMMM yyyy") : "Pick start date"}
                              </span>
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-muted-foreground px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                              {generateDateRange.from || "YYYY-MM-DD"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3 z-50 bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl" align="start">
                          <div className="flex items-center justify-between gap-2 p-1 pb-2.5 mb-1 border-b border-border/60">
                            <Select
                              value={String(fromMonth.getMonth())}
                              onValueChange={(val) => {
                                const newD = new Date(fromMonth);
                                newD.setMonth(Number(val));
                                setFromMonth(newD);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-semibold rounded-lg w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-56 z-50">
                                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                                  <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={String(fromMonth.getFullYear())}
                              onValueChange={(val) => {
                                const newD = new Date(fromMonth);
                                newD.setFullYear(Number(val));
                                setFromMonth(newD);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-semibold rounded-lg w-[85px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-56 z-50">
                                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DayPickerCalendar
                            mode="single"
                            month={fromMonth}
                            onMonthChange={setFromMonth}
                            selected={fromDateObj}
                            onSelect={handleSelectFromDate}
                            initialFocus
                            disabled={(date) => toDateObj ? date > toDateObj : false}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-[11px] text-muted-foreground">Click to open interactive calendar picker</p>
                    </div>

                    {/* To Date Calendar Popover */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-primary" />
                        To Date (End) <span className="text-rose-500">*</span>
                      </label>
                      <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between text-left font-normal rounded-xl h-11 border-border/70 bg-white dark:bg-slate-900 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-2xs"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Calendar className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {toDateObj ? format(toDateObj, "dd MMMM yyyy") : "Pick end date"}
                              </span>
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-muted-foreground px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                              {generateDateRange.to || "YYYY-MM-DD"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3 z-50 bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl" align="start">
                          <div className="flex items-center justify-between gap-2 p-1 pb-2.5 mb-1 border-b border-border/60">
                            <Select
                              value={String(toMonth.getMonth())}
                              onValueChange={(val) => {
                                const newD = new Date(toMonth);
                                newD.setMonth(Number(val));
                                setToMonth(newD);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-semibold rounded-lg w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-56 z-50">
                                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                                  <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={String(toMonth.getFullYear())}
                              onValueChange={(val) => {
                                const newD = new Date(toMonth);
                                newD.setFullYear(Number(val));
                                setToMonth(newD);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-semibold rounded-lg w-[85px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-56 z-50">
                                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DayPickerCalendar
                            mode="single"
                            month={toMonth}
                            onMonthChange={setToMonth}
                            selected={toDateObj}
                            onSelect={handleSelectToDate}
                            initialFocus
                            disabled={(date) => fromDateObj ? date < fromDateObj : false}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-[11px] text-muted-foreground">Click to open interactive calendar picker</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Report Summary Preview */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Report Summary Preview ({generateInterval.toUpperCase()})
                </p>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-border/60 shadow-2xs">
                  {formattedEffectiveDateLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Active Orders</span>
                  <span className="font-extrabold text-foreground text-lg sm:text-xl">{generatedReportData.activeOrders}</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Completed</span>
                  <span className="font-extrabold text-emerald-600 text-lg sm:text-xl">{generatedReportData.completedOrders}</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Chargeable</span>
                  <span className="font-extrabold text-amber-600 text-lg sm:text-xl">{generatedReportData.chargeableOrders}</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Revenue</span>
                  <span className="font-extrabold text-emerald-600 text-lg sm:text-xl">
                    ₹{generatedReportData.totalRevenueSum.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Preview of matching tickets in this range */}
            {generatedReportData.tickets.length > 0 && (
              <div className="space-y-2 no-print">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                  <span>Matching Work Orders ({generatedReportData.tickets.length})</span>
                  <span>Top {Math.min(10, generatedReportData.tickets.length)} shown</span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {generatedReportData.tickets.slice(0, 10).map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-primary shrink-0">{t.ticket_id}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{t.customer}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({t.type})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 font-semibold">
                          {t.status}
                        </span>
                        {t.is_chargeable && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                            ₹{t.service_charge || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2 no-print">
              <Button
                type="button"
                onClick={() => window.print()}
                className="gradient-primary text-white font-bold text-xs rounded-xl h-10 px-6 gap-2 shadow-glow"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Report</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportGeneratedReportCSV}
                className="font-bold text-xs rounded-xl h-10 px-5 gap-2 border-border/70 hover:bg-muted"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export CSV Data</span>
              </Button>
            </div>
          </Card>

          {/* ==================================================================== */}
          {/* 🖨️ OFFICIAL PRINTABLE EXECUTIVE COMPLIANCE REPORT                     */}
          {/* Rendered exclusively during @media print                             */}
          {/* ==================================================================== */}
          <div className="print-only w-full bg-white text-slate-900 p-2 space-y-5">
            {/* Corporate Header / Letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  Brihaspathi Technologies Limited
                </h1>
                <p className="text-xs text-slate-700 font-bold uppercase tracking-wider">
                  Field Service Management & Operations Directorate
                </p>
                <p className="text-[11px] text-slate-500">
                  Official Executive Compliance • Diagnostic Audit • Revenue Ledger
                </p>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block px-2.5 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold rounded uppercase tracking-wider">
                  Official Audit Copy
                </span>
                <p className="text-[11px] text-slate-600">
                  Document No: <span className="font-mono font-bold text-slate-900">BTL-DOC-{new Date().getFullYear()}-{String(Date.now()).slice(-6)}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  Generated: <span className="font-semibold text-slate-900">{format(new Date(), "dd MMM yyyy, hh:mm a")}</span>
                </p>
              </div>
            </div>

            {/* Scope & Reporting Window Banner */}
            <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Report Classification</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {generateCategory === "all"
                    ? "Unified Field Operations (Complaints & Installations)"
                    : generateCategory === "chargeable"
                    ? "Chargeable Services & Revenue Recovery"
                    : generateCategory === "complaint"
                    ? "Complaints & Remedial Service Tickets"
                    : "Field Installation Work Orders"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Reporting Audit Window</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formattedEffectiveDateLabel}
                </span>
              </div>
            </div>

            {/* Executive KPI Summary Cards */}
            <div className="grid grid-cols-4 gap-3 print-avoid-break">
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Work Orders</span>
                <span className="text-2xl font-black text-slate-900">{generatedReportData.activeOrders}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Completed / Handed Over</span>
                <span className="text-2xl font-black text-emerald-700">{generatedReportData.completedOrders}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ({generatedReportData.activeOrders > 0 ? Math.round((generatedReportData.completedOrders / generatedReportData.activeOrders) * 100) : 0}% Resolution)
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Chargeable Work Orders</span>
                <span className="text-2xl font-black text-amber-700">{generatedReportData.chargeableOrders}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Realized Revenue</span>
                <span className="text-2xl font-black text-emerald-700">₹{generatedReportData.totalRevenueSum.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Full Work Orders Ledger Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Work Order Audit Register ({generatedReportData.tickets.length} Records)
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">All Matching Work Orders</span>
              </div>

              <table className="print-table w-full">
                <thead>
                  <tr>
                    <th className="w-8 text-center">#</th>
                    <th className="w-28 text-left">Ticket ID</th>
                    <th className="w-20 text-left">Type</th>
                    <th className="text-left">Customer Name</th>
                    <th className="text-left">Site Location</th>
                    <th className="w-24 text-left">Technician</th>
                    <th className="w-20 text-center">Status</th>
                    <th className="w-20 text-center">Scope</th>
                    <th className="w-20 text-right">Charge (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedReportData.tickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-slate-500">
                        No work orders recorded for this reporting period.
                      </td>
                    </tr>
                  ) : (
                    generatedReportData.tickets.map((t, idx) => (
                      <tr key={t.id}>
                        <td className="text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="font-mono font-bold text-slate-900">{t.ticket_id}</td>
                        <td className="font-semibold">{t.type}</td>
                        <td className="font-medium text-slate-900">{t.customer}</td>
                        <td className="text-slate-600">{t.location}</td>
                        <td className="text-slate-600">{t.technician}</td>
                        <td className="text-center font-bold uppercase text-[9px]">
                          {t.status}
                        </td>
                        <td className="text-center font-medium">
                          {t.is_chargeable ? "Chargeable" : "Standard"}
                        </td>
                        <td className="text-right font-mono font-bold text-slate-900">
                          {t.is_chargeable ? `₹${Number(t.service_charge || 0).toLocaleString("en-IN")}` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Sign-off & Verification Block (Printed at the end) */}
            <div className="pt-8 mt-8 border-t border-slate-300 print-avoid-break">
              <div className="grid grid-cols-3 gap-8 text-center text-xs">
                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase text-[10px]">Prepared By</p>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="font-semibold text-slate-900">{user?.name || "Operations Dispatch"}</p>
                    <p className="text-[10px] text-slate-500">Service Coordinator</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase text-[10px]">Verified By</p>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="font-semibold text-slate-900">Technical Operations Manager</p>
                    <p className="text-[10px] text-slate-500">Brihaspathi Technologies</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase text-[10px]">Authorized Signature / Seal</p>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="font-semibold text-slate-900">Executive Directorate</p>
                    <p className="text-[10px] text-slate-500">Official Seal</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-400">
                This is an official computer-generated audit report issued by Brihaspathi Technologies Limited. Confidential — For internal executive compliance only.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: SLA & CREW PERFORMANCE                                        */}
      {/* ==================================================================== */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <span className="text-xs uppercase font-bold text-muted-foreground">SLA Met Target</span>
              <p className="text-3xl font-black text-emerald-600">96.4%</p>
              <p className="text-[11px] text-muted-foreground">Within standard response window</p>
            </Card>
            <Card className="p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <span className="text-xs uppercase font-bold text-muted-foreground">First-Time Fix Rate</span>
              <p className="text-3xl font-black text-blue-600">88.2%</p>
              <p className="text-[11px] text-muted-foreground">Zero repeat visit within 7 days</p>
            </Card>
            <Card className="p-5 rounded-2xl border border-border/60 bg-white dark:bg-slate-900 shadow-sm space-y-1">
              <span className="text-xs uppercase font-bold text-muted-foreground">Average Mean Time (MTTR)</span>
              <p className="text-3xl font-black text-purple-600">4.2h</p>
              <p className="text-[11px] text-muted-foreground">Intake to final handover</p>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: AUDIT LEDGER & HISTORY                                        */}
      {/* ==================================================================== */}
      {activeTab === "history" && (
        <div className="space-y-5">
          {/* Audit Ledger Header & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl border border-border/70 bg-white dark:bg-slate-900 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-extrabold text-foreground">
                    Financial & Operational Audit Ledger
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chronological audit register of invoices, remittances, field dispatches, and ticket completions.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchAudit();
                  toast.info("Refreshed audit ledger history");
                }}
                disabled={isLoadingAudit}
                className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${isLoadingAudit ? "animate-spin" : ""}`} />
                <span>Refresh Log</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  paymentService.exportAuditLedgerToCSV(
                    filteredAuditRecords,
                    `Audit_Ledger_${new Date().toISOString().split("T")[0]}.csv`
                  );
                  toast.success(`Exported ${filteredAuditRecords.length} audit records to CSV.`);
                }}
                className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold border-border/70 hover:bg-muted"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Audit CSV</span>
              </Button>
            </div>
          </div>

          {/* Audit Metric Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="p-4 rounded-xl border border-border/60 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Total Audit Events
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-foreground">{rawAuditRecords.length}</span>
                <span className="text-[10px] text-primary font-bold">Chronological</span>
              </div>
            </Card>

            <Card className="p-4 rounded-xl border border-border/60 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Invoices & Financials
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-600">
                  {rawAuditRecords.filter((r) => r.category === "financial").length}
                </span>
                <span className="text-[10px] text-muted-foreground">Ledger Entries</span>
              </div>
            </Card>

            <Card className="p-4 rounded-xl border border-border/60 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Field Operations
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-blue-600">
                  {rawAuditRecords.filter((r) => r.category === "operational" || r.category === "status").length}
                </span>
                <span className="text-[10px] text-muted-foreground">Service Milestones</span>
              </div>
            </Card>

            <Card className="p-4 rounded-xl border border-border/60 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Crew Dispatches
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-purple-600">
                  {rawAuditRecords.filter((r) => r.category === "assignment").length}
                </span>
                <span className="text-[10px] text-muted-foreground">Allocations</span>
              </div>
            </Card>
          </div>

          {/* Search and Category Filter Toolbar */}
          <Card className="p-4 rounded-2xl border border-border/70 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search audit records by ticket, customer, action, or technician..."
                  value={auditSearchQuery}
                  onChange={(e) => {
                    setAuditSearchQuery(e.target.value);
                    setAuditPage(1);
                  }}
                  className="pl-9 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-border text-xs"
                />
                {auditSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuditSearchQuery("");
                      setAuditPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="w-full sm:w-60">
                <Select
                  value={auditCategoryFilter}
                  onValueChange={(val) => {
                    setAuditCategoryFilter(val);
                    setAuditPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-border text-xs font-semibold">
                    <SelectValue placeholder="All Event Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories ({rawAuditRecords.length})</SelectItem>
                    <SelectItem value="financial">Financial & Invoices ({rawAuditRecords.filter(r => r.category === "financial").length})</SelectItem>
                    <SelectItem value="operational">Operational & Service ({rawAuditRecords.filter(r => r.category === "operational").length})</SelectItem>
                    <SelectItem value="assignment">Crew Assignments ({rawAuditRecords.filter(r => r.category === "assignment").length})</SelectItem>
                    <SelectItem value="status">Status Milestones ({rawAuditRecords.filter(r => r.category === "status").length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Desktop Structured Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-border text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 w-36">Timestamp</th>
                    <th className="py-3 px-3 w-36">Ticket ID</th>
                    <th className="py-3 px-3">Event & Audit Action</th>
                    <th className="py-3 px-3">Customer & Site</th>
                    <th className="py-3 px-3 w-36">Performed By</th>
                    <th className="py-3 px-3 w-28 text-right">Scope / Impact</th>
                    <th className="py-3 px-3 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedAuditRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-semibold text-sm">No audit records found</p>
                        <p className="text-xs mt-0.5">Try adjusting your search query or event category filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedAuditRecords.map((record, idx) => {
                      const rowNumber = (auditPage - 1) * RECORDS_PER_PAGE + idx + 1;
                      const formattedTime = (() => {
                        try {
                          return format(new Date(record.timestamp), "dd MMM yyyy, hh:mm a");
                        } catch {
                          return record.timestamp;
                        }
                      })();

                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 text-center font-mono text-muted-foreground text-[11px]">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-medium">{formattedTime}</span>
                          </td>
                          <td className="py-3 px-3">
                            {record.raw_ticket_id ? (
                              <Link
                                to={
                                  record.ticket_type === "installation"
                                    ? "/installations"
                                    : `/complaints/${record.raw_ticket_id}`
                                }
                                className="font-mono font-bold text-primary hover:underline"
                              >
                                {record.ticket_id}
                              </Link>
                            ) : (
                              <span className="font-mono font-bold text-foreground">{record.ticket_id}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className="font-bold text-foreground block text-xs">
                                {record.event_title}
                              </span>
                              <span className="text-[11px] text-muted-foreground block line-clamp-1">
                                {record.description}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div>
                              <span className="font-semibold text-foreground block">{record.customer_name}</span>
                              {record.location && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1">
                                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                  {record.location}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              {record.performed_by}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {record.amount ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ₹{Number(record.amount).toLocaleString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Standard</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeColor(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Card List */}
            <div className="md:hidden space-y-3">
              {paginatedAuditRecords.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-semibold text-sm">No audit records found</p>
                  <p className="text-xs mt-0.5">Try adjusting your filters.</p>
                </div>
              ) : (
                paginatedAuditRecords.map((record, idx) => {
                  const rowNumber = (auditPage - 1) * RECORDS_PER_PAGE + idx + 1;
                  const formattedTime = (() => {
                    try {
                      return format(new Date(record.timestamp), "dd MMM yyyy, hh:mm a");
                    } catch {
                      return record.timestamp;
                    }
                  })();

                  return (
                    <Card key={record.id} className="p-3.5 rounded-xl border border-border/70 space-y-2 bg-white dark:bg-slate-900 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-600 dark:text-slate-400">
                            {rowNumber}
                          </span>
                          <span className="font-mono font-bold text-xs text-primary">{record.ticket_id}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeColor(record.status)}`}>
                          {record.status}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-xs text-foreground">{record.event_title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{record.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground">
                        <span>{record.customer_name}</span>
                        {record.amount ? (
                          <span className="font-mono font-bold text-emerald-600">
                            ₹{Number(record.amount).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span>Standard Scope</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{record.performed_by}</span>
                        <span>{formattedTime}</span>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={auditPage}
              totalPages={totalAuditPages}
              totalItems={filteredAuditRecords.length}
              itemsPerPage={RECORDS_PER_PAGE}
              onPageChange={setAuditPage}
              itemName="audit ledger records"
            />
          </Card>
        </div>
      )}
    </div>
  );
}

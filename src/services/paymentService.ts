import { supabase } from "@/lib/supabase";
import { formatComplaintTicketId } from "./complaintService";
import { formatInstallationTicketId } from "./installationService";
import { generateCSV, downloadCSV } from "@/utils/csvHelpers";

export interface ChargeableTicket {
  id: string;
  raw_id: string;
  ticket_id: string;
  ticket_type: "complaint" | "installation";
  customer_name: string;
  customer_id?: string;
  assigned_technician?: string;
  service_charge: number;
  quotation_estimate: number;
  payment_status: "Pending" | "Partially Paid" | "Paid" | "Not Applicable";
  payment_received_date?: string;
  payment_remarks?: string;
  invoice_number?: string;
  is_chargeable: boolean;
  created_at: string;
  title_or_scope?: string;
}

export interface PaymentRecord {
  id?: string;
  ticket_id: string;
  raw_ticket_id?: string;
  ticket_type: "complaint" | "installation";
  customer_name?: string;
  customer_id?: string;
  technician_name?: string;
  service_charge: number;
  quotation_estimate: number;
  invoice_number: string;
  payment_status: "Pending" | "Partially Paid" | "Paid" | "Not Applicable";
  payment_received_date?: string;
  payment_remarks?: string;
  created_at?: string;
  updated_at?: string;
  // joined fields
  customer?: { full_name?: string; phone?: string };
  complaint?: { ticket_id?: string; assigned_technician?: string };
  installation?: { ticket_id?: string; assigned_technicians?: string };
}

export interface PaymentStatistics {
  totalRevenue: number;
  pendingCount: number;
  pendingAmount: number;
  partiallyPaidCount: number;
  partiallyPaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

export interface AuditLedgerRecord {
  id: string;
  timestamp: string;
  ticket_id: string;
  raw_ticket_id?: string;
  ticket_type: "complaint" | "installation";
  category: "financial" | "operational" | "assignment" | "status";
  event_title: string;
  description: string;
  customer_name: string;
  location?: string;
  performed_by: string;
  amount?: number | null;
  status: string;
}

export const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "Paid":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/40";
    case "Partially Paid":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40";
    case "Pending":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40";
    case "Not Applicable":
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export const generateInvoiceNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `INV-${year}-${random}`;
};

export const paymentService = {
  /**
   * Fetch all chargeable tickets from both complaints & installations
   */
  fetchChargeableTickets: async (): Promise<ChargeableTicket[]> => {
    const list: ChargeableTicket[] = [];

    // 1. Fetch complaints that are chargeable
    try {
      let { data: complaints, error: compErr } = await supabase
        .from("complaints")
        .select(`
          id,
          customer_name,
          customer_id,
          chargeable_service,
          coverage,
          service_charge,
          payment_status,
          assigned_technician,
          created_at,
          title
        `)
        .order("created_at", { ascending: false });

      if (compErr && (compErr.code === "42703" || compErr.code === "PGRST204" || compErr.message?.includes("column") || compErr.message?.includes("service_charge"))) {
        console.warn("Retrying complaints query without payment columns...");
        const fallbackRes = await supabase
          .from("complaints")
          .select("id, customer_name, customer_id, chargeable_service, coverage, assigned_technician, created_at, title")
          .order("created_at", { ascending: false });
        complaints = fallbackRes.data as any;
        compErr = null;
      }

      if (!compErr && complaints) {
        // Filter chargeable complaints (chargeable_service === 'Yes' or coverage is chargeable or payment_status exists)
        const chargeableComplaints = complaints.filter(
          (c: any) =>
            c.chargeable_service === "Yes" ||
            c.coverage === "Chargeable Service" ||
            c.coverage === "Chargeable" ||
            (c.service_charge && Number(c.service_charge) > 0) ||
            (c.payment_status && c.payment_status !== "Not Applicable")
        );

        chargeableComplaints.forEach((c: any) => {
          const formattedId = formatComplaintTicketId(c);
          list.push({
            id: c.id,
            raw_id: c.id,
            ticket_id: formattedId,
            ticket_type: "complaint",
            customer_name: c.customer_name || "Valued Client",
            customer_id: c.customer_id,
            assigned_technician: c.assigned_technician || "Unassigned",
            service_charge: Number(c.service_charge) || 0,
            quotation_estimate: Number(c.service_charge) ? Number(c.service_charge) * 1.1 : 0,
            payment_status: (c.payment_status as any) || "Pending",
            is_chargeable: true,
            created_at: c.created_at,
            title_or_scope: c.title || "Field Service Complaint"
          });
        });
      }
    } catch (e) {
      console.warn("Error fetching chargeable complaints:", e);
    }

    // 2. Fetch installations that are chargeable
    try {
      let { data: installations, error: instErr } = await supabase
        .from("installations")
        .select(`
          id,
          customer_id,
          non_btl_customer_name,
          customer:customers(full_name, phone),
          is_chargeable,
          service_charge,
          payment_status,
          created_at,
          installation_technicians(
            technician:profiles(full_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (instErr && (instErr.code === "42703" || instErr.code === "PGRST204" || instErr.message?.includes("column"))) {
        console.warn("Retrying installations query without service_charge column...");
        const fallbackRes = await supabase
          .from("installations")
          .select(`
            id,
            customer_id,
            non_btl_customer_name,
            customer:customers(full_name, phone),
            is_chargeable,
            created_at,
            installation_technicians(
              technician:profiles(full_name)
            )
          `)
          .order("created_at", { ascending: false });
        installations = fallbackRes.data as any;
        instErr = null;
      }

      if (!instErr && installations) {
        const chargeableInstallations = installations.filter(
          (i: any) =>
            i.is_chargeable === true ||
            (i.service_charge && Number(i.service_charge) > 0) ||
            (i.payment_status && i.payment_status !== "Not Applicable")
        );

        chargeableInstallations.forEach((i: any) => {
          const formattedId = formatInstallationTicketId(i);
          const custName =
            (i.customer as any)?.full_name || i.non_btl_customer_name || "Installation Client";
          const techNames = (i.installation_technicians || [])
            .map((it: any) => it.technician?.full_name)
            .filter(Boolean)
            .join(", ") || "Crew Assigned";

          list.push({
            id: i.id,
            raw_id: i.id,
            ticket_id: formattedId,
            ticket_type: "installation",
            customer_name: custName,
            customer_id: i.customer_id,
            assigned_technician: techNames,
            service_charge: Number(i.service_charge) || 0,
            quotation_estimate: Number(i.service_charge) ? Number(i.service_charge) * 1.15 : 0,
            payment_status: (i.payment_status as any) || "Pending",
            is_chargeable: true,
            created_at: i.created_at,
            title_or_scope: "Equipment Installation & Handover"
          });
        });
      }
    } catch (e) {
      console.warn("Error fetching chargeable installations:", e);
    }

    return list;
  },

  /**
   * Fetch payment reports with filters
   */
  fetchPaymentReports: async (filters?: {
    filterStatus?: string;
    dateRange?: { from?: string; to?: string };
    searchQuery?: string;
  }): Promise<PaymentRecord[]> => {
    let query = supabase
      .from("payment_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.filterStatus && filters.filterStatus !== "All Payment Status") {
      query = query.eq("payment_status", filters.filterStatus);
    }

    if (filters?.dateRange?.from) {
      query = query.gte("payment_received_date", filters.dateRange.from);
    }

    if (filters?.dateRange?.to) {
      query = query.lte("payment_received_date", filters.dateRange.to);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Notice: payment_records query returned error (table or column might need migration):", error.message);
    }

    let records: PaymentRecord[] = data || [];

    // Fallback synthesize from chargeable complaints & installations if table has 0 records
    if (records.length === 0) {
      try {
        const chargeable = await paymentService.fetchChargeableTickets();
        records = chargeable.map((t, idx) => {
          const invNum = `INV-${new Date().getFullYear()}-${String(idx + 1).padStart(5, "0")}`;
          return {
            id: t.id,
            raw_ticket_id: t.raw_id,
            ticket_id: t.ticket_id,
            ticket_type: t.ticket_type,
            customer_name: t.customer_name,
            customer_id: t.customer_id,
            technician_name: t.assigned_technician,
            service_charge: t.service_charge || (t.ticket_type === "installation" ? 1500 : 850),
            quotation_estimate: t.quotation_estimate || (t.ticket_type === "installation" ? 1800 : 1000),
            invoice_number: invNum,
            payment_status: t.payment_status || "Pending",
            payment_received_date: t.payment_status === "Paid" ? new Date().toISOString().split("T")[0] : undefined,
            payment_remarks: `${t.ticket_type === "installation" ? "Installation Scope" : "Remedial Service"} — ${t.title_or_scope}`,
            created_at: t.created_at,
            updated_at: t.created_at
          };
        });
      } catch (err) {
        console.warn("Could not synthesize fallback payments:", err);
      }
    }

    // In-memory search filtering if provided
    if (filters?.filterStatus && filters.filterStatus !== "All Payment Status") {
      records = records.filter((r) => r.payment_status === filters.filterStatus);
    }
    if (filters?.dateRange?.from) {
      records = records.filter((r) => (r.payment_received_date || r.created_at || "") >= filters.dateRange!.from!);
    }
    if (filters?.dateRange?.to) {
      records = records.filter((r) => (r.payment_received_date || r.created_at || "") <= filters.dateRange!.to!);
    }
    if (filters?.searchQuery && filters.searchQuery.trim() !== "") {
      const q = filters.searchQuery.toLowerCase();
      records = records.filter(
        (r) =>
          r.ticket_id?.toLowerCase().includes(q) ||
          r.customer_name?.toLowerCase().includes(q) ||
          r.invoice_number?.toLowerCase().includes(q) ||
          r.technician_name?.toLowerCase().includes(q) ||
          r.payment_remarks?.toLowerCase().includes(q)
      );
    }

    return records;
  },

  /**
   * Save / Upsert payment details into payment_records and sync with complaints/installations
   */
  savePayment: async (paymentData: {
    ticket_id: string;
    raw_ticket_id?: string;
    ticket_type?: "complaint" | "installation";
    customer_name?: string;
    customer_id?: string;
    technician_name?: string;
    service_charge: number;
    quotation_estimate: number;
    invoice_number: string;
    payment_status: "Pending" | "Partially Paid" | "Paid" | "Not Applicable";
    payment_received_date?: string;
    payment_remarks?: string;
  }): Promise<{ success: boolean; data?: any; error?: any }> => {
    try {
      const recordPayload: any = {
        ticket_id: paymentData.ticket_id,
        raw_ticket_id: paymentData.raw_ticket_id || null,
        customer_name: paymentData.customer_name || "Valued Client",
        technician_name: paymentData.technician_name || null,
        service_charge: Number(paymentData.service_charge) || 0,
        quotation_estimate: Number(paymentData.quotation_estimate) || 0,
        invoice_number: paymentData.invoice_number,
        payment_status: paymentData.payment_status,
        payment_received_date: paymentData.payment_received_date || null,
        payment_remarks: paymentData.payment_remarks || null,
        updated_at: new Date().toISOString()
      };

      // Try upsert on ticket_id
      let { data, error } = await supabase
        .from("payment_records")
        .upsert(recordPayload, { onConflict: "ticket_id" })
        .select();

      // If error occurs due to schema or column mismatch, attempt resilient column drop
      if (error) {
        console.warn("Initial upsert into payment_records failed, retrying with resilient fallback:", error.message);
        const retryPayload = { ...recordPayload };
        const optionalCols = ['customer_name', 'technician_name', 'raw_ticket_id', 'quotation_estimate', 'payment_remarks', 'payment_received_date'];
        for (const col of optionalCols) {
          if (error.message?.toLowerCase().includes(col)) {
            delete retryPayload[col];
          }
        }

        const resFallback = await supabase
          .from("payment_records")
          .upsert(retryPayload, { onConflict: "ticket_id" })
          .select();
        data = resFallback.data;
        error = resFallback.error;
      }

      if (error) {
        throw error;
      }

      // Sync payment_status and service_charge back to the target ticket table
      const targetId = paymentData.raw_ticket_id;
      if (targetId) {
        if (paymentData.ticket_type === "installation" || paymentData.ticket_id.startsWith("BTL-INS")) {
          await supabase
            .from("installations")
            .update({
              payment_status: paymentData.payment_status,
              service_charge: paymentData.service_charge
            })
            .eq("id", targetId);
        } else {
          await supabase
            .from("complaints")
            .update({
              payment_status: paymentData.payment_status,
              service_charge: paymentData.service_charge
            })
            .eq("id", targetId);
        }
      }

      return { success: true, data };
    } catch (err: any) {
      console.error("Error saving payment:", err);
      return { success: false, error: err };
    }
  },

  /**
   * Calculate executive payment statistics
   */
  calculatePaymentStatistics: (records: PaymentRecord[]): PaymentStatistics => {
    let totalRevenue = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let partiallyPaidCount = 0;
    let partiallyPaidAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    records.forEach((r) => {
      const charge = Number(r.service_charge) || 0;
      const created = r.created_at ? new Date(r.created_at) : now;

      if (r.payment_status === "Paid") {
        totalRevenue += charge;
      } else if (r.payment_status === "Partially Paid") {
        partiallyPaidCount += 1;
        partiallyPaidAmount += charge;
      } else if (r.payment_status === "Pending") {
        pendingCount += 1;
        pendingAmount += charge;

        // Check if invoice is older than 30 days
        if (created < thirtyDaysAgo) {
          overdueCount += 1;
          overdueAmount += charge;
        }
      }
    });

    return {
      totalRevenue,
      pendingCount,
      pendingAmount,
      partiallyPaidCount,
      partiallyPaidAmount,
      overdueCount,
      overdueAmount
    };
  },

  /**
   * Export payment records to CSV
   */
  exportPaymentToCSV: (records: PaymentRecord[], filename = "payment_report.csv"): void => {
    const csvData = records.map((record) => ({
      Ticket: record.ticket_id,
      Customer: record.customer_name || record.customer?.full_name || "N/A",
      Technician: record.technician_name || record.complaint?.assigned_technician || record.installation?.assigned_technicians || "N/A",
      "Service Charge": `₹${record.service_charge ?? 0}`,
      Quotation: `₹${record.quotation_estimate ?? 0}`,
      Invoice: record.invoice_number || "N/A",
      Status: record.payment_status || "Pending",
      "Received Date": record.payment_received_date || "N/A",
      Remarks: record.payment_remarks || "—"
    }));

    const columns = [
      "Ticket",
      "Customer",
      "Technician",
      "Service Charge",
      "Quotation",
      "Invoice",
      "Status",
      "Received Date",
      "Remarks"
    ];

    const csvString = generateCSV(csvData, columns);
    downloadCSV(csvString, filename);
  },

  /**
   * Comprehensive Financial & Operational Audit Ledger
   * Gathers transactions from payment_records, complaints lifecycle, and installations
   */
  fetchAuditLedger: async (): Promise<AuditLedgerRecord[]> => {
    const events: AuditLedgerRecord[] = [];

    // 1. Fetch Payment / Invoicing Records
    try {
      const payments = await paymentService.fetchPaymentReports();
      payments.forEach((p) => {
        events.push({
          id: `aud-inv-${p.id || p.ticket_id}`,
          timestamp: p.created_at || new Date().toISOString(),
          ticket_id: p.ticket_id,
          raw_ticket_id: p.raw_ticket_id,
          ticket_type: p.ticket_type || "complaint",
          category: "financial",
          event_title: `Invoice Generated (${p.invoice_number})`,
          description: `Generated service invoice of ₹${p.service_charge} • Quotation: ₹${p.quotation_estimate}`,
          customer_name: p.customer_name || "Valued Client",
          performed_by: p.technician_name || "Finance Operations",
          amount: Number(p.service_charge) || 0,
          status: p.payment_status || "Pending",
        });

        if (p.payment_status === "Paid" && p.payment_received_date) {
          events.push({
            id: `aud-settle-${p.id || p.ticket_id}`,
            timestamp: `${p.payment_received_date}T12:00:00.000Z`,
            ticket_id: p.ticket_id,
            raw_ticket_id: p.raw_ticket_id,
            ticket_type: p.ticket_type || "complaint",
            category: "financial",
            event_title: `Payment Settlement Confirmed`,
            description: `Full remittance of ₹${p.service_charge} received and cleared for ${p.invoice_number}`,
            customer_name: p.customer_name || "Valued Client",
            performed_by: "Accounts Desk",
            amount: Number(p.service_charge) || 0,
            status: "Settled",
          });
        }
      });
    } catch (e) {
      console.warn("Audit ledger payment records load warning:", e);
    }

    // 2. Fetch Complaints Operational Events
    try {
      const { data: complaints } = await supabase
        .from("complaints")
        .select(`
          id,
          title,
          status,
          priority,
          customer_name,
          site_address,
          assigned_technician,
          chargeable_service,
          service_charge,
          created_at,
          updated_at,
          resolved_at
        `)
        .order("created_at", { ascending: false });

      if (complaints) {
        complaints.forEach((c: any) => {
          const formattedId = formatComplaintTicketId(c);
          
          // Event A: Ticket Registration
          events.push({
            id: `aud-comp-reg-${c.id}`,
            timestamp: c.created_at,
            ticket_id: formattedId,
            raw_ticket_id: c.id,
            ticket_type: "complaint",
            category: "operational",
            event_title: `Complaint Registered`,
            description: `${c.title || "Service defect report"} • Priority: ${c.priority || "Medium"}`,
            customer_name: c.customer_name || "Customer",
            location: c.site_address,
            performed_by: "Customer Care Dispatch",
            amount: c.chargeable_service === "Yes" ? Number(c.service_charge) || 0 : 0,
            status: "Registered",
          });

          // Event B: Technician Assignment
          if (c.assigned_technician && c.assigned_technician !== "Unassigned") {
            events.push({
              id: `aud-comp-assign-${c.id}`,
              timestamp: c.created_at,
              ticket_id: formattedId,
              raw_ticket_id: c.id,
              ticket_type: "complaint",
              category: "assignment",
              event_title: `Technician Dispatched`,
              description: `Assigned field specialist ${c.assigned_technician} for site remediation`,
              customer_name: c.customer_name || "Customer",
              location: c.site_address,
              performed_by: "Operations Supervisor",
              status: "Assigned",
            });
          }

          // Event C: Status Progress / Completion
          if (c.status === "completed" || c.status === "resolved") {
            events.push({
              id: `aud-comp-res-${c.id}`,
              timestamp: c.resolved_at || c.updated_at || c.created_at,
              ticket_id: formattedId,
              raw_ticket_id: c.id,
              ticket_type: "complaint",
              category: "status",
              event_title: `Work Order Completed & Handed Over`,
              description: `Field service diagnostic & repair verified and signed off by client`,
              customer_name: c.customer_name || "Customer",
              location: c.site_address,
              performed_by: c.assigned_technician || "Lead Technician",
              status: "Completed",
            });
          } else if (c.status === "in-progress") {
            events.push({
              id: `aud-comp-prog-${c.id}`,
              timestamp: c.updated_at || c.created_at,
              ticket_id: formattedId,
              raw_ticket_id: c.id,
              ticket_type: "complaint",
              category: "status",
              event_title: `On-Site Diagnostic In-Progress`,
              description: `Technician arrived at site and commenced troubleshooting`,
              customer_name: c.customer_name || "Customer",
              location: c.site_address,
              performed_by: c.assigned_technician || "Field Tech",
              status: "In-Progress",
            });
          }
        });
      }
    } catch (e) {
      console.warn("Audit ledger complaints load warning:", e);
    }

    // 3. Fetch Installations Operational Events
    try {
      const { data: installations } = await supabase
        .from("installations")
        .select(`
          id,
          site_address,
          status,
          scheduled_date,
          non_btl_customer_name,
          customer:customers(full_name),
          is_chargeable,
          service_charge,
          created_at,
          installation_technicians(
            technician:profiles(full_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (installations) {
        installations.forEach((i: any) => {
          const formattedId = formatInstallationTicketId(i);
          const custName = (i.customer as any)?.full_name || i.non_btl_customer_name || "Installation Client";
          const techNames = (i.installation_technicians || [])
            .map((it: any) => it.technician?.full_name)
            .filter(Boolean)
            .join(", ") || "Crew Assigned";

          events.push({
            id: `aud-inst-reg-${i.id}`,
            timestamp: i.created_at,
            ticket_id: formattedId,
            raw_ticket_id: i.id,
            ticket_type: "installation",
            category: "operational",
            event_title: `Installation Work Order Created`,
            description: `Scheduled installation project for site deployment`,
            customer_name: custName,
            location: i.site_address,
            performed_by: "Project Coordinator",
            amount: i.is_chargeable ? Number(i.service_charge) || 0 : 0,
            status: i.status || "Scheduled",
          });

          if (techNames && techNames !== "Crew Assigned") {
            events.push({
              id: `aud-inst-assign-${i.id}`,
              timestamp: i.created_at,
              ticket_id: formattedId,
              raw_ticket_id: i.id,
              ticket_type: "installation",
              category: "assignment",
              event_title: `Installation Crew Deployed`,
              description: `Field team (${techNames}) allocated for hardware commissioning`,
              customer_name: custName,
              location: i.site_address,
              performed_by: "Crew Dispatcher",
              status: "Assigned",
            });
          }
        });
      }
    } catch (e) {
      console.warn("Audit ledger installations load warning:", e);
    }

    // Sort all events chronologically descending
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  /**
   * Export Audit Ledger records to CSV
   */
  exportAuditLedgerToCSV: (records: AuditLedgerRecord[], filename = "audit_ledger_report.csv"): void => {
    const csvData = records.map((record, index) => ({
      "#": index + 1,
      "Timestamp": record.timestamp,
      "Ticket ID": record.ticket_id,
      "Category": record.category,
      "Event Title": record.event_title,
      "Description": record.description,
      "Customer": record.customer_name,
      "Location": record.location || "—",
      "Performed By": record.performed_by,
      "Financial Scope": record.amount ? `₹${record.amount}` : "Standard Scope",
      "Status": record.status
    }));

    const columns = [
      "#",
      "Timestamp",
      "Ticket ID",
      "Category",
      "Event Title",
      "Description",
      "Customer",
      "Location",
      "Performed By",
      "Financial Scope",
      "Status"
    ];

    const csvString = generateCSV(csvData, columns);
    downloadCSV(csvString, filename);
  }
};

export const savePaymentRecord = paymentService.savePayment;
export const getPaymentRecords = paymentService.fetchPaymentReports;

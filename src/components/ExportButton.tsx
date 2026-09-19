import { Download, FileSpreadsheet, Users, Shield, UserCheck, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCSV, generateCSV } from "@/utils/csvHelpers";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { formatComplaintTicketId } from "@/services/complaintService";

interface ExportButtonProps {
  variant?: "staff" | "customer" | "asset" | "complaint";
  className?: string;
}

const STAFF_COLUMNS = ["full_name", "email", "phone", "role", "branch_id", "expertise", "created_at"];
const CUSTOMER_COLUMNS = ["full_name", "email", "phone", "customer_type", "created_at"];
const ASSET_COLUMNS = [
  "customer_name",
  "product_name",
  "brand",
  "model_number",
  "serial_number",
  "category",
  "purchase_date",
  "warranty_months",
  "status",
];
const COMPLAINT_COLUMNS = [
  "ticket_id",
  "title",
  "customer_name",
  "customer_phone",
  "category",
  "coverage",
  "chargeable_service",
  "brand",
  "severity",
  "priority",
  "status",
  "location",
  "assigned_supervisor",
  "assigned_technician",
  "scheduled_date",
  "scheduled_time",
  "created_at",
];

export default function ExportButton({ variant = "staff", className }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const fetchProfiles = useQuery({
    queryKey: ["export-profiles"],
    enabled: variant === "staff",
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const fetchCustomers = useQuery({
    queryKey: ["export-customers"],
    enabled: variant === "customer",
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const fetchAssets = useQuery({
    queryKey: ["export-assets"],
    enabled: variant === "asset",
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_assets").select("*, customers(full_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        customer_name: a.customers?.full_name || a.customer_name || "",
      }));
    },
  });

  const fetchComplaints = useQuery({
    queryKey: ["export-complaints"],
    enabled: variant === "complaint",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select("*, profiles:customer_id(full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        ticket_id: formatComplaintTicketId(c),
        customer_name: c.customer_name || c.profiles?.full_name || "Customer",
        customer_phone: c.customer_phone || c.profiles?.phone || "",
        category: c.field_of_work || c.category || "",
        coverage: c.coverage || "Out of Warranty",
        chargeable_service: c.chargeable_service ? String(c.chargeable_service) : "No",
      }));
    },
  });

  const getQueryData = () => {
    if (variant === "staff") return fetchProfiles.data || [];
    if (variant === "customer") return fetchCustomers.data || [];
    if (variant === "asset") return fetchAssets.data || [];
    return fetchComplaints.data || [];
  };

  const getColumns = () => {
    if (variant === "staff") return STAFF_COLUMNS;
    if (variant === "customer") return CUSTOMER_COLUMNS;
    if (variant === "asset") return ASSET_COLUMNS;
    return COMPLAINT_COLUMNS;
  };

  const normalizeRow = (row: Record<string, unknown>, columns: string[]) => {
    const normalized: Record<string, unknown> = {};
    columns.forEach((col) => {
      const key = Object.keys(row).find((k) => k.toLowerCase() === col.toLowerCase());
      normalized[col] = key ? row[key] : "";
    });
    return normalized;
  };

  const download = (filtered: Record<string, unknown>[], filename: string) => {
    const columns = getColumns();
    const normalized = filtered.map((row) => normalizeRow(row, columns));
    const csv = generateCSV(normalized, columns);
    downloadCSV(csv, filename);
    toast.success(`Exported ${normalized.length} records to ${filename}`);
    setExporting(false);
  };

  const handleExport = async (filter: "all" | "technician" | "supervisor" | null) => {
    setExporting(true);
    try {
      const data = getQueryData();

      if (!data || data.length === 0) {
        toast.info("No records found to export.");
        setExporting(false);
        return;
      }

      let rows = data;
      if (variant === "customer") {
        download(rows, "customers_export.csv");
        return;
      }

      if (variant === "asset") {
        download(rows, "assets_inventory_export.csv");
        return;
      }

      if (variant === "complaint") {
        download(rows, "complaints_export.csv");
        return;
      }

      if (filter === "technician") {
        rows = rows.filter((r: any) => r.role === "technician");
      } else if (filter === "supervisor") {
        rows = rows.filter((r: any) => r.role === "supervisor");
      }

      if (rows.length === 0) {
        toast.info("No matching records found for this filter.");
        setExporting(false);
        return;
      }

      if (filter === "all") {
        download(rows, "export_all_users.csv");
      } else if (filter === "technician") {
        download(rows, "export_technicians.csv");
      } else if (filter === "supervisor") {
        download(rows, "export_supervisors.csv");
      }
    } catch (e: any) {
      toast.error(e.message || "Export failed");
      setExporting(false);
    }
  };

  const isLoading = fetchProfiles.isLoading || fetchCustomers.isLoading || fetchAssets.isLoading || fetchComplaints.isLoading;

  if (variant === "customer" || variant === "asset" || variant === "complaint") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport(null)}
        disabled={isLoading || exporting}
        className={`rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs transition-all ${className || ""}`}
      >
        {exporting || isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : (
          <Download className="w-4 h-4 text-primary shrink-0" />
        )}
        <span>Export CSV</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || exporting}
          className={`rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs transition-all ${className || ""}`}
        >
          {exporting || isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Download className="w-4 h-4 text-primary shrink-0" />
          )}
          <span>Export</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl p-1.5 shadow-xl border-border/60 min-w-[180px]">
        <DropdownMenuItem onClick={() => handleExport("all")} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
          <Users className="w-4 h-4 text-primary" /> Export All Users
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("technician")} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
          <UserCheck className="w-4 h-4 text-emerald-500" /> Export Technicians
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("supervisor")} className="rounded-xl gap-2 font-medium text-xs cursor-pointer py-2">
          <Shield className="w-4 h-4 text-indigo-500" /> Export Supervisors
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

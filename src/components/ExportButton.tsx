import { Download } from "lucide-react";
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
import { Loader2 } from "lucide-react";
import { useState } from "react";

type Table = "profiles" | "customers" | "customer_assets";

interface ExportButtonProps {
  variant?: "staff" | "customer" | "asset";
  className?: string;
}

const STAFF_COLUMNS = ["full_name", "email", "phone", "role", "branch_id", "expertise", "created_at"];
const CUSTOMER_COLUMNS = ["full_name", "email", "phone", "created_at"];
const ASSET_COLUMNS = [
  "customer_name",
  "product_name",
  "model_number",
  "serial_number",
  "category",
  "purchase_date",
  "warranty_status",
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
      const { data, error } = await supabase.from("customer_assets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const getQueryData = () => {
    if (variant === "staff") return fetchProfiles.data || [];
    if (variant === "customer") return fetchCustomers.data || [];
    return fetchAssets.data || [];
  };

  const getColumns = () => {
    if (variant === "staff") return STAFF_COLUMNS;
    if (variant === "customer") return CUSTOMER_COLUMNS;
    return ASSET_COLUMNS;
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
    toast.success(`Exported ${normalized.length} rows`);
    setExporting(false);
  };

  const handleExport = async (filter: "all" | "technician" | "supervisor" | null) => {
    setExporting(true);
    try {
      let rows = getQueryData();

      if (variant === "staff" && filter) {
        rows = rows.filter((r: any) => r.role === filter);
      }

      if (variant === "asset") {
        const assetRows = rows.map((r: any) => ({
          ...r,
          customer_name: r.customers?.full_name || r.customer_name || "",
        }));
        const filename = filter ? `export_${filter}_assets.csv` : "export_all_assets.csv";
        download(assetRows, filename);
        return;
      }

      if (variant === "customer") {
        download(rows, "export_customers.csv");
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

  const isLoading = fetchProfiles.isLoading || fetchCustomers.isLoading || fetchAssets.isLoading;

  if (variant === "customer") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport(null)}
        disabled={isLoading || exporting}
        className={className}
      >
        {exporting || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 shrink-0" />}
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">Exp</span>
      </Button>
    );
  }

  if (variant === "asset") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport(null)}
        disabled={isLoading || exporting}
        className={className}
      >
        {exporting || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 shrink-0" />}
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">Exp</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading || exporting} className={className}>
          {exporting || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 shrink-0" />}
          <span className="hidden sm:inline">Export</span>
          <span className="sm:hidden">Exp</span>
          <span className="text-[10px]">▼</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("all")}>Export All Users</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("technician")}>Export Technicians</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("supervisor")}>Export Supervisors</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

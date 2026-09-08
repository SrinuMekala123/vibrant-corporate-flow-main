// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escape = (value: unknown): string => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const toCSV = (rows: Record<string, unknown>[], columns: string[]): string => {
  if (!rows.length || !columns.length) return "";
  const header = columns.map(escape).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const key = Object.keys(row).find((k) => k.toLowerCase() === col.toLowerCase());
          return escape(key ? row[key] : "");
        })
        .join(",")
    )
    .join("\n");
  return [header, body].join("\n");
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { table, filters = {} } = body;

    if (!table || !["profiles", "customers", "customer_assets"].includes(table)) {
      throw new Error("Invalid table. Must be profiles, customers, or customer_assets.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabaseAdmin.from(table).select("*").order("created_at", { ascending: false });
    if (error) throw error;

    let rows = data || [];

    if (table === "profiles" && filters.role) {
      rows = rows.filter((r: any) => r.role === filters.role);
    }

    if (table === "customer_assets" && filters.customer_id) {
      rows = rows.filter((r: any) => r.customer_id === filters.customer_id);
    }

    let columns: string[] = [];
    if (table === "profiles") {
      columns = ["full_name", "email", "phone", "role", "branch_id", "expertise", "created_at"];
    } else if (table === "customers") {
      columns = ["full_name", "email", "phone", "created_at"];
    } else {
      columns = [
        "customer_name",
        "product_name",
        "model_number",
        "serial_number",
        "category",
        "purchase_date",
        "warranty_status",
      ];
    }

    const csv = toCSV(rows, columns);

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv;charset=utf-8;",
        "Content-Disposition": `attachment; filename="${table}_export.csv"`,
      },
      status: 200,
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Export failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

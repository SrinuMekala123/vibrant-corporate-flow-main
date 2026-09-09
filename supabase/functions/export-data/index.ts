// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const columns = ["full_name", "email", "phone", "role", "branch_id", "customer_type", "expertise", "created_at"];
const escape = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { table = "profiles", role } = await req.json();
    if (table !== "profiles") throw new Error("User export must use the profiles table");
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Export service is missing Supabase configuration");
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    let query = admin.from("profiles").select(columns.join(",")).in("role", ["customer", "technician", "supervisor", "admin"]).order("created_at", { ascending: false });
    if (role && ["customer", "technician", "supervisor", "admin"].includes(role)) query = query.eq("role", role);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load profiles: ${error.message}`);
    const csv = [columns.join(","), ...(data || []).map((row) => columns.map((column) => escape(row[column])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}\r\n`, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=users_export.csv" },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Export failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

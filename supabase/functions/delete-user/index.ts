// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = ["profiles", "customers", "customer_assets", "assets"];

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, tableName } = body;

    if (!userId || typeof userId !== "string") {
      throw new Error("Missing or invalid userId");
    }

    if (!tableName || !ALLOWED_TABLES.includes(tableName)) {
      throw new Error(`Invalid tableName. Allowed: ${ALLOWED_TABLES.join(", ")}`);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // For customers table, resolve the actual customer record id first
    let recordId = userId;
    if (tableName === "customers") {
      const { data: customerRecord, error: lookupError } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (lookupError) {
        console.error("Failed to look up customer record:", lookupError);
        throw new Error(`Failed to look up customer record: ${lookupError.message}`);
      }

      if (!customerRecord) {
        // No customer record found, still try to delete auth user
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
          throw new Error(`Failed to delete auth user: ${authError.message}`);
        }
        return new Response(
          JSON.stringify({ success: true, message: "No customer record found, but auth user deleted" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      recordId = customerRecord.id;
    }

    // Step A: Delete from the specified public table first
    const { error: tableError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq("id", recordId);

    if (tableError) {
      console.error(`Failed to delete from ${tableName}:`, tableError);
      throw new Error(`Failed to delete from ${tableName}: ${tableError.message}`);
    }

    // Step B: Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Failed to delete auth user:", authError);
      throw new Error(`Failed to delete auth user: ${authError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "User permanently deleted from database and auth" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Delete user error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Delete failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

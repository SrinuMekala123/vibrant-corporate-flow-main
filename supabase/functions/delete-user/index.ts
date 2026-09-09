// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Request body must be valid JSON" }, 400); }

  const { userId, customerId, tableName } = body;
  console.log("Deleting user:", userId, "from table:", tableName);
  console.log("Service role key exists:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (userId != null && typeof userId !== "string") return json({ error: "Invalid userId" }, 400);
  if (customerId != null && typeof customerId !== "string") return json({ error: "Invalid customerId" }, 400);
  if (!userId && !customerId) return json({ error: "Missing userId or customerId" }, 400);
  if (!["profiles", "customers"].includes(tableName)) return json({ error: "tableName must be profiles or customers" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Delete configuration error", { hasUrl: !!url, hasServiceRoleKey: !!key });
    return json({ error: "Delete service is not configured with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    let authUserId = userId || null;
    let profileId = userId || null;
    let customerRecordIds = customerId ? [customerId] : [];
    if (tableName === "customers") {
      let query = admin.from("customers").select("id, user_id");
      query = customerId ? query.eq("id", customerId) : query.eq("user_id", userId);
      const { data: customers, error } = await query;
      if (error) throw new Error(`Could not find customer records: ${error.message}`);
      if (customers?.length) {
        customerRecordIds = customers.map((customer) => customer.id);
        const linkedUserId = customers.find((customer) => customer.user_id)?.user_id;
        authUserId = linkedUserId || authUserId;
        profileId = linkedUserId || profileId;
      }
    } else if (userId) {
      const { data: profile, error } = await admin.from("profiles").select("id, role").eq("id", userId).maybeSingle();
      if (error) throw new Error(`Could not find profile: ${error.message}`);
      const { data: customers, error: customerError } = await admin.from("customers").select("id, user_id").eq("user_id", userId);
      if (customerError) throw new Error(`Could not find related customers: ${customerError.message}`);
      customerRecordIds = customers?.map((customer) => customer.id) || [];
    }

    if (customerRecordIds.length) {
      const { error } = await admin.from("customers").delete().in("id", customerRecordIds);
      if (error) throw new Error(`Failed to delete customers record: ${error.message}`);
    }
    if (profileId) {
      const { error } = await admin.from("profiles").delete().eq("id", profileId);
      if (error) throw new Error(`Failed to delete profiles record: ${error.message}`);
    }
    if (authUserId) {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error && !/not found|user not found/i.test(error.message)) throw new Error(`Failed to delete Auth user: ${error.message}`);
    }
    return json({ success: true, message: "User deleted from customers, profiles, and Auth" });
  } catch (error) {
    console.error("Delete user error:", error);
    return json({ error: error?.message || "Delete failed" }, 500);
  }
});

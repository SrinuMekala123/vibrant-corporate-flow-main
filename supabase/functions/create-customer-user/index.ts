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
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone || "").trim();
    const role = body.role || "customer";
    const createCustomerRecord = body.createCustomerRecord === true;
    const customerData = body.customerData || {};

    if (!email || !password || !fullName) return json({ error: "Missing required fields: email, password, full_name" }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Invalid email address" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (!["customer", "technician", "supervisor", "admin"].includes(role)) return json({ error: "Invalid role" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Auth service is not configured" }, 500);
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: existingProfile, error: profileLookupError } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (profileLookupError) throw new Error(`Could not check existing email: ${profileLookupError.message}`);
    if (existingProfile) return json({ error: "Email already exists" }, 400);
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw new Error(`Could not check existing Auth users: ${usersError.message}`);
    if (users.users.some((existingUser) => existingUser.email?.toLowerCase() === email)) return json({ error: "Email already exists" }, 400);

    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role, phone } });
    if (authError || !authData.user) {
      if (/already|exists|registered/i.test(authError?.message || "")) return json({ error: "Email already exists" }, 400);
      throw new Error(authError?.message || "Failed to create Auth user");
    }

    const userId = authData.user.id;
    try {
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId, email, full_name: fullName, role, phone: phone || null,
        avatar_url: fullName.charAt(0).toUpperCase(), branch_id: customerData.branch_id || null,
        customer_type: role === "customer" ? customerData.customer_type || "Retail" : null,
      });
      if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

      let customerId = null;
      if (createCustomerRecord) {
        const { data: customer, error: customerError } = await admin.from("customers").insert({
          user_id: userId, full_name: fullName, phone: phone || null, email,
          address: customerData.address || null, customer_type: customerData.customer_type || "Retail",
          branch_id: customerData.branch_id || null,
        }).select("id").single();
        if (customerError) throw new Error(`Failed to create customer record: ${customerError.message}`);
        customerId = customer.id;
      }
      return json({ success: true, userId, customerId, user: { id: userId, email, full_name: fullName, role } });
    } catch (error) {
      await admin.auth.admin.deleteUser(userId);
      throw error;
    }
  } catch (error) {
    console.error("create-customer-user error:", error);
    return json({ error: error?.message || "Customer creation failed" }, 500);
  }
});

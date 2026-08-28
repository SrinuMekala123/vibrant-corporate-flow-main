// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      email,
      password,
      full_name,
      phone,
      role = "customer",
      // Optional: create a customer record alongside the auth user
      createCustomerRecord = false,
      customerData = {},
    } = body;

    // --- Validate required fields ---
    if (!email || !password || !full_name) {
      throw new Error("Missing required fields: email, password, full_name");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    // Initialize Supabase client with Service Role Key (bypasses RLS & allows admin auth actions)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // --- Step 1: Create Auth User ---
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        phone,
      },
    });

    if (authError) {
      // Provide a user-friendly message for duplicate emails
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        throw new Error(`An account with email "${email}" already exists.`);
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Failed to create auth user");
    }

    const userId = authData.user.id;

    // --- Step 2: Upsert Profile ---
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        full_name,
        role,
        phone: phone || null,
        avatar_url: full_name.charAt(0).toUpperCase(),
      });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      throw profileError;
    }

    // --- Step 3: Optionally create Customer record ---
    let customerId: string | null = null;

    if (createCustomerRecord) {
      const customerPayload = {
        user_id: userId,
        full_name,
        phone: phone || null,
        email: email.trim().toLowerCase(),
        address: customerData.address || null,
        customer_type: customerData.customer_type || "Retail",
        branch_id: customerData.branch_id || null,
      };

      const { data: customerRow, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert([customerPayload])
        .select("id")
        .single();

      if (customerError) {
        console.error("Customer insert error:", customerError);
        throw customerError;
      }

      customerId = customerRow?.id || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        customerId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("create-customer-user error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

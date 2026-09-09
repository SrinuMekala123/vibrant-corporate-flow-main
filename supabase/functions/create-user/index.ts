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
    const { email, password, fullName, role, phone, expertise, userId, branchId, customerType = "Retail" } = body;

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

    if (userId) {
      if (!password) {
        throw new Error("Missing required field: password");
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (authError) throw authError;

      return new Response(
        JSON.stringify({ success: true, user: authData.user }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!email || !password || !fullName || !role) {
      throw new Error("Missing required fields: email, password, fullName, role");
    }

    const resolvedBranchId = branchId || null;
    if (resolvedBranchId) {
      const { data: branch, error: branchError } = await supabaseAdmin
        .from("branches")
        .select("id")
        .eq("id", resolvedBranchId)
        .maybeSingle();
      if (branchError) throw new Error(`Failed to validate branch: ${branchError.message}`);
      if (!branch) throw new Error("Selected branch does not exist");
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        phone,
        expertise,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create auth user");

    // Upsert into profiles table
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
        phone: phone || null,
        expertise: expertise || null,
        branch_id: resolvedBranchId,
        customer_type: role === "customer" ? customerType : null,
        avatar_url: fullName.charAt(0).toUpperCase(),
      });

    if (profileError) {
      console.error("Create user profile error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    let customer = null;
    if (role === "customer") {
      const customerPayload = {
        user_id: authData.user.id,
        full_name: fullName,
        phone: phone || null,
        email,
        customer_type: customerType || "Retail",
        branch_id: resolvedBranchId,
      };
      const { data: customerData, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert(customerPayload)
        .select("id, user_id, full_name, email, customer_type, branch_id")
        .single();
      if (customerError) {
        console.error("Create user customer record error:", customerError);
        await supabaseAdmin.from("profiles").delete().eq("id", authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create customer record: ${customerError.message}`);
      }
      customer = customerData;
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user, customer }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Create user error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

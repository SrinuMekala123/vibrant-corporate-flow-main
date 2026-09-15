// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ error: "ids must be a non-empty array" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Validate requester is admin or supervisor
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requester } } = await admin.auth.getUser(token);
    if (!requester) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .maybeSingle();

    if (profileError || !profile || !["admin", "supervisor"].includes(profile.role)) {
      return json({ error: "Forbidden: admin or supervisor access required" }, 403);
    }

    const validIds = ids.filter((id: any) => typeof id === "string" && id.length > 0);
    if (validIds.length === 0) {
      return json({ error: "No valid customer IDs provided" }, 400);
    }

    let deletedCustomers = 0;
    let failedCustomers = 0;

    for (const customerId of validIds) {
      try {
        // Lookup customer record and linked user_id
        const { data: customer, error: customerLookupError } = await admin
          .from("customers")
          .select("id, user_id")
          .eq("id", customerId)
          .maybeSingle();

        if (customerLookupError || !customer) {
          console.error(`Customer lookup failed for ${customerId}:`, customerLookupError);
          failedCustomers++;
          continue;
        }

        const authUserId = customer.user_id;

        // Delete customer record
        const { error: deleteCustomerError } = await admin
          .from("customers")
          .delete()
          .eq("id", customerId);

        if (deleteCustomerError) {
          console.error(`Failed to delete customer ${customerId}:`, deleteCustomerError);
          failedCustomers++;
          continue;
        }

        // If linked auth user exists, delete profile and auth user
        if (authUserId) {
          const { error: deleteProfileError } = await admin
            .from("profiles")
            .delete()
            .eq("id", authUserId);

          if (deleteProfileError) {
            console.error(`Failed to delete profile ${authUserId}:`, deleteProfileError);
          }

          const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUserId);
          if (deleteAuthError && !/not found|user not found/i.test(deleteAuthError.message)) {
            console.error(`Failed to delete auth user ${authUserId}:`, deleteAuthError);
          }
        }

        deletedCustomers++;
      } catch (err) {
        console.error(`Unexpected error deleting customer ${customerId}:`, err);
        failedCustomers++;
      }
    }

    return json({
      success: true,
      deletedCount: deletedCustomers,
      failedCount: failedCustomers,
      totalRequested: validIds.length,
    });
  } catch (error: any) {
    console.error("Bulk delete customers error:", error);
    return json({ error: error?.message || "Bulk delete failed" }, 500);
  }
});

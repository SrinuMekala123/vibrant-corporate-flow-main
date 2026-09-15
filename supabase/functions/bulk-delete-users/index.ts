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
      return json({ error: "No valid user IDs provided" }, 400);
    }

    let deletedUsers = 0;
    let failedUsers = 0;

    for (const userId of validIds) {
      try {
        // Lookup customer records linked to this profile
        const { data: customers, error: customerError } = await admin
          .from("customers")
          .select("id")
          .eq("user_id", userId);

        if (customerError) {
          console.error(`Failed to lookup customers for user ${userId}:`, customerError);
        }

        // Delete customer records
        if (customers && customers.length > 0) {
          const customerIds = customers.map((c) => c.id);
          const { error: deleteCustomersError } = await admin
            .from("customers")
            .delete()
            .in("id", customerIds);

          if (deleteCustomersError) {
            console.error(`Failed to delete customers for user ${userId}:`, deleteCustomersError);
          }
        }

        // Delete profile record
        const { error: deleteProfileError } = await admin
          .from("profiles")
          .delete()
          .eq("id", userId);

        if (deleteProfileError) {
          console.error(`Failed to delete profile ${userId}:`, deleteProfileError);
          failedUsers++;
          continue;
        }

        // Delete auth user
        const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
        if (deleteAuthError && !/not found|user not found/i.test(deleteAuthError.message)) {
          console.error(`Failed to delete auth user ${userId}:`, deleteAuthError);
          failedUsers++;
          continue;
        }

        deletedUsers++;
      } catch (err) {
        console.error(`Unexpected error deleting user ${userId}:`, err);
        failedUsers++;
      }
    }

    return json({
      success: true,
      deletedCount: deletedUsers,
      failedCount: failedUsers,
      totalRequested: validIds.length,
    });
  } catch (error: any) {
    console.error("Bulk delete users error:", error);
    return json({ error: error?.message || "Bulk delete failed" }, 500);
  }
});

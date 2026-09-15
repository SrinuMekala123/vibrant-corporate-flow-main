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

  const { customers } = body as { customers?: Array<Record<string, any>> };
  if (!Array.isArray(customers) || customers.length === 0) {
    return json({ error: "customers must be a non-empty array" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  const results = {
    total: customers.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ row: number; email?: string; error: string }>,
  };

  for (let i = 0; i < customers.length; i++) {
    const row = customers[i];
    const rowNum = i + 1;

    try {
      const fullName = String(row.full_name || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      const phone = String(row.phone || "").trim().replace(/[\s-]/g, "");
      const rawPassword = String(row.password || "").trim();
      const customerType = String(row.customer_type || "").trim() || "Retail";
      const address = String(row.address || "").trim();

      if (!fullName || !email) {
        results.failed++;
        results.errors.push({ row: rowNum, email, error: "Missing full_name or email" });
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.failed++;
        results.errors.push({ row: rowNum, email, error: "Invalid email format" });
        continue;
      }

      const phoneRegex = /^[6-9]\d{9}$/;
      if (phone && !phoneRegex.test(phone.replace(/\D/g, ""))) {
        results.failed++;
        results.errors.push({ row: rowNum, email, error: "Invalid phone number" });
        continue;
      }

      const password = rawPassword.length >= 8 ? rawPassword : "Welcome@123!";

      // Resolve branch name to branch_id UUID
      let resolvedBranchId: string | null = null;
      const branchName = (row.branch || row.branch_id || "").trim();
      if (branchName) {
        const { data: branchData } = await admin
          .from("branches")
          .select("id")
          .ilike("branch_name", branchName)
          .maybeSingle();

        if (branchData?.id) {
          resolvedBranchId = branchData.id;
        } else {
          console.warn(`Branch not found for name: "${branchName}". Setting branch_id to NULL.`);
        }
      }

      // Check if profile already exists
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      let authUserId: string;

      if (existingProfile?.id) {
        authUserId = existingProfile.id;
      } else {
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "customer" },
        });

        if (createError) {
          console.warn(`Auth creation warning for ${email}:`, createError.message);
        }

        if (!newUser?.id) {
          const { data: maybeUser } = await admin.auth.admin.getUserByEmail(email);
          if (maybeUser?.user?.id) {
            authUserId = maybeUser.user.id;
          } else {
            results.failed++;
            results.errors.push({ row: rowNum, email, error: createError?.message || "Failed to create auth user" });
            continue;
          }
        } else {
          authUserId = newUser.id;
        }
      }

      const { error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            id: authUserId,
            email,
            full_name: fullName,
            phone: phone || null,
            role: "customer",
            customer_type: customerType,
            branch_id: resolvedBranchId,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        results.failed++;
        results.errors.push({ row: rowNum, email, error: profileError.message });
        continue;
      }

      const { error: customerError } = await admin
        .from("customers")
        .upsert(
          {
            user_id: authUserId,
            full_name: fullName,
            email,
            phone: phone || null,
            customer_type: customerType,
            branch_id: resolvedBranchId,
            address: address || null,
          },
          { onConflict: "user_id" }
        );

      if (customerError) {
        results.failed++;
        results.errors.push({ row: rowNum, email, error: customerError.message });
        continue;
      }

      results.success++;
    } catch (err: any) {
      results.failed++;
      results.errors.push({ row: rowNum, email: row.email, error: err.message || "Unexpected error" });
    }
  }

  return json(results);
});

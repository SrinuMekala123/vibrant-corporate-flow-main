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
    const { rows, role } = await req.json();
    if (!Array.isArray(rows) || !rows.length) return json({ error: "No rows provided for import" }, 400);
    if (!["technician", "supervisor"].includes(role)) return json({ error: "Role must be technician or supervisor" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Import service is not configured" }, 500);
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const results = { success: 0, failed: 0, errors: [], created: [] };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      let createdUserId = null;
      try {
        const fullName = String(row.full_name || row["Full Name"] || "").trim();
        const email = String(row.email || row["Email Address"] || "").trim().toLowerCase();
        const phone = String(row.phone || row["Phone Number"] || "").trim();
        const branchValue = String(row.branch_id || row.branch || "").trim();
        let branchId = null;
        if (branchValue) {
          const { data: branch, error: branchError } = await admin
            .from("branches")
            .select("id, branch_name")
            .ilike("branch_name", branchValue)
            .maybeSingle();
          if (branchError) {
            console.error(`Row ${index + 1} branch lookup failed`, {
              branchValue,
              code: branchError.code,
              details: branchError.details,
              hint: branchError.hint,
              message: branchError.message,
            });
            throw new Error(`Branch lookup failed for '${branchValue}': ${branchError.message}`);
          }
          let resolvedBranch = branch;
          if (!resolvedBranch) {
            const { data: branchRows, error: fallbackError } = await admin
              .from("branches")
              .select("id, branch_name");
            if (fallbackError) {
              console.error(`Row ${index + 1} branch fallback lookup failed`, {
                branchValue, code: fallbackError.code, details: fallbackError.details,
                hint: fallbackError.hint, message: fallbackError.message,
              });
              throw new Error(`Branch lookup failed for '${branchValue}': ${fallbackError.message}`);
            }
            resolvedBranch = branchRows?.find((item) => item.branch_name?.trim().toLowerCase() === branchValue.toLowerCase());
          }
          if (!resolvedBranch) throw new Error(`Branch '${branchValue}' not found`);
          branchId = resolvedBranch.id;
        }
        const suppliedPassword = String(row.password || "").trim();
        const defaultPassword = role === "supervisor" ? "SupPass123!" : "TechPass123!";
        const password = suppliedPassword.length >= 8 ? suppliedPassword : defaultPassword;
        if (suppliedPassword.length < 8) {
          console.warn(`Row ${index + 1}: password is missing or too short; using the ${role} default password`);
        }
        const expertiseValue = String(row.expertise || row["Field of Work"] || "").trim();
        const expertise = expertiseValue
          ? expertiseValue.split(",").map((item) => item.trim()).filter(Boolean).join(", ")
          : null;
        if (!fullName || !email) throw new Error("Missing required full_name or email");
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email address");
        if (password.length < 8) throw new Error("Password must be at least 8 characters");

        const { data: existingProfile, error: profileError } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
        if (profileError) {
          console.error(`Row ${index + 1} profile duplicate check failed`, {
            email, code: profileError.code, details: profileError.details,
            hint: profileError.hint, message: profileError.message,
          });
          throw new Error(`Profile lookup failed: ${profileError.message}`);
        }
        if (existingProfile) throw new Error(`Email already exists: ${email}`);
        const { data: authUsers, error: authLookupError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (authLookupError) {
          console.error(`Row ${index + 1} Auth duplicate check failed`, {
            email, code: authLookupError.code, details: authLookupError.details,
            hint: authLookupError.hint, message: authLookupError.message,
          });
          throw new Error(`Auth lookup failed: ${authLookupError.message}`);
        }
        if (authUsers.users.some((user) => user.email?.toLowerCase() === email)) throw new Error(`Email already exists: ${email}`);

        const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role, phone, expertise } });
        if (authError || !authData.user) {
          console.error(`Row ${index + 1} Auth creation failed`, {
            email, code: authError?.code, status: authError?.status,
            name: authError?.name, message: authError?.message,
          });
          throw new Error(authError?.message || "Failed to create Auth user");
        }
        createdUserId = authData.user.id;
        // Auth's database trigger may already have created this profile. Upsert
        // by the Auth ID so the trigger row is enriched instead of duplicated.
        const { error: insertError } = await admin.from("profiles").upsert({ id: createdUserId, email, full_name: fullName, role, phone: phone || null, branch_id: branchId, expertise, avatar_url: fullName.charAt(0).toUpperCase() }, { onConflict: "id" });
        if (insertError) {
          console.error(`Row ${index + 1} profile insert failed`, {
            email, fullName, role, branchId, expertise,
            code: insertError.code, details: insertError.details,
            hint: insertError.hint, message: insertError.message,
          });
          throw new Error(`Profile insert failed: ${insertError.message}`);
        }
        results.success += 1;
        results.created.push({ row: index + 1, userId: createdUserId, email });
      } catch (error) {
        console.error(`Row ${index + 1} failed`, {
          message: error?.message,
          stack: error?.stack,
          row: { full_name: row.full_name || row["Full Name"], email: row.email || row["Email Address"], branch: row.branch_id || row.branch },
        });
        if (createdUserId) {
          const { error: cleanupError } = await admin.auth.admin.deleteUser(createdUserId);
          if (cleanupError) console.error(`Row ${index + 1} Auth cleanup failed`, cleanupError);
        }
        results.failed += 1;
        results.errors.push(`Row ${index + 1}: ${error?.message || "Unknown error"}`);
      }
    }
    return json({ success: true, results });
  } catch (error) {
    console.error("Bulk import staff error:", error);
    return json({ error: error?.message || "Bulk import failed" }, 500);
  }
});

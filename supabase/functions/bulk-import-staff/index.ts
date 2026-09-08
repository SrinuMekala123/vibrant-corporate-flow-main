// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { rows, role } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("No rows provided for import");
    }

    if (role !== "technician" && role !== "supervisor") {
      throw new Error("Invalid role. Must be 'technician' or 'supervisor'");
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

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const BATCH_SIZE = 5;
    const DELAY_MS = 500;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          const fullName = String(row.full_name || row["Full Name"] || "").trim();
          const email = String(row.email || row["Email Address"] || "").trim().toLowerCase();
          const phone = String(row.phone || row["Phone Number"] || "").trim();
          const branch = String(row.branch || "").trim();
          const password = String(row.password || "").trim();
          const expertiseRaw = row.expertise || row["Field of Work"] || "";
          const expertiseList = String(expertiseRaw)
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean);

          if (!fullName || !email) {
            results.failed += 1;
            results.errors.push(`Row ${i + 1}: Missing full_name or email`);
            continue;
          }

          const finalPassword = password || "Welcome@123";

          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: finalPassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              role,
              phone: phone || undefined,
              expertise: expertiseList.length > 0 ? expertiseList.join(", ") : undefined,
            },
          });

          if (authError) {
            const message = authError.message.toLowerCase();
            if (message.includes("already") || message.includes("duplicate") || message.includes("exists")) {
              results.failed += 1;
              results.errors.push(`Row ${i + 1}: Email already exists - ${email}`);
              continue;
            }
            throw authError;
          }

          if (!authData.user) {
            results.failed += 1;
            results.errors.push(`Row ${i + 1}: Failed to create auth user for ${email}`);
            continue;
          }

          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert({
              id: authData.user.id,
              email,
              full_name: fullName,
              role,
              phone: phone || null,
              expertise: expertiseList.length > 0 ? expertiseList.join(", ") : null,
              avatar_url: fullName.charAt(0).toUpperCase(),
            });

          if (profileError) throw profileError;

          results.success += 1;
        } catch (err: any) {
          results.failed += 1;
          results.errors.push(`Row ${i + 1}: ${err.message || "Unknown error"}`);
        }
      }

      if (i + BATCH_SIZE < rows.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Bulk import staff error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Bulk import failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

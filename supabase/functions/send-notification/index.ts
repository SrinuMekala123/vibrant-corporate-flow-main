// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { email, subject, message, ticketId } = await req.json();

    if (!email || !subject || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: email, subject, message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY environment variable is not set. Simulating notification.");
      return new Response(
        JSON.stringify({ 
          success: false, 
          simulated: true, 
          warning: "RESEND_API_KEY is not configured in Supabase Secrets. Email notification was skipped." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Support sending to multiple emails if an array is passed
    const toEmails = Array.isArray(email) ? email : [email];

    console.log(`Attempting to send email. To: ${JSON.stringify(toEmails)} | Subject: ${subject}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Brihaspathi Support <onboarding@resend.dev>",
        to: toEmails,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
            <h2 style="color: #4f46e5; margin-top: 0;">🔧 Brihaspathi Field Service</h2>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p><strong>Subject:</strong> ${subject}</p>
            ${ticketId ? `<p><strong>Ticket ID:</strong> #${ticketId.slice(0, 8)}</p>` : ''}
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border-left: 4px solid #4f46e5; white-space: pre-wrap; font-size: 14px; line-height: 1.5; color: #374151;">${message}</div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
              This is an automated notification from Brihaspathi Field Service Management. Please do not reply directly to this email.
            </p>
          </div>
        `,
      }),
    });

    console.log(`Resend HTTP Response status: ${res.status}`);
    let data;
    try {
      data = await res.json();
      console.log("Resend Response Data:", JSON.stringify(data));
    } catch (e) {
      const rawText = await res.text();
      console.error("Failed to parse Resend response as JSON. Raw text:", rawText);
      return new Response(
        JSON.stringify({ success: false, error: `Resend returned non-JSON response (status ${res.status}): ${rawText}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      console.error("Resend API rejected request. Error payload:", data);
      const errMsg = data.message || (data.error && data.error.message) || `Resend API Error (HTTP ${res.status})`;
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error: any) {
    console.error("Failed to send notification:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
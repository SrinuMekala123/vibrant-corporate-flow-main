// // supabase/functions/send-notification/index.ts
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// serve(async (req: Request): Promise<Response> => {
//   // Handle CORS preflight
//   if (req.method === "OPTIONS") {
//     return new Response("ok", { headers: corsHeaders });
//   }

//   try {
//     const { email, subject, message, ticketId } = await req.json();

//     if (!email || !subject || !message) {
//       throw new Error("Missing required fields: email, subject, message");
//     }

//     // 🔥 TESTING MODE: Use default sender (works with verified emails only)
//     const senderEmail = "Brihaspathi Support <onboarding@resend.dev>";

//     // 🚀 PRODUCTION MODE: Uncomment this once domain is verified
//     // const senderEmail = "Brihaspathi Support <notifications@pathi.resend.dev>";

//     const res = await fetch("https://api.resend.com/emails", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${RESEND_API_KEY}`,
//       },
//       body: JSON.stringify({
//         from: senderEmail,
//         to: [email],
//         subject: subject,
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <h2 style="color: #4f46e5;">🔧 Brihaspathi Field Service</h2>
//             <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
//             <p><strong>Subject:</strong> ${subject}</p>
//             <p><strong>Ticket ID:</strong> ${ticketId || "N/A"}</p>
//             <p style="background: #f9fafb; padding: 12px; border-radius: 6px; white-space: pre-line;">${message}</p>
//             <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
//             <p style="color: #6b7280; font-size: 12px;">
//               This is an automated notification from Brihaspathi Field Service Management.
//             </p>
//           </div>
//         `,
//       }),
//     });

//     const data = await res.json();

//     if (res.ok) {
//       return new Response(JSON.stringify({ success: true, data }), {
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//         status: 200,
//       });
//     } else {
//       throw new Error(data.message || "Failed to send email");
//     }
//   } catch (error: any) {
//     console.error("Email error:", error);
//     return new Response(JSON.stringify({ error: error.message }), {
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//       status: 400,
//     });
//   }
// });

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
      throw new Error("Missing required fields: email, subject, message");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
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
      throw new Error(`Resend returned non-JSON response (status ${res.status}): ${rawText}`);
    }

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      console.error("Resend API rejected request. Error payload:", data);
      const errMsg = data.message || (data.error && data.error.message) || `Resend API Error (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
  } catch (error: any) {
    console.error("Failed to send notification:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
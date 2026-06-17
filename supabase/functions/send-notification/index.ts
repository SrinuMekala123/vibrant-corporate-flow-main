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
      throw new Error("RESEND_API_KEY is not set");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Brihaspathi Support <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">🔧 Brihaspathi Field Service</h2>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p><strong>Subject:</strong> ${subject}</p>
            ${ticketId ? `<p><strong>Ticket ID:</strong> ${ticketId}</p>` : ''}
            <p style="background: #f9fafb; padding: 12px; border-radius: 6px;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              This is an automated notification from Brihaspathi Field Service Management.
            </p>
          </div>
        `,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      throw new Error(data.message || "Failed to send email");
    }
  } catch (error) {
    console.error("Email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
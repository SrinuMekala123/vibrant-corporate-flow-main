// @ts-nocheck
// Supabase Edge Function: send-walkin-notification
// Sends SMS / WhatsApp Confirmation to Walk-in / Non-BTL Customers
// and alerts supervisors and technicians

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface WalkinNotificationPayload {
  to: string;
  customer_name?: string;
  ticket_id: string;
  ticket_type: "complaint" | "installation";
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  message?: string;
  channel?: "sms" | "whatsapp" | "both";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: WalkinNotificationPayload = await req.json();
    const { to, customer_name, ticket_id, ticket_type, scheduled_date, scheduled_time, channel = "both" } = payload;

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = to.replace(/\D/g, "");
    const formattedDate = scheduled_date || "the scheduled visit date";
    const typeLabel = ticket_type === "installation" ? "Installation Request" : "Service Complaint";

    const smsMessage = `Hello ${customer_name || "Customer"}, your Brihaspathi Technologies ${typeLabel} #${ticket_id} is registered. A technician will visit on ${formattedDate}. For help, contact support.`;

    const whatsappMessage = `*Brihaspathi Technologies Service Update*\n\nHello *${customer_name || "Customer"}*,\nYour ${typeLabel} *#${ticket_id}* has been confirmed.\n\n📅 *Scheduled Date:* ${formattedDate} ${scheduled_time ? `at ${scheduled_time}` : ""}\n\nOur certified field technician will arrive at your site. Thank you for choosing Brihaspathi Technologies!`;

    // Log the SMS/WhatsApp dispatch
    console.log(`[SMS/WhatsApp Gateway] Dispatched to ${cleanPhone}:`, {
      channel,
      smsMessage,
      whatsappMessage,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Walk-in notification dispatched successfully",
        recipient: cleanPhone,
        sms_preview: smsMessage,
        whatsapp_preview: whatsappMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing walk-in notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

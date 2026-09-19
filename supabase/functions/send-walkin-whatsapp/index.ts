// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { 
      phone, 
      name, 
      ticketId, 
      date, 
      time, 
      technicianName, 
      message, 
      happiness_code,
      code,
      event_type = "registration" 
    } = payload;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required field: phone" }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get credentials from Supabase Vault (Secrets / Environment Variables)
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "+14155238886";

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio credentials missing in Supabase Secrets (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)");
      return new Response(
        JSON.stringify({ 
          success: false, 
          simulated: true, 
          warning: "Twilio credentials missing in Supabase Secrets (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)." 
        }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean and format WhatsApp phone number (default to +91 India if 10-digit number provided)
    const rawClean = phone.replace(/\D/g, "");
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith("+")) {
      if (rawClean.length === 10) {
        formattedPhone = `+91${rawClean}`;
      } else if (rawClean.length === 12 && rawClean.startsWith("91")) {
        formattedPhone = `+${rawClean}`;
      } else {
        formattedPhone = `+${rawClean}`;
      }
    }

    const cleanFrom = fromNumber.replace(/^whatsapp:/, "").trim();
    const customerName = name || "Valued Customer";
    const displayTicket = ticketId || "Service Request";
    const scheduledDateStr = date || "the scheduled date";
    const scheduledTimeStr = time ? ` at ${time}` : "";
    const assignedTechStr = technicianName || "our certified field technician";
    const hpCode = happiness_code || code || "XXXXX";

    // Build intelligent WhatsApp message template based on event type
    let messageBody = message;
    if (!messageBody) {
      switch (event_type) {
        case "registration":
          messageBody = `Dear Customer, your complaint ${displayTicket} for ${payload.title || "service request"} has been successfully registered. We will assign a technician shortly. - Brihaspathi Technologies`;
          break;
        case "assignment":
          messageBody = `Dear Customer, Technician ${assignedTechStr} has been assigned to your complaint ${displayTicket} and will visit on ${scheduledDateStr}. - Brihaspathi Technologies`;
          break;
        case "happiness_code":
          messageBody = `Dear Customer, your service for ${displayTicket} is completed. Your Happiness Code is: ${hpCode}. Please share this code with our Supervisor when they call for verification. - Brihaspathi Technologies`;
          break;
        case "closure":
          messageBody = `Dear Customer, your complaint ${displayTicket} is successfully closed. Thank you for choosing Brihaspathi Technologies!`;
          break;
        case "reassignment":
          messageBody = `Dear Customer, update on complaint ${displayTicket}: Technician ${assignedTechStr} has been reassigned to visit on ${scheduledDateStr}. - Brihaspathi Technologies`;
          break;
        default:
          messageBody = `Hello ${customerName}, your service request ${displayTicket} is registered with Brihaspathi Technologies. Thank you!`;
          break;
      }
    }

    console.log(`[WhatsApp ${event_type}] Sending to ${formattedPhone} from ${cleanFrom} for ticket ${displayTicket}`);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    };

    const body = new URLSearchParams({
      To: `whatsapp:${formattedPhone}`,
      From: `whatsapp:${cleanFrom}`,
      Body: messageBody,
    });

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio WhatsApp API Error:", data);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.message || "Failed to send WhatsApp message via Twilio",
          details: data 
        }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, messageId: data.sid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

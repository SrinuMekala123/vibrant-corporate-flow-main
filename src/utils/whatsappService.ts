import { supabase } from "@/lib/supabase";
import { whatsappLogService } from "@/services/whatsappLogService";

export interface SendWhatsAppOptions {
  name?: string;
  ticketId?: string;
  event_type?: string;
  technicianName?: string;
  date?: string;
  time?: string;
  happiness_code?: string;
  code?: string;
  title?: string;
  phone?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Sends a WhatsApp message via Supabase Edge Function with fallback to direct HTTP API.
 */
export const sendWhatsAppMessage = async (
  phoneNumber: string,
  message: string,
  extraData?: SendWhatsAppOptions
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  const logAttempt = async (result: { success: boolean; error?: string; messageId?: string }) => {
    try {
      const rawName = extraData?.name || extraData?.customerName || extraData?.recipientName;
      const safeRecipientName = typeof rawName === 'object' && rawName !== null
        ? (rawName.full_name || rawName.name || rawName.email || 'Customer')
        : (typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Customer');

      await whatsappLogService.createLog({
        ticket_id: extraData?.ticketId || extraData?.ticket_id || 'GENERAL',
        ticket_type: extraData?.ticketType || (extraData?.equipmentType ? 'installation' : 'complaint'),
        recipient_phone: phoneNumber || 'Unknown',
        recipient_name: safeRecipientName,
        message_type: extraData?.messageType || (message.toLowerCase().includes('happiness code') || message.toLowerCase().includes('otp') ? 'otp' : 'dispatch'),
        message_content: message,
        status: result.success ? 'sent' : 'failed',
        error_details: result.error
      });
    } catch (logErr) {
      console.warn('[WhatsAppService] Log error:', logErr);
    }
    return result;
  };

  try {
    if (!phoneNumber) {
      return await logAttempt({ success: false, error: "Phone number is missing." });
    }

    // Format phone number (remove non-digits)
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!cleanPhone) {
      return await logAttempt({ success: false, error: "Invalid phone number." });
    }

    const payload = {
      phone: cleanPhone,
      to: cleanPhone,
      message: message,
      ...extraData,
    };

    // 1. Try Supabase Edge Function invoke first
    try {
      const { data, error } = await supabase.functions.invoke("send-walkin-whatsapp", {
        body: payload,
      });

      if (!error && data?.success !== false) {
        return await logAttempt({ success: true, messageId: data?.messageId });
      }
      if (error) {
        console.warn("supabase.functions.invoke('send-walkin-whatsapp') returned error:", error);
      }
    } catch (invokeErr) {
      console.warn("Edge function invocation threw:", invokeErr);
    }

    // 2. Fallback to direct HTTP endpoint fetch
    try {
      const response = await fetch("https://supportapi.brihaspathi.in/functions/v1/send-walkin-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok && resData?.success !== false) {
        return await logAttempt({ success: true, messageId: resData?.messageId });
      }
      return await logAttempt({
        success: false,
        error: resData?.error || "Failed to send WhatsApp message via API",
      });
    } catch (fetchErr: any) {
      console.error("Direct WhatsApp fetch error:", fetchErr);
      return await logAttempt({ success: false, error: fetchErr?.message || "Network error sending WhatsApp" });
    }
  } catch (error: any) {
    console.error("sendWhatsAppMessage unexpected error:", error);
    return await logAttempt({ success: false, error: error?.message || "Unexpected error" });
  }
};

/**
 * Extracts the best recipient phone number from ticket/complaint/installation data
 */
export const getCustomerPhone = (ticket: any): string => {
  if (!ticket) return "";
  return (
    ticket.customer_phone ||
    ticket.non_btl_contact_number ||
    ticket.contact_number ||
    ticket.phone ||
    ticket.walk_in_phone ||
    ticket.profiles?.phone ||
    ticket.customer?.phone ||
    ""
  );
};

/**
 * Extracts the customer name from ticket/complaint/installation data
 */
export const getCustomerName = (ticket: any): string => {
  if (!ticket) return "Valued Customer";
  if (typeof ticket.customer_name === "string" && ticket.customer_name.trim()) {
    return ticket.customer_name.trim();
  }
  if (typeof ticket.non_btl_customer_name === "string" && ticket.non_btl_customer_name.trim()) {
    return ticket.non_btl_customer_name.trim();
  }
  if (ticket.customer) {
    if (typeof ticket.customer === "string" && ticket.customer.trim()) {
      return ticket.customer.trim();
    }
    if (typeof ticket.customer === "object") {
      const name = ticket.customer.full_name || ticket.customer.name || ticket.customer.email;
      if (name && typeof name === "string") return name.trim();
    }
  }
  if (typeof ticket.walk_in_name === "string" && ticket.walk_in_name.trim()) {
    return ticket.walk_in_name.trim();
  }
  if (ticket.profiles) {
    if (typeof ticket.profiles === "string" && ticket.profiles.trim()) {
      return ticket.profiles.trim();
    }
    if (typeof ticket.profiles === "object" && ticket.profiles.full_name) {
      return String(ticket.profiles.full_name).trim();
    }
  }
  if (ticket.customer_name && typeof ticket.customer_name === "object") {
    const name = ticket.customer_name.full_name || ticket.customer_name.name || ticket.customer_name.email;
    if (name) return String(name).trim();
  }
  return "Valued Customer";
};

// ==========================================
// COMPLAINT STAGE TEMPLATES
// ==========================================

// Stage 1: Complaint Creation
export const getComplaintCreatedMessage = (params: {
  customerName: string;
  ticketId: string;
}): string => {
  return `Dear ${params.customerName}, your complaint ${params.ticketId} has been successfully created. Our team will consult and update you within 24 hours. - Brihaspathi Technologies`;
};

// Stage 2: Remote Resolution
export const getRemoteResolutionMessage = (params: {
  customerName: string;
  ticketId: string;
  happinessCode: string;
}): string => {
  return `Dear ${params.customerName}, your complaint ${params.ticketId} has been successfully resolved remotely. Your Happiness Code is: ${params.happinessCode}. Please share this code if our admin calls for verification. - Brihaspathi Technologies`;
};

// Stage 3: Field Visit Scheduled
export const getFieldVisitScheduledMessage = (params: {
  customerName: string;
  technicianName: string;
  ticketId: string;
  scheduledDate: string;
  scheduledTime: string;
}): string => {
  return `Dear ${params.customerName}, Technician ${params.technicianName} has been assigned to your complaint ${params.ticketId}. The site visit is scheduled for ${params.scheduledDate} at ${params.scheduledTime}. - Brihaspathi Technologies`;
};

// Stage 4: Technician Sign-Off
export const getTechnicianSignOffMessage = (params: {
  customerName: string;
  ticketId: string;
  happinessCode: string;
}): string => {
  return `Dear ${params.customerName}, your complaint ${params.ticketId} has been successfully resolved on-site. Your Happiness Code is: ${params.happinessCode}. Please share this code with our Admin for final verification. - Brihaspathi Technologies`;
};

// Stage 5: Complaint Closed
export const getComplaintClosedMessage = (params: {
  customerName: string;
  ticketId: string;
}): string => {
  return `Dear ${params.customerName}, your complaint ${params.ticketId} has been successfully verified and closed. Thank you for choosing Brihaspathi Technologies! - Support`;
};

// ==========================================
// INSTALLATION STAGE TEMPLATES
// ==========================================

// Stage 1: Installation Created
export const getInstallationCreatedMessage = (params: {
  customerName: string;
  ticketId: string;
  equipmentType?: string;
}): string => {
  const equip = params.equipmentType || "Equipment Installation";
  return `Dear ${params.customerName}, your installation request ${params.ticketId} for ${equip} has been created. Our team will contact you shortly to schedule the visit. - Brihaspathi Technologies`;
};

// Stage 2: Technician Assigned & Scheduled
export const getInstallationScheduledMessage = (params: {
  customerName: string;
  technicianName: string;
  ticketId: string;
  scheduledDate: string;
  scheduledTime: string;
}): string => {
  return `Dear ${params.customerName}, Technician ${params.technicianName} has been assigned to your installation ${params.ticketId}. The visit is scheduled for ${params.scheduledDate} at ${params.scheduledTime}. - Brihaspathi Technologies`;
};

// Stage 3: Technician Sign-Off (Happiness Code)
export const getInstallationSignOffMessage = (params: {
  customerName: string;
  ticketId: string;
  happinessCode: string;
}): string => {
  return `Dear ${params.customerName}, your installation ${params.ticketId} has been completed on-site. Your Happiness Code is: ${params.happinessCode}. Please share this code with our Admin for final verification. - Brihaspathi Technologies`;
};

// Stage 4: Installation Closed
export const getInstallationClosedMessage = (params: {
  customerName: string;
  ticketId: string;
}): string => {
  return `Dear ${params.customerName}, your installation ${params.ticketId} has been successfully verified and closed. Thank you for choosing Brihaspathi Technologies! - Support`;
};

// ==========================================
// UNIFIED FULL TICKET SUMMARY GENERATOR
// ==========================================
export const getTicketFullSummaryMessage = (params: {
  ticketType?: "complaint" | "installation";
  ticketId: string;
  customerName: string;
  titleOrEquipment?: string;
  status?: string;
  phase?: number | string;
  technicianName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  happinessCode?: string;
  location?: string;
  notes?: string;
}): string => {
  const isInst = params.ticketType === "installation";
  const typeLabel = isInst ? "Installation Job" : "Service Complaint";
  const lines = [
    `*Brihaspathi Technologies - ${typeLabel} #${params.ticketId}*`,
    "",
    `📌 *${isInst ? "Equipment Scope" : "Issue"}:* ${params.titleOrEquipment || "Service Request"}`,
    `📋 *Status:* ${params.status || "In Progress"}${params.phase ? ` (Phase ${params.phase})` : ""}`,
    `👤 *Customer:* ${params.customerName || "Valued Customer"}`,
  ];

  if (params.location) {
    lines.push(`📍 *Location:* ${params.location}`);
  }
  if (params.technicianName && params.technicianName !== "Unassigned") {
    lines.push(`👨‍🔧 *Technician:* ${params.technicianName}`);
  }
  if (params.scheduledDate) {
    lines.push(`📅 *Scheduled Visit:* ${params.scheduledDate}${params.scheduledTime ? ` at ${params.scheduledTime}` : ""}`);
  }
  if (params.happinessCode) {
    lines.push(`🔑 *Happiness Code:* ${params.happinessCode}`);
  }
  if (params.notes) {
    lines.push(`📝 *Notes:* ${params.notes}`);
  }

  lines.push("");
  lines.push("For any queries or updates, please reply directly to this message.");
  lines.push("- Brihaspathi Technologies Support");

  return lines.join("\n");
};


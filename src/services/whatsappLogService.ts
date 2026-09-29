import { supabase } from "@/lib/supabase";

export interface WhatsAppLog {
  id: string;
  ticket_id: string;
  ticket_type: 'complaint' | 'installation' | 'general';
  recipient_phone: string;
  recipient_name: string;
  message_type: 'otp' | 'dispatch' | 'scheduled' | 'sign_off' | 'closure' | 'manual';
  message_content: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  error_details?: string;
  sent_at: string;
  resend_count: number;
}

const LOCAL_STORAGE_KEY = 'btl_whatsapp_logs_cache';

export const sanitizeLog = (item: any): WhatsAppLog => {
  if (!item || typeof item !== 'object') {
    return {
      id: `log_${Date.now()}`,
      ticket_id: 'GENERAL',
      ticket_type: 'complaint',
      recipient_phone: 'Unknown',
      recipient_name: 'Customer',
      message_type: 'dispatch',
      message_content: '',
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_count: 0
    };
  }

  let recipientName = 'Customer';
  if (typeof item.recipient_name === 'string' && item.recipient_name.trim()) {
    recipientName = item.recipient_name.trim();
  } else if (typeof item.recipient_name === 'object' && item.recipient_name !== null) {
    recipientName = item.recipient_name.full_name || item.recipient_name.name || item.recipient_name.email || 'Customer';
  }

  let recipientPhone = 'Unknown';
  if (typeof item.recipient_phone === 'string' && item.recipient_phone.trim()) {
    recipientPhone = item.recipient_phone.trim();
  } else if (typeof item.recipient_phone === 'object' && item.recipient_phone !== null) {
    recipientPhone = item.recipient_phone.phone || 'Unknown';
  }

  let ticketId = 'GENERAL';
  if (typeof item.ticket_id === 'string' && item.ticket_id.trim()) {
    ticketId = item.ticket_id.trim();
  } else if (typeof item.ticket_id === 'object' && item.ticket_id !== null) {
    ticketId = item.ticket_id.ticket_id || 'GENERAL';
  }

  let messageContent = '';
  if (typeof item.message_content === 'string') {
    messageContent = item.message_content;
  } else if (item.message_content !== undefined && item.message_content !== null) {
    messageContent = String(item.message_content);
  }

  let errorDetails = undefined;
  if (typeof item.error_details === 'string') {
    errorDetails = item.error_details;
  } else if (item.error_details !== undefined && item.error_details !== null) {
    errorDetails = typeof item.error_details === 'object' ? JSON.stringify(item.error_details) : String(item.error_details);
  }

  return {
    id: String(item.id || `log_${Date.now()}`),
    ticket_id: ticketId,
    ticket_type: (item.ticket_type === 'installation' || item.ticket_type === 'general') ? item.ticket_type : 'complaint',
    recipient_phone: recipientPhone,
    recipient_name: recipientName,
    message_type: item.message_type || 'dispatch',
    message_content: messageContent,
    status: item.status || 'sent',
    error_details: errorDetails,
    sent_at: typeof item.sent_at === 'string' ? item.sent_at : new Date().toISOString(),
    resend_count: Number(item.resend_count) || 0
  };
};

// Helper to get local cached logs
const getLocalLogs = (): WhatsAppLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeLog);
  } catch {
    return [];
  }
};

// Helper to save local cached logs
const saveLocalLogs = (logs: WhatsAppLog[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch (e) {
    console.warn('[WhatsAppLogService] LocalStorage quota exceeded or error:', e);
  }
};

// Event emitter for reactive UI updates
type LogListener = (log: WhatsAppLog) => void;
const listeners: Set<LogListener> = new Set();

export const whatsappLogService = {
  subscribe(listener: LogListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  notifyListeners(log: WhatsAppLog) {
    listeners.forEach((fn) => {
      try {
        fn(log);
      } catch (err) {
        console.error('[WhatsAppLogService] Listener error:', err);
      }
    });
  },

  /**
   * Log every outgoing WhatsApp attempt (Success or Failure)
   */
  async createLog(params: {
    ticket_id?: string;
    ticket_type?: 'complaint' | 'installation' | 'general';
    recipient_phone: string;
    recipient_name?: string;
    message_type?: 'otp' | 'dispatch' | 'scheduled' | 'sign_off' | 'closure' | 'manual';
    message_content: string;
    status: 'sent' | 'delivered' | 'failed' | 'pending';
    error_details?: string;
  }): Promise<WhatsAppLog> {
    const newLog: WhatsAppLog = sanitizeLog({
      id: crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      ticket_id: params.ticket_id || 'GENERAL',
      ticket_type: params.ticket_type || 'complaint',
      recipient_phone: params.recipient_phone,
      recipient_name: params.recipient_name,
      message_type: params.message_type || (params.message_content.toLowerCase().includes('code') || params.message_content.toLowerCase().includes('otp') ? 'otp' : 'dispatch'),
      message_content: params.message_content,
      status: params.status,
      error_details: params.error_details,
      sent_at: new Date().toISOString(),
      resend_count: 0
    });

    // 1. Save to local cache first for instant UI responsiveness
    const currentLocal = getLocalLogs();
    const updatedLocal = [newLog, ...currentLocal.filter(l => l.id !== newLog.id)];
    saveLocalLogs(updatedLocal);
    this.notifyListeners(newLog);

    // 2. Persist to Supabase whatsapp_logs table asynchronously
    try {
      const { error } = await supabase.from('whatsapp_logs').insert({
        id: newLog.id,
        ticket_id: newLog.ticket_id,
        ticket_type: newLog.ticket_type,
        recipient_phone: newLog.recipient_phone,
        recipient_name: newLog.recipient_name,
        message_type: newLog.message_type,
        message_content: newLog.message_content,
        status: newLog.status,
        error_details: newLog.error_details,
        sent_at: newLog.sent_at,
        resend_count: newLog.resend_count
      });

      if (error) {
        console.warn('[WhatsAppLogService] Supabase insert warning (falling back to local cache):', error.message);
      }
    } catch (dbErr) {
      console.warn('[WhatsAppLogService] Supabase connection error:', dbErr);
    }

    return newLog;
  },

  /**
   * Fetch all logs with optional filtering
   */
  async getLogs(filter?: {
    ticketId?: string;
    status?: string;
    messageType?: string;
    limit?: number;
  }): Promise<WhatsAppLog[]> {
    const limit = filter?.limit || 50;

    // Try fetching from Supabase
    try {
      let query = supabase
        .from('whatsapp_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (filter?.ticketId) {
        query = query.eq('ticket_id', filter.ticketId);
      }
      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.messageType) {
        query = query.eq('message_type', filter.messageType);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(sanitizeLog);
      }
    } catch (e) {
      console.warn('[WhatsAppLogService] Error fetching from Supabase, returning local cache:', e);
    }

    // Fallback to local storage
    let logs = getLocalLogs();
    if (filter?.ticketId) {
      logs = logs.filter(l => l.ticket_id.toLowerCase() === filter.ticketId?.toLowerCase());
    }
    if (filter?.status) {
      logs = logs.filter(l => l.status === filter.status);
    }
    if (filter?.messageType) {
      logs = logs.filter(l => l.message_type === filter.messageType);
    }
    return logs.slice(0, limit);
  },

  /**
   * Get the most recent OTP log for a specific ticket
   */
  async getLatestOtpLog(ticketId: string): Promise<WhatsAppLog | null> {
    const logs = await this.getLogs({ ticketId, limit: 10 });
    const otpLogs = logs.filter(l => l.message_type === 'otp' || l.message_content.toLowerCase().includes('code'));
    return otpLogs.length > 0 ? otpLogs[0] : null;
  },

  /**
   * Resend a WhatsApp message and update log
   */
  async resendLog(logId: string, sendFn: (phone: string, msg: string, extra?: any) => Promise<{ success: boolean; error?: string }>): Promise<{ success: boolean; error?: string }> {
    const logs = getLocalLogs();
    const existingLog = logs.find(l => l.id === logId);
    if (!existingLog) {
      return { success: false, error: 'Log entry not found' };
    }

    const res = await sendFn(existingLog.recipient_phone, existingLog.message_content, {
      ticketId: existingLog.ticket_id,
      ticketType: existingLog.ticket_type,
      recipientName: existingLog.recipient_name,
      isResend: true
    });

    const updatedLog: WhatsAppLog = {
      ...existingLog,
      status: res.success ? 'sent' : 'failed',
      error_details: res.error || (res.success ? undefined : 'Resend failed'),
      sent_at: new Date().toISOString(),
      resend_count: (existingLog.resend_count || 0) + 1
    };

    // Update local cache
    const updatedList = logs.map(l => l.id === logId ? updatedLog : l);
    saveLocalLogs(updatedList);
    this.notifyListeners(updatedLog);

    // Update Supabase
    try {
      await supabase
        .from('whatsapp_logs')
        .update({
          status: updatedLog.status,
          error_details: updatedLog.error_details,
          sent_at: updatedLog.sent_at,
          resend_count: updatedLog.resend_count
        })
        .eq('id', logId);
    } catch (err) {
      console.warn('[WhatsAppLogService] Supabase update error:', err);
    }

    return res;
  }
};

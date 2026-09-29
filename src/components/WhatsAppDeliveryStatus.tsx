import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Send, History } from 'lucide-react';
import { whatsappLogService, type WhatsAppLog } from '@/services/whatsappLogService';
import { sendWhatsAppMessage } from '@/utils/whatsappService';
import { toast } from 'sonner';
import { WhatsAppLogModal } from '@/components/WhatsAppLogModal';

interface WhatsAppDeliveryStatusProps {
  ticketId: string;
  ticketType?: 'complaint' | 'installation';
  recipientPhone?: string;
  recipientName?: string;
  happinessCode?: string;
  className?: string;
  onResendSuccess?: () => void;
}

export const WhatsAppDeliveryStatus: React.FC<WhatsAppDeliveryStatusProps> = ({
  ticketId,
  ticketType = 'complaint',
  recipientPhone,
  recipientName,
  happinessCode,
  className = '',
  onResendSuccess,
}) => {
  const [latestLog, setLatestLog] = useState<WhatsAppLog | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchLog = async () => {
    if (!ticketId) return;
    const log = await whatsappLogService.getLatestOtpLog(ticketId);
    setLatestLog(log);
  };

  useEffect(() => {
    fetchLog();
    const unsubscribe = whatsappLogService.subscribe((updatedLog) => {
      if (updatedLog.ticket_id?.toLowerCase() === ticketId?.toLowerCase()) {
        setLatestLog(updatedLog);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [ticketId]);

  const handleResend = async () => {
    const phoneToUse = recipientPhone || latestLog?.recipient_phone;
    if (!phoneToUse) {
      toast.error('Cannot resend: Customer phone number is missing.');
      return;
    }

    setIsResending(true);
    try {
      const codeToUse = happinessCode || (latestLog?.message_content.match(/\b\d{4,6}\b/) ? latestLog.message_content.match(/\b\d{4,6}\b/)![0] : '12345');
      const message = `Dear ${recipientName || 'Valued Customer'}, your Happiness Code for ticket ${ticketId} is: ${codeToUse}. Please share this code with the technician to verify job completion. - Brihaspathi Technologies`;

      const result = await sendWhatsAppMessage(phoneToUse, message, {
        ticketId,
        ticketType,
        customerName: recipientName,
        messageType: 'otp',
        happiness_code: codeToUse,
        isResend: true,
      });

      if (result.success) {
        toast.success(`✅ Happiness Code re-sent via WhatsApp to ${phoneToUse}!`);
        await fetchLog();
        if (onResendSuccess) onResendSuccess();
      } else {
        toast.error(`⚠️ Resend failed: ${result.error || 'Check customer phone number.'}`);
        await fetchLog();
      }
    } catch (err: any) {
      toast.error(`Failed to dispatch WhatsApp: ${err.message || 'Error'}`);
    } finally {
      setIsResending(false);
    }
  };

  const isFailed = latestLog?.status === 'failed';
  const isSent = latestLog?.status === 'sent' || latestLog?.status === 'delivered';

  return (
    <>
      <div className={`rounded-xl border p-3 text-xs transition-all ${
        isFailed
          ? 'bg-rose-50/80 border-rose-200 text-rose-800'
          : isSent
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      } ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 min-w-0">
            {isFailed ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
            ) : isSent ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Send className="w-4 h-4 text-slate-500 shrink-0" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold">
                  {isFailed ? 'WhatsApp Delivery Failed' : isSent ? 'WhatsApp OTP Dispatched' : 'WhatsApp Delivery Status'}
                </span>
                {latestLog && (
                  <span className="text-[10px] opacity-75">
                    {new Date(latestLog.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {latestLog && latestLog.resend_count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Resent {latestLog.resend_count}x
                  </span>
                )}
              </div>

              <p className="text-[11px] truncate opacity-90">
                {isFailed
                  ? latestLog?.error_details || 'Message delivery failed. Customer did not receive code.'
                  : isSent
                  ? `Delivered to ${latestLog?.recipient_phone || recipientPhone || 'customer'}`
                  : `Waiting for dispatch to ${recipientPhone || 'customer'}`}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-all active:scale-95 ${
                isFailed
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
              {isResending ? 'Sending...' : 'Resend OTP'}
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-colors"
              title="View WhatsApp Audit Logs"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Full Audit Log Modal */}
      <WhatsAppLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialTicketId={ticketId}
      />
    </>
  );
};

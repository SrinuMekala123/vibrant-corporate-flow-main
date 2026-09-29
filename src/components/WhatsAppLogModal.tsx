import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Phone,
  Filter,
  XCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { whatsappLogService, type WhatsAppLog } from '@/services/whatsappLogService';
import { sendWhatsAppMessage } from '@/utils/whatsappService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface WhatsAppLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTicketId?: string;
}

export const WhatsAppLogModal: React.FC<WhatsAppLogModalProps> = ({
  isOpen,
  onClose,
  initialTicketId,
}) => {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [search, setSearch] = useState(initialTicketId || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'failed' | 'sent'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await whatsappLogService.getLogs({ limit: 100 });
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTicketId) setSearch(initialTicketId);
      fetchLogs();
    }
  }, [isOpen, initialTicketId]);

  const getSafeText = (val: any, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.full_name || val.name || val.email || fallback;
    return String(val);
  };

  const filteredLogs = logs.map((log) => ({
    ...log,
    recipient_name: getSafeText(log.recipient_name, 'Customer'),
    recipient_phone: getSafeText(log.recipient_phone, 'Unknown'),
    ticket_id: getSafeText(log.ticket_id, 'GENERAL'),
    message_content: typeof log.message_content === 'object' ? JSON.stringify(log.message_content) : String(log.message_content || ''),
    error_details: typeof log.error_details === 'object' ? JSON.stringify(log.error_details) : (log.error_details ? String(log.error_details) : undefined),
  })).filter((log) => {
    const rName = log.recipient_name;
    const rPhone = log.recipient_phone;
    const tId = log.ticket_id;
    const q = (search || '').toLowerCase();

    const matchesSearch =
      !search ||
      tId.toLowerCase().includes(q) ||
      rPhone.includes(search) ||
      rName.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'failed' && log.status === 'failed') ||
      (statusFilter === 'sent' && (log.status === 'sent' || log.status === 'delivered'));

    return matchesSearch && matchesStatus;
  });

  const totalLogs = filteredLogs.length;
  const failedLogs = filteredLogs.filter((l) => l.status === 'failed').length;
  const sentLogs = filteredLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const successRate = totalLogs > 0 ? Math.round((sentLogs / totalLogs) * 100) : 100;

  const handleResend = async (log: WhatsAppLog) => {
    setResendingId(log.id);
    try {
      const result = await whatsappLogService.resendLog(log.id, sendWhatsAppMessage);
      if (result.success) {
        toast.success(`✅ Resent successfully to ${getSafeText(log.recipient_phone)}`);
        await fetchLogs();
      } else {
        toast.error(`⚠️ Resend failed: ${result.error || 'Gateway error'}`);
        await fetchLogs();
      }
    } catch (err: any) {
      toast.error(`Resend error: ${err.message || 'Unknown error'}`);
    } finally {
      setResendingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  WhatsApp Delivery Audit Logs
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Live Audit
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Track delivery status, catch failed OTPs instantly, and resend with one click.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={isLoading}
              className="text-xs rounded-xl gap-1.5 h-8 border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2.5 mt-4">
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Total Dispatched</p>
              <p className="text-lg font-black text-slate-800 dark:text-white">{totalLogs}</p>
            </div>
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs">
              <p className="text-[10px] text-emerald-700 font-bold uppercase">Delivered / Sent</p>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{sentLogs}</p>
            </div>
            <div className="bg-rose-50/60 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-800/40 shadow-2xs">
              <p className="text-[10px] text-rose-700 font-bold uppercase">Failed Dispatches</p>
              <p className="text-lg font-black text-rose-700 dark:text-rose-400">{failedLogs}</p>
            </div>
            <div className="bg-cyan-50/60 dark:bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-200/60 dark:border-cyan-800/40 shadow-2xs">
              <p className="text-[10px] text-cyan-700 font-bold uppercase">Delivery Success Rate</p>
              <p className="text-lg font-black text-cyan-700 dark:text-cyan-400">{successRate}%</p>
            </div>
          </div>
        </DialogHeader>

        {/* Filter Controls */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Ticket ID (BTL-...), Customer Name, or Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0083a2]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All ({totalLogs})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'failed'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              Failed ({failedLogs})
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'sent'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              Sent ({sentLogs})
            </button>
          </div>
        </div>

        {/* Logs List Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No WhatsApp logs found</p>
              <p className="text-xs text-slate-400 mt-0.5">Logs appear automatically whenever any OTP or notification is sent.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isFailed = log.status === 'failed';
              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isFailed
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                          isFailed
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isFailed ? <AlertTriangle className="w-3 h-3 text-rose-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {isFailed ? 'FAILED' : 'DELIVERED'}
                      </span>

                      {/* Ticket Badge */}
                      <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md text-slate-800 dark:text-slate-200">
                        {log.ticket_id}
                      </span>

                      {/* Message Type */}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {log.message_type}
                      </span>

                      {/* Resend count */}
                      {log.resend_count > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Resent {log.resend_count}x
                        </span>
                      )}
                    </div>

                    {/* Timestamp & Actions */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.sent_at).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {/* Resend Button */}
                      <Button
                        size="sm"
                        variant={isFailed ? 'destructive' : 'outline'}
                        onClick={() => handleResend(log)}
                        disabled={resendingId === log.id}
                        className={`h-7 px-2.5 text-xs font-bold rounded-lg ${
                          isFailed ? 'bg-rose-600 hover:bg-rose-700' : 'border-slate-200'
                        }`}
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                        {resendingId === log.id ? 'Resending...' : isFailed ? 'Resend Failed' : 'Resend'}
                      </Button>
                    </div>
                  </div>

                  {/* Recipient Info */}
                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 mb-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{getSafeText(log.recipient_name, 'Customer')}</span>
                    <span className="flex items-center gap-1 font-mono text-slate-500">
                      <Phone className="w-3 h-3" />
                      {getSafeText(log.recipient_phone, 'Unknown')}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(log.recipient_phone)}
                        className="text-slate-400 hover:text-slate-600 ml-1"
                        title="Copy phone"
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  </div>

                  {/* Failure reason callout if failed */}
                  {isFailed && log.error_details && (
                    <div className="bg-rose-100/70 border border-rose-200 rounded-lg p-2 text-xs text-rose-800 mb-2 font-medium">
                      <strong>Delivery Error:</strong> {log.error_details}
                    </div>
                  )}

                  {/* Message Snippet */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 font-mono line-clamp-2">
                    {log.message_content}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

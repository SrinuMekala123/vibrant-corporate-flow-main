import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Flame,
  Target,
  Zap,
  Layers,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Sparkles,
  Phone,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { complaintService, formatComplaintTicketId } from '@/services/complaintService';
import { installationService, formatInstallationTicketId } from '@/services/installationService';
import { Button } from '@/components/ui/button';
import { WhatsAppLogModal } from '@/components/WhatsAppLogModal';

export default function PriorityMatrix() {
  const [ticketFilter, setTicketFilter] = useState<'all' | 'complaints' | 'installations'>('all');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Fetch Complaints
  const { data: complaints = [], isLoading: isLoadingComplaints, refetch: refetchComplaints } = useQuery({
    queryKey: ['priority-complaints'],
    queryFn: async () => {
      const data = await complaintService.getAll();
      return data.filter((c: any) => c.status !== 'closed' && c.status !== 'verified');
    },
  });

  // Fetch Installations
  const { data: installations = [], isLoading: isLoadingInstallations, refetch: refetchInstallations } = useQuery({
    queryKey: ['priority-installations'],
    queryFn: async () => {
      const data = await installationService.getAll();
      return data.filter((i: any) => i.status !== 'verified' && i.status !== 'closed');
    },
  });

  const handleRefresh = () => {
    refetchComplaints();
    refetchInstallations();
  };

  // Categorize live tickets into the 4 Eisenhower Quadrants
  const categorizedTickets = useMemo(() => {
    const q1: any[] = []; // Critical & Urgent (Do First)
    const q2: any[] = []; // High Impact, Low Urgency (Schedule & Plan)
    const q3: any[] = []; // Low Impact, High Urgency (Quick Wins / Delegate)
    const q4: any[] = []; // Low Impact, Low Urgency (Backlog & Monitor)

    const allItems: any[] = [];

    const resolveCustomerName = (item: any): string => {
      if (!item) return 'Customer';
      if (typeof item.customer_name === 'string' && item.customer_name.trim()) return item.customer_name.trim();
      if (item.customer_name && typeof item.customer_name === 'object') {
        return item.customer_name.full_name || item.customer_name.name || item.customer_name.email || 'Customer';
      }
      if (item.customer && typeof item.customer === 'object') {
        return item.customer.full_name || item.customer.name || item.customer.email || 'Customer';
      }
      if (typeof item.customer === 'string' && item.customer.trim()) return item.customer.trim();
      if (typeof item.non_btl_customer_name === 'string' && item.non_btl_customer_name.trim()) return item.non_btl_customer_name.trim();
      if (item.profiles && typeof item.profiles === 'object') {
        return item.profiles.full_name || item.profiles.email || 'Customer';
      }
      return 'Customer';
    };

    if (ticketFilter === 'all' || ticketFilter === 'complaints') {
      complaints.forEach((c: any) => {
        allItems.push({
          id: c.id,
          displayId: formatComplaintTicketId(c),
          type: 'complaint',
          title: c.title || c.description || 'Service Complaint',
          customerName: resolveCustomerName(c),
          customerPhone: c.customer_phone || c.contact_number || c.profiles?.phone || '',
          severity: (c.severity || c.priority || 'medium').toLowerCase(),
          status: c.status,
          date: c.created_at,
          isBTL: !c.is_non_btl,
          phase: c.phase || 1,
        });
      });
    }

    if (ticketFilter === 'all' || ticketFilter === 'installations') {
      installations.forEach((i: any) => {
        allItems.push({
          id: i.id,
          displayId: formatInstallationTicketId(i),
          type: 'installation',
          title: i.equipment_model || i.equipment_type || 'Installation Work Order',
          customerName: resolveCustomerName(i),
          customerPhone: (typeof i.customer === 'object' ? i.customer?.phone : '') || i.customer_phone || i.non_btl_contact_number || '',
          severity: (i.priority || 'medium').toLowerCase(),
          status: i.status,
          date: i.created_at,
          isBTL: true,
          phase: i.phase || 1,
        });
      });
    }

    allItems.forEach((item) => {
      const isUrgent = item.severity === 'critical' || item.severity === 'high';
      const isHighImpact = item.isBTL || item.type === 'installation' || item.severity === 'critical';

      if (isUrgent && isHighImpact) {
        q1.push(item);
      } else if (!isUrgent && isHighImpact) {
        q2.push(item);
      } else if (isUrgent && !isHighImpact) {
        q3.push(item);
      } else {
        q4.push(item);
      }
    });

    return { q1, q2, q3, q4, total: allItems.length };
  }, [complaints, installations, ticketFilter]);

  const isLoading = isLoadingComplaints || isLoadingInstallations;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Executive Operations Header Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-[#0083a2] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-cyan-200 text-xs font-bold border border-white/15">
              <Sparkles className="w-3.5 h-3.5" />
              Operational Dispatch Framework
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Field Operations Priority Matrix
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              Based on the <strong>Eisenhower Impact vs. Urgency Framework</strong>. Active complaints and installations are automatically classified so managers and lead technicians prioritize critical work orders, avoid SLA breaches, and accelerate job completions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={isLoading}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs h-10 px-3.5 rounded-xl gap-2 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              onClick={() => setIsLogModalOpen(true)}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs h-10 px-3.5 rounded-xl gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              WhatsApp Audit Logs
            </Button>
          </div>
        </div>
      </div>

      {/* Subheader & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[#0083a2]" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter Work Orders:</span>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => setTicketFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                ticketFilter === 'all'
                  ? 'bg-[#0083a2] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              All Active ({complaints.length + installations.length})
            </button>
            <button
              onClick={() => setTicketFilter('complaints')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                ticketFilter === 'complaints'
                  ? 'bg-[#0083a2] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Complaints ({complaints.length})
            </button>
            <button
              onClick={() => setTicketFilter('installations')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                ticketFilter === 'installations'
                  ? 'bg-[#0083a2] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Installations ({installations.length})
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          Showing <strong>{categorizedTickets.total}</strong> active operational jobs
        </div>
      </div>

      {/* 2x2 Operational Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Q1: Do First (Critical & Urgent) */}
        <div className="rounded-2xl border-2 border-rose-300/80 bg-rose-50/25 dark:bg-rose-950/10 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-rose-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-rose-950 dark:text-rose-200 flex items-center gap-2">
                  Quadrant 1: Critical & Urgent (Do First)
                  <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {categorizedTickets.q1.length}
                  </span>
                </h3>
                <p className="text-[11px] text-rose-700/80">High Impact • High Urgency (Immediate Dispatch & Escalation)</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {categorizedTickets.q1.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-500 opacity-60" />
                <p className="text-xs italic">No urgent critical work orders right now.</p>
              </div>
            ) : (
              categorizedTickets.q1.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} badgeColor="bg-rose-100 text-rose-800 border-rose-300" />
              ))
            )}
          </div>
        </div>

        {/* Q2: Schedule & Plan (High Impact, Low Urgency) */}
        <div className="rounded-2xl border-2 border-blue-300/80 bg-blue-50/25 dark:bg-blue-950/10 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-blue-950 dark:text-blue-200 flex items-center gap-2">
                  Quadrant 2: Strategic & Scheduled (Plan Ahead)
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {categorizedTickets.q2.length}
                  </span>
                </h3>
                <p className="text-[11px] text-blue-700/80">High Impact • Standard Timeline (Installations & Preventive AMC)</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {categorizedTickets.q2.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <p className="text-xs italic">No pending scheduled tasks.</p>
              </div>
            ) : (
              categorizedTickets.q2.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} badgeColor="bg-blue-100 text-blue-800 border-blue-300" />
              ))
            )}
          </div>
        </div>

        {/* Q3: Quick Wins (Low Impact, High Urgency) */}
        <div className="rounded-2xl border-2 border-amber-300/80 bg-amber-50/25 dark:bg-amber-950/10 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  Quadrant 3: Quick Wins & Fast Turnarounds
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {categorizedTickets.q3.length}
                  </span>
                </h3>
                <p className="text-[11px] text-amber-700/80">Low Impact • High Urgency (Walk-ins & Quick Sign-offs)</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {categorizedTickets.q3.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <p className="text-xs italic">No quick turnaround requests.</p>
              </div>
            ) : (
              categorizedTickets.q3.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} badgeColor="bg-amber-100 text-amber-800 border-amber-300" />
              ))
            )}
          </div>
        </div>

        {/* Q4: Backlog & Review (Low Impact, Low Urgency) */}
        <div className="rounded-2xl border-2 border-slate-300/80 bg-slate-50/40 dark:bg-slate-900/40 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  Quadrant 4: Backlog & Routine Review (Monitor)
                  <span className="bg-slate-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {categorizedTickets.q4.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-600/80">Low Impact • Low Urgency (General Inquiries & Routine Follow-ups)</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {categorizedTickets.q4.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <p className="text-xs italic">No backlog work orders.</p>
              </div>
            ) : (
              categorizedTickets.q4.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} badgeColor="bg-slate-100 text-slate-800 border-slate-300" />
              ))
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Logs Modal */}
      <WhatsAppLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}

// Subcomponent for each ticket card in the Matrix
function TicketCard({ ticket, badgeColor }: { ticket: any; badgeColor: string }) {
  const isInst = ticket.type === 'installation';
  const detailUrl = isInst ? `/installations/${ticket.id}` : `/complaints/${ticket.id}`;

  return (
    <Link
      to={detailUrl}
      className="block p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#0083a2] hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white group-hover:text-[#0083a2] transition-colors">
            {ticket.displayId}
          </span>
          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
            {ticket.severity}
          </span>
          {ticket.isBTL ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
              BTL Contract
            </span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Walk-in
            </span>
          )}
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {ticket.type}
          </span>
        </div>

        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0083a2] group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>

      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mb-1.5">
        {ticket.title}
      </p>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="truncate">👤 {typeof ticket.customerName === 'object' && ticket.customerName !== null ? (ticket.customerName.full_name || ticket.customerName.name || 'Customer') : String(ticket.customerName || 'Customer')}</span>
        <span className="capitalize font-medium shrink-0 ml-2">Phase {ticket.phase} • {ticket.status}</span>
      </div>
    </Link>
  );
}

// import { cn } from "@/lib/utils";
// import { TicketStatus, SeverityTier, statusColors, severityColors } from "@/data/mockData";

// export function StatusBadge({ status }: { status: TicketStatus }) {
//   return (
//     <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize", statusColors[status])}>
//       {status.replace("-", " ")}
//     </span>
//   );
// }

// export function SeverityBadge({ severity }: { severity: SeverityTier }) {
//   return (
//     <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize", severityColors[severity])}>
//       {severity}
//     </span>
//   );
// }


import { TicketStatus } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";

export function getEffectiveComplaintStatus(ticket: any): string {
  if (!ticket) return "unassigned";
  const rawStatus = (typeof ticket === "string" ? ticket : ticket.status || "").toLowerCase().trim();
  
  // 1. If ticket is in an active milestone stage, preserve that explicit operational state!
  if (
    rawStatus === "closed" || 
    rawStatus === "completed" || 
    rawStatus === "pending_verification" || 
    rawStatus === "resolution_submitted" || 
    rawStatus === "awaiting_verification" ||
    rawStatus === "in-progress" ||
    rawStatus === "in_progress" ||
    rawStatus === "pir_approved_work_in_progress" ||
    rawStatus === "pir_submitted_awaiting_approval" ||
    rawStatus === "pir_submitted" ||
    rawStatus === "pir_approved" ||
    rawStatus === "pir_rejected"
  ) {
    return rawStatus;
  }
  
  const hasTech = typeof ticket === "object" ? Boolean(
    ticket.assigned_technician ||
    ticket.assigned_to ||
    (Array.isArray(ticket.complaint_technicians) && ticket.complaint_technicians.length > 0)
  ) : false;

  // 2. If technician has started journey (en route), it is DISPATCHED (even on rework rounds)!
  if (
    (typeof ticket === "object" && Boolean(ticket.start_journey_timestamp) && hasTech) ||
    (rawStatus === "dispatched" && hasTech)
  ) {
    return "dispatched";
  }

  // 3. If ticket has rework / reassignment signals and has not advanced to dispatched/progress yet, it is "reassigned"
  if (
    rawStatus === "reassigned" ||
    rawStatus === "rework_required" ||
    (typeof ticket === "object" && (
      Boolean(ticket.reassignment_reason) ||
      Boolean(ticket.reassigned_at) ||
      (Array.isArray(ticket.rework_history) && ticket.rework_history.length > 0) ||
      (Array.isArray(ticket.feedback_history) && ticket.feedback_history.some((x: any) => x && (x.type === "rework_round" || x.round))) ||
      (Array.isArray(ticket.pir_decision_tree) && ticket.pir_decision_tree.some((x: any) => x && (x.type === "rework_round" || x.round))) ||
      (typeof ticket.supervisor_notes === "string" && (
        ticket.supervisor_notes.toLowerCase().includes("reassign") ||
        ticket.supervisor_notes.toLowerCase().includes("rework")
      )) ||
      (typeof ticket.resolution === "string" && ticket.resolution.toLowerCase().startsWith("rejected:"))
    ))
  ) {
    return "reassigned";
  }

  // 4. Check technician assignment strictly when ticket object is provided
  if (typeof ticket === "object") {
    // If technician is assigned (and journey hasn't started yet)
    if (hasTech) {
      return "assigned";
    }

    // IF NO TECHNICIAN IS ASSIGNED:
    // It can never be "assigned" or "dispatched"!
    // If supervisor is assigned or current_phase >= 2, status is "open" (Open / Under Review)
    if (ticket.assigned_supervisor || ticket.supervisor_assigned || Number(ticket.current_phase) >= 2) {
      return "open";
    }

    return "unassigned";
  }

  return rawStatus;
}

export interface StatusBadgeProps {
  status: string;
  ticket?: any;
}

export interface SeverityBadgeProps {
  severity: string;
}

export function StatusBadge({ status, ticket }: StatusBadgeProps) {
  let isCustomer = false;
  try {
    const auth = useAuth();
    isCustomer = auth?.isRole ? auth.isRole("customer") : false;
  } catch {
    // Outside AuthContext fallback
  }

  const effectiveKey = ticket ? getEffectiveComplaintStatus(ticket) : getEffectiveComplaintStatus(status);
  const isRework = typeof ticket === "object" && Boolean(
    ticket?.reassignment_reason ||
    ticket?.reassigned_at ||
    (Array.isArray(ticket?.rework_history) && ticket.rework_history.length > 0)
  ) && effectiveKey !== "closed";

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    unassigned: { bg: "bg-slate-100", text: "text-slate-700", label: "Unassigned" },
    open: { bg: "bg-blue-100", text: "text-blue-700", label: "Open / Under Review" },
    "open / under review": { bg: "bg-blue-100", text: "text-blue-700", label: "Open / Under Review" },
    "Open": { bg: "bg-blue-100", text: "text-blue-700", label: "Open / Under Review" },
    assigned: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Assigned" },
    dispatched: { bg: "bg-orange-100", text: "text-orange-700", label: "Dispatched" },
    "in-progress": { bg: "bg-yellow-100", text: "text-yellow-700", label: "In Progress" },
    in_progress: { bg: "bg-yellow-100", text: "text-yellow-700", label: "In Progress" },
    pir_submitted_awaiting_approval: { bg: "bg-purple-100", text: "text-purple-700", label: "Awaiting PIR Approval" },
    awaiting_pir_approval: { bg: "bg-amber-100", text: "text-amber-800", label: "Awaiting PIR Approval" },
    pir_submitted: { bg: "bg-amber-100", text: "text-amber-800", label: "Awaiting PIR Approval" },
    "Awaiting PIR Approval": { bg: "bg-amber-100", text: "text-amber-800", label: "Awaiting PIR Approval" },
    "Resolution & Sign-off": { bg: "bg-blue-100", text: "text-blue-800", label: "Resolution & Sign-off" },
    "Next Steps / Closure": { bg: "bg-purple-100", text: "text-purple-800", label: "Next Steps / Closure" },
    "PIR Rejected": { bg: "bg-rose-100", text: "text-rose-700", label: "PIR Rejected" },
    "PIR Revision Requested": { bg: "bg-amber-100", text: "text-amber-800", label: "PIR Revision Requested" },
    pir_rejected: { bg: "bg-amber-100", text: "text-amber-800", label: "Info Requested" },
    pir_approved_work_in_progress: { bg: "bg-blue-100", text: "text-blue-800", label: "Resolution & Sign-off" },
    resolution_pending: { bg: "bg-blue-100", text: "text-blue-800", label: "Resolution Pending" },
    rework_required: { bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300", label: isCustomer ? "In Progress" : "Reassigned" },
    reassigned: { bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300", label: isCustomer ? "In Progress" : "Reassigned" },
    "Reassigned": { bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300", label: isCustomer ? "In Progress" : "Reassigned" },
    completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
    resolved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Resolved" },
    pending_verification: { bg: "bg-cyan-100", text: "text-cyan-700", label: "Pending Verification" },
    closed: { bg: "bg-slate-200", text: "text-slate-800", label: "Closed" },
    cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
    awaiting_verification: { bg: "bg-purple-100", text: "text-purple-800", label: "Awaiting QA Verification" },
    resolution_submitted: { bg: "bg-purple-100", text: "text-purple-800", label: "Awaiting QA Verification" },
    pir_approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Resolution & Sign-off" },
    "Site Completed and Handed Over": { bg: "bg-emerald-100", text: "text-emerald-700", label: "Site Completed and Handed Over" },
    "Verified": { bg: "bg-sky-100", text: "text-sky-700", label: "Verified" },
    "In Progress": { bg: "bg-amber-100", text: "text-amber-700", label: "In Progress" },
    "Pending due to Material Shortage": { bg: "bg-rose-100", text: "text-rose-700", label: "Pending due to Material Shortage" },
    "Dispatched": { bg: "bg-orange-100", text: "text-orange-700", label: "Dispatched" },
  };

  const config = statusConfig[effectiveKey] || statusConfig[status] || { bg: "bg-slate-100", text: "text-slate-700", label: status };

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
      {!isCustomer && isRework && effectiveKey !== "reassigned" && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50">
          Rework
        </span>
      )}
    </span>
  );
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const severityConfig = {
    minor: { bg: "bg-blue-100", text: "text-blue-700", label: "Minor" },
    moderate: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Moderate" },
    major: { bg: "bg-red-100", text: "text-red-700", label: "Major" },
  };

  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.minor;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
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

interface StatusBadgeProps {
  status: string; // 🔥 Changed from TicketStatus to string
}

interface SeverityBadgeProps {
  severity: string; // 🔥 Changed from SeverityTier to string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    unassigned: { bg: "bg-slate-100", text: "text-slate-700", label: "Unassigned" },
    open: { bg: "bg-blue-100", text: "text-blue-700", label: "Open" },
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
    awaiting_signoff: { bg: "bg-blue-100", text: "text-blue-800", label: "Awaiting Sign-off" },
    rework_required: { bg: "bg-rose-100", text: "text-rose-700", label: "Rework Required" },
    completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
    resolved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Resolved" },
    pending_verification: { bg: "bg-cyan-100", text: "text-cyan-700", label: "Pending Verification" },
    closed: { bg: "bg-slate-200", text: "text-slate-800", label: "Closed" },
    Closed: { bg: "bg-slate-200", text: "text-slate-800", label: "Closed" },
    cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
    awaiting_verification: { bg: "bg-purple-100", text: "text-purple-800", label: "Awaiting QA Verification" },
    resolution_submitted: { bg: "bg-purple-100", text: "text-purple-800", label: "Awaiting QA Verification" },
    pir_approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Resolution & Sign-off" },
  };

  const config = statusConfig[status] || { bg: "bg-slate-100", text: "text-slate-700", label: status };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
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
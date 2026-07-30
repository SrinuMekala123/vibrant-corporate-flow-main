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



interface StatusBadgeProps {
  status: string; // 🔥 Changed from TicketStatus to string
}

interface SeverityBadgeProps {
  severity: string; // 🔥 Changed from SeverityTier to string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: "bg-gray-100", text: "text-gray-700", label: "Open" },
    assigned: { bg: "bg-blue-100", text: "text-blue-700", label: "Assigned" },
    in_progress: { bg: "bg-yellow-100", text: "text-yellow-700", label: "In Progress" },
    pir_pending: { bg: "bg-amber-100", text: "text-amber-700", label: "PIR Pending" },
    pir_approved: { bg: "bg-indigo-100", text: "text-indigo-700", label: "PIR Approved" },
    rework_required: { bg: "bg-red-100", text: "text-red-700", label: "Rework Required" },
    pending_verification: { bg: "bg-green-100", text: "text-green-700", label: "Pending Verification" },
    closed: { bg: "bg-gray-100", text: "text-gray-700", label: "Closed" },
    cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled" },
  };

  const config = statusConfig[status] || statusConfig.open;

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
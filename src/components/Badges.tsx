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
  const statusConfig = {
    unassigned: { bg: "bg-muted", text: "text-muted-foreground", label: "Unassigned" },
    assigned: { bg: "bg-blue-100", text: "text-blue-700", label: "Assigned" },
    dispatched: { bg: "bg-orange-100", text: "text-orange-700", label: "Dispatched" },
    "in-progress": { bg: "bg-yellow-100", text: "text-yellow-700", label: "In Progress" },
    completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
    closed: { bg: "bg-gray-100", text: "text-gray-700", label: "Closed" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unassigned;

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
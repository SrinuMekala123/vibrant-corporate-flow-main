export const INSTALLATION_STATUSES = [
  "Unassigned",
  "Assigned",
  "Dispatched",
  "In Progress",
  "Pending due to Material Shortage",
  "Site Completed and Handed Over",
  "Verified",
] as const;

export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

export const INSTALLATION_STATUS_DB_MAP: Record<string, InstallationStatus> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  dispatched: "Dispatched",
  "in_progress": "In Progress",
  "in progress": "In Progress",
  arrived: "In Progress",
  en_route: "Assigned",
  "en route": "Assigned",
  completed: "Site Completed and Handed Over",
  verified: "Verified",
  closed: "Verified",
  force_closed: "Verified",
  revision_requested: "In Progress",
  pending_material_shortage: "Pending due to Material Shortage",
  "work in progress": "In Progress",
  "configuration pending": "In Progress",
  "signature pending due to client unavailability": "In Progress",
  reassigned: "Assigned",
  followup_scheduled: "Assigned",
};

export const getInstallationStatusLabel = (status: string): InstallationStatus => {
  const normalized = status.toLowerCase().trim();
  return (
    INSTALLATION_STATUS_DB_MAP[normalized] ||
    (INSTALLATION_STATUSES.includes(status as InstallationStatus)
      ? (status as InstallationStatus)
      : "Assigned")
  );
};

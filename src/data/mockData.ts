export type TicketStatus = "unassigned" | "assigned" | "in-progress" | "dispatched" | "completed" | "closed";
export type SeverityTier = "minor" | "moderate" | "major";
export type Phase = 1 | 2 | 3 | 4 | 5 | 6;

export interface Ticket {
  id: string;
  title: string;
  customer: string;
  customerPhone: string;
  location: string;
  fieldOfWork: string;
  status: TicketStatus;
  severity: SeverityTier;
  currentPhase: Phase;
  assignedSupervisor: string;
  assignedTechnician: string | null;
  createdAt: string;
  updatedAt: string;
  description: string;
  resolution: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: "supervisor" | "technician" | "assignee";
  avatar: string;
  expertise: string;
  activeTickets: number;
  available: boolean;
  phone: string;
  email: string;
}

export interface KPIData {
  label: string;
  value: number;
  unit: string;
  change: number;
  trend: "up" | "down" | "flat";
}

export const mockTickets: Ticket[] = [
  { id: "FSM-001", title: "Solar Panel Inverter Failure", customer: "Greenfield Solar Park", customerPhone: "+91 98765 43210", location: "Hyderabad, Telangana", fieldOfWork: "Solar PV", status: "in-progress", severity: "major", currentPhase: 4, assignedSupervisor: "Rajesh Kumar", assignedTechnician: "Anil Reddy", createdAt: "2026-02-20T09:30:00", updatedAt: "2026-02-21T14:20:00", description: "Inverter displaying E-03 error code. Output dropped to 40% capacity.", resolution: null },
  { id: "FSM-002", title: "Network Switch Configuration", customer: "TechHub IT Solutions", customerPhone: "+91 87654 32109", location: "Bangalore, Karnataka", fieldOfWork: "Networking", status: "dispatched", severity: "moderate", currentPhase: 3, assignedSupervisor: "Priya Sharma", assignedTechnician: "Vikram Singh", createdAt: "2026-02-21T08:00:00", updatedAt: "2026-02-21T11:45:00", description: "Layer 3 switch not routing traffic between VLANs correctly.", resolution: null },
  { id: "FSM-003", title: "CCTV DVR Replacement", customer: "SecureVision Ltd", customerPhone: "+91 76543 21098", location: "Chennai, Tamil Nadu", fieldOfWork: "Security Systems", status: "completed", severity: "minor", currentPhase: 5, assignedSupervisor: "Arjun Nair", assignedTechnician: "Suresh Babu", createdAt: "2026-02-19T14:00:00", updatedAt: "2026-02-20T16:30:00", description: "DVR hard drive failed. Customer needs replacement and reconfiguration.", resolution: "Replaced 4TB HDD, reconfigured all 16 camera feeds. System operational." },
  { id: "FSM-004", title: "UPS Battery Bank Failure", customer: "DataCore Systems", customerPhone: "+91 65432 10987", location: "Pune, Maharashtra", fieldOfWork: "Power Systems", status: "assigned", severity: "major", currentPhase: 2, assignedSupervisor: "Rajesh Kumar", assignedTechnician: null, createdAt: "2026-02-21T07:15:00", updatedAt: "2026-02-21T09:00:00", description: "3-phase UPS showing battery fault. Backup time reduced to 5 minutes.", resolution: null },
  { id: "FSM-005", title: "Fiber Optic Cable Repair", customer: "ConnectNet ISP", customerPhone: "+91 54321 09876", location: "Mumbai, Maharashtra", fieldOfWork: "Networking", status: "closed", severity: "moderate", currentPhase: 6, assignedSupervisor: "Priya Sharma", assignedTechnician: "Mohan Das", createdAt: "2026-02-18T10:00:00", updatedAt: "2026-02-19T17:00:00", description: "Fiber cut reported near junction box. Affecting 200+ subscribers.", resolution: "Spliced fiber at two points. Signal restored to -18dBm. All subscribers online." },
  { id: "FSM-006", title: "Solar Panel Cleaning & Inspection", customer: "SunPower Farms", customerPhone: "+91 43210 98765", location: "Visakhapatnam, AP", fieldOfWork: "Solar PV", status: "unassigned", severity: "minor", currentPhase: 1, assignedSupervisor: "", assignedTechnician: null, createdAt: "2026-02-21T12:00:00", updatedAt: "2026-02-21T12:00:00", description: "Quarterly maintenance - panel cleaning and electrical inspection required.", resolution: null },
  { id: "FSM-007", title: "Access Control System Malfunction", customer: "Prestige Towers", customerPhone: "+91 32109 87654", location: "Hyderabad, Telangana", fieldOfWork: "Security Systems", status: "in-progress", severity: "moderate", currentPhase: 4, assignedSupervisor: "Arjun Nair", assignedTechnician: "Karthik Rao", createdAt: "2026-02-20T16:00:00", updatedAt: "2026-02-21T10:30:00", description: "Biometric readers on floors 5-8 not communicating with central controller.", resolution: null },
  { id: "FSM-008", title: "Generator Auto-Start Failure", customer: "MedLife Hospital", customerPhone: "+91 21098 76543", location: "Delhi NCR", fieldOfWork: "Power Systems", status: "dispatched", severity: "major", currentPhase: 3, assignedSupervisor: "Rajesh Kumar", assignedTechnician: "Anil Reddy", createdAt: "2026-02-21T06:00:00", updatedAt: "2026-02-21T08:30:00", description: "500KVA DG set not auto-starting on mains failure. Critical healthcare facility.", resolution: null },
];

export const mockTeam: TeamMember[] = [
  { id: "TM-001", name: "Rajesh Kumar", role: "supervisor", avatar: "RK", expertise: "Solar PV, Power Systems", activeTickets: 3, available: true, phone: "+91 99887 76655", email: "rajesh.k@brihaspathi.com" },
  { id: "TM-002", name: "Priya Sharma", role: "supervisor", avatar: "PS", expertise: "Networking, Fiber Optics", activeTickets: 2, available: true, phone: "+91 88776 65544", email: "priya.s@brihaspathi.com" },
  { id: "TM-003", name: "Arjun Nair", role: "supervisor", avatar: "AN", expertise: "Security Systems, CCTV", activeTickets: 2, available: false, phone: "+91 77665 54433", email: "arjun.n@brihaspathi.com" },
  { id: "TM-004", name: "Anil Reddy", role: "technician", avatar: "AR", expertise: "Solar PV, Power Systems", activeTickets: 2, available: false, phone: "+91 66554 43322", email: "anil.r@brihaspathi.com" },
  { id: "TM-005", name: "Vikram Singh", role: "technician", avatar: "VS", expertise: "Networking", activeTickets: 1, available: true, phone: "+91 55443 32211", email: "vikram.s@brihaspathi.com" },
  { id: "TM-006", name: "Suresh Babu", role: "technician", avatar: "SB", expertise: "Security Systems", activeTickets: 1, available: true, phone: "+91 44332 21100", email: "suresh.b@brihaspathi.com" },
  { id: "TM-007", name: "Mohan Das", role: "technician", avatar: "MD", expertise: "Fiber Optics, Networking", activeTickets: 0, available: true, phone: "+91 33221 10099", email: "mohan.d@brihaspathi.com" },
  { id: "TM-008", name: "Karthik Rao", role: "technician", avatar: "KR", expertise: "Security Systems, Access Control", activeTickets: 1, available: false, phone: "+91 22110 09988", email: "karthik.r@brihaspathi.com" },
];

export const mockKPIs: KPIData[] = [
  { label: "First-Time Fix Rate", value: 78, unit: "%", change: 3.2, trend: "up" },
  { label: "Mean Time to Resolve", value: 4.2, unit: "hrs", change: -0.8, trend: "down" },
  { label: "SLA Adherence", value: 91, unit: "%", change: 1.5, trend: "up" },
  { label: "Travel Efficiency", value: 85, unit: "%", change: -2.1, trend: "down" },
  { label: "PIR Accuracy", value: 88, unit: "%", change: 4.0, trend: "up" },
  { label: "Response Latency", value: 12, unit: "min", change: -3.0, trend: "down" },
];

export const phaseLabels: Record<Phase, string> = {
  1: "Complaint Intake",
  2: "Telephonic Triage",
  3: "Dispatch & Journey",
  4: "Field Execution",
  5: "Completion & Sign-off",
  6: "QA & Closing",
};

export const statusColors: Record<TicketStatus, string> = {
  unassigned: "bg-muted text-muted-foreground",
  assigned: "bg-info/15 text-info",
  "in-progress": "bg-warning/15 text-warning",
  dispatched: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

export const severityColors: Record<SeverityTier, string> = {
  minor: "bg-success/15 text-success",
  moderate: "bg-warning/15 text-warning",
  major: "bg-destructive/15 text-destructive",
};

// KPI chart data
export const monthlyKPIData = [
  { month: "Sep", ftfr: 72, mttr: 5.1, sla: 85, travel: 80 },
  { month: "Oct", ftfr: 74, mttr: 4.8, sla: 87, travel: 82 },
  { month: "Nov", ftfr: 73, mttr: 4.9, sla: 86, travel: 81 },
  { month: "Dec", ftfr: 76, mttr: 4.5, sla: 89, travel: 84 },
  { month: "Jan", ftfr: 75, mttr: 4.6, sla: 88, travel: 83 },
  { month: "Feb", ftfr: 78, mttr: 4.2, sla: 91, travel: 85 },
];

export const ticketsByField = [
  { name: "Solar PV", value: 35, fill: "hsl(230, 70%, 50%)" },
  { name: "Networking", value: 28, fill: "hsl(175, 60%, 42%)" },
  { name: "Security Systems", value: 22, fill: "hsl(35, 95%, 55%)" },
  { name: "Power Systems", value: 15, fill: "hsl(0, 72%, 55%)" },
];

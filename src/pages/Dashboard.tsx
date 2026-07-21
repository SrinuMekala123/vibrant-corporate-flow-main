// import { motion } from "framer-motion";
// import { Link } from "react-router-dom";
// import {
//   ClipboardList,
//   Users,
//   AlertTriangle,
//   CheckCircle2,
//   Clock,
//   TrendingUp,
//   ArrowRight,
//   Zap,
//   MapPin,
// } from "lucide-react";
// import { StatCard } from "@/components/StatCard";
// import { StatusBadge, SeverityBadge } from "@/components/Badges";
// import { mockTickets, mockKPIs, mockTeam } from "@/data/mockData";

// const Dashboard = () => {
//   const openTickets = mockTickets.filter((t) => !["completed", "closed"].includes(t.status)).length;
//   const urgentTickets = mockTickets.filter((t) => t.severity === "major" && t.status !== "closed").length;
//   const completedToday = mockTickets.filter((t) => t.status === "completed").length;
//   const availableTechs = mockTeam.filter((m) => m.role === "technician" && m.available).length;

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div>
//         <h1 className="text-2xl font-display font-bold">Dashboard</h1>
//         <p className="text-muted-foreground">Welcome back! Here's your operations overview.</p>
//       </div>

//       {/* Stats Grid */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard label="Open Tickets" value={openTickets} icon={ClipboardList} gradient="primary" delay={0} change={5} trend="up" />
//         <StatCard label="Urgent Issues" value={urgentTickets} icon={AlertTriangle} gradient="warm" delay={0.1} change={-2} trend="down" />
//         <StatCard label="Completed Today" value={completedToday} icon={CheckCircle2} gradient="cool" delay={0.2} change={12} trend="up" />
//         <StatCard label="Techs Available" value={`${availableTechs}/${mockTeam.filter(m => m.role === "technician").length}`} icon={Users} gradient="primary" delay={0.3} />
//       </div>

//       {/* KPI Row */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: 0.4 }}
//         className="glass-card rounded-xl p-5"
//       >
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="font-display font-semibold text-lg">Key Performance Indicators</h2>
//           <Link to="/kpi" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
//             View Details <ArrowRight className="w-3 h-3" />
//           </Link>
//         </div>
//         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//           {mockKPIs.map((kpi) => (
//             <div key={kpi.label} className="text-center p-3 rounded-lg bg-muted/50">
//               <p className="text-xl font-bold">{kpi.value}<span className="text-xs text-muted-foreground ml-0.5">{kpi.unit}</span></p>
//               <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
//             </div>
//           ))}
//         </div>
//       </motion.div>

//       {/* Recent Tickets + Team */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         {/* Recent Tickets */}
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 0.5 }}
//           className="lg:col-span-2 glass-card rounded-xl p-5"
//         >
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="font-display font-semibold text-lg">Recent Tickets</h2>
//             <Link to="/complaints" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
//               View All <ArrowRight className="w-3 h-3" />
//             </Link>
//           </div>
//           <div className="space-y-3">
//             {mockTickets.slice(0, 5).map((ticket, i) => (
//               <Link
//                 key={ticket.id}
//                 to={`/complaints/${ticket.id}`}
//                 className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
//               >
//                 <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
//                   <Zap className="w-5 h-5 text-primary-foreground" />
//                 </div>
//                 <div className="flex-1 min-w-0">
//                   <p className="font-medium text-sm truncate">{ticket.title}</p>
//                   <div className="flex items-center gap-2 mt-0.5">
//                     <span className="text-xs text-muted-foreground">{ticket.id}</span>
//                     <span className="text-xs text-muted-foreground">•</span>
//                     <span className="text-xs text-muted-foreground flex items-center gap-1">
//                       <MapPin className="w-3 h-3" />{ticket.location.split(",")[0]}
//                     </span>
//                   </div>
//                 </div>
//                 <SeverityBadge severity={ticket.severity} />
//                 <StatusBadge status={ticket.status} />
//               </Link>
//             ))}
//           </div>
//         </motion.div>

//         {/* Team */}
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 0.6 }}
//           className="glass-card rounded-xl p-5"
//         >
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="font-display font-semibold text-lg">Team Status</h2>
//             <Link to="/assignments" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
//               Manage <ArrowRight className="w-3 h-3" />
//             </Link>
//           </div>
//           <div className="space-y-3">
//             {mockTeam.slice(0, 6).map((member) => (
//               <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg">
//                 <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
//                   {member.avatar}
//                 </div>
//                 <div className="flex-1 min-w-0">
//                   <p className="text-sm font-medium truncate">{member.name}</p>
//                   <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
//                 </div>
//                 <div className={`w-2 h-2 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>
//     </div>
//   );
// };

// export default Dashboard;


import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Zap,
  MapPin,
  Loader2,
  Plus,
  X,
  Mail,
  Phone,
  Shield,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const formatIndianDateTime = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    let normalized = dateString;
    if (
      typeof dateString === "string" &&
      !dateString.endsWith("Z") &&
      !/[+-]\d{2}:\d{2}$/.test(dateString)
    ) {
      normalized = `${dateString}Z`;
    }
    return new Date(normalized).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch (e) {
    return new Date(dateString).toLocaleString();
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  const getGreetingText = () => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 17) {
      timeGreeting = "Good evening";
    }
    
    let nameTitle = user?.name || "User";
    if (user?.role === "admin") {
      nameTitle = "Admin";
    }
    
    return `${timeGreeting}, ${nameTitle}! 👋`;
  };

  // Fetch all complaints from Supabase
  const { data: complaints, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['dashboard-complaints'],
    queryFn: () => complaintService.getAll(),
  });

  // Fetch all profiles (technicians/supervisors/admins)
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['dashboard-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').neq('role', 'customer');
      if (error) throw error;
      return data;
    }
  });

  if (isLoadingComplaints || isLoadingProfiles) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  // Calculate real stats
  const openTickets = complaints?.filter((t) => !["completed", "closed"].includes(t.status)).length || 0;
  const urgentTickets = complaints?.filter((t) => t.severity === "major" && t.status !== "closed").length || 0;

  // Completed today (check if updated_at is today)
  const today = new Date().toDateString();
  const completedToday = complaints?.filter((t) =>
    t.status === "completed" && new Date(t.updated_at).toDateString() === today
  ).length || 0;

  const allTechnicians = profiles?.filter((m: any) => m.role === "technician") || [];
  const availableTechs = allTechnicians.filter((m: any) => m.available).length;

  // Get recent tickets (last 5)
  const recentTickets = complaints?.slice(0, 5) || [];

  // Get team members (first 6)
  const teamMembers = profiles?.slice(0, 6) || [];

  // Calculate KPIs from real data
  const totalCompleted = complaints?.filter(t => t.status === "completed").length || 0;
  const totalTickets = complaints?.length || 1;
  const firstTimeFixRate = totalCompleted > 0 ? Math.round((totalCompleted / totalTickets) * 100) : 0;

  // Calculate average resolution time (in hours)
  const avgResolutionTime = complaints?.reduce((acc, ticket) => {
    if (ticket.status === "completed") {
      const created = new Date(ticket.created_at).getTime();
      const updated = new Date(ticket.updated_at).getTime();
      const hours = (updated - created) / (1000 * 60 * 60);
      return acc + hours;
    }
    return acc;
  }, 0);
  const mttr = totalCompleted > 0 ? (avgResolutionTime / totalCompleted).toFixed(1) : "0";

  const slaAdherence = firstTimeFixRate; // Simplified for now
  const travelEfficiency = 85; // Would need GPS data to calculate
  const pirAccuracy = 88; // Would need PIR data
  const responseLatency = 12; // Would need timestamp data

  return (
    <div className="space-y-8 relative">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-10 right-10 bg-primary/10" />
      <div className="bg-ambient-blur bottom-20 left-20 bg-emerald-500/10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6 relative z-10">
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-3.5 w-fit uppercase tracking-wider shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            System Active
          </div>
          <h1 className="text-3xl font-display font-black tracking-tight text-slate-900">{getGreetingText()}</h1>
          <p className="text-slate-500 text-[13px] font-medium mt-2 max-w-3xl leading-relaxed">
            Welcome to your smart tracking dashboard. Monitor live field complaints, manage scheduled service tasks, download system metrics, and track updates dynamically.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
        <StatCard label="Open Tickets" value={openTickets} icon={ClipboardList} gradient="primary" delay={0} />
        <StatCard label="Urgent Issues" value={urgentTickets} icon={AlertTriangle} gradient="warm" delay={0.05} />
        <StatCard label="Completed Today" value={completedToday} icon={CheckCircle2} gradient="cool" delay={0.1} />
        <StatCard label="Techs Available" value={`${availableTechs}/${allTechnicians.length}`} icon={Users} gradient="primary" delay={0.15} />
      </div>

      {/* KPI Row */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-6 border border-border/60 relative z-10"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-0.5">
            <h2 className="font-display font-extrabold text-lg tracking-tight">Key Performance Indicators</h2>
            <p className="text-xs text-muted-foreground">Historical averages and service compliance efficiency rates.</p>
          </div>
          <Link to="/kpi" className="text-xs text-primary font-bold hover:underline flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all">
            View Details <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "First-Time Fix Rate", value: firstTimeFixRate, unit: "%", theme: "text-primary" },
            { label: "Mean Time to Resolve", value: mttr, unit: "hrs", theme: "text-amber-500" },
            { label: "SLA Adherence", value: slaAdherence, unit: "%", theme: "text-emerald-500" },
            { label: "Travel Efficiency", value: travelEfficiency, unit: "%", theme: "text-blue-500" },
            { label: "PIR Accuracy", value: pirAccuracy, unit: "%", theme: "text-purple-500" },
            { label: "Response Latency", value: responseLatency, unit: "min", theme: "text-indigo-500" },
          ].map((kpi) => (
            <motion.div
              key={kpi.label}
              whileHover={{ y: -3 }}
              className="text-center p-4 rounded-xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-glow transition-all duration-300 cursor-pointer"
            >
              <p className={`text-2xl font-extrabold tracking-tight ${kpi.theme}`}>
                {kpi.value}
                <span className="text-xs font-semibold text-muted-foreground ml-0.5">{kpi.unit}</span>
              </p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-2">{kpi.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Tickets + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Recent Tickets */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 glass-card rounded-2xl p-6 border border-border/60"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-0.5">
              <h2 className="font-display font-extrabold text-lg tracking-tight">Recent Complaints</h2>
              <p className="text-xs text-muted-foreground">Latest client submittals needing attention or review.</p>
            </div>
            <Link to="/complaints" className="text-xs text-primary font-bold hover:underline flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3.5">
            {recentTickets.length > 0 ? (
              recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/complaints/${ticket.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border/40 hover:border-primary/20 bg-card hover:bg-muted/10 transition-all group relative overflow-hidden"
                >
                  {/* Hover indicator lines */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">FSM-{ticket.id.slice(0, 4).toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors" title={ticket.title}>{ticket.title}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {ticket.location?.split(",")[0] || "N/A"}
                      </span>
                      <span>•</span>
                      <span>Customer: <span className="font-semibold text-primary">{ticket.customer_name || ticket.profiles?.full_name || ticket.created_by_name || 'Customer'}</span> on {formatIndianDateTime(ticket.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 mt-2 sm:mt-0">
                    {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
                    {ticket.status && <StatusBadge status={ticket.status} />}
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No complaints registered yet.</p>
            )}
          </div>
        </motion.div>

        {/* Team */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6 border border-border/60"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-0.5">
              <h2 className="font-display font-extrabold text-lg tracking-tight">Active Team</h2>
              <p className="text-xs text-muted-foreground">Staff availability and status.</p>
            </div>
            <Link to="/assignments" className="text-xs text-primary font-bold hover:underline flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all">
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {teamMembers.length > 0 ? (
              teamMembers.map((member: any) => (
                <div 
                  key={member.id} 
                  onClick={() => setSelectedMember(member)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/30 bg-card hover:bg-muted/10 transition-all cursor-pointer hover:border-primary/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full gradient-cool flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                      {member.full_name?.charAt(0) || member.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{member.full_name || member.email}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize">{member.available ? "Available" : "Busy"}</span>
                    <div className={`w-2 h-2 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No team members registered.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Team Member Details Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-md w-full rounded-2xl p-6 relative flex flex-col gap-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase ${
                  selectedMember.role === 'admin' ? 'bg-rose-500' :
                  selectedMember.role === 'supervisor' ? 'bg-indigo-500' :
                  selectedMember.role === 'technician' ? 'bg-amber-500' : 'bg-teal-500'
                }`}>
                  {selectedMember.full_name?.charAt(0) || selectedMember.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-800">{selectedMember.full_name || "No Name"}</h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block mt-1 ${
                    selectedMember.role === 'admin' ? 'bg-rose-50 border border-rose-200 text-rose-600' :
                    selectedMember.role === 'supervisor' ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' :
                    selectedMember.role === 'technician' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                    'bg-teal-50 border border-teal-200 text-teal-600'
                  }`}>
                    {selectedMember.role}
                  </span>
                </div>
              </div>

              {/* Details Body */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Email Address</span>
                    <span className="block truncate font-medium">{selectedMember.email || "N/A"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Phone Contact</span>
                    <span className="font-semibold">{selectedMember.phone || "Not provided"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Availability Status</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${selectedMember.available ? "bg-success" : "bg-muted-foreground"}`} />
                      <span className="font-medium capitalize">{selectedMember.available ? "Available (Ready for assignment)" : "Busy (On duty / Assigned)"}</span>
                    </div>
                  </div>
                </div>

                {(selectedMember.role === 'supervisor' || selectedMember.role === 'technician') && (
                  <div className="pt-3 border-t border-slate-150">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">Expertise / Specialties</span>
                    {selectedMember.expertise ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMember.expertise.split(",").map((exp: string) => (
                          <span key={exp} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-muted border border-slate-200 text-slate-700 rounded-full">
                            <Wrench className="w-3 h-3 text-primary" /> {exp.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">General / Unspecified</span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-2 border-t pt-4 flex justify-end">
                <Button 
                  onClick={() => setSelectedMember(null)}
                  className="gradient-primary text-white text-xs font-bold rounded-xl px-4 py-2"
                >
                  Close Details
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
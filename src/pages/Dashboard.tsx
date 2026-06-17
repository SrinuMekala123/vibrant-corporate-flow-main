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


import { motion } from "framer-motion";
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
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";

const Dashboard = () => {
  // Fetch all complaints from Supabase
  const { data: complaints, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['dashboard-complaints'],
    queryFn: () => complaintService.getAll(),
  });

  // Fetch all profiles (technicians/supervisors)
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['dashboard-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your operations overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Tickets" value={openTickets} icon={ClipboardList} gradient="primary" delay={0} />
        <StatCard label="Urgent Issues" value={urgentTickets} icon={AlertTriangle} gradient="warm" delay={0.1} />
        <StatCard label="Completed Today" value={completedToday} icon={CheckCircle2} gradient="cool" delay={0.2} />
        <StatCard label="Techs Available" value={`${availableTechs}/${allTechnicians.length}`} icon={Users} gradient="primary" delay={0.3} />
      </div>

      {/* KPI Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Key Performance Indicators</h2>
          <Link to="/kpi" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
            View Details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "First-Time Fix Rate", value: firstTimeFixRate, unit: "%" },
            { label: "Mean Time to Resolve", value: mttr, unit: "hrs" },
            { label: "SLA Adherence", value: slaAdherence, unit: "%" },
            { label: "Travel Efficiency", value: travelEfficiency, unit: "%" },
            { label: "PIR Accuracy", value: pirAccuracy, unit: "%" },
            { label: "Response Latency", value: responseLatency, unit: "min" },
          ].map((kpi) => (
            <div key={kpi.label} className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{kpi.value}<span className="text-xs text-muted-foreground ml-0.5">{kpi.unit}</span></p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Tickets + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tickets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 glass-card rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Recent Tickets</h2>
            <Link to="/complaints" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentTickets.length > 0 ? (
              recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/complaints/${ticket.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Zap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ticket.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{ticket.id.slice(0, 8)}...</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{ticket.location?.split(",")[0] || "N/A"}
                      </span>
                    </div>
                  </div>
                  {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
                  {ticket.status && <StatusBadge status={ticket.status} />}
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No tickets found</p>
            )}
          </div>
        </motion.div>

        {/* Team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Team Status</h2>
            <Link to="/assignments" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {teamMembers.length > 0 ? (
              teamMembers.map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
                    {member.full_name?.charAt(0) || member.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No team members found</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
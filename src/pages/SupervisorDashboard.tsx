// import { motion } from "framer-motion";
// import { Link } from "react-router-dom";
// import { ClipboardList, Users, AlertTriangle, CheckCircle2, ArrowRight, Clock, ShieldCheck } from "lucide-react";
// import { StatCard } from "@/components/StatCard";
// import { StatusBadge, SeverityBadge } from "@/components/Badges";
// import { mockTickets, mockTeam } from "@/data/mockData";
// import { useAuth } from "@/contexts/AuthContext";
// import { Button } from "@/components/ui/button";

// const SupervisorDashboard = () => {
//   const { user } = useAuth();
//   const myTickets = mockTickets.filter((t) => t.assignedSupervisor === user?.name);
//   const pendingVerification = myTickets.filter((t) => t.status === "completed");
//   const activeTickets = myTickets.filter((t) => !["completed", "closed"].includes(t.status));
//   const urgentTickets = myTickets.filter((t) => t.severity === "major" && t.status !== "closed");
//   const myTechnicians = mockTeam.filter(
//     (m) => m.role === "technician" && user?.expertise && m.expertise.split(", ").some((e) => user.expertise!.includes(e))
//   );

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-2xl font-display font-bold">Supervisor Dashboard</h1>
//         <p className="text-muted-foreground">Welcome back, {user?.name}! Here's your team overview.</p>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard label="My Active Tickets" value={activeTickets.length} icon={ClipboardList} gradient="primary" delay={0} />
//         <StatCard label="Urgent Issues" value={urgentTickets.length} icon={AlertTriangle} gradient="warm" delay={0.1} />
//         <StatCard label="Pending Verification" value={pendingVerification.length} icon={ShieldCheck} gradient="cool" delay={0.2} />
//         <StatCard label="My Technicians" value={myTechnicians.length} icon={Users} gradient="primary" delay={0.3} />
//       </div>

//       {/* Pending Verification */}
//       {pendingVerification.length > 0 && (
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
//           <h2 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
//             <ShieldCheck className="w-5 h-5 text-warning" /> Awaiting Your Verification
//           </h2>
//           <div className="space-y-2">
//             {pendingVerification.map((t) => (
//               <Link key={t.id} to={`/complaints/${t.id}`} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors">
//                 <div>
//                   <span className="text-xs font-mono text-primary font-semibold mr-2">{t.id}</span>
//                   <span className="font-medium text-sm">{t.title}</span>
//                 </div>
//                 <Button size="sm" variant="outline" className="text-xs">Review & Verify</Button>
//               </Link>
//             ))}
//           </div>
//         </motion.div>
//       )}

//       {/* Active Tickets */}
//       <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-5">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="font-display font-semibold text-lg">My Active Tickets</h2>
//           <Link to="/complaints" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></Link>
//         </div>
//         <div className="space-y-3">
//           {activeTickets.map((t) => (
//             <Link key={t.id} to={`/complaints/${t.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
//               <div className="flex-1 min-w-0">
//                 <div className="flex items-center gap-2 mb-0.5">
//                   <span className="text-xs font-mono text-primary font-semibold">{t.id}</span>
//                   <SeverityBadge severity={t.severity} />
//                   <StatusBadge status={t.status} />
//                 </div>
//                 <p className="font-medium text-sm truncate">{t.title}</p>
//                 <p className="text-xs text-muted-foreground mt-0.5">{t.assignedTechnician ? `Tech: ${t.assignedTechnician}` : "No technician assigned"}</p>
//               </div>
//               <div className="text-xs text-muted-foreground flex items-center gap-1">
//                 <Clock className="w-3 h-3" />
//                 {new Date(t.updatedAt).toLocaleDateString()}
//               </div>
//             </Link>
//           ))}
//           {activeTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No active tickets</p>}
//         </div>
//       </motion.div>

//       {/* My Technicians */}
//       <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card rounded-xl p-5">
//         <h2 className="font-display font-semibold text-lg mb-4">My Field Technicians</h2>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
//           {myTechnicians.map((m) => (
//             <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
//               <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-xs font-bold text-primary-foreground">{m.avatar}</div>
//               <div className="flex-1 min-w-0">
//                 <p className="text-sm font-medium truncate">{m.name}</p>
//                 <p className="text-xs text-muted-foreground">{m.expertise}</p>
//               </div>
//               <div className={`w-2.5 h-2.5 rounded-full ${m.available ? "bg-success" : "bg-muted-foreground"}`} />
//             </div>
//           ))}
//         </div>
//       </motion.div>
//     </div>
//   );
// };

// export default SupervisorDashboard;


import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ClipboardList, Users, AlertTriangle, CheckCircle2, ArrowRight, Clock, ShieldCheck, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

const SupervisorDashboard = () => {
  const { user } = useAuth();
  const [supervisorName, setSupervisorName] = useState("");

  // 1. Fetch Current Supervisor's Name from Profiles
  // We need the name to match it with 'assigned_supervisor' in the complaints table
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.full_name) setSupervisorName(data.full_name);
        });
    }
  }, [user]);

  // 2. Fetch All Complaints
  const { data: allComplaints, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['complaints-dashboard'],
    queryFn: () => complaintService.getAll(),
  });

  // 3. Fetch All Technicians
  const { data: allTechnicians, isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'technician');
      if (error) throw error;
      return data;
    }
  });

  if (isLoadingComplaints || isLoadingTechnicians) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  // Filter Logic using Real Data
  // Note: assigned_supervisor in DB is a string (name)
  const myTickets = allComplaints?.filter((t) => t.assigned_supervisor === supervisorName) || [];
  const pendingVerification = myTickets.filter((t) => t.status === "completed");
  const activeTickets = myTickets.filter((t) => !["completed", "closed"].includes(t.status));
  const urgentTickets = myTickets.filter((t) => t.severity === "major" && t.status !== "closed");

  // Show all technicians for now
  const myTechnicians = allTechnicians || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Supervisor Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {supervisorName || user?.email}! Here's your team overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Active Tickets" value={activeTickets.length} icon={ClipboardList} gradient="primary" delay={0} />
        <StatCard label="Urgent Issues" value={urgentTickets.length} icon={AlertTriangle} gradient="warm" delay={0.1} />
        <StatCard label="Pending Verification" value={pendingVerification.length} icon={ShieldCheck} gradient="cool" delay={0.2} />
        <StatCard label="My Technicians" value={myTechnicians.length} icon={Users} gradient="primary" delay={0.3} />
      </div>

      {/* Pending Verification */}
      {pendingVerification.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5 border-l-4 border-l-warning">
          <h2 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-warning" /> Awaiting Your Verification
          </h2>
          <div className="space-y-2">
            {pendingVerification.map((t) => (
              <Link key={t.id} to={`/complaints/${t.id}`} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors">
                <div>
                  <span className="text-xs font-mono text-primary font-semibold mr-2">{t.id.slice(0, 8)}...</span>
                  <span className="font-medium text-sm">{t.title}</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs">Review & Verify</Button>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Tickets */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">My Active Tickets</h2>
          <Link to="/complaints" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="space-y-3">
          {activeTickets.map((t) => (
            <Link key={t.id} to={`/complaints/${t.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-primary font-semibold">{t.id.slice(0, 8)}...</span>
                  {t.severity && <SeverityBadge severity={t.severity as any} />}
                  {t.status && <StatusBadge status={t.status} />}
                </div>
                <p className="font-medium text-sm truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.assigned_technician ? `Tech: ${t.assigned_technician}` : "No technician assigned"}</p>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(t.updated_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
          {activeTickets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No active tickets</p>}
        </div>
      </motion.div>

      {/* My Technicians */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card rounded-xl p-5">
        <h2 className="font-display font-semibold text-lg mb-4">My Field Technicians</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {myTechnicians.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-xs font-bold text-primary-foreground">{m.full_name?.charAt(0) || 'T'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.expertise || 'General'}</p>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${m.available ? "bg-success" : "bg-muted-foreground"}`} />
            </div>
          ))}
          {myTechnicians.length === 0 && <p className="text-sm text-muted-foreground">No technicians found.</p>}
        </div>
      </motion.div>
    </div>
  );
};

export default SupervisorDashboard;
// import { motion } from "framer-motion";
// import { Link } from "react-router-dom";
// import { ClipboardList, AlertTriangle, MapPin, Clock, Wrench, CheckCircle2 } from "lucide-react";
// import { StatCard } from "@/components/StatCard";
// import { StatusBadge, SeverityBadge } from "@/components/Badges";
// import { PhaseTimeline } from "@/components/PhaseTimeline";
// import { mockTickets } from "@/data/mockData";
// import { useAuth } from "@/contexts/AuthContext";

// const TechnicianDashboard = () => {
//   const { user } = useAuth();
//   const myTickets = mockTickets.filter((t) => t.assignedTechnician === user?.name);
//   const activeTickets = myTickets.filter((t) => !["completed", "closed"].includes(t.status));
//   const completedTickets = myTickets.filter((t) => t.status === "completed" || t.status === "closed");

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-2xl font-display font-bold">My Jobs</h1>
//         <p className="text-muted-foreground">Welcome, {user?.name}! Here are your assigned tasks.</p>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <StatCard label="Active Jobs" value={activeTickets.length} icon={Wrench} gradient="primary" delay={0} />
//         <StatCard label="Urgent" value={myTickets.filter((t) => t.severity === "major").length} icon={AlertTriangle} gradient="warm" delay={0.1} />
//         <StatCard label="Completed" value={completedTickets.length} icon={CheckCircle2} gradient="cool" delay={0.2} />
//       </div>

//       {/* Active Jobs */}
//       {activeTickets.map((ticket, i) => (
//         <motion.div
//           key={ticket.id}
//           initial={{ opacity: 0, y: 15 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 0.3 + i * 0.1 }}
//         >
//           <Link to={`/complaints/${ticket.id}`} className="glass-card rounded-xl p-5 block hover:shadow-glow transition-all">
//             <div className="flex items-center justify-between mb-3">
//               <div className="flex items-center gap-2">
//                 <span className="text-xs font-mono text-primary font-semibold">{ticket.id}</span>
//                 <SeverityBadge severity={ticket.severity} />
//                 <StatusBadge status={ticket.status} />
//               </div>
//               <div className="text-xs text-muted-foreground flex items-center gap-1">
//                 <Clock className="w-3 h-3" />
//                 {new Date(ticket.updatedAt).toLocaleDateString()}
//               </div>
//             </div>
//             <h3 className="font-semibold mb-1">{ticket.title}</h3>
//             <p className="text-sm text-muted-foreground mb-3">{ticket.description}</p>
//             <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
//               <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ticket.location}</span>
//               <span>{ticket.customer}</span>
//             </div>
//             <PhaseTimeline currentPhase={ticket.currentPhase} />
//           </Link>
//         </motion.div>
//       ))}

//       {activeTickets.length === 0 && (
//         <div className="glass-card rounded-xl p-12 text-center">
//           <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
//           <p className="font-semibold">No active jobs!</p>
//           <p className="text-sm text-muted-foreground">You're all caught up.</p>
//         </div>
//       )}
//     </div>
//   );
// };

// export default TechnicianDashboard;


import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { MapPin, Clock, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("active");

  // 1. Fetch the logged-in user's profile to get their REAL name (e.g., "Anil Reddy")
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const technicianName = userProfile?.full_name || user?.email?.split("@")[0];

  // 2. Fetch complaints assigned to THIS technician
  const { data: allComplaints, isLoading } = useQuery({
    queryKey: ["technician-complaints", technicianName],
    queryFn: async () => {
      if (!technicianName) return [];
      const data = await complaintService.getAll();
      // Filter using the REAL name fetched from profiles
      return data.filter(c => c.assigned_technician === technicianName);
    },
    enabled: !!technicianName,
  });

  // Filter based on active tab
  const filteredComplaints = allComplaints?.filter((c) => {
    if (activeTab === "active") return c.status !== "completed" && c.status !== "closed";
    if (activeTab === "completed") return c.status === "completed" || c.status === "closed";
    return true;
  }) || [];

  // Calculate Stats
  const stats = {
    total: allComplaints?.length || 0,
    active: allComplaints?.filter(c => c.status !== "completed" && c.status !== "closed").length || 0,
    completed: allComplaints?.filter(c => c.status === "completed" || c.status === "closed").length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading your jobs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">My Jobs</h1>
        <p className="text-muted-foreground">
          Welcome, {technicianName || "Technician"}! Here are your assigned tasks.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {allComplaints?.filter(c => (c.priority === "high" || c.priority === "urgent") && c.status !== "completed").length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Urgent</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-6 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Job List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant={activeTab === "all" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("all")}>All</Button>
          <Button variant={activeTab === "active" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("active")}>Active</Button>
          <Button variant={activeTab === "completed" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("completed")}>Completed</Button>
        </div>

        {filteredComplaints.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-xl">
            <p className="text-muted-foreground">No jobs found in this category.</p>
          </div>
        ) : (
          filteredComplaints.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-6 hover:shadow-glow transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-bold text-primary">FSM-{ticket.id.slice(0, 4).toUpperCase()}</span>
                    <SeverityBadge severity={ticket.severity as any} />
                    <StatusBadge status={ticket.status} />
                  </div>

                  <h3 className="text-lg font-semibold">{ticket.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {ticket.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(ticket.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Right Action/Progress */}
                <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <div className="w-full space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">Phase {ticket.current_phase}/6</span>
                    </div>
                    <Progress value={(ticket.current_phase || 1) * (100 / 6)} className="h-2" />
                  </div>

                  <Link to={`/complaints/${ticket.id}`}>
                    <Button size="sm" className="w-full">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default TechnicianDashboard;
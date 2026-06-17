// import { motion } from "framer-motion";
// import { Link } from "react-router-dom";
// import { ClipboardList, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
// import { StatCard } from "@/components/StatCard";
// import { StatusBadge, SeverityBadge } from "@/components/Badges";
// import { PhaseTimeline } from "@/components/PhaseTimeline";
// import { mockTickets } from "@/data/mockData";
// import { useAuth } from "@/contexts/AuthContext";

// const CustomerDashboard = () => {
//   const { user } = useAuth();
//   // Match tickets by customer name
//   const myTickets = mockTickets.filter((t) => t.customer === user?.name);
//   const openTickets = myTickets.filter((t) => !["completed", "closed"].includes(t.status));
//   const resolvedTickets = myTickets.filter((t) => t.status === "completed" || t.status === "closed");

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-2xl font-display font-bold">My Tickets</h1>
//         <p className="text-muted-foreground">Track your service requests and complaints.</p>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <StatCard label="Open Tickets" value={openTickets.length} icon={ClipboardList} gradient="primary" delay={0} />
//         <StatCard label="Resolved" value={resolvedTickets.length} icon={CheckCircle2} gradient="cool" delay={0.1} />
//         <StatCard label="Total" value={myTickets.length} icon={AlertTriangle} gradient="warm" delay={0.2} />
//       </div>

//       {/* Tickets */}
//       <div className="space-y-4">
//         {myTickets.map((ticket, i) => (
//           <motion.div
//             key={ticket.id}
//             initial={{ opacity: 0, y: 15 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ delay: 0.3 + i * 0.1 }}
//             className="glass-card rounded-xl p-5"
//           >
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
//             <p className="text-sm text-muted-foreground mb-4">{ticket.description}</p>
//             <PhaseTimeline currentPhase={ticket.currentPhase} />
//             {ticket.resolution && (
//               <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
//                 <p className="text-xs text-muted-foreground mb-1">Resolution</p>
//                 <p className="text-sm">{ticket.resolution}</p>
//               </div>
//             )}
//           </motion.div>
//         ))}
//         {myTickets.length === 0 && (
//           <div className="glass-card rounded-xl p-12 text-center">
//             <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
//             <p className="font-semibold">No tickets found</p>
//             <p className="text-sm text-muted-foreground">You don't have any service requests yet.</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default CustomerDashboard;

import { motion } from "framer-motion";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";

const CustomerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  console.log("🔍 CustomerDashboard loaded:", {
    userEmail: user?.email,
    userRole: user?.role,
    userId: user?.id
  });

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['customer-complaints', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const allComplaints = await complaintService.getAll();
      return allComplaints.filter(t => t.customer_id === user.id);
    },
    enabled: !!user,
  });

  const openTickets = complaints?.filter((t) => !["completed", "closed"].includes(t.status)) || [];
  const resolvedTickets = complaints?.filter((t) => t.status === "completed" || t.status === "closed") || [];
  const totalTickets = complaints || [];

  // 🔥 FIX: Navigate to new complaint with debugging
  const handleNewComplaint = () => {
    console.log("🚀 New Complaint button clicked!");
    console.log("📍 Navigating to: /complaints/new");
    navigate("/complaints/new");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading your tickets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">My Tickets</h1>
          <p className="text-muted-foreground">Track your service requests and complaints.</p>
        </div>
        {/* 🔥 FIX: Use onClick with navigate */}
        <Button
          onClick={() => {
            console.log("🔘 Button clicked - navigating to /complaints/new");
            navigate("/complaints/new");
          }}
          className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Complaint
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Open Tickets" value={openTickets.length} icon={ClipboardList} gradient="primary" delay={0} />
        <StatCard label="Resolved" value={resolvedTickets.length} icon={CheckCircle2} gradient="cool" delay={0.1} />
        <StatCard label="Total" value={totalTickets.length} icon={AlertTriangle} gradient="warm" delay={0.2} />
      </div>

      <div className="space-y-4">
        {totalTickets.length > 0 ? (
          totalTickets.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass-card rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-primary font-semibold">{ticket.id.slice(0, 8)}...</span>
                  {ticket.severity && <SeverityBadge severity={ticket.severity} />}
                  {ticket.status && <StatusBadge status={ticket.status} />}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(ticket.updated_at).toLocaleDateString()}
                </div>
              </div>
              <h3 className="font-semibold mb-1">{ticket.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{ticket.description}</p>
              <PhaseTimeline currentPhase={ticket.current_phase as any || 1} />
              {ticket.resolution && (
                <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-muted-foreground mb-1">Resolution</p>
                  <p className="text-sm">{ticket.resolution}</p>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="glass-card rounded-xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold">No tickets found</p>
            <p className="text-sm text-muted-foreground mb-4">You don't have any service requests yet.</p>
            <Button
              onClick={() => {
                console.log("🔘 Empty state button clicked");
                navigate("/complaints/new");
              }}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Ticket
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;
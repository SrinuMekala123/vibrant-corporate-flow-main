// import { motion } from "framer-motion";
// import { MapPin, Phone, Mail, Wrench, ClipboardList } from "lucide-react";
// import { StatusBadge } from "@/components/Badges";
// import { mockTeam, mockTickets } from "@/data/mockData";
// import { Link } from "react-router-dom";

// const Assignments = () => {
//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-2xl font-display font-bold">Assignments</h1>
//         <p className="text-muted-foreground">Team dispatch and workload overview</p>
//       </div>

//       {/* Supervisors */}
//       <div>
//         <h2 className="font-display font-semibold text-lg mb-4">Supervisors</h2>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           {mockTeam.filter((m) => m.role === "supervisor").map((member, i) => {
//             const tickets = mockTickets.filter((t) => t.assignedSupervisor === member.name);
//             return (
//               <motion.div
//                 key={member.id}
//                 initial={{ opacity: 0, y: 15 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: i * 0.1 }}
//                 className="glass-card rounded-xl p-5"
//               >
//                 <div className="flex items-center gap-3 mb-4">
//                   <div className="w-12 h-12 rounded-full gradient-cool flex items-center justify-center text-sm font-bold text-primary-foreground">
//                     {member.avatar}
//                   </div>
//                   <div className="flex-1">
//                     <p className="font-semibold">{member.name}</p>
//                     <p className="text-xs text-muted-foreground flex items-center gap-1">
//                       <Wrench className="w-3 h-3" /> {member.expertise}
//                     </p>
//                   </div>
//                   <div className={`w-3 h-3 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
//                 </div>
//                 <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
//                   <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{member.phone}</span>
//                   <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{member.email.split("@")[0]}</span>
//                 </div>
//                 <div className="space-y-2">
//                   <p className="text-xs font-medium text-muted-foreground">Assigned Tickets ({tickets.length})</p>
//                   {tickets.map((t) => (
//                     <Link key={t.id} to={`/complaints/${t.id}`} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm">
//                       <span className="truncate flex-1">{t.id} — {t.title}</span>
//                       <StatusBadge status={t.status} />
//                     </Link>
//                   ))}
//                   {tickets.length === 0 && <p className="text-xs text-muted-foreground italic">No assigned tickets</p>}
//                 </div>
//               </motion.div>
//             );
//           })}
//         </div>
//       </div>

//       {/* Technicians */}
//       <div>
//         <h2 className="font-display font-semibold text-lg mb-4">Field Technicians</h2>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//           {mockTeam.filter((m) => m.role === "technician").map((member, i) => {
//             const tickets = mockTickets.filter((t) => t.assignedTechnician === member.name);
//             return (
//               <motion.div
//                 key={member.id}
//                 initial={{ opacity: 0, y: 15 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: i * 0.08 }}
//                 className="glass-card rounded-xl p-4"
//               >
//                 <div className="flex items-center gap-3 mb-3">
//                   <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-xs font-bold text-primary-foreground">
//                     {member.avatar}
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p className="font-semibold text-sm truncate">{member.name}</p>
//                     <p className="text-xs text-muted-foreground truncate">{member.expertise}</p>
//                   </div>
//                   <div className={`w-2.5 h-2.5 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
//                 </div>
//                 <div className="flex items-center justify-between text-xs">
//                   <span className="text-muted-foreground flex items-center gap-1">
//                     <ClipboardList className="w-3 h-3" /> {tickets.length} active
//                   </span>
//                   <span className={member.available ? "text-success font-medium" : "text-muted-foreground"}>
//                     {member.available ? "Available" : "Busy"}
//                   </span>
//                 </div>
//               </motion.div>
//             );
//           })}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Assignments;


import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Wrench, ClipboardList, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/Badges";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";

const Assignments = () => {
  // Fetch Complaints
  const { data: complaints, isLoading: isComplaintsLoading } = useQuery({
    queryKey: ['complaints-assignments'],
    queryFn: () => complaintService.getAll(),
  });

  // Fetch Profiles (Supervisors & Technicians)
  const { data: profiles, isLoading: isProfilesLoading } = useQuery({
    queryKey: ['profiles-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data;
    }
  });

  if (isComplaintsLoading || isProfilesLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const supervisors = profiles?.filter((p: any) => p.role === 'supervisor') || [];
  const technicians = profiles?.filter((p: any) => p.role === 'technician') || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Assignments</h1>
        <p className="text-muted-foreground">Team dispatch and workload overview</p>
      </div>

      {/* Supervisors */}
      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Supervisors</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {supervisors.map((member: any, i: number) => {
            // Filter complaints for this supervisor
            const tickets = complaints?.filter((t) => t.assigned_supervisor === member.full_name) || [];
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full gradient-cool flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {member.full_name?.charAt(0) || 'S'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> {member.expertise || 'N/A'}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{member.phone || 'N/A'}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{member.email}</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Assigned Tickets ({tickets.length})</p>
                  {tickets.map((t) => (
                    <Link key={t.id} to={`/complaints/${t.id}`} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm">
                      <span className="truncate flex-1">{t.id.slice(0, 8)}... — {t.title}</span>
                      <StatusBadge status={t.status} />
                    </Link>
                  ))}
                  {tickets.length === 0 && <p className="text-xs text-muted-foreground italic">No assigned tickets</p>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Technicians */}
      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Field Technicians</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {technicians.map((member: any, i: number) => {
            const tickets = complaints?.filter((t) => t.assigned_technician === member.full_name) || [];
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {member.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.expertise || 'General'}</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" /> {tickets.filter(t => t.status !== 'closed' && t.status !== 'completed').length} active
                  </span>
                  <span className={member.available ? "text-success font-medium" : "text-muted-foreground"}>
                    {member.available ? "Available" : "Busy"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Assignments;
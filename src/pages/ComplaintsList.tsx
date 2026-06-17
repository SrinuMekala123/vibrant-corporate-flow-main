// import { useState, useEffect } from "react";
// import { Link } from "react-router-dom";
// import { motion } from "framer-motion";
// import { Search, Filter, Plus, MapPin, Clock, Loader2 } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { StatusBadge, SeverityBadge } from "@/components/Badges";
// import { useQuery } from "@tanstack/react-query";
// import { complaintService } from "@/services/complaintService";
// import { TicketStatus } from "@/data/mockData";

// import { supabase } from "@/lib/supabase";
// import { toast } from "sonner";

// const statusFilters: (TicketStatus | "all")[] = [
//   "all",
//   "unassigned",
//   "assigned",
//   "in-progress",
//   "dispatched",
//   "completed",
//   "closed"
// ];

// const ComplaintsList = () => {
//   const [search, setSearch] = useState("");
//   const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
//   const { user } = useAuth();

//   // Fetch complaints from Supabase using React Query
//   const { data: complaints, isLoading, error, refetch } = useQuery({
//     queryKey: ["complaints", statusFilter, search],
//     queryFn: () => complaintService.getAll({
//       status: statusFilter === "all" ? undefined : statusFilter
//     }),
//     enabled: !!user, // Only fetch when user is logged in
//     staleTime: 1000 * 60 * 5, // Cache for 5 minutes
//   });

//   // 🔄 REALTIME SUBSCRIPTION - Listen to ALL complaint changes
//   useEffect(() => {
//     if (!user) return;

//     // Subscribe to all changes on complaints table
//     const channel = supabase
//       .channel('complaints-list')
//       .on(
//         'postgres_changes',
//         {
//           event: '*', // Listen to INSERT, UPDATE, DELETE
//           schema: 'public',
//           table: 'complaints',
//         },
//         (payload) => {
//           console.log('🔄 Realtime update in complaints list:', payload);

//           // Show a toast notification based on the event type
//           if (payload.eventType === 'INSERT') {
//             toast.success(`New complaint created: ${payload.new.title}`, {
//               duration: 4000,
//             });
//           } else if (payload.eventType === 'UPDATE') {
//             const oldStatus = payload.old?.status;
//             const newStatus = payload.new?.status;
//             if (oldStatus !== newStatus) {
//               toast.info(`Complaint ${payload.new.id.slice(0, 8)}... status changed to ${newStatus}`, {
//                 duration: 3000,
//               });
//             } else {
//               toast.info(`Complaint ${payload.new.id.slice(0, 8)}... has been updated`, {
//                 duration: 3000,
//               });
//             }
//           } else if (payload.eventType === 'DELETE') {
//             toast.warning(`A complaint has been deleted`, {
//               duration: 3000,
//             });
//           }

//           // Refetch complaints to update the list
//           refetch();
//         }
//       )
//       .subscribe((status) => {
//         console.log('📡 Complaints list subscription status:', status);
//       });

//     // Cleanup on unmount
//     return () => {
//       supabase.removeChannel(channel);
//       console.log('🔌 Complaints list subscription removed');
//     };
//   }, [user, refetch]);

//   // Also listen for specific status filter changes? Optional enhancement
//   useEffect(() => {
//     // This will trigger refetch when filters change
//     // The queryKey already handles this, but we can add realtime refetch
//     console.log('Filters changed:', { statusFilter, search });
//   }, [statusFilter, search]);

//   // Filter results client-side for search
//   const filtered = complaints?.filter((t) => {
//     const matchSearch =
//       t.title?.toLowerCase().includes(search.toLowerCase()) ||
//       t.id?.toLowerCase().includes(search.toLowerCase()) ||
//       t.profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
//     return matchSearch;
//   }) || [];

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center h-64">
//         <Loader2 className="w-8 h-8 animate-spin text-primary" />
//         <span className="ml-2">Loading complaints...</span>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="p-4 text-destructive">
//         <p>Error loading complaints: {error.message}</p>
//         <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
//           Retry
//         </Button>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-display font-bold">Complaints</h1>
//           <p className="text-muted-foreground">Manage service tickets and complaints</p>
//         </div>
//         <Link to="/complaints/new">
//           <Button className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
//             <Plus className="w-4 h-4 mr-2" /> New Complaint
//           </Button>
//         </Link>
//       </div>

//       {/* Filters */}
//       <div className="glass-card rounded-xl p-4 space-y-4">
//         <div className="relative">
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//           <Input
//             placeholder="Search by ticket ID, title, or customer..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             className="pl-10"
//           />
//         </div>
//         <div className="flex flex-wrap gap-2">
//           {statusFilters.map((s) => (
//             <button
//               key={s}
//               onClick={() => setStatusFilter(s)}
//               className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${statusFilter === s
//                 ? "gradient-primary text-primary-foreground shadow-glow"
//                 : "bg-muted text-muted-foreground hover:bg-muted/80"
//                 }`}
//             >
//               {s === "all" ? "All" : s.replace("-", " ")}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Tickets List */}
//       <div className="space-y-3">
//         {filtered.map((ticket, i) => (
//           <motion.div
//             key={ticket.id}
//             initial={{ opacity: 0, y: 10 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ delay: i * 0.05 }}
//           >
//             <Link
//               to={`/complaints/${ticket.id}`}
//               className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-glow transition-all duration-300 block"
//             >
//               <div className="flex-1 min-w-0">
//                 <div className="flex items-center gap-2 mb-1">
//                   <span className="text-xs font-mono text-primary font-semibold">{ticket.id}</span>
//                   {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
//                   {ticket.status && <StatusBadge status={ticket.status} />}
//                 </div>
//                 <h3 className="font-semibold truncate">{ticket.title}</h3>
//                 <p className="text-sm text-muted-foreground truncate mt-1">{ticket.description}</p>
//               </div>
//               <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 text-xs text-muted-foreground flex-shrink-0">
//                 {ticket.location && (
//                   <span className="flex items-center gap-1">
//                     <MapPin className="w-3 h-3" />
//                     {ticket.location.split(",")[0]}
//                   </span>
//                 )}
//                 <span className="flex items-center gap-1">
//                   <Clock className="w-3 h-3" />
//                   {new Date(ticket.updated_at).toLocaleDateString()}
//                 </span>
//                 {ticket.profiles?.full_name && (
//                   <span>{ticket.profiles.full_name}</span>
//                 )}
//               </div>
//             </Link>
//           </motion.div>
//         ))}

//         {filtered.length === 0 && (
//           <div className="text-center py-12 text-muted-foreground">
//             {complaints?.length === 0
//               ? "No complaints found. Create your first one!"
//               : "No complaints match your filters."}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ComplaintsList;

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Filter, Plus, MapPin, Clock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";


const statusFilters = [
  "all",
  "unassigned",
  "assigned",
  "in-progress",
  "dispatched",
  "completed",
  "closed"
];

const ComplaintsList = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { user, isRole } = useAuth();

  // 🔐 Fetch complaints based on user role
  const { data: complaints, isLoading, error, refetch } = useQuery({
    queryKey: ["complaints", statusFilter, user?.id, user?.role],
    queryFn: async () => {
      let allComplaints = await complaintService.getAll();

      // 🔐 ROLE-BASED FILTERING
      if (isRole("customer")) {
        // Customers see ONLY their own complaints
        allComplaints = allComplaints.filter(t => t.customer_id === user?.id);
      } else if (isRole("technician")) {
        // Technicians see ONLY complaints assigned to them
        allComplaints = allComplaints.filter(t =>
          t.assigned_technician === user?.name ||
          t.assigned_technician === user?.email?.split('@')[0]
        );
      }
      // Admin & Supervisor see ALL complaints (no filter)

      return allComplaints;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const debouncedSearch = useDebounce(search, 300);

  // Client-side search and status filter using debounced value
  const filtered = complaints?.filter((t) => {
    const matchSearch =
      t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.id?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchStatus = statusFilter === "all" || t.status === statusFilter;

    return matchSearch && matchStatus;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading complaints...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        <p>Error loading complaints: {error.message}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">
            {isRole("customer") ? "My Complaints" : "Complaints"}
          </h1>
          <p className="text-muted-foreground">
            {isRole("customer")
              ? "Track your service requests"
              : isRole("technician")
                ? "View your assigned tickets"
                : "Manage service tickets and complaints"
            }
          </p>
        </div>

        {/* 🔐 Only Admin/Supervisor can create complaints for others */}
        {isRole("admin", "supervisor") && (
          <Link to="/complaints/new">
            <Button className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> New Complaint
            </Button>
          </Link>
        )}
      </div>

      {/* 🔐 Filters - Show only for Admin/Supervisor */}
      {isRole("admin", "supervisor") && (
        <div className="glass-card rounded-xl p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticket ID, title, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${statusFilter === s
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
              >
                {s === "all" ? "All" : s.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tickets List */}
      <div className="space-y-3">
        {filtered.map((ticket, i) => (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/complaints/${ticket.id}`}
              className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-glow transition-all duration-300 block"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-primary font-semibold">
                    {ticket.id.slice(0, 8)}...
                  </span>
                  {ticket.severity && <SeverityBadge severity={ticket.severity as any} />}
                  {ticket.status && <StatusBadge status={ticket.status} />}
                </div>
                <h3 className="font-semibold truncate">{ticket.title}</h3>
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {ticket.description}
                </p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 text-xs text-muted-foreground flex-shrink-0">
                {ticket.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {ticket.location.split(",")[0]}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(ticket.updated_at).toLocaleDateString()}
                </span>
                {ticket.profiles?.full_name && (
                  <span>{ticket.profiles.full_name}</span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {complaints?.length === 0
              ? isRole("customer")
                ? "You haven't submitted any complaints yet."
                : isRole("technician")
                  ? "No complaints assigned to you."
                  : "No complaints found. Create your first one!"
              : "No complaints match your filters."}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintsList;
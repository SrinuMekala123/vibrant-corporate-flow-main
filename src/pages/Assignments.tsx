import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, Wrench, ClipboardList, Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "@/components/Badges";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";

const Assignments = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

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
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentUserProfile = profiles?.find((p: any) => p.id === user?.id);
  const isSupervisor = currentUserProfile?.role === 'supervisor';

  const supervisors = (profiles?.filter((p: any) => p.role === 'supervisor') || []).filter((s: any) => {
    if (isSupervisor) {
      return s.id === user?.id;
    }
    return true;
  });

  const technicians = (profiles?.filter((p: any) => p.role === 'technician') || []).filter((tech: any) => {
    if (isSupervisor) {
      const supExpertise = currentUserProfile?.expertise;
      // General technicians: no expertise, empty, or includes "general"
      if (!tech.expertise || tech.expertise.trim() === "" || tech.expertise.toLowerCase().includes("general")) {
        return true;
      }
      if (!supExpertise) {
        return false;
      }
      const supFields = supExpertise.split(",").map(f => f.trim().toLowerCase()).filter(Boolean);
      const techFields = tech.expertise.split(",").map(f => f.trim().toLowerCase()).filter(Boolean);
      return techFields.some(tf => supFields.includes(tf));
    }
    return true; // Admin views all technicians
  });

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredSupervisors = supervisors.filter((member: any) =>
    (member.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.expertise || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTechnicians = technicians.filter((member: any) =>
    (member.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.expertise || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Assignments</h1>
          <p className="text-muted-foreground">Team dispatch and workload overview</p>
        </div>
        
        {/* Search filter input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or expertise..."
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Supervisors */}
      <div className="space-y-4">
        <h2 className="font-display font-semibold text-lg text-slate-800 border-b pb-2">Supervisors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSupervisors.map((member: any, i: number) => {
            const tickets = complaints?.filter((t) => t.assigned_supervisor === member.full_name) || [];
            const activeTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'completed');
            const isExpanded = !!expandedCards[member.id];
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleCard(member.id)}
                className="glass-card rounded-xl p-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all select-none"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full gradient-cool flex items-center justify-center text-sm font-bold text-primary-foreground uppercase">
                    {member.full_name?.charAt(0) || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-primary" /> {member.expertise || 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{member.phone || 'N/A'}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-indigo-500" />{member.email}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5 text-primary" /> {tickets.length} assigned ({activeTickets.length} active)
                  </span>
                  <span className={member.available ? "text-success font-semibold" : "text-muted-foreground font-semibold"}>
                    {member.available ? "Available" : "Busy"}
                  </span>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-4 border-t border-slate-200 pt-4"
                      onClick={(e) => e.stopPropagation()} // Prevent card collapse when clicking inside details
                    >
                      <p className="text-xs font-semibold text-slate-700 mb-2">Assigned Tickets ({tickets.length})</p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {tickets.map((t) => (
                          <Link 
                            key={t.id} 
                            to={`/complaints/${t.id}`} 
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/75 border border-slate-100 hover:border-slate-200 transition-colors text-sm"
                          >
                            <span className="truncate flex-1 font-medium">{t.id.slice(0, 8)}... — {t.title}</span>
                            <StatusBadge status={t.status} />
                          </Link>
                        ))}
                        {tickets.length === 0 && <p className="text-xs text-muted-foreground italic py-1">No assigned tickets</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        {filteredSupervisors.length === 0 && (
          <p className="text-sm text-muted-foreground italic border border-dashed rounded-xl p-6 text-center">No supervisors match the search criteria.</p>
        )}
      </div>

      {/* Technicians */}
      <div className="space-y-4">
        <h2 className="font-display font-semibold text-lg text-slate-800 border-b pb-2">Field Technicians</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechnicians.map((member: any, i: number) => {
            const tickets = complaints?.filter((t) => t.assigned_technician === member.full_name) || [];
            const activeTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'completed');
            const isExpanded = !!expandedCards[member.id];
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleCard(member.id)}
                className="glass-card rounded-xl p-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all select-none"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full gradient-warm flex items-center justify-center text-sm font-bold text-primary-foreground uppercase">
                    {member.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-primary" /> {member.expertise || 'General'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${member.available ? "bg-success" : "bg-muted-foreground"}`} />
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{member.phone || 'N/A'}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-indigo-500" />{member.email}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5 text-primary" /> {tickets.length} assigned ({activeTickets.length} active)
                  </span>
                  <span className={member.available ? "text-success font-semibold" : "text-muted-foreground font-semibold"}>
                    {member.available ? "Available" : "Busy"}
                  </span>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-4 border-t border-slate-200 pt-4"
                      onClick={(e) => e.stopPropagation()} // Prevent card collapse when clicking inside details
                    >
                      <p className="text-xs font-semibold text-slate-700 mb-2">All Assigned Tickets ({tickets.length})</p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {tickets.map((t) => (
                          <Link 
                            key={t.id} 
                            to={`/complaints/${t.id}`} 
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/75 border border-slate-100 hover:border-slate-200 transition-colors text-sm"
                          >
                            <span className="truncate flex-1 font-medium">{t.id.slice(0, 8)}... — {t.title}</span>
                            <StatusBadge status={t.status} />
                          </Link>
                        ))}
                        {tickets.length === 0 && <p className="text-xs text-muted-foreground italic py-1">No assigned tickets</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        {filteredTechnicians.length === 0 && (
          <p className="text-sm text-muted-foreground italic border border-dashed rounded-xl p-6 text-center">No technicians match the search criteria.</p>
        )}
      </div>
    </div>
  );
};

export default Assignments;
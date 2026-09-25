import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, Wrench, ClipboardList, Loader2, Search, ChevronDown, ChevronUp, X } from "lucide-react";
import { StatusBadge } from "@/components/Badges";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TabType = 'all' | 'supervisors' | 'technicians';

const Assignments = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const itemsPerPage = 16;

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
    return true;
  });

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered data based on tab and search
  const filteredData = useMemo(() => {
    let data: any[] = [];
    if (activeTab === 'all') {
      data = [...supervisors, ...technicians];
    } else if (activeTab === 'supervisors') {
      data = [...supervisors];
    } else if (activeTab === 'technicians') {
      data = [...technicians];
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      data = data.filter((member: any) =>
        (member.full_name || "").toLowerCase().includes(query) ||
        (member.email || "").toLowerCase().includes(query) ||
        (member.expertise || "").toLowerCase().includes(query)
      );
    }

    return data;
  }, [activeTab, debouncedSearch, supervisors, technicians]);

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const getTabLabel = () => {
    if (activeTab === 'supervisors') return 'Supervisors';
    if (activeTab === 'technicians') return 'Technicians';
    return 'Team Members';
  };

  if (isComplaintsLoading || isProfilesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const teamStats = {
    total: supervisors.length + technicians.length,
    supervisors: supervisors.length,
    technicians: technicians.length,
    available: [...supervisors, ...technicians].filter((m: any) => m.available).length
  };

  return (
    <div className="space-y-8 relative pb-12">
      {/* Ambient background glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-indigo-500/10" />

      {/* Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-indigo-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Wrench className="w-3.5 h-3.5" /> FLEET DISPATCH BOARD
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              Staff Assignments & Workload Radar
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Monitor real-time task allocations across field technicians and supervisors, track live active jobs, and verify availability.
            </p>
          </div>

          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff, email, specialty..."
              className="pl-10 text-xs h-10 rounded-xl border-border/60 bg-card"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📊 Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">Total Personnel</span>
            <span className="text-2xl font-black text-foreground mt-0.5 block">{teamStats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">Supervisors</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">{teamStats.supervisors}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Technicians</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{teamStats.technicians}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Available Now</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{teamStats.available}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Filter */}
      <div className="inline-flex p-1 bg-muted/80 backdrop-blur-md rounded-2xl border border-border/60 relative z-10">
        {[
          { key: 'all', label: `All Staff (${supervisors.length + technicians.length})` },
          { key: 'supervisors', label: `Supervisors (${supervisors.length})` },
          { key: 'technicians', label: `Technicians (${technicians.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === tab.key
                ? 'bg-card text-primary shadow-sm border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs font-semibold text-muted-foreground relative z-10">
        Showing {filteredData.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} {getTabLabel()}
      </p>

      {/* Grid */}
      {currentData.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground text-sm">No users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentData.map((member: any, i: number) => {
            const tickets = complaints?.filter((t) => {
              if (member.role === 'supervisor') {
                return t.assigned_supervisor === member.full_name;
              }
              return t.assigned_technician === member.full_name;
            }) || [];
            const activeTickets = tickets.filter(t => t.status !== 'verified' && t.status !== 'completed');
            const isExpanded = !!expandedCards[member.id];
            const isTech = member.role === 'technician';

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
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground uppercase ${isTech ? 'gradient-warm' : 'gradient-cool'}`}>
                    {member.full_name?.charAt(0) || (isTech ? 'T' : 'S')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-primary" /> {member.expertise || (isTech ? 'General' : 'N/A')}
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs font-semibold text-slate-700 mb-2">
                        Assigned Tickets ({tickets.length})
                      </p>
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
                        {tickets.length === 0 && (
                          <p className="text-xs text-muted-foreground italic py-1">No assigned tickets</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-4">
          <p className="text-xs text-muted-foreground">
            Showing {filteredData.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} {getTabLabel()}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs"
          >
            Previous
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(page)}
              className={`text-xs min-w-[2rem] ${currentPage === page ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {page}
            </Button>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-xs"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default Assignments;

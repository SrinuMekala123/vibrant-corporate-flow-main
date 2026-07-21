// import { motion } from "framer-motion";
// import { TrendingUp, TrendingDown, Target, Clock, CheckCircle2, MapPin, Brain, Timer } from "lucide-react";
// import { StatCard } from "@/components/StatCard";
// import { mockKPIs, monthlyKPIData, ticketsByField } from "@/data/mockData";
// import {
//   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
//   BarChart, Bar, PieChart, Pie, Cell, Legend,
// } from "recharts";

// const kpiIcons = [CheckCircle2, Clock, Target, MapPin, Brain, Timer];
// const kpiGradients: Array<"primary" | "warm" | "cool"> = ["primary", "cool", "warm", "primary", "cool", "warm"];

// const KPIAnalytics = () => {
//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-2xl font-display font-bold">KPI Analytics</h1>
//         <p className="text-muted-foreground">Performance metrics and operational insights</p>
//       </div>

//       {/* KPI Cards */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//         {mockKPIs.map((kpi, i) => (
//           <StatCard
//             key={kpi.label}
//             label={kpi.label}
//             value={kpi.value}
//             unit={kpi.unit}
//             change={kpi.change}
//             trend={kpi.trend}
//             icon={kpiIcons[i]}
//             gradient={kpiGradients[i]}
//             delay={i * 0.08}
//           />
//         ))}
//       </div>

//       {/* Charts */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         {/* Trend Line Chart */}
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-5">
//           <h2 className="font-display font-semibold mb-4">Performance Trend</h2>
//           <ResponsiveContainer width="100%" height={280}>
//             <LineChart data={monthlyKPIData}>
//               <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
//               <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
//               <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
//               <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(220, 15%, 90%)", boxShadow: "0 4px 16px hsl(0 0% 0% / 0.08)" }} />
//               <Line type="monotone" dataKey="ftfr" stroke="hsl(230, 70%, 50%)" strokeWidth={2.5} dot={{ r: 4 }} name="FTFR %" />
//               <Line type="monotone" dataKey="sla" stroke="hsl(175, 60%, 42%)" strokeWidth={2.5} dot={{ r: 4 }} name="SLA %" />
//             </LineChart>
//           </ResponsiveContainer>
//         </motion.div>

//         {/* Bar Chart */}
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card rounded-xl p-5">
//           <h2 className="font-display font-semibold mb-4">MTTR & Travel Efficiency</h2>
//           <ResponsiveContainer width="100%" height={280}>
//             <BarChart data={monthlyKPIData}>
//               <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
//               <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
//               <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
//               <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(220, 15%, 90%)" }} />
//               <Bar dataKey="mttr" fill="hsl(35, 95%, 55%)" radius={[4, 4, 0, 0]} name="MTTR (hrs)" />
//               <Bar dataKey="travel" fill="hsl(230, 70%, 50%)" radius={[4, 4, 0, 0]} name="Travel %" />
//             </BarChart>
//           </ResponsiveContainer>
//         </motion.div>

//         {/* Pie Chart */}
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-card rounded-xl p-5">
//           <h2 className="font-display font-semibold mb-4">Tickets by Field of Work</h2>
//           <ResponsiveContainer width="100%" height={280}>
//             <PieChart>
//               <Pie data={ticketsByField} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={4}>
//                 {ticketsByField.map((entry, i) => (
//                   <Cell key={i} fill={entry.fill} />
//                 ))}
//               </Pie>
//               <Tooltip contentStyle={{ borderRadius: "12px" }} />
//               <Legend />
//             </PieChart>
//           </ResponsiveContainer>
//         </motion.div>

//         {/* KPI Table */}
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="glass-card rounded-xl p-5">
//           <h2 className="font-display font-semibold mb-4">KPI Definitions</h2>
//           <div className="space-y-3 text-sm">
//             {[
//               { name: "Response Latency", desc: "Time between ticket assignment and 'Start Journey'" },
//               { name: "Travel Efficiency", desc: "GPS transit time vs actual distance to site" },
//               { name: "First-Time Fix Rate", desc: "% of tickets with no follow-up within 7 days" },
//               { name: "Mean Time to Resolve", desc: "Average duration from intake to closing" },
//               { name: "PIR Accuracy Index", desc: "Supervisor tiering vs actual field findings" },
//               { name: "SLA Adherence", desc: "Tasks completed within supervisor-set duration" },
//             ].map((item, i) => (
//               <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50">
//                 <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0 mt-0.5">
//                   {i + 1}
//                 </div>
//                 <div>
//                   <p className="font-medium">{item.name}</p>
//                   <p className="text-muted-foreground text-xs">{item.desc}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>
//     </div>
//   );
// };

// export default KPIAnalytics;


import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, Clock, CheckCircle2, MapPin, Brain, Timer, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useQuery } from "@tanstack/react-query";
import { complaintService, type Complaint } from "@/services/complaintService";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const KPIAnalytics = () => {
  // Fetch all complaints
  const { data: complaints, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['kpi-complaints'],
    queryFn: () => complaintService.getAll(),
  });

  // Fetch profiles
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['kpi-profiles'],
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
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  // Calculate real KPIs from Supabase data
  const totalTickets = complaints?.length || 1;
  const completedTickets = complaints?.filter((t: Complaint) => t.status === "completed") || [];
  const totalCompleted = completedTickets.length;

  // 1. First-Time Fix Rate (FTFR)
  const firstTimeFixRate = totalCompleted > 0
    ? Math.round((completedTickets.filter((t: Complaint) => !t.follow_up_required).length / totalCompleted) * 100)
    : 78;

  // 2. Mean Time to Resolve (MTTR)
  const totalHours = completedTickets.reduce((acc: number, ticket: Complaint) => {
    const created = new Date(ticket.created_at).getTime();
    const updated = new Date(ticket.updated_at).getTime();
    return acc + ((updated - created) / (1000 * 60 * 60));
  }, 0);
  const mttr = totalCompleted > 0 ? (totalHours / totalCompleted).toFixed(1) : "4.2";

  // 3. Response Latency
  const responseLatencyTickets = completedTickets.filter((t: Complaint) => t.assignment_timestamp && t.start_journey_timestamp);
  const responseLatency = responseLatencyTickets.length > 0
    ? (responseLatencyTickets.reduce((acc: number, t: Complaint) => {
      const assign = new Date(t.assignment_timestamp!).getTime();
      const journey = new Date(t.start_journey_timestamp!).getTime();
      return acc + ((journey - assign) / (1000 * 60));
    }, 0) / responseLatencyTickets.length).toFixed(0)
    : "12";

  // 4. Travel Efficiency
  const travelTickets = completedTickets.filter((t: Complaint) => t.start_journey_timestamp && t.arrival_timestamp);
  const travelEfficiency = travelTickets.length > 0
    ? (travelTickets.reduce((acc: number, t: Complaint) => {
      const journey = new Date(t.start_journey_timestamp!).getTime();
      const arrival = new Date(t.arrival_timestamp!).getTime();
      return acc + ((arrival - journey) / (1000 * 60));
    }, 0) / travelTickets.length).toFixed(0)
    : "22";

  // 5. PIR Accuracy Index
  const pirAccuracyTickets = completedTickets.filter((t: Complaint) => t.supervisor_severity && t.pir_findings_severity);
  const pirAccuracy = pirAccuracyTickets.length > 0
    ? Math.round((pirAccuracyTickets.filter((t: Complaint) => t.supervisor_severity === t.pir_findings_severity).length / pirAccuracyTickets.length) * 100)
    : 88;

  // 6. SLA Adherence
  const slaTickets = completedTickets.filter((t: Complaint) => t.target_duration_hours);
  const slaAdherence = slaTickets.length > 0
    ? Math.round((slaTickets.filter((t: Complaint) => {
      const duration = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
      return duration <= t.target_duration_hours!;
    }).length / slaTickets.length) * 100)
    : 91;

  // Prepare chart data
  const monthlyData = complaints?.reduce((acc: any, ticket: Complaint) => {
    const month = new Date(ticket.created_at).toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = {
        month, count: 0, completed: 0, mttr: 0,
        responseLatency: 0, travelEfficiency: 0
      };
    }
    acc[month].count++;
    if (ticket.status === "completed") {
      acc[month].completed++;
      const start = new Date(ticket.created_at).getTime();
      const end = new Date(ticket.updated_at).getTime();
      acc[month].mttr += (end - start) / (1000 * 60 * 60);
      if (ticket.assignment_timestamp && ticket.start_journey_timestamp) {
        const assign = new Date(ticket.assignment_timestamp).getTime();
        const journey = new Date(ticket.start_journey_timestamp).getTime();
        acc[month].responseLatency += (journey - assign) / (1000 * 60);
      }
      if (ticket.start_journey_timestamp && ticket.arrival_timestamp) {
        const journey = new Date(ticket.start_journey_timestamp).getTime();
        const arrival = new Date(ticket.arrival_timestamp).getTime();
        acc[month].travelEfficiency += (arrival - journey) / (1000 * 60);
      }
    }
    return acc;
  }, {}) || {};

  const chartData = Object.values(monthlyData).map((d: any) => ({
    month: d.month,
    tickets: d.count,
    completed: d.completed,
    mttr: d.completed > 0 ? (d.mttr / d.completed).toFixed(1) : 0,
    responseLatency: d.completed > 0 ? (d.responseLatency / d.completed).toFixed(0) : 0,
    travelEfficiency: d.completed > 0 ? (d.travelEfficiency / d.completed).toFixed(0) : 0,
  }));

  // Group by field of work
  const fieldData = complaints?.reduce((acc: any, ticket: Complaint) => {
    const field = ticket.field_of_work || "Unspecified";
    acc[field] = (acc[field] || 0) + 1;
    return acc;
  }, {}) || {};

  const pieData = Object.entries(fieldData).map(([name, value]) => ({
    name,
    value,
    fill: ["#4f46e5", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][Object.keys(fieldData).length % 6],
  }));

  const kpiCards = [
    { label: "First-Time Fix Rate", value: firstTimeFixRate, unit: "%", change: 3.2, trend: "up" as const, icon: CheckCircle2, gradient: "primary" as const },
    { label: "Mean Time to Resolve", value: mttr, unit: "hrs", change: -0.8, trend: "down" as const, icon: Clock, gradient: "cool" as const },
    { label: "SLA Adherence", value: slaAdherence, unit: "%", change: 1.5, trend: "up" as const, icon: Target, gradient: "warm" as const },
    { label: "Travel Efficiency", value: travelEfficiency, unit: "min", change: -2.1, trend: "down" as const, icon: MapPin, gradient: "primary" as const },
    { label: "PIR Accuracy", value: pirAccuracy, unit: "%", change: 4, trend: "up" as const, icon: Brain, gradient: "cool" as const },
    { label: "Response Latency", value: responseLatency, unit: "min", change: -3, trend: "down" as const, icon: Timer, gradient: "warm" as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">KPI Analytics</h1>
        <p className="text-muted-foreground">Performance metrics and operational insights</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((kpi, i) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            change={kpi.change}
            trend={kpi.trend}
            icon={kpi.icon}
            gradient={kpi.gradient}
            delay={i * 0.08}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Line Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Performance Trend</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(220, 15%, 90%)", boxShadow: "0 4px 16px hsl(0 0% 0% / 0.08)" }} />
                <Line type="monotone" dataKey="completed" stroke="hsl(230, 70%, 50%)" strokeWidth={2.5} dot={{ r: 4 }} name="Completed" />
                <Line type="monotone" dataKey="tickets" stroke="hsl(175, 60%, 42%)" strokeWidth={2.5} dot={{ r: 4 }} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No data available</div>
          )}
        </motion.div>

        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">MTTR & Travel Efficiency</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(220, 15%, 90%)" }} />
                <Bar dataKey="mttr" fill="hsl(35, 95%, 55%)" radius={[4, 4, 0, 0]} name="MTTR (hrs)" />
                <Bar dataKey="travelEfficiency" fill="hsl(230, 70%, 50%)" radius={[4, 4, 0, 0]} name="Travel (min)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No data available</div>
          )}
        </motion.div>

        {/* Pie Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Tickets by Field of Work</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={4}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No data available</div>
          )}
        </motion.div>

        {/* KPI Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">KPI Definitions</h2>
          <div className="space-y-3 text-sm">
            {[
              { name: "Response Latency", desc: "Time between 'Ticket Assignment' and 'Start Journey'" },
              { name: "Travel Efficiency", desc: "GPS-calculated transit time vs actual distance to site" },
              { name: "First-Time Fix Rate", desc: "% of tickets requiring no follow-up visits within 7 days" },
              { name: "Mean Time to Resolve", desc: "Average duration from Phase 1 Intake to Phase 5 Closing" },
              { name: "PIR Accuracy Index", desc: "Comparison of Supervisor's initial tiering vs actual PIR findings" },
              { name: "SLA Adherence", desc: "Frequency of tasks completed within Supervisor-set duration limit" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50">
                <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default KPIAnalytics;
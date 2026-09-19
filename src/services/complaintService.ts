// import { supabase } from "@/lib/supabase";

// export interface Complaint {
//   id: string;
//   customer_id: string;
//   customer_name?: string;
//   customer_phone?: string;
//   title: string;
//   description: string;
//   status: string;
//   severity?: string;
//   field_of_work?: string;
//   location?: string;
//   assigned_supervisor?: string;
//   assigned_technician?: string;
//   current_phase: number;
//   resolution?: string;
//   pir_findings?: string;
//   pir_audio_url?: string;
//   evidence_urls?: string[];
//   signature_url?: string;
//   triage_outcome?: 'remote_fixed' | 'field_required';
//   assignment_timestamp?: string;
//   start_journey_timestamp?: string;
//   arrival_timestamp?: string;
//   signoff_timestamp?: string;
//   arrival_lat?: number;
//   arrival_lng?: number;
//   follow_up_required?: boolean;
//   supervisor_severity?: string;
//   pir_findings_severity?: string;
//   target_duration_hours?: number;
//   created_at: string;
//   updated_at: string;
  
//   // 🔥 NEW: Universal Feedback Fields
//   feedback_collected?: boolean;
//   customer_satisfaction?: 'satisfied' | 'partially_satisfied' | 'unsatisfied';
//   feedback_comments?: string;
//   feedback_contact_method?: 'phone' | 'email' | 'whatsapp' | 'sms' | 'in_person';
//   feedback_timestamp?: string;
//   closure_timestamp?: string;
//   closed_by?: string;
  
//   profiles?: {
//     full_name: string;
//     email: string;
//     phone?: string;
//   };
// }

// export const complaintService = {
//   // Get all complaints
//   getAll: async (): Promise<Complaint[]> => {
//     const { data, error } = await supabase
//       .from("complaints")
//       .select(`
//         *,
//         profiles:customer_id (
//           full_name,
//           email,
//           phone
//         )
//       `)
//       .order("created_at", { ascending: false });

//     if (error) throw error;
//     return data || [];
//   },

//   // Get complaint by ID
//   getById: async (id: string): Promise<Complaint> => {
//     const { data, error } = await supabase
//       .from("complaints")
//       .select(`
//         *,
//         profiles:customer_id (
//           full_name,
//           email,
//           phone
//         )
//       `)
//       .eq("id", id)
//       .single();

//     if (error) throw error;
//     return data;
//   },

//   // Create new complaint
//   create: async (complaint: Partial<Complaint>): Promise<Complaint> => {
//     const { data, error } = await supabase
//       .from("complaints")
//       .insert([complaint])
//       .select()
//       .single();

//     if (error) throw error;
//     return data;
//   },

//   // Update complaint
//   update: async (id: string, updates: Partial<Complaint>): Promise<Complaint> => {
//     const { data, error } = await supabase
//       .from("complaints")
//       .update(updates)
//       .eq("id", id)
//       .select()
//       .single();

//     if (error) throw error;
//     return data;
//   },

//   // Delete complaint
//   delete: async (id: string): Promise<void> => {
//     const { error } = await supabase
//       .from("complaints")
//       .delete()
//       .eq("id", id);

//     if (error) throw error;
//   },
// };

import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, getComplaintCreatedMessage } from "@/utils/whatsappService";

export interface Complaint {
  id: string;
  ticket_id?: string;
  customer_id?: string | null;
  customer_type?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  created_by_name?: string;
  title: string;
  description: string;
  status: string;
  severity?: string;
  priority?: string;
  field_of_work?: string;
  coverage?: string;
  chargeable_service?: string | boolean;
  brand?: string;
  service_charge?: number;
  payment_status?: string;
  location?: string;
  assigned_supervisor?: string;
  assigned_technician?: string;
  current_phase: number;
  resolution?: string;
  resolution_notes?: string;
  supervisor_notes?: string;
  resolved_remotely?: boolean;
  resolution_type?: string;
  resolved_at?: string;
  resolved_by?: string;
  pir_findings?: string;
  pir_audio_url?: string;
  complaint_images?: string[];      // Initial images (Before)
  technician_evidence?: string[];   // Technician images (After)
  signature_url?: string;
  triage_outcome?: 'remote_fixed' | 'field_required';
  pir_decision_tree?: string;
  assignment_timestamp?: string;
  start_journey_timestamp?: string;
  arrival_timestamp?: string;
  signoff_timestamp?: string;
  arrival_lat?: number;
  arrival_lng?: number;
  
  // 🔥 NEW: Customer GPS Coordinates for Enhanced Navigation
  customer_lat?: number;
  customer_lng?: number;
  
  follow_up_required?: boolean;
  supervisor_severity?: string;
  pir_findings_severity?: string;
  target_duration_hours?: number;
  target_end_time?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  assigned_to?: string | null;
  location_id?: string | null;
  pir_status?: 'pending' | 'submitted' | 'pending_approval' | 'resubmitted' | 'approved' | 'rejected' | 'revision_requested' | string | null;
  pir_revision_notes?: string | null;
  pir_revision_requested_by?: string | null;
  pir_revision_requested_at?: string | null;
  pir_resubmitted_at?: string | null;
  pir_approved_at?: string | null;
  pir_approved_by?: string | null;
  created_at: string;
  updated_at: string;
  
  // Universal Feedback Fields
  feedback_collected?: boolean;
  customer_satisfaction?: 'satisfied' | 'partially_satisfied' | 'unsatisfied';
  feedback_comments?: string;
  feedback_contact_method?: 'phone' | 'email' | 'whatsapp' | 'sms' | 'in_person';
  feedback_timestamp?: string;
  closure_timestamp?: string;
  closed_by?: string;
  
  happiness_code?: string | null;
  happiness_code_sent_at?: string | null;
  happiness_code_verified?: boolean;
  
  force_closed?: boolean;
  force_closed_by?: string | null;
  force_closure_reason?: string | null;
  
  closed_at?: string | null;
  reassignment_reason?: string | null;
  complaint_technicians?: {
    id?: string;
    complaint_id?: string;
    technician_id: string;
    is_lead?: boolean;
    phase?: number;
    assigned_at?: string;
    technician?: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
      technician_id?: string;
      designation?: string;
    };
    profiles?: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
      technician_id?: string;
      designation?: string;
    };
  }[];

  profiles?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

export const getTicketIdMap = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem("btl_ticket_id_map") || "{}");
  } catch {
    return {};
  }
};

export const setTicketIdMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem("btl_ticket_id_map", JSON.stringify(map));
  } catch (e) {
    // ignore
  }
};

export const enrichComplaintsWithTicketIds = (complaints: Complaint[]): Complaint[] => {
  if (!complaints || complaints.length === 0) return complaints;

  const currentYear = new Date().getFullYear();
  const idMap = getTicketIdMap();
  let updatedMap = false;

  // Group complaints by year
  const complaintsByYear: Record<number, Complaint[]> = {};
  complaints.forEach((c) => {
    const yr = c.created_at ? new Date(c.created_at).getFullYear() : currentYear;
    if (!complaintsByYear[yr]) complaintsByYear[yr] = [];
    complaintsByYear[yr].push(c);
  });

  for (const [yrStr, list] of Object.entries(complaintsByYear)) {
    const yr = parseInt(yrStr, 10);
    const prefix = `BTL-CMS-${yr}-`;
    const storageKey = `btl_cms_last_seq_${yr}`;

    // Sort chronologically ascending to assign sequential numbers from oldest to newest
    const sortedAsc = [...list].sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

    let assignedIndex = 1;
    sortedAsc.forEach((c) => {
      let finalId = c.ticket_id;
      if (finalId && typeof finalId === "string" && finalId.startsWith(prefix)) {
        const numPart = parseInt(finalId.replace(prefix, ""), 10);
        if (!isNaN(numPart)) {
          finalId = `${prefix}${String(numPart).padStart(7, "0")}`;
        }
      } else if (idMap[c.id]) {
        finalId = idMap[c.id];
      } else {
        finalId = `${prefix}${String(assignedIndex).padStart(7, "0")}`;
        idMap[c.id] = finalId;
        updatedMap = true;
      }

      c.ticket_id = finalId;
      idMap[c.id] = finalId;
      assignedIndex++;
    });

    const maxForYear = Math.max(sortedAsc.length, assignedIndex - 1);
    localStorage.setItem(storageKey, String(maxForYear));
  }

  if (updatedMap) {
    setTicketIdMap(idMap);
  }

  return complaints;
};

export const generateNextTicketId = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const prefix = `BTL-CMS-${currentYear}-`;
  const storageKey = `btl_cms_last_seq_${currentYear}`;
  
  let maxNumber = 0;
  
  // 1. Ultra-fast query: get highest ticket_id for this year prefix directly with limit 1
  try {
    const { data: latestRow } = await supabase
      .from('complaints')
      .select('ticket_id')
      .ilike('ticket_id', `${prefix}%`)
      .order('ticket_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestRow?.ticket_id) {
      const match = latestRow.ticket_id.match(/BTL-CMS-\d+-(\d+)/i);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNumber) {
          maxNumber = parsed;
        }
      }
    }

    // Fast count query without downloading table payload
    const { count } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true });

    if (typeof count === 'number' && count > maxNumber) {
      maxNumber = count;
    }
  } catch (error) {
    console.warn('Fast ticket ID query failed, using sequence cache:', error);
  }

  // 2. Check idMap cache
  const idMap = getTicketIdMap();
  Object.values(idMap).forEach((val) => {
    if (typeof val === "string" && val.startsWith(prefix)) {
      const num = parseInt(val.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  
  // 3. Prevent duplicate IDs within same session / race conditions
  const storedSeq = parseInt(localStorage.getItem(storageKey) || "0", 10);
  if (!isNaN(storedSeq) && storedSeq > maxNumber) {
    maxNumber = storedSeq;
  }
  
  // Increment by 1
  const nextNumber = maxNumber + 1;
  localStorage.setItem(storageKey, String(nextNumber));
  
  // Zero-pad to 7 digits
  const paddedNumber = String(nextNumber).padStart(7, '0');
  
  return `${prefix}${paddedNumber}`;
};

export const formatComplaintTicketId = (ticket?: { ticket_id?: string | null; id?: string; created_at?: string } | null): string => {
  if (!ticket) return "BTL-CMS-N/A";
  if (ticket.ticket_id && ticket.ticket_id.trim()) {
    const parts = ticket.ticket_id.split('-');
    if (parts.length >= 3) {
      const numPart = parts[parts.length - 1];
      const num = parseInt(numPart, 10);
      if (!isNaN(num)) {
        return `${parts.slice(0, -1).join('-')}-${String(num).padStart(7, '0')}`;
      }
    }
    return ticket.ticket_id;
  }

  if (ticket.id) {
    const idMap = getTicketIdMap();
    if (idMap[ticket.id]) {
      return idMap[ticket.id];
    }
  }

  const year = ticket.created_at ? new Date(ticket.created_at).getFullYear() : new Date().getFullYear();
  return `BTL-CMS-${year}-0000001`;
};

export const complaintService = {
  // Get all complaints
  getAll: async (): Promise<Complaint[]> => {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select(`
          *,
          profiles:customer_id (
            full_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return enrichComplaintsWithTicketIds(data || []);
    } catch (err) {
      console.warn("getAll fallback:", err);
      const { data } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });
      return enrichComplaintsWithTicketIds(data || []);
    }
  },

  // Fetch technicians for a complaint with graceful fallback if table missing
  fetchTechnicians: async (complaintId: string) => {
    try {
      const { data, error } = await supabase
        .from("complaint_technicians")
        .select(`
          id,
          complaint_id,
          technician_id,
          is_lead,
          phase,
          assigned_at,
          technician:technician_id (
            id,
            full_name,
            email,
            phone
          )
        `)
        .eq("complaint_id", complaintId);

      if (error) {
        if (error.code === "42P01" || error.code === "PGRST200" || error.message?.includes("does not exist")) {
          return [];
        }
        return [];
      }

      return data || [];
    } catch (err) {
      return [];
    }
  },

  // Get complaint by ID
  getById: async (id: string): Promise<Complaint> => {
    const { data, error } = await supabase
      .from("complaints")
      .select(`
        *,
        profiles:customer_id (
          full_name,
          email,
          phone
        )
      `)
      .eq("id", id)
      .single();
    if (error) throw error;

    if (data && !data.ticket_id) {
      const idMap = getTicketIdMap();
      data.ticket_id = idMap[data.id] || formatComplaintTicketId(data);
    }

    // Load assigned technicians safely
    try {
      const techList = await complaintService.fetchTechnicians(id);
      if (techList && techList.length > 0) {
        data.complaint_technicians = techList;
      }
    } catch (e) {
      console.warn("complaint_technicians junction not loaded:", e);
    }

    return data;
  },

  // Create new complaint with auto-generated ticket_id & multi-technicians
  create: async (
    complaint: Partial<Complaint>,
    technicianInput?: Array<string | { technician_id: string; is_lead?: boolean }>
  ): Promise<Complaint> => {
    let ticket_id = complaint.ticket_id;
    if (!ticket_id) {
      try {
        ticket_id = await generateNextTicketId();
      } catch (e) {
        console.warn("Failed to auto-generate ticket_id:", e);
      }
    }

    // Normalize technician list
    const techObjs: Array<{ technician_id: string; is_lead: boolean }> = (technicianInput || []).map((t, idx) => {
      if (typeof t === "string") {
        return { technician_id: t, is_lead: idx === 0 };
      }
      return { technician_id: t.technician_id, is_lead: Boolean(t.is_lead) };
    });

    const leadTech = techObjs.find((t) => t.is_lead) || techObjs[0];
    const primaryTechId = leadTech ? leadTech.technician_id : (complaint.assigned_to || null);

    let primaryTechName = complaint.assigned_technician || null;
    if (primaryTechId && !primaryTechName) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", primaryTechId)
          .maybeSingle();
        if (prof?.full_name) primaryTechName = prof.full_name;
      } catch (e) {
        // ignore
      }
    }

    const isUUID = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const payload: any = {
      ...complaint,
      assigned_to: primaryTechId,
      ...(primaryTechName ? { assigned_technician: primaryTechName } : {}),
      ...(ticket_id ? { ticket_id } : {}),
    };

    // Pre-sanitize known UUID columns
    if (payload.customer_id !== undefined && payload.customer_id !== null && !isUUID(payload.customer_id)) {
      delete payload.customer_id;
    }
    if (payload.assigned_to !== undefined && payload.assigned_to !== null && !isUUID(payload.assigned_to)) {
      delete payload.assigned_to;
    }
    if (payload.assigned_supervisor && isUUID(payload.assigned_supervisor)) {
      try {
        const { data: sProf } = await supabase.from("profiles").select("full_name").eq("id", payload.assigned_supervisor).maybeSingle();
        if (sProf?.full_name) {
          payload.assigned_supervisor = sProf.full_name;
        }
      } catch (e) {
        // ignore
      }
    }

    // Normalize check constraint values
    if (payload.priority) {
      const p = String(payload.priority).toLowerCase();
      payload.priority = ['low', 'medium', 'high', 'urgent'].includes(p) ? p : 'medium';
    }
    if (payload.severity) {
      const s = String(payload.severity).toLowerCase();
      payload.severity = ['minor', 'moderate', 'major'].includes(s) ? s : 'minor';
    }
    if (payload.status) {
      const validStatuses = ['unassigned', 'open', 'assigned', 'in-progress', 'in_progress', 'dispatched', 'completed', 'pir_pending', 'pir_approved', 'rework_required', 'pending_verification', 'closed', 'cancelled', 'pir_submitted_awaiting_approval', 'pir_approved_work_in_progress'];
      if (!validStatuses.includes(payload.status)) {
        payload.status = 'open';
      }
    }

    const optionalColumnsToDrop = [
      'coverage',
      'chargeable_service',
      'service_charge',
      'payment_status',
      'brand',
      'customer_type',
      'customer_email',
      'location_id',
      'scheduled_date',
      'scheduled_time',
      'ticket_id',
      'reassignment_reason',
      'closed_at',
      'pir_approved_by',
      'pir_approved_at',
      'target_end_time',
      'pir_findings_severity',
      'supervisor_severity',
      'target_duration_hours',
      'pir_status',
      'pir_revision_notes',
      'pir_revision_requested_by',
      'pir_revision_requested_at',
      'pir_resubmitted_at',
      'closure_timestamp',
      'closed_by',
      'feedback_collected',
      'customer_satisfaction',
      'feedback_comments',
      'feedback_contact_method',
      'feedback_timestamp',
      'resolved_remotely',
      'resolution_type',
      'resolution_notes',
      'resolved_at',
      'resolved_by',
      'triage_outcome',
      'evidence_urls',
      'technician_evidence',
      'arrival_lat',
      'arrival_lng',
      'arrival_timestamp',
      'start_journey_timestamp',
      'pir_decision_tree',
      'happiness_code',
      'happiness_code_sent_at',
      'happiness_code_verified'
    ];

    let data: any = null;
    let attempts = 0;
    while (attempts < 15) {
      attempts++;
      const res = await supabase.from("complaints").insert([payload]).select().single();
      if (!res.error) {
        data = res.data;
        break;
      }

      console.warn(`Complaint insert attempt ${attempts} error:`, res.error);
      const errMsg = res.error.message || "";
      const errDetails = res.error.details || "";
      const isColErr = 
        res.error.code === "42703" || 
        res.error.code === "PGRST204" || 
        errMsg.toLowerCase().includes("column") || 
        errDetails.toLowerCase().includes("column") ||
        res.error.code === "PGRST100" ||
        errMsg.includes("schema cache");

      const isUuidErr = 
        res.error.code === "22P02" || 
        errMsg.toLowerCase().includes("invalid input syntax for type uuid");

      if (isUuidErr) {
        const match = errMsg.match(/invalid input syntax for type uuid: "([^"]+)"/) || errDetails.match(/invalid input syntax for type uuid: "([^"]+)"/);
        if (match && match[1]) {
          for (const key of Object.keys(payload)) {
            if (String(payload[key]) === match[1]) {
              delete payload[key];
            }
          }
        }
        delete payload.customer_id;
        delete payload.assigned_to;
        continue;
      }

      // Foreign key constraint violation handler (e.g. complaints_customer_id_fkey, complaints_assigned_to_fkey)
      const isFkErr = 
        res.error.code === "23503" || 
        errMsg.toLowerCase().includes("violates foreign key constraint") || 
        errDetails.toLowerCase().includes("violates foreign key constraint") ||
        errMsg.toLowerCase().includes("foreign key") ||
        errDetails.toLowerCase().includes("foreign key");

      if (isFkErr) {
        if (
          errMsg.includes("complaints_customer_id_fkey") || 
          errDetails.includes("complaints_customer_id_fkey") ||
          errMsg.includes("customer_id") || 
          errDetails.includes("customer_id") ||
          (payload.customer_id && attempts <= 3)
        ) {
          console.warn(`Foreign key violation on customer_id '${payload.customer_id}'. Setting customer_id to null and retrying insert...`);
          payload.customer_id = null;
          continue;
        }

        if (
          errMsg.includes("complaints_assigned_to_fkey") || 
          errDetails.includes("complaints_assigned_to_fkey") ||
          errMsg.includes("assigned_to") || 
          errDetails.includes("assigned_to") ||
          payload.assigned_to
        ) {
          console.warn(`Foreign key violation on assigned_to '${payload.assigned_to}'. Setting assigned_to to null and retrying insert...`);
          payload.assigned_to = null;
          continue;
        }

        if (
          errMsg.includes("location_id") || 
          errDetails.includes("location_id") ||
          payload.location_id
        ) {
          console.warn(`Foreign key violation on location_id '${payload.location_id}'. Setting location_id to null and retrying insert...`);
          payload.location_id = null;
          continue;
        }

        // Generic FK fallback: clear customer_id if present
        if (payload.customer_id) {
          console.warn(`General foreign key violation detected. Clearing customer_id and retrying...`);
          payload.customer_id = null;
          continue;
        }
      }

      if (isColErr) {
        const match = errMsg.match(/'([^']+)' column/) || errDetails.match(/'([^']+)' column/) || errMsg.match(/column complaints\.([a-zA-Z0-9_]+) does not exist/);
        if (match && match[1] && payload[match[1]] !== undefined) {
          console.warn(`Stripping missing column '${match[1]}' from complaints insert payload`);
          delete payload[match[1]];
          continue;
        }

        const nextColToDrop = optionalColumnsToDrop.find(c => payload[c] !== undefined);
        if (nextColToDrop) {
          console.warn(`Dropping optional column '${nextColToDrop}' and retrying insert...`);
          delete payload[nextColToDrop];
          continue;
        }
      }

      if (attempts >= 15) {
        throw res.error;
      }
    }

    // Link multiple technicians in complaint_technicians junction table
    if (techObjs.length > 0 && data?.id) {
      try {
        const rows = techObjs.map((t) => ({
          complaint_id: data.id,
          technician_id: t.technician_id,
          is_lead: t.is_lead,
          phase: data.current_phase || 3,
        }));
        const { error: ctErr } = await supabase.from("complaint_technicians").insert(rows);
        if (ctErr && ctErr.code !== "42P01") {
          // If is_lead column is missing, fallback without is_lead
          const fallbackRows = techObjs.map((t) => ({
            complaint_id: data.id,
            technician_id: t.technician_id,
          }));
          await supabase.from("complaint_technicians").insert(fallbackRows);
        }
      } catch (techLinkErr) {
        console.warn("Could not insert complaint_technicians:", techLinkErr);
      }
    }

    // 🔔 Step 1: Automated WhatsApp on Complaint Creation (Registered or Walk-in)
    let targetPhone = data?.customer_phone || complaint.customer_phone || data?.walk_in_phone || complaint.walk_in_phone;
    const custName = data?.customer_name || complaint.customer_name || data?.walk_in_name || complaint.walk_in_name || "Valued Customer";
    const newTicketId = data?.ticket_id || ticket_id || (data?.id ? `#${data.id.slice(0, 8)}` : "CMS-REQ");
    const issueTitle = data?.title || complaint.title || "service request";

    if (!targetPhone && (data?.customer_id || complaint.customer_id)) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", data?.customer_id || complaint.customer_id)
          .maybeSingle();
        if (prof?.phone) targetPhone = prof.phone;
      } catch (e) {
        // ignore
      }
    }

    if (targetPhone) {
      try {
        const createdMessage = getComplaintCreatedMessage({
          customerName: custName,
          ticketId: newTicketId,
        });
        await sendWhatsAppMessage(targetPhone, createdMessage, {
          name: custName,
          ticketId: newTicketId,
          title: issueTitle,
          event_type: "registration",
        });
        console.log("✅ Step 1: Complaint Registration WhatsApp notification sent successfully");
      } catch (whatsappError) {
        console.warn("⚠️ Step 1: WhatsApp registration notification failed:", whatsappError);
        // Do not block ticket creation if WhatsApp fails
      }
    }

    if (data && ticket_id) {
      data.ticket_id = ticket_id;
      if (data.id) {
        const idMap = getTicketIdMap();
        idMap[data.id] = ticket_id;
        setTicketIdMap(idMap);
      }
    }

    return data;
  },

  // Update complaint
  update: async (
    id: string,
    updates: Partial<Complaint>,
    technicianInput?: Array<string | { technician_id: string; is_lead?: boolean }>
  ): Promise<Complaint> => {
    let current: any = null;
    try {
      const { data } = await supabase
        .from("complaints")
        .select("triage_outcome, current_phase, status")
        .eq("id", id)
        .maybeSingle();
      current = data;
    } catch (fetchErr) {
      console.warn("Could not pre-fetch complaint details for update:", fetchErr);
    }

    const wasRemoteFixed = current?.triage_outcome === "remote_fixed";

    if (wasRemoteFixed && (updates.triage_outcome === undefined || updates.triage_outcome === null)) {
      const nextPhase = updates.current_phase ?? current?.current_phase;
      const nextStatus = updates.status ?? current?.status;

      if (nextPhase !== 6 || nextStatus !== "completed") {
        updates.triage_outcome = null;
        updates.resolution = null;
        updates.signoff_timestamp = null;
        updates.pir_findings = null;
        updates.resolution_notes = null;
        updates.resolved_remotely = false;
        updates.resolution_type = null;
        updates.resolved_at = null;
        updates.resolved_by = null;
      }
    }

    let data: any = null;
    let payload: any = { ...updates };

    const isUUID = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // Pre-sanitize known UUID columns to prevent Postgres 22P02 invalid input syntax errors
    if (payload.pir_approved_by !== undefined && payload.pir_approved_by !== null && !isUUID(payload.pir_approved_by)) {
      payload.pir_approved_by = null;
    }
    if (payload.resolved_by !== undefined && payload.resolved_by !== null && !isUUID(payload.resolved_by)) {
      payload.resolved_by = null;
    }
    if (payload.assigned_to !== undefined && payload.assigned_to !== null && !isUUID(payload.assigned_to)) {
      delete payload.assigned_to;
    }
    if (payload.customer_id !== undefined && payload.customer_id !== null && !isUUID(payload.customer_id)) {
      delete payload.customer_id;
    }
    if (payload.assigned_supervisor && isUUID(payload.assigned_supervisor)) {
      try {
        const { data: sProf } = await supabase.from("profiles").select("full_name").eq("id", payload.assigned_supervisor).maybeSingle();
        if (sProf?.full_name) {
          payload.assigned_supervisor = sProf.full_name;
        }
      } catch (e) {
        // ignore
      }
    }

    const optionalColumnsToDrop = [
      'service_charge',
      'payment_status',
      'coverage',
      'chargeable_service',
      'brand',
      'pir_approved_by',
      'pir_approved_at',
      'target_end_time',
      'pir_findings_severity',
      'supervisor_severity',
      'target_duration_hours',
      'pir_status',
      'pir_revision_notes',
      'pir_revision_requested_by',
      'pir_revision_requested_at',
      'pir_resubmitted_at',
      'reassignment_reason',
      'closed_at',
      'ticket_id',
      'closure_timestamp',
      'closed_by',
      'feedback_collected',
      'customer_satisfaction',
      'feedback_comments',
      'feedback_contact_method',
      'feedback_timestamp',
      'resolved_remotely',
      'resolution_type',
      'resolution_notes',
      'resolved_at',
      'resolved_by',
      'triage_outcome',
      'evidence_urls',
      'technician_evidence',
      'arrival_lat',
      'arrival_lng',
      'arrival_timestamp',
      'start_journey_timestamp',
      'pir_decision_tree',
      'happiness_code',
      'happiness_code_sent_at',
      'happiness_code_verified'
    ];

    let attempts = 0;
    while (attempts < 15) {
      attempts++;
      const res = await supabase.from("complaints").update(payload).eq("id", id).select().maybeSingle();
      if (!res.error) {
        data = res.data || { id, ...payload };
        break;
      }

      console.warn(`Complaint update attempt ${attempts} error:`, res.error);
      const errMsg = res.error.message || "";
      const errDetails = res.error.details || "";
      const isColErr = 
        res.error.code === "42703" || 
        res.error.code === "PGRST204" || 
        errMsg.toLowerCase().includes("column") || 
        errDetails.toLowerCase().includes("column") ||
        res.error.code === "PGRST100" ||
        errMsg.includes("schema cache");

      const isUuidErr = 
        res.error.code === "22P02" || 
        errMsg.toLowerCase().includes("invalid input syntax for type uuid");

      const isConstraintErr = 
        res.error.code === "23514" || 
        errMsg.toLowerCase().includes("check constraint");

      if (isUuidErr) {
        // Strip any value that matches the invalid uuid string or drop all uuid fields
        const match = errMsg.match(/invalid input syntax for type uuid: "([^"]+)"/) || errDetails.match(/invalid input syntax for type uuid: "([^"]+)"/);
        let foundInvalidKey = false;
        if (match && match[1]) {
          for (const key of Object.keys(payload)) {
            if (String(payload[key]) === match[1]) {
              console.warn(`Stripping non-UUID value from column '${key}'`);
              delete payload[key];
              foundInvalidKey = true;
            }
          }
        }
        if (!foundInvalidKey) {
          // Drop optional UUID columns from payload
          ['pir_approved_by', 'resolved_by', 'closed_by', 'ticket_id', 'pir_revision_requested_by'].forEach(k => {
            if (payload[k] !== undefined) delete payload[k];
          });
        }
        continue;
      }

      if (isConstraintErr) {
        if (payload.status) {
          // Map status to legacy supported status
          const legacyStatusMap: Record<string, string> = {
            'pir_submitted_awaiting_approval': 'in-progress',
            'awaiting_pir_approval': 'pir_submitted_awaiting_approval',
            'pir_approved': 'in-progress',
            'pir_rejected': 'in-progress',
            'resolution_pending': 'in-progress',
            'awaiting_signoff': 'in-progress',
            'awaiting_verification': 'in-progress',
            'resolution_submitted': 'in-progress',
            'in_service': 'in-progress',
            'assigned': 'Assigned',
            'Assigned': 'in-progress',
            'completed': 'resolved',
            'resolved': 'resolved',
            'closed': 'closed'
          };
          const fallbackStatus = legacyStatusMap[payload.status] || (payload.status === 'closed' ? 'closed' : 'in-progress');
          if (fallbackStatus && fallbackStatus !== payload.status) {
            console.warn(`Falling back status from '${payload.status}' to '${fallbackStatus}' due to check constraint`);
            payload.status = fallbackStatus;
            continue;
          } else {
            console.warn(`Removing problematic status '${payload.status}' from payload to allow update to proceed`);
            delete payload.status;
            continue;
          }
        }
        if (payload.pir_status) {
          if (payload.pir_status === 'pending_approval' || payload.pir_status === 'submitted' || payload.pir_status === 'resubmitted') {
            console.warn(`Constraint error on pir_status '${payload.pir_status}', falling back to 'pending'`);
            payload.pir_status = 'pending';
            continue;
          } else {
            console.warn(`Constraint error on pir_status '${payload.pir_status}', dropping from payload`);
            delete payload.pir_status;
            continue;
          }
        }
      }

      if (isColErr) {
        // Try extracting specific missing column name
        const match = errMsg.match(/'([^']+)' column/) || errDetails.match(/'([^']+)' column/);
        if (match && match[1] && payload[match[1]] !== undefined) {
          console.warn(`Stripping missing column '${match[1]}' from complaints update payload`);
          delete payload[match[1]];
          continue;
        }

        // Drop one optional column at a time that is currently in payload
        const nextColToDrop = optionalColumnsToDrop.find(c => payload[c] !== undefined);
        if (nextColToDrop) {
          console.warn(`Dropping optional column '${nextColToDrop}' and retrying update...`);
          delete payload[nextColToDrop];
          continue;
        }
      }

      // Try update without select() if select fails
      const fallbackRes = await supabase.from("complaints").update(payload).eq("id", id);
      if (!fallbackRes.error) {
        data = { id, ...payload };
        break;
      }

      if (attempts >= 15) {
        throw res.error;
      }
    }

    // Update complaint_technicians if technicianInput provided
    if (technicianInput !== undefined) {
      const techObjs = technicianInput.map((t, idx) => {
        if (typeof t === "string") return { technician_id: t, is_lead: idx === 0 };
        return { technician_id: t.technician_id, is_lead: Boolean(t.is_lead) };
      });

      try {
        await supabase.from("complaint_technicians").delete().eq("complaint_id", id);
        if (techObjs.length > 0) {
          const rows = techObjs.map((t) => ({
            complaint_id: id,
            technician_id: t.technician_id,
            is_lead: t.is_lead,
            phase: data?.current_phase || 3,
          }));
          const { error: insErr } = await supabase.from("complaint_technicians").insert(rows);
          if (insErr && insErr.code !== "42P01") {
            const fallbackRows = techObjs.map((t) => ({
              complaint_id: id,
              technician_id: t.technician_id,
            }));
            await supabase.from("complaint_technicians").insert(fallbackRows);
          }
        }
      } catch (techUpdateErr) {
        console.warn("Could not update complaint_technicians junction:", techUpdateErr);
      }
    }

    return data;
  },

  // Assign multiple technicians with a Lead Technician on Field Visit Required (Phase 2 -> Phase 3)
  assignFieldVisitTechnicians: async (
    complaintId: string,
    technicians: Array<{ technician_id: string; is_lead: boolean }>,
    scheduledDate?: string | null,
    scheduledTime?: string | null,
    supervisorNotes?: string | null
  ): Promise<void> => {
    const leadTech = technicians.find((t) => t.is_lead) || technicians[0];
    const leadTechId = leadTech ? leadTech.technician_id : null;

    let leadTechName: string | null = null;
    if (leadTechId) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", leadTechId)
          .maybeSingle();
        if (prof?.full_name) leadTechName = prof.full_name;
      } catch (e) {
        // ignore
      }
    }

    const complaintUpdates: any = {
      status: "in-progress",
      current_phase: 3,
      assigned_to: leadTechId,
      ...(leadTechName ? { assigned_technician: leadTechName } : {}),
      ...(scheduledDate ? { scheduled_date: scheduledDate } : {}),
      ...(scheduledTime ? { scheduled_time: scheduledTime } : {}),
      ...(supervisorNotes ? { supervisor_notes: supervisorNotes } : {}),
      triage_outcome: "field_required",
      updated_at: new Date().toISOString(),
    };

    const { error: compError } = await supabase
      .from("complaints")
      .update(complaintUpdates)
      .eq("id", complaintId);

    if (compError) throw compError;

    // Sync complaint_technicians junction
    try {
      await supabase.from("complaint_technicians").delete().eq("complaint_id", complaintId);
      if (technicians.length > 0) {
        const rows = technicians.map((t) => ({
          complaint_id: complaintId,
          technician_id: t.technician_id,
          is_lead: Boolean(t.is_lead),
          phase: 3,
          assigned_at: new Date().toISOString(),
        }));

        const { error: insErr } = await supabase.from("complaint_technicians").insert(rows);
        if (insErr) {
          const fallbackRows = technicians.map((t) => ({
            complaint_id: complaintId,
            technician_id: t.technician_id,
            assigned_at: new Date().toISOString(),
          }));
          await supabase.from("complaint_technicians").insert(fallbackRows);
        }
      }
    } catch (juncErr) {
      console.warn("complaint_technicians table update skipped:", juncErr);
    }
  },

  // Reassign Technicians (with mandatory reason)
  reassignTechnicians: async (
    complaintId: string,
    technicianInput: Array<string | { technician_id: string; is_lead?: boolean }>,
    reason: string
  ): Promise<void> => {
    if (!reason.trim() || reason.trim().length < 10) {
      throw new Error("Reassignment reason must be at least 10 characters");
    }

    const techObjs = technicianInput.map((t, idx) => {
      if (typeof t === "string") return { technician_id: t, is_lead: idx === 0 };
      return { technician_id: t.technician_id, is_lead: Boolean(t.is_lead) };
    });

    const leadTech = techObjs.find((t) => t.is_lead) || techObjs[0];
    const leadTechId = leadTech ? leadTech.technician_id : null;

    let leadTechName: string | null = null;
    if (leadTechId) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", leadTechId)
          .maybeSingle();
        if (prof?.full_name) leadTechName = prof.full_name;
      } catch (e) {
        // ignore
      }
    }

    const updates: any = {
      reassignment_reason: reason.trim(),
      assigned_to: leadTechId,
      ...(leadTechName ? { assigned_technician: leadTechName } : {}),
      status: "assigned",
      current_phase: 3,
      happiness_code: null,
      happiness_code_sent_at: null,
      happiness_code_verified: false,
      feedback_collected: false,
      // Preserve customer_satisfaction, feedback_comments, resolution, resolution_notes for technician reference
      technician_evidence: null,
      signature_url: null,
      signoff_timestamp: null,
      closed_at: null,
      closure_timestamp: null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: updateError } = await supabase.from("complaints").update(updates).eq("id", complaintId);
      if (updateError) throw updateError;
    } catch (err: any) {
      if (err?.message?.includes("column") || err?.code === "42703" || err?.code === "PGRST204") {
        const stripped = { ...updates };
        delete stripped.reassignment_reason;
        delete stripped.closed_at;
        delete stripped.closure_timestamp;
        delete stripped.happiness_code;
        delete stripped.happiness_code_sent_at;
        delete stripped.happiness_code_verified;
        delete stripped.customer_satisfaction;
        delete stripped.feedback_comments;
        delete stripped.feedback_contact_method;
        delete stripped.feedback_timestamp;
        const { error: retryErr } = await supabase.from("complaints").update(stripped).eq("id", complaintId);
        if (retryErr) throw retryErr;
      } else {
        throw err;
      }
    }

    try {
      await supabase.from("complaint_technicians").delete().eq("complaint_id", complaintId);
      if (techObjs.length > 0) {
        const rows = techObjs.map((t) => ({
          complaint_id: complaintId,
          technician_id: t.technician_id,
          is_lead: t.is_lead,
          phase: 3,
        }));
        const { error: insErr } = await supabase.from("complaint_technicians").insert(rows);
        if (insErr) {
          const fallbackRows = techObjs.map((t) => ({
            complaint_id: complaintId,
            technician_id: t.technician_id,
          }));
          await supabase.from("complaint_technicians").insert(fallbackRows);
        }
      }
    } catch (juncErr) {
      console.warn("Could not sync complaint_technicians on reassign:", juncErr);
    }
  },

  // Delete complaint
  delete: async (id: string): Promise<void> => {
    try {
      await supabase.from("complaint_technicians").delete().eq("complaint_id", id);
    } catch (e) {
      // Ignore if table doesn't exist
    }

    const { error } = await supabase
      .from("complaints")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
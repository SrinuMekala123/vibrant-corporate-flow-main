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
  evidence_urls?: string[];         // Diagnostic / PIR evidence (Before)
  complaint_images?: string[];      // Initial images (Customer - Phase 1)
  technician_evidence?: string[];   // Technician images (Resolution - After - Phase 5)
  signature_url?: string;
  triage_outcome?: 'remote_fixed' | 'field_required';
  pir_decision_tree?: any;
  feedback_history?: any[];
  rework_history?: any[];
  assignment_timestamp?: string;
  start_journey_timestamp?: string;
  arrival_timestamp?: string;
  signoff_timestamp?: string;
  verified_at?: string | null;
  verified_by?: string | null;
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
  force_close_reason?: string | null;
  
  closed_at?: string | null;
  reassigned_at?: string | null;
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

  complaint_assets?: ComplaintAsset[];
}

export interface ComplaintAsset {
  id?: string;
  complaint_id: string;
  asset_type: string;
  asset_name: string;
  reported_issue?: string | null;
  warranty_status?: 'Active' | 'Expired' | 'Not Applicable' | string;
  is_chargeable?: boolean;
  service_charge?: number;
  created_at?: string;
}

// Permanent immutable baseline mapping for existing active complaints
export const INITIAL_COMPLAINT_TICKET_MAP: Record<string, string> = {
  '9e4d1ce2-f837-4f27-a4b6-ca4056a7b186': 'BTL-CMS-2026-0000001',
  '0f67f486-a07b-45dd-913c-8b0ce6686e93': 'BTL-CMS-2026-0000002',
  'e2a0c197-57c5-40aa-951a-37690245b4f7': 'BTL-CMS-2026-0000003',
  'f077892f-4c65-443a-9108-a84f95302383': 'BTL-CMS-2026-0000004',
  'bd003028-c018-46d9-b932-eb4de38351aa': 'BTL-CMS-2026-0000005',
  '3c94a625-453f-4f40-b09f-13ea7f129328': 'BTL-CMS-2026-0000006',
};

export const getTicketIdMap = (): Record<string, string> => {
  try {
    const cached = JSON.parse(localStorage.getItem("btl_ticket_id_map") || "{}");
    return { ...INITIAL_COMPLAINT_TICKET_MAP, ...cached };
  } catch {
    return { ...INITIAL_COMPLAINT_TICKET_MAP };
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

  // Track the highest observed number across all tickets (minimum 6 for established baseline)
  let highestObserved = 6;

  // Step 1: Retain established ticket IDs for existing complaints
  complaints.forEach((c) => {
    let finalId = c.ticket_id;
    if (finalId && typeof finalId === "string" && finalId.startsWith("BTL-CMS-")) {
      const match = finalId.match(/BTL-CMS-\d+-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          finalId = `BTL-CMS-${currentYear}-${String(num).padStart(7, "0")}`;
          if (num > highestObserved) highestObserved = num;
        }
      }
    } else if (c.id && idMap[c.id]) {
      finalId = idMap[c.id];
      const match = finalId.match(/BTL-CMS-\d+-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > highestObserved) {
          highestObserved = num;
        }
      }
    }

    if (finalId) {
      c.ticket_id = finalId;
    }
  });

  // Step 2: For any complaints still lacking a ticket ID, allocate monotonically above highestObserved
  const unassigned = complaints.filter((c) => !c.ticket_id);
  if (unassigned.length > 0) {
    unassigned.sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

    unassigned.forEach((c) => {
      highestObserved++;
      const yr = c.created_at ? new Date(c.created_at).getFullYear() : currentYear;
      const genId = `BTL-CMS-${yr}-${String(highestObserved).padStart(7, "0")}`;
      c.ticket_id = genId;
      if (c.id) {
        idMap[c.id] = genId;
        updatedMap = true;
      }
    });
  }

  // Step 3: Strictly monotonic sequence update — NEVER downgrade sequence when records are deleted
  const storageKey = `btl_cms_last_seq_${currentYear}`;
  const currentStored = parseInt(localStorage.getItem(storageKey) || "0", 10);
  if (highestObserved > currentStored) {
    localStorage.setItem(storageKey, String(highestObserved));
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
  
  // Baseline floor is 6 (since tickets 1 through 6 exist)
  let maxNumber = 6;
  
  // 1. Check all mapped ticket IDs (including baseline and dynamically cached)
  const idMap = getTicketIdMap();
  Object.values(idMap).forEach((val) => {
    if (typeof val === "string") {
      const match = val.match(/BTL-CMS-\d+-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  // 2. Prevent rollback from persistent sequence store (strictly monotonic)
  const storedSeq = parseInt(localStorage.getItem(storageKey) || "0", 10);
  if (!isNaN(storedSeq) && storedSeq > maxNumber) {
    maxNumber = storedSeq;
  }

  // 3. Increment monotonically by 1
  const nextNumber = maxNumber + 1;
  localStorage.setItem(storageKey, String(nextNumber));

  // 4. Zero-pad to 7 digits
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
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching all complaints:", error);
      return [];
    }

    const rows = enrichComplaintsWithTicketIds(data || []);
    if (rows.length === 0) return rows;

    try {
      const complaintIds = rows.map((r: any) => r.id);
      const { data: ctRows, error: ctError } = await supabase
        .from("complaint_technicians")
        .select("complaint_id, technician_id, is_lead, technician:profiles!complaint_technicians_technician_id_fkey (id, full_name, email, phone)")
        .in("complaint_id", complaintIds);

      if (ctError) {
        console.warn("complaint_technicians join skipped:", ctError);
        return rows;
      }

      if (ctRows && ctRows.length > 0) {
        const ctMap = new Map<string, any[]>();
        ctRows.forEach((ct: any) => {
          const list = ctMap.get(ct.complaint_id) || [];
          list.push(ct);
          ctMap.set(ct.complaint_id, list);
        });
        rows.forEach((r: any) => {
          r.complaint_technicians = ctMap.get(r.id) || [];
        });
      }
    } catch (ctErr) {
      console.warn("Fallback complaint_technicians load skipped:", ctErr);
    }

    try {
      const complaintIds = rows.map((r: any) => r.id);
      const { data: caRows, error: caError } = await supabase
        .from("complaint_assets")
        .select("id, complaint_id, asset_type, asset_name, reported_issue, warranty_status, is_chargeable, service_charge")
        .in("complaint_id", complaintIds)
        .order("created_at", { ascending: true });

      if (!caError && caRows && caRows.length > 0) {
        const caMap = new Map<string, any[]>();
        caRows.forEach((ca: any) => {
          const list = caMap.get(ca.complaint_id) || [];
          list.push(ca);
          caMap.set(ca.complaint_id, list);
        });
        rows.forEach((r: any) => {
          r.complaint_assets = caMap.get(r.id) || [];
        });
      }
    } catch (caErr) {
      console.warn("Fallback complaint_assets batch load skipped:", caErr);
    }

    rows.forEach((r: any) => {
      const isActuallyClosed = (r.status || "").toLowerCase() === 'closed' || (r.status || "").toLowerCase() === 'verified';
      if (
        isActuallyClosed && (
          r.force_closed ||
          r.resolution_type === 'force_closed' ||
          r.feedback_comments?.includes('[Force Closed - ') ||
          (!r.happiness_code_verified && !r.resolved_remotely && r.resolution_type !== 'telephonic_triage' && r.triage_outcome !== 'remote_fixed')
        )
      ) {
        r.force_closed = true;
        if (!r.force_close_reason) {
          if (r.feedback_comments?.includes('[Force Closed - ')) {
            const match = r.feedback_comments.match(/\[Force Closed - ([^\]]+)\]/);
            if (match) r.force_close_reason = match[1];
          } else if (r.resolution_notes && r.resolution_type === 'force_closed') {
            r.force_close_reason = r.resolution_notes;
          }
        }
      }
    });

    return rows;
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

    if (data) {
      const isActuallyClosed = (data.status || "").toLowerCase() === 'closed' || (data.status || "").toLowerCase() === 'verified';
      if (
        isActuallyClosed && (
          data.force_closed ||
          data.resolution_type === 'force_closed' ||
          data.feedback_comments?.includes('[Force Closed - ') ||
          (!data.happiness_code_verified && !data.resolved_remotely && data.resolution_type !== 'telephonic_triage' && data.triage_outcome !== 'remote_fixed')
        )
      ) {
        data.force_closed = true;
        if (!data.force_close_reason) {
          if (data.feedback_comments?.includes('[Force Closed - ')) {
            const match = data.feedback_comments.match(/\[Force Closed - ([^\]]+)\]/);
            if (match) data.force_close_reason = match[1];
          } else if (data.resolution_notes && data.resolution_type === 'force_closed') {
            data.force_close_reason = data.resolution_notes;
          }
        }
      }

      // Load complaint_assets
      try {
        const { data: caRows } = await supabase
          .from("complaint_assets")
          .select("*")
          .eq("complaint_id", id)
          .order("created_at", { ascending: true });
        if (caRows) {
          data.complaint_assets = caRows as ComplaintAsset[];
        }
      } catch (caErr) {
        console.warn("complaint_assets junction not loaded:", caErr);
      }
    }

    return data;
  },

  // Fetch assets for a complaint
  getAssetsByComplaintId: async (complaintId: string): Promise<ComplaintAsset[]> => {
    try {
      const { data, error } = await supabase
        .from('complaint_assets')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn("Error fetching complaint_assets:", error);
        return [];
      }
      return (data as ComplaintAsset[]) || [];
    } catch (e) {
      console.warn("Exception fetching complaint_assets:", e);
      return [];
    }
  },

  // Sync / replace assets for a complaint
  syncComplaintAssets: async (complaintId: string, assets: any[]): Promise<ComplaintAsset[]> => {
    if (!complaintId) return [];
    try {
      const { error: delErr } = await supabase
        .from('complaint_assets')
        .delete()
        .eq('complaint_id', complaintId);
      if (delErr) {
        console.warn("Error deleting old complaint_assets:", delErr);
      }

      if (!assets || assets.length === 0) return [];

      const assetsToInsert = assets.map(a => ({
        complaint_id: complaintId,
        asset_type: (a.asset_type || '').trim(),
        asset_name: (a.asset_name || '').trim(),
        reported_issue: (a.reported_issue || '').trim(),
        warranty_status: a.warranty_status || 'Active',
        is_chargeable: Boolean(a.is_chargeable),
        service_charge: a.is_chargeable ? (Number(a.service_charge) || 0) : 0
      }));

      const { data, error: insErr } = await supabase
        .from('complaint_assets')
        .insert(assetsToInsert)
        .select();

      if (insErr) {
        console.error("Error inserting complaint_assets:", insErr);
        throw insErr;
      }
      return (data as ComplaintAsset[]) || [];
    } catch (e) {
      console.error("Exception in syncComplaintAssets:", e);
      throw e;
    }
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
    let targetPhone = data?.customer_phone || complaint.customer_phone || (data as any)?.walk_in_phone || (complaint as any)?.walk_in_phone;
    const custName = data?.customer_name || complaint.customer_name || (data as any)?.walk_in_name || (complaint as any)?.walk_in_name || "Valued Customer";
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

    const wasRemoteFixed = current?.triage_outcome === "remote_fixed" || current?.resolved_remotely || current?.resolution_type === "telephonic_triage";
    const isMovingToFieldVisit = updates.triage_outcome === "field_required" || (updates.current_phase !== undefined && updates.current_phase < 6);

    if (wasRemoteFixed && (updates.triage_outcome === undefined || updates.triage_outcome === null || isMovingToFieldVisit)) {
      const nextPhase = updates.current_phase ?? current?.current_phase;
      const nextStatus = updates.status ?? current?.status;

      if (nextPhase !== 6 || nextStatus !== "completed" || isMovingToFieldVisit) {
        if (updates.triage_outcome === undefined) updates.triage_outcome = null;
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
            'closed': 'closed',
            'verified': 'closed',
            'qa_verified': 'closed'
          };
          const fallbackStatus = legacyStatusMap[payload.status] || (payload.status === 'closed' || payload.status === 'verified' || payload.status === 'qa_verified' ? 'closed' : 'in-progress');
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
        // Try extracting specific missing column name from Postgres / PostgREST error message
        const match = 
          errMsg.match(/column\s+(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s+does not exist/i) ||
          errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) ||
          errMsg.match(/find the '([^']+)' column/i) ||
          errMsg.match(/'([^']+)' column/i) ||
          errDetails.match(/'([^']+)' column/);

        if (match && match[1] && payload[match[1]] !== undefined) {
          console.warn(`Stripping missing column '${match[1]}' from complaints update payload and retrying`);
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

    let existingHistory: any[] = [];
    try {
      const { data: cur } = await supabase.from("complaints").select("rework_history, feedback_history, pir_findings, resolution, technician_evidence, assigned_technician, assigned_to").eq("id", complaintId).maybeSingle();
      if (cur) {
        if (Array.isArray(cur.rework_history)) {
          existingHistory = cur.rework_history;
        } else if (typeof cur.rework_history === "string") {
          try {
            const p = JSON.parse(cur.rework_history);
            if (Array.isArray(p)) existingHistory = p;
          } catch {}
        } else if (Array.isArray(cur.feedback_history)) {
          existingHistory = cur.feedback_history.filter((x: any) => x && (x.type === "rework_round" || x.round));
        }

        // If the ticket has prior submitted work before team modification, archive it:
        if (cur.pir_findings || cur.resolution || (cur.technician_evidence && cur.technician_evidence.length > 0)) {
          const prevTechs = await complaintService.fetchTechnicians(complaintId);
          const previousRoundTechs = prevTechs && prevTechs.length > 0
            ? prevTechs.map((t: any) => ({
                id: t.technician_id,
                name: t.technician?.full_name || t.technician_id,
                is_lead: Boolean(t.is_lead),
              }))
            : (cur.assigned_technician ? [{ id: cur.assigned_to || "1", name: cur.assigned_technician, is_lead: true }] : []);

          const nextRound = existingHistory.length + 1;
          const snap = {
            type: "rework_round",
            round: nextRound,
            round_number: nextRound,
            reassigned_at: new Date().toISOString(),
            reassigned_by: "Supervisor",
            reassignment_reason: supervisorNotes || "Team modified by supervisor in Phase 3",
            technician_name: cur.assigned_technician || previousRoundTechs.find((t: any) => t.is_lead)?.name || previousRoundTechs[0]?.name || "Previous Technician",
            technicians: previousRoundTechs,
            pir: {
              findings: cur.pir_findings || "",
              severity: "",
              evidence_urls: [],
              audio_url: null,
            },
            resolution: {
              notes: cur.resolution || "",
              evidence_urls: cur.technician_evidence || [],
              signature_url: null,
              signoff_timestamp: null,
            },
            verification: {
              status: "rework_required",
              qa_notes: supervisorNotes || "Reassigned by supervisor",
            }
          };
          existingHistory = [...existingHistory, snap];
        }
      }
    } catch (e) {
      console.warn("Could not check/archive rework history in assignFieldVisitTechnicians:", e);
    }

    const complaintUpdates: any = {
      status: "assigned",
      current_phase: 3,
      assigned_to: leadTechId,
      ...(leadTechName ? { assigned_technician: leadTechName } : {}),
      ...(scheduledDate ? { scheduled_date: scheduledDate } : {}),
      ...(scheduledTime ? { scheduled_time: scheduledTime } : {}),
      ...(supervisorNotes ? { supervisor_notes: supervisorNotes } : {}),
      ...(existingHistory.length > 0 ? {
        rework_history: existingHistory,
        feedback_history: existingHistory,
        pir_decision_tree: existingHistory,
      } : {}),
      triage_outcome: "field_required",
      closure_timestamp: null,
      closed_at: null,
      closed_by: null,
      signature_url: null,
      signoff_timestamp: null,
      resolution: null,
      resolution_notes: null,
      pir_findings: null,
      pir_audio_url: null,
      technician_evidence: null,
      resolved_remotely: false,
      resolution_type: null,
      resolved_at: null,
      resolved_by: null,
      happiness_code: null,
      happiness_code_sent_at: null,
      happiness_code_verified: false,
      customer_satisfaction: null,
      feedback_comments: null,
      feedback_timestamp: null,
      feedback_collected: false,
      start_journey_timestamp: null,
      arrival_timestamp: null,
      arrival_lat: null,
      arrival_lng: null,
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
    reason: string,
    scheduledDate?: string | null,
    scheduledTime?: string | null
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

    // Capture previous round snapshot before resetting fields
    let updatedReworkHistory: any[] = [];
    try {
      const { data: cur } = await supabase.from("complaints").select("*").eq("id", complaintId).maybeSingle();
      if (cur) {
        let existingHistory: any[] = [];
        if (Array.isArray(cur.rework_history)) {
          existingHistory = cur.rework_history;
        } else if (typeof cur.rework_history === "string") {
          try {
            const p = JSON.parse(cur.rework_history);
            if (Array.isArray(p)) existingHistory = p;
          } catch {}
        } else if (Array.isArray(cur.feedback_history)) {
          existingHistory = cur.feedback_history.filter((x: any) => x && (x.type === "rework_round" || x.round));
        }

        if (existingHistory.length === 0 && Array.isArray(cur.pir_decision_tree)) {
          existingHistory = cur.pir_decision_tree.filter((x: any) => x && (x.type === "rework_round" || x.round));
        }

        const prevTechs = await complaintService.fetchTechnicians(complaintId);
        const previousRoundTechs = prevTechs && prevTechs.length > 0
          ? prevTechs.map((t: any) => ({
              id: t.technician_id,
              name: t.technician?.full_name || t.technician_id,
              is_lead: Boolean(t.is_lead),
            }))
          : (cur.assigned_technician ? [{ id: cur.assigned_to || "1", name: cur.assigned_technician, is_lead: true }] : []);

        const pastPirUrls = (cur.evidence_urls && cur.evidence_urls.length > 0)
          ? cur.evidence_urls
          : (cur.technician_evidence && !cur.resolution ? cur.technician_evidence : []);
        const pastResUrls = cur.technician_evidence || [];

        // If this ticket was previously reassigned but rework_history wasn't initialized, synthesize Round 1
        if (existingHistory.length === 0 && cur.reassignment_reason && (cur.technician_evidence?.length > 0 || cur.signature_url || cur.pir_findings || (cur.evidence_urls && cur.evidence_urls.length > 0))) {
          existingHistory = [{
            type: "rework_round",
            round: 1,
            round_number: 1,
            reassigned_at: cur.reassigned_at || cur.updated_at,
            reassignment_reason: cur.reassignment_reason,
            technician_name: cur.assigned_technician || previousRoundTechs.find((t: any) => t.is_lead)?.name || previousRoundTechs[0]?.name || "Previous Technician",
            technicians: previousRoundTechs,
            pir: {
              findings: cur.pir_findings || "",
              severity: cur.pir_findings_severity || "",
              evidence_urls: pastPirUrls,
              audio_url: cur.pir_audio_url || null,
            },
            resolution: {
              notes: cur.resolution || cur.resolution_notes || "",
              evidence_urls: pastResUrls,
              signature_url: cur.signature_url || null,
              signoff_timestamp: cur.signoff_timestamp || null,
            },
            verification: {
              status: "rework_required",
              qa_notes: cur.reassignment_reason,
            }
          }];
        }

        const nextRound = existingHistory.length + 1;
        const snapshot = {
          type: "rework_round",
          round: nextRound,
          round_number: nextRound,
          reassigned_at: new Date().toISOString(),
          reassigned_by: "Supervisor",
          reassignment_reason: reason.trim(),
          technician_name: cur.assigned_technician || previousRoundTechs.find((t: any) => t.is_lead)?.name || previousRoundTechs[0]?.name || "Previous Technician",
          technicians: previousRoundTechs,
          pir: {
            findings: cur.pir_findings || "",
            severity: cur.pir_findings_severity || "",
            evidence_urls: pastPirUrls,
            audio_url: cur.pir_audio_url || null,
          },
          resolution: {
            notes: cur.resolution || cur.resolution_notes || "",
            evidence_urls: pastResUrls,
            signature_url: cur.signature_url || null,
            signoff_timestamp: cur.signoff_timestamp || null,
          },
          verification: {
            status: "rework_required",
            qa_notes: reason.trim(),
          }
        };
        updatedReworkHistory = [...existingHistory, snapshot];
      }
    } catch (e) {
      console.warn("Could not archive rework snapshot in reassignComplaint:", e);
    }

    const updates: any = {
      reassignment_reason: reason.trim(),
      reassigned_at: new Date().toISOString(),
      supervisor_notes: `[Reassigned for Rework] ${reason.trim()}`,
      assigned_to: leadTechId,
      ...(leadTechName ? { assigned_technician: leadTechName } : {}),
      status: "reassigned",
      current_phase: 3,
      rework_history: updatedReworkHistory,
      feedback_history: updatedReworkHistory,
      pir_decision_tree: updatedReworkHistory,
      triage_outcome: "field_required",
      start_journey_timestamp: null,
      arrival_timestamp: null,
      arrival_lat: null,
      arrival_lng: null,
      closure_timestamp: null,
      closed_at: null,
      closed_by: null,
      verified_by: null,
      verified_at: null,
      force_closed: false,
      force_closed_by: null,
      force_close_reason: null,
      force_close_comments: null,
      customer_satisfaction: null,
      feedback_comments: null,
      feedback_contact_method: null,
      feedback_timestamp: null,
      happiness_code: null,
      happiness_code_sent_at: null,
      happiness_code_verified: false,
      feedback_collected: false,
      signature_url: null,
      signoff_timestamp: null,
      resolution: null,
      resolution_notes: null,
      pir_findings: null,
      pir_audio_url: null,
      technician_evidence: null,
      evidence_urls: null,
      resolved_remotely: false,
      resolution_type: null,
      resolved_at: null,
      resolved_by: null,
      updated_at: new Date().toISOString(),
    };

    if (scheduledDate) updates.scheduled_date = scheduledDate;
    if (scheduledTime) updates.scheduled_time = scheduledTime;

    try {
      const { error: updateError } = await supabase.from("complaints").update(updates).eq("id", complaintId);
      if (updateError) throw updateError;
    } catch (err: any) {
      if (err?.message?.includes("column") || err?.code === "42703" || err?.code === "PGRST204") {
        const stripped = { ...updates };
        // Delete only the non-existent columns, keep rework_history intact!
        delete stripped.reassignment_reason;
        delete stripped.reassigned_at;
        delete stripped.closed_at;
        delete stripped.closure_timestamp;
        delete stripped.happiness_code;
        delete stripped.happiness_code_sent_at;
        delete stripped.happiness_code_verified;
        delete stripped.customer_satisfaction;
        delete stripped.feedback_comments;
        delete stripped.feedback_contact_method;
        delete stripped.feedback_timestamp;
        delete stripped.verified_by;
        delete stripped.verified_at;
        delete stripped.force_closed;
        delete stripped.force_closed_by;
        delete stripped.force_close_reason;
        delete stripped.force_close_comments;
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

    if (error) {
      throw new Error(error.message || "Failed to delete complaint from database.");
    }

    const { data: stillExists } = await supabase
      .from("complaints")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (stillExists) {
      throw new Error("DELETE_BLOCKED");
    }
  },

  deleteMany: async (ids: string[]): Promise<{ deleted: string[]; blocked: string[]; failed: string[] }> => {
    const deleted: string[] = [];
    const blocked: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        await complaintService.delete(id);
        deleted.push(id);
      } catch (err: any) {
        console.error(`Delete issue for complaint ${id}:`, err);
        if (err?.message === "DELETE_BLOCKED") {
          blocked.push(id);
        } else {
          failed.push(id);
        }
      }
    }

    return { deleted, blocked, failed };
  },
};
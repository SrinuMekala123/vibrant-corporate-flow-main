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

export interface Complaint {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  created_by_name?: string;
  title: string;
  description: string;
  status: string;
  severity?: string;
  priority?: string;
  field_of_work?: string;
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
  pir_status?: 'pending' | 'approved' | 'revision_requested';
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
  
  profiles?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

export const complaintService = {
  // Get all complaints
  getAll: async (): Promise<Complaint[]> => {
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
    return data || [];
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
    return data;
  },

  // Create new complaint
  create: async (complaint: Partial<Complaint>): Promise<Complaint> => {
    const { data, error } = await supabase
      .from("complaints")
      .insert([complaint])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update complaint
  update: async (id: string, updates: Partial<Complaint>): Promise<Complaint> => {
    const { data: current, error: fetchError } = await supabase
      .from("complaints")
      .select("triage_outcome, current_phase, status, resolution_notes, resolved_remotely, resolution_type, resolved_at, resolved_by")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const wasRemoteFixed = current?.triage_outcome === "remote_fixed";

    if (wasRemoteFixed && (updates.triage_outcome === undefined || updates.triage_outcome === null)) {
      const nextPhase = updates.current_phase ?? current.current_phase;
      const nextStatus = updates.status ?? current.status;

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

    const { data, error } = await supabase
      .from("complaints")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete complaint
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("complaints")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
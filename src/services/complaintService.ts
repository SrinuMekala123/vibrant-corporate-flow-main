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
  pir_findings?: string;
  pir_audio_url?: string;
  complaint_images?: string[];      // Initial images (Before)
  technician_evidence?: string[];   // Technician images (After)
  signature_url?: string;
  triage_outcome?: 'remote_fixed' | 'field_required';
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
  created_at: string;
  updated_at: string;
  
  // Universal Feedback Fields
  feedback_collected?: boolean;
  customer_satisfaction?: 'satisfied' | 'partially_satisfied' | 'unsatisfied';
  feedback_comments?: string;
  feedback_contact_method?: 'phone' | 'email' | 'whatsapp' | 'sms' | 'in_person';
  feedback_timestamp?: string;
  feedback_history?: {
    type: 'pir_rejection' | 'qa_rejection';
    reason: string;
    created_at: string;
    created_by: string;
  }[];
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

  // Live tracking
  sendTechnicianLocation: async (complaintId: string, technicianName: string, lat: number, lng: number, accuracy?: number, heading?: number, speed?: number): Promise<void> => {
    try {
      const { error } = await supabase
        .from("technician_locations")
        .insert([{ complaint_id: complaintId, technician_name: technicianName, lat, lng, accuracy, heading, speed }]);

      if (error) {
        console.warn('technician_locations table may not exist:', error.message);
      }
    } catch (err: any) {
      console.warn('Failed to send technician location (table may not exist):', err?.message || err);
    }
  },

  getLatestTechnicianLocation: async (complaintId: string) => {
    try {
      const { data, error } = await supabase
        .from("technician_locations")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('technician_locations table may not exist:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.warn('Failed to get technician location (table may not exist):', err?.message || err);
      return null;
    }
  },

  subscribeToTechnicianLocation: (complaintId: string, callback: (payload: any) => void) => {
    try {
      const channel = supabase
        .channel(`technician-location-${complaintId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "technician_locations",
          filter: `complaint_id=eq.${complaintId}`,
        }, callback)
        .subscribe();

      return channel;
    } catch (err: any) {
      console.warn('Failed to subscribe to technician location (table may not exist):', err?.message || err);
      return null;
    }
  },
};
// import { supabase } from "@/lib/supabase";

// export type TicketStatus = "unassigned" | "assigned" | "in-progress" | "dispatched" | "completed" | "closed";
// export type SeverityTier = "minor" | "moderate" | "major";
// export type PriorityLevel = "low" | "medium" | "high";
// export type TriageOutcome = "remote_fixed" | "field_required" | null;

// export interface Complaint {
//     // Core Fields
//     id: string;
//     customer_id: string;
//     title: string;
//     description: string;
//     status: TicketStatus;
//     severity: SeverityTier;
//     category: string | null;
//     priority: PriorityLevel | null;
//     location: string | null;
//     field_of_work: string | null;
//     created_at: string;
//     updated_at: string;
//     assigned_to: string | null;
//     assigned_supervisor: string | null;
//     assigned_technician: string | null;
//     current_phase: number;
//     resolution: string | null;
//     customer_name?: string;
//     customer_phone?: string;

//     // 🔥 NEW FIELDS for Advanced Workflow
//     triage_outcome: TriageOutcome;
//     pir_findings: string | null;
//     pir_audio_url: string | null;
//     pir_findings_severity: string | null;
//     supervisor_severity: string | null;
//     evidence_urls: string[] | null;
//     signature_url: string | null;
//     assignment_timestamp: string | null;
//     start_journey_timestamp: string | null;
//     arrival_timestamp: string | null;
//     signoff_timestamp: string | null;
//     target_duration_hours: number | null;
//     follow_up_required: boolean | null;
//     arrival_lat: number | null;
//     arrival_lng: number | null;

//     // Relations (from Supabase joins)
//     profiles?: {
//         full_name: string;
//         email: string;
//         phone: string | null;
//     };
// }

// export const complaintService = {
//     getAll: async (filters?: { status?: TicketStatus; customerId?: string }) => {
//         let query = supabase.from("complaints").select("*, profiles:customer_id(full_name, email, phone)").order("created_at", { ascending: false });

//         if (filters?.status) {
//             query = query.eq("status", filters.status);
//         }
//         if (filters?.customerId) {
//             query = query.eq("customer_id", filters.customerId);
//         }

//         const { data, error } = await query;
//         if (error) throw error;
//         return data as Complaint[];
//     },

//     getById: async (id: string) => {
//         const { data, error } = await supabase
//             .from("complaints")
//             .select("*, profiles:customer_id(full_name, email, phone)")
//             .eq("id", id)
//             .single();
//         if (error) throw error;
//         return data as Complaint;
//     },

//     create: async (complaint: Omit<Complaint, "id" | "created_at" | "updated_at">) => {
//         const { data, error } = await supabase.from("complaints").insert(complaint).select().single();
//         if (error) throw error;
//         return data as Complaint;
//     },

//     update: async (id: string, updates: Partial<Complaint>) => {
//         const { data, error } = await supabase
//             .from("complaints")
//             .update({ ...updates, updated_at: new Date().toISOString() })
//             .eq("id", id)
//             .select()
//             .single();
//         if (error) throw error;
//         return data as Complaint;
//     },

//     delete: async (id: string) => {
//         const { error } = await supabase.from("complaints").delete().eq("id", id);
//         if (error) throw error;
//     },
// };

import { supabase } from "@/lib/supabase";

export interface Complaint {
    id: string;
    customer_id: string;
    customer_name?: string;
    customer_phone?: string;
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
    evidence_urls?: string[];
    signature_url?: string;
    triage_outcome?: 'remote_fixed' | 'field_required';
    assignment_timestamp?: string;
    start_journey_timestamp?: string;
    arrival_timestamp?: string;
    signoff_timestamp?: string;
    arrival_lat?: number;
    arrival_lng?: number;
    follow_up_required?: boolean;
    supervisor_severity?: string;
    pir_findings_severity?: string;
    target_duration_hours?: number;
    created_at: string;
    updated_at: string;
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
};
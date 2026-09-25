import { supabase } from "@/lib/supabase";

export interface Installation {
  id: string;
  ticket_id: string;
  customer_type: string;
  customer_id?: string | null;
  location_id?: string | null;
  non_btl_customer_name?: string | null;
  non_btl_contact_number?: string | null;
  non_btl_address?: string | null;
  equipment_details?: string | null;
  brand?: string | null;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  is_chargeable: boolean;
  service_charge?: number | null;
  payment_status?: string | null;
  notes?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status: string;
  current_phase?: number;
  equipment_model?: string | null;
  serial_number?: string | null;
  installation_notes?: string | null;
  testing_results?: string | null;
  evidence_photos?: any[];
  customer_signature?: string | null;
  arrival_gps_lat?: number | null;
  arrival_gps_lng?: number | null;
  arrival_time?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  happiness_code?: string | null;
  happiness_code_sent_at?: string | null;
  happiness_code_verified?: boolean;
  customer_satisfaction?: string | null;
  customer_feedback_comments?: string | null;
  correction_requested?: boolean;
  correction_notes?: string | null;
  lead_technician_id?: string | null;
  reassignment_reason?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined relations
  customer?: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
  } | null;
  location?: {
    id: string;
    location_name: string;
    address: string;
    city?: string;
  } | null;
  installation_technicians?: {
    id: string;
    technician_id: string;
    technician?: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
      role?: string;
      expertise?: string;
    };
  }[];
}

export const getInstallationTicketIdMap = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem("btl_installation_ticket_id_map") || "{}");
  } catch {
    return {};
  }
};

export const setInstallationTicketIdMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem("btl_installation_ticket_id_map", JSON.stringify(map));
  } catch (e) {
    // ignore
  }
};

export const enrichInstallationsWithTicketIds = (installations: Installation[]): Installation[] => {
  if (!installations || installations.length === 0) return installations;

  const currentYear = new Date().getFullYear();
  const idMap = getInstallationTicketIdMap();
  let updatedMap = false;

  const instByYear: Record<number, Installation[]> = {};
  installations.forEach((inst) => {
    const yr = inst.created_at ? new Date(inst.created_at).getFullYear() : currentYear;
    if (!instByYear[yr]) instByYear[yr] = [];
    instByYear[yr].push(inst);
  });

  for (const [yrStr, list] of Object.entries(instByYear)) {
    const yr = parseInt(yrStr, 10);
    const prefix = `BTL-INS-${yr}-`;
    const storageKey = `btl_ins_last_seq_${yr}`;

    const sortedAsc = [...list].sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

    let assignedIndex = 1;
    sortedAsc.forEach((inst) => {
      let finalId = inst.ticket_id;
      if (finalId && typeof finalId === "string" && finalId.startsWith(prefix)) {
        const numPart = parseInt(finalId.replace(prefix, ""), 10);
        if (!isNaN(numPart)) {
          finalId = `${prefix}${String(numPart).padStart(7, "0")}`;
        }
      } else if (idMap[inst.id]) {
        finalId = idMap[inst.id];
      } else {
        finalId = `${prefix}${String(assignedIndex).padStart(7, "0")}`;
        idMap[inst.id] = finalId;
        updatedMap = true;
      }

      inst.ticket_id = finalId;
      idMap[inst.id] = finalId;
      assignedIndex++;
    });

    const maxForYear = Math.max(sortedAsc.length, assignedIndex - 1);
    localStorage.setItem(storageKey, String(maxForYear));
  }

  if (updatedMap) {
    setInstallationTicketIdMap(idMap);
  }

  return installations;
};

export const generateInstallationTicketId = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const prefix = `BTL-INS-${currentYear}-`;
  const storageKey = `btl_ins_last_seq_${currentYear}`;

  let maxNumber = 0;

  try {
    const { data: existingInstallations } = await supabase
      .from('installations')
      .select('id, ticket_id, created_at');

    if (existingInstallations && existingInstallations.length > 0) {
      existingInstallations.forEach((installation) => {
        if (installation.ticket_id && typeof installation.ticket_id === "string" && installation.ticket_id.startsWith(prefix)) {
          const numericPart = installation.ticket_id.replace(prefix, "");
          const num = parseInt(numericPart, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      if (maxNumber === 0) {
        const thisYear = existingInstallations.filter(
          (inst) => !inst.created_at || new Date(inst.created_at).getFullYear() === currentYear
        );
        if (thisYear.length > maxNumber) {
          maxNumber = thisYear.length;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching existing installation tickets:', error);
  }

  const idMap = getInstallationTicketIdMap();
  Object.values(idMap).forEach((val) => {
    if (typeof val === "string" && val.startsWith(prefix)) {
      const num = parseInt(val.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  const storedSeq = parseInt(localStorage.getItem(storageKey) || "0", 10);
  if (!isNaN(storedSeq) && storedSeq > maxNumber) {
    maxNumber = storedSeq;
  }

  const nextNumber = maxNumber + 1;
  localStorage.setItem(storageKey, String(nextNumber));

  const paddedNumber = String(nextNumber).padStart(7, '0');
  return `${prefix}${paddedNumber}`;
};

export const formatInstallationTicketId = (installation?: { ticket_id?: string | null; id?: string; created_at?: string } | null): string => {
  if (!installation) return "BTL-INS-N/A";
  if (installation.ticket_id && installation.ticket_id.trim()) {
    const parts = installation.ticket_id.split("-");
    if (parts.length >= 3) {
      const numPart = parts[parts.length - 1];
      const num = parseInt(numPart, 10);
      if (!isNaN(num)) {
        return `${parts.slice(0, -1).join("-")}-${String(num).padStart(7, "0")}`;
      }
    }
    return installation.ticket_id;
  }

  if (installation.id) {
    const idMap = getInstallationTicketIdMap();
    if (idMap[installation.id]) {
      return idMap[installation.id];
    }
  }

  const year = installation.created_at ? new Date(installation.created_at).getFullYear() : new Date().getFullYear();
  return `BTL-INS-${year}-0000001`;
};

export const installationService = {
  // Fetch all installations with joined customer and location details
  getAll: async (): Promise<Installation[]> => {
    const { data, error } = await supabase
      .from("installations")
      .select(`
        *,
        customer:customers (
          id,
          full_name,
          phone,
          email
        ),
        location:customer_locations (
          id,
          location_name,
          address,
          city
        ),
        installation_technicians (
          id,
          technician_id,
          technician:profiles!installation_technicians_technician_id_fkey (
            id,
            full_name,
            email,
            phone,
            role,
            expertise
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching installations from Supabase:", error);
      // Fallback: try querying without the explicit foreign key alias if relation naming differs
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("installations")
        .select(`
          *,
          customer:customers(id, full_name, phone, email),
          location:customer_locations(id, location_name, address, city),
          installation_technicians(*)
        `)
        .order("created_at", { ascending: false });

      if (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        throw fallbackError;
      }
      return enrichInstallationsWithTicketIds((fallbackData as Installation[]) || []);
    }

    return enrichInstallationsWithTicketIds((data as Installation[]) || []);
  },

  // Get installation by ID
  getById: async (id: string): Promise<Installation> => {
    const { data, error } = await supabase
      .from("installations")
      .select(`
        *,
        customer:customers (
          id,
          full_name,
          phone,
          email
        ),
        location:customer_locations (
          id,
          location_name,
          address,
          city
        ),
        installation_technicians (
          id,
          technician_id,
          technician:profiles!installation_technicians_technician_id_fkey (
            id,
            full_name,
            email,
            phone,
            role,
            expertise
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching installation by id:", error);
      throw error;
    }

    if (data && !data.ticket_id) {
      const idMap = getInstallationTicketIdMap();
      data.ticket_id = idMap[data.id] || formatInstallationTicketId(data);
    }

    return data as Installation;
  },

  // Create new installation
  create: async (payload: Partial<Installation>): Promise<Installation> => {
    const ticketId = payload.ticket_id || (await generateInstallationTicketId());

    const brandVal = payload.brand || (payload as any).brand_oem || null;
    const equipVal = payload.equipment_details || (payload as any).equipment_scope || null;
    const walkInName = payload.non_btl_customer_name || (payload as any).walk_in_customer_name || null;
    const walkInPhone = payload.non_btl_contact_number || (payload as any).walk_in_customer_phone || null;
    const siteAddr = payload.non_btl_address || (payload as any).installation_site_address || null;
    const notesVal = payload.notes || (payload as any).scope_instructions || null;

    const baseInsert: any = {
      ticket_id: ticketId,
      customer_id: payload.customer_id || null,
      location_id: payload.location_id || null,
      customer_type: payload.customer_type || (payload.customer_id ? "BTL" : "Non-BTL"),
      non_btl_customer_name: walkInName,
      walk_in_customer_name: walkInName,
      non_btl_contact_number: walkInPhone,
      walk_in_customer_phone: walkInPhone,
      non_btl_address: siteAddr,
      installation_site_address: siteAddr,
      equipment_details: equipVal,
      equipment_scope: equipVal,
      brand: brandVal,
      brand_oem: brandVal,
      priority: payload.priority || "Medium",
      is_chargeable: payload.is_chargeable ?? true,
      service_charge: payload.service_charge ?? 0,
      payment_status: payload.payment_status || "Pending",
      scheduled_date: payload.scheduled_date || null,
      scheduled_time: payload.scheduled_time || null,
      status: payload.status || "Unassigned",
      current_phase: payload.current_phase || 1,
      notes: notesVal,
      scope_instructions: notesVal,
    };

    // Remove undefined values
    Object.keys(baseInsert).forEach(k => {
      if (baseInsert[k] === undefined) delete baseInsert[k];
    });

    let currentInsert = { ...baseInsert };
    let result: any = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      result = await supabase
        .from("installations")
        .insert([currentInsert])
        .select()
        .single();

      if (!result.error) {
        break;
      }

      console.warn(`Insert installation attempt ${attempt + 1} failed:`, result.error.message);
      const msg = result.error.message || "";
      let removedAny = false;

      // Extract missing column from PostgREST error message
      const colMatches = [
        ...msg.matchAll(/['"]([a-zA-Z0-9_]+)['"] column/gi),
        ...msg.matchAll(/column ['"]([a-zA-Z0-9_]+)['"]/gi),
        ...msg.matchAll(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/gi),
        ...msg.matchAll(/column ([a-zA-Z0-9_]+) does not exist/gi)
      ];

      for (const match of colMatches) {
        const colName = match[1];
        if (colName && colName in currentInsert) {
          delete currentInsert[colName];
          removedAny = true;
        }
      }

      const candidateCols = [
        'brand', 'brand_oem', 'equipment_scope', 'equipment_details',
        'scope_instructions', 'lead_technician_id', 'walk_in_customer_name',
        'walk_in_customer_phone', 'installation_site_address', 'service_charge', 'payment_status'
      ];
      for (const col of candidateCols) {
        if (msg.toLowerCase().includes(col.toLowerCase()) && col in currentInsert) {
          delete currentInsert[col];
          removedAny = true;
        }
      }

      if (!removedAny) {
        break;
      }
    }

    if (result.error) {
      console.error("Error creating installation in Supabase:", result.error);
      throw result.error;
    }

    const data = result.data;

    // 🔔 Trigger WhatsApp notification for Walk-in / Non-BTL customers
    const nonBtlPhone = data?.non_btl_contact_number || payload.non_btl_contact_number;
    const nonBtlName = data?.non_btl_customer_name || payload.non_btl_customer_name || "Valued Customer";
    const isWalkIn = !data?.customer_id || data?.customer_type === 'Non-BTL' || data?.customer_type === 'New / Non-BTL Customer' || payload.customer_type === 'Non-BTL';
    const newInstTicketId = data?.ticket_id || ticketId || (data?.id ? data.id.slice(0, 8) : "INS-REQ");

    if (isWalkIn && nonBtlPhone) {
      try {
        await supabase.functions.invoke('send-walkin-whatsapp', {
          body: {
            phone: nonBtlPhone,
            name: nonBtlName,
            ticketId: newInstTicketId,
            date: data?.scheduled_date || payload.scheduled_date || 'the scheduled date',
          },
        });
        console.log("✅ Walk-in Installation WhatsApp notification triggered successfully");
      } catch (whatsappError) {
        console.error("⚠️ WhatsApp notification failed:", whatsappError);
      }
    }

    if (data && ticketId) {
      data.ticket_id = ticketId;
      if (data.id) {
        const idMap = getInstallationTicketIdMap();
        idMap[data.id] = ticketId;
        setInstallationTicketIdMap(idMap);
      }
    }

    return data as Installation;
  },

  // Update installation basic fields
  update: async (id: string, updates: Partial<Installation>): Promise<Installation> => {
    let payload: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Clean undefined fields
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    let currentPayload = { ...payload };
    let data: any = null;
    let error: any = null;

    // Retry loop to gracefully handle schema cache differences and missing columns
    for (let attempt = 0; attempt < 12; attempt++) {
      const res = await supabase
        .from("installations")
        .update(currentPayload)
        .eq("id", id)
        .select()
        .maybeSingle();

      data = res.data;
      error = res.error;

      if (!error) {
        break;
      }

      console.warn(`Update installations attempt ${attempt + 1} encountered error:`, error.message);
      const msg = error.message || "";
      let removedAny = false;

      // Extract column name from PostgREST error (e.g. "Could not find the 'brand' column of 'installations' in the schema cache")
      const colMatches = [
        ...msg.matchAll(/['"]([a-zA-Z0-9_]+)['"] column/gi),
        ...msg.matchAll(/column ['"]([a-zA-Z0-9_]+)['"]/gi),
        ...msg.matchAll(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/gi),
        ...msg.matchAll(/column ([a-zA-Z0-9_]+) does not exist/gi)
      ];

      for (const match of colMatches) {
        const colName = match[1];
        if (colName && colName in currentPayload) {
          delete currentPayload[colName];
          removedAny = true;
        }
      }

      // Check all possible schema / migration column variants
      const candidateCols = [
        'equipment_model',
        'serial_number',
        'installation_notes',
        'testing_results',
        'evidence_photos',
        'customer_signature',
        'happiness_code',
        'happiness_code_sent_at',
        'happiness_code_verified',
        'completed_at',
        'verified_at',
        'verified_by',
        'customer_satisfaction',
        'customer_feedback_comments',
        'feedback_comments',
        'correction_requested',
        'correction_notes',
        'corrected_at',
        'brand',
        'brand_oem',
        'equipment_scope',
        'equipment_details',
        'scope_instructions',
        'notes',
        'chargeable_service',
        'is_chargeable',
        'lead_technician_id',
        'walk_in_customer_name',
        'walk_in_customer_phone',
        'installation_site_address',
        'non_btl_customer_name',
        'non_btl_contact_number',
        'non_btl_address',
        'arrival_gps_lat',
        'arrival_gps_lng',
        'arrival_time',
        'service_charge',
        'payment_status',
        'force_closed',
        'force_closed_at',
        'force_closed_by',
        'force_close_reason',
        'force_close_comments',
        'updated_at'
      ];

      for (const col of candidateCols) {
        if (msg.toLowerCase().includes(col.toLowerCase()) && col in currentPayload) {
          delete currentPayload[col];
          removedAny = true;
        }
      }

      if (!removedAny) {
        break;
      }
    }

    if (error) {
      console.error("Error updating installation:", error);
      throw error;
    }
    return (data || { id, ...updates }) as Installation;
  },

  // Assign or Reassign Technicians
  assignTechnicians: async (
    installationId: string,
    technicianIds: string[],
    scheduledDate?: string | null,
    scheduledTime?: string | null,
    reassignmentReason?: string | null,
    leadTechnicianId?: string | null
  ): Promise<void> => {
    // 1. Delete previous assignments for this installation
    const { error: deleteError } = await supabase
      .from("installation_technicians")
      .delete()
      .eq("installation_id", installationId);

    if (deleteError) {
      console.error("Error deleting old installation technicians:", deleteError);
      throw deleteError;
    }

    // 2. Insert new assignments with is_lead flag (with fallback if column missing)
    if (technicianIds && technicianIds.length > 0) {
      const effectiveLeadId = leadTechnicianId || technicianIds[0];
      const rowsToInsert = technicianIds.map((techId) => ({
        installation_id: installationId,
        technician_id: techId,
        is_lead: techId === effectiveLeadId,
      }));

      let { error: insertError } = await supabase
        .from("installation_technicians")
        .insert(rowsToInsert);

      // Fallback if is_lead column not yet created in Supabase
      if (insertError && (insertError.message?.includes("is_lead") || insertError.code === "42703" || insertError.code === "PGRST204")) {
        console.warn("Retrying installation_technicians insert without is_lead column...");
        const fallbackRows = technicianIds.map((techId) => ({
          installation_id: installationId,
          technician_id: techId,
        }));
        const retryRes = await supabase
          .from("installation_technicians")
          .insert(fallbackRows);
        insertError = retryRes.error;
      }

      if (insertError) {
        console.error("Error inserting installation technicians:", insertError);
        throw insertError;
      }
    }

    // 3. Update status and schedule on installation record
    const newStatus = technicianIds.length > 0 ? "Assigned" : "Unassigned";
    const updatePayload: any = {
      status: newStatus,
      current_phase: technicianIds.length > 0 ? 2 : 1,
      updated_at: new Date().toISOString(),
    };

    if (scheduledDate !== undefined) updatePayload.scheduled_date = scheduledDate || null;
    if (scheduledTime !== undefined) updatePayload.scheduled_time = scheduledTime || null;
    if (reassignmentReason !== undefined) updatePayload.reassignment_reason = reassignmentReason || null;
    if (leadTechnicianId !== undefined) updatePayload.lead_technician_id = leadTechnicianId || null;

    let { error: updateError } = await supabase
      .from("installations")
      .update(updatePayload)
      .eq("id", installationId);

    // Fallback if lead_technician_id column not yet created in Supabase
    if (updateError && updateError.message?.includes("lead_technician_id")) {
      console.warn("Retrying installations update without lead_technician_id column...");
      delete updatePayload.lead_technician_id;
      const retryRes = await supabase
        .from("installations")
        .update(updatePayload)
        .eq("id", installationId);
      updateError = retryRes.error;
    }

    if (updateError) {
      console.error("Error updating installation status:", updateError);
      throw updateError;
    }
  },

  // Reassign Technicians (with mandatory reason)
  reassignTechnicians: async (
    installationId: string,
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

    const updates: any = {
      reassignment_reason: reason.trim(),
      lead_technician_id: leadTechId,
      status: "Assigned",
      current_phase: 2,
      happiness_code: null,
      happiness_code_sent_at: null,
      happiness_code_verified: false,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: updateError } = await supabase.from("installations").update(updates).eq("id", installationId);
      if (updateError) throw updateError;
    } catch (err: any) {
      if (err?.message?.includes("column") || err?.code === "42703" || err?.code === "PGRST204") {
        const stripped = { ...updates };
        delete stripped.reassignment_reason;
        delete stripped.happiness_code;
        delete stripped.happiness_code_sent_at;
        delete stripped.happiness_code_verified;
        const { error: retryErr } = await supabase.from("installations").update(stripped).eq("id", installationId);
        if (retryErr) throw retryErr;
      } else {
        throw err;
      }
    }

    try {
      await supabase.from("installation_technicians").delete().eq("installation_id", installationId);
      if (techObjs.length > 0) {
        const rows = techObjs.map((t) => ({
          installation_id: installationId,
          technician_id: t.technician_id,
          is_lead: t.is_lead,
        }));
        const { error: insErr } = await supabase.from("installation_technicians").insert(rows);
        if (insErr) {
          const fallbackRows = techObjs.map((t) => ({
            installation_id: installationId,
            technician_id: t.technician_id,
          }));
          await supabase.from("installation_technicians").insert(fallbackRows);
        }
      }
    } catch (juncErr) {
      console.warn("Could not sync installation_technicians on reassign:", juncErr);
    }
  },

  // Delete an installation
  delete: async (id: string): Promise<void> => {
    // Delete junction records first
    await supabase.from("installation_technicians").delete().eq("installation_id", id);
    const { error } = await supabase.from("installations").delete().eq("id", id);
    if (error) throw error;
  },
};

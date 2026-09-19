import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const SQL_MIGRATION_SCRIPT = `-- ========================================================
-- BRIHASPATHI CMS & INSTALLATIONS DATABASE MIGRATION SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR
-- ========================================================

-- 1. Create junction table for multiple technicians per complaint
CREATE TABLE IF NOT EXISTS complaint_technicians (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_lead BOOLEAN DEFAULT FALSE,
  phase INTEGER DEFAULT 3,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(complaint_id, technician_id)
);

-- 2. Add missing columns to complaints table
ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS ticket_id TEXT,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reassignment_reason TEXT,
ADD COLUMN IF NOT EXISTS pir_status TEXT,
ADD COLUMN IF NOT EXISTS pir_findings_severity TEXT,
ADD COLUMN IF NOT EXISTS supervisor_severity TEXT,
ADD COLUMN IF NOT EXISTS target_duration_hours NUMERIC,
ADD COLUMN IF NOT EXISTS pir_approved_by UUID,
ADD COLUMN IF NOT EXISTS pir_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS target_end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS feedback_collected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS customer_satisfaction TEXT,
ADD COLUMN IF NOT EXISTS feedback_comments TEXT,
ADD COLUMN IF NOT EXISTS feedback_contact_method TEXT,
ADD COLUMN IF NOT EXISTS feedback_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closure_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed_by TEXT,
ADD COLUMN IF NOT EXISTS pir_revision_notes TEXT,
ADD COLUMN IF NOT EXISTS pir_revision_requested_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS pir_revision_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pir_resubmitted_at TIMESTAMP WITH TIME ZONE;

-- 3. Add is_lead column to complaint_technicians if table already exists
ALTER TABLE complaint_technicians
ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phase INTEGER DEFAULT 3;

-- 4. Create indexes for high performance
CREATE INDEX IF NOT EXISTS idx_complaint_tech_complaint ON complaint_technicians(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_tech_technician ON complaint_technicians(technician_id);
CREATE INDEX IF NOT EXISTS idx_complaints_ticket_id ON complaints(ticket_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE complaint_technicians ENABLE ROW LEVEL SECURITY;

-- 6. Add RLS policies for complaint_technicians
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'complaint_technicians' AND policyname = 'Allow read access to all users'
  ) THEN
    CREATE POLICY "Allow read access to all users"
    ON complaint_technicians FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'complaint_technicians' AND policyname = 'Allow insert for authenticated users'
  ) THEN
    CREATE POLICY "Allow insert for authenticated users"
    ON complaint_technicians FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'complaint_technicians' AND policyname = 'Allow update for authenticated users'
  ) THEN
    CREATE POLICY "Allow update for authenticated users"
    ON complaint_technicians FOR UPDATE
    USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'complaint_technicians' AND policyname = 'Allow delete for authenticated users'
  ) THEN
    CREATE POLICY "Allow delete for authenticated users"
    ON complaint_technicians FOR DELETE
    USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 7. Update complaints status check constraint to allow all lifecycle statuses
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;

ALTER TABLE complaints ADD CONSTRAINT complaints_status_check 
CHECK (status IN (
  'pending', 
  'unassigned',
  'open',
  'assigned', 
  'dispatched',
  'in-progress', 
  'in_progress',
  'awaiting_pir_approval', 
  'pir_submitted', 
  'pir_submitted_awaiting_approval',
  'pir_approved', 
  'pir_approved_work_in_progress',
  'pir_rejected', 
  'rework_required',
  'resolution_pending', 
  'awaiting_signoff', 
  'completed', 
  'resolved',
  'closed', 
  'cancelled'
));

-- 8. Update complaints pir_status check constraint to allow all PIR workflow states
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_pir_status_check;

ALTER TABLE complaints ADD CONSTRAINT complaints_pir_status_check 
CHECK (pir_status IS NULL OR pir_status IN (
  'pending',
  'submitted',
  'pending_approval',
  'resubmitted',
  'approved',
  'rejected',
  'revision_requested'
));

-- 9. Fix 'complaints' table for service charges & payments
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS service_charge NUMERIC DEFAULT 0;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';

-- 10. Fix 'installations' table for service charges, payments & brand
ALTER TABLE installations ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE installations ADD COLUMN IF NOT EXISTS service_charge NUMERIC DEFAULT 0;
ALTER TABLE installations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';

-- 11. Fix 'payment_records' table with complete schema & indexes
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT UNIQUE NOT NULL,
  raw_ticket_id UUID,
  customer_name TEXT NOT NULL DEFAULT 'Customer',
  technician_name TEXT,
  service_charge NUMERIC(10,2) DEFAULT 0,
  quotation_estimate NUMERIC(10,2) DEFAULT 0,
  invoice_number TEXT UNIQUE NOT NULL,
  payment_status TEXT DEFAULT 'Pending',
  payment_received_date DATE,
  payment_remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all columns exist on payment_records if table was created earlier without them
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT 'Customer';
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS raw_ticket_id UUID;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS technician_name TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS quotation_estimate NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS payment_received_date DATE;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS payment_remarks TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_records_ticket_id ON payment_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_customer_name ON payment_records(customer_name);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_number ON payment_records(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_status ON payment_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_records_created_at ON payment_records(created_at);

-- Enable RLS and create policy for payment_records
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_records' AND policyname = 'Allow all access to payment_records'
  ) THEN
    CREATE POLICY "Allow all access to payment_records" ON payment_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 12. Fix 'installation_technicians' table with is_lead column
ALTER TABLE installation_technicians ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_installation_technicians_is_lead ON installation_technicians(is_lead);

-- 13. Add workflow execution, metadata, and verification columns to 'installations' table
ALTER TABLE installations
ADD COLUMN IF NOT EXISTS lead_technician_id UUID,
ADD COLUMN IF NOT EXISTS walk_in_customer_name TEXT,
ADD COLUMN IF NOT EXISTS walk_in_customer_phone TEXT,
ADD COLUMN IF NOT EXISTS installation_site_address TEXT,
ADD COLUMN IF NOT EXISTS equipment_scope TEXT,
ADD COLUMN IF NOT EXISTS brand_oem TEXT,
ADD COLUMN IF NOT EXISTS scope_instructions TEXT,
ADD COLUMN IF NOT EXISTS current_phase INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS equipment_model TEXT,
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS installation_notes TEXT,
ADD COLUMN IF NOT EXISTS testing_results TEXT,
ADD COLUMN IF NOT EXISTS evidence_photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS customer_signature TEXT,
ADD COLUMN IF NOT EXISTS arrival_gps_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS arrival_gps_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS happiness_code TEXT,
ADD COLUMN IF NOT EXISTS happiness_code_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS happiness_code_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS customer_satisfaction TEXT,
ADD COLUMN IF NOT EXISTS customer_feedback_comments TEXT,
ADD COLUMN IF NOT EXISTS correction_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS correction_notes TEXT,
ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP WITH TIME ZONE;

-- 13. Create installation-evidence storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('installation-evidence', 'installation-evidence', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow all access to installation-evidence'
  ) THEN
    CREATE POLICY "Allow all access to installation-evidence"
    ON storage.objects FOR ALL
    USING (bucket_id = 'installation-evidence')
    WITH CHECK (bucket_id = 'installation-evidence');
  END IF;
END $$;
`;

let migrationChecked = false;
let migrationMissing = false;

export const checkAndRunMigration = async (): Promise<boolean> => {
  if (migrationChecked) return !migrationMissing;
  try {
    const { error } = await supabase
      .from("complaint_technicians")
      .select("id")
      .limit(1);

    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
      migrationMissing = true;
      migrationChecked = true;
      console.warn("⚠️ complaint_technicians table is missing. Please run database migration script in Supabase SQL Editor.");
      toast.warning("Database migration required for multiple technician assignment. Run the SQL migration script in Supabase.", {
        duration: 8000,
      });
      return false;
    }
    migrationMissing = false;
    migrationChecked = true;
    return true;
  } catch (err) {
    console.warn("Error checking migration status:", err);
    return false;
  }
};

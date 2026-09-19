-- ==========================================================
-- Migration: Create complaint_technicians and Happiness Code
-- ==========================================================

-- 1. Create complaint_technicians junction table
CREATE TABLE IF NOT EXISTS complaint_technicians (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_lead BOOLEAN DEFAULT FALSE,
  phase INTEGER DEFAULT 3,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(complaint_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_complaint_tech_complaint ON complaint_technicians(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_tech_technician ON complaint_technicians(technician_id);

-- Enable RLS
ALTER TABLE complaint_technicians ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'complaint_technicians' AND policyname = 'Allow authenticated users full access to complaint_technicians') THEN
    DROP POLICY "Allow authenticated users full access to complaint_technicians" ON complaint_technicians;
  END IF;
END $$;

CREATE POLICY "Allow authenticated users full access to complaint_technicians"
  ON complaint_technicians
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow anon if your app uses anon key
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'complaint_technicians' AND policyname = 'Allow anon users full access to complaint_technicians') THEN
    DROP POLICY "Allow anon users full access to complaint_technicians" ON complaint_technicians;
  END IF;
END $$;

CREATE POLICY "Allow anon users full access to complaint_technicians"
  ON complaint_technicians
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2. Add Happiness Code columns to complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS happiness_code TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS happiness_code_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS happiness_code_verified BOOLEAN DEFAULT FALSE;

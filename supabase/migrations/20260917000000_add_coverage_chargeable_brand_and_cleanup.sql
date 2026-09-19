-- ==============================================================================
-- 0. ADD DESIGNATION & TECHNICIAN_ID TO PROFILES TABLE
-- ==============================================================================
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS technician_id text;

-- 1. ADD NEW COLUMNS TO COMPLAINTS TABLE
ALTER TABLE IF EXISTS public.complaints
  ADD COLUMN IF NOT EXISTS coverage text DEFAULT 'Out of Warranty',
  ADD COLUMN IF NOT EXISTS chargeable_service text DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS scheduled_date text,
  ADD COLUMN IF NOT EXISTS scheduled_time text,
  ADD COLUMN IF NOT EXISTS ticket_id text;

-- Comment on columns
COMMENT ON COLUMN public.complaints.coverage IS 'Warranty or contract coverage: Under Warranty, Out of Warranty, AMC, CAMC, Chargeable Service';
COMMENT ON COLUMN public.complaints.chargeable_service IS 'Chargeable service flag: Yes or No';
COMMENT ON COLUMN public.complaints.brand IS 'Product brand (e.g. Luminous, Hikvision, Exide)';
COMMENT ON COLUMN public.complaints.ticket_id IS '7-digit sequential identifier (e.g. BTL-CMS-2026-0000001)';

-- 2. ADD BRAND COLUMN TO CUSTOMER_ASSETS TABLE
ALTER TABLE IF EXISTS public.customer_assets
  ADD COLUMN IF NOT EXISTS brand text;

COMMENT ON COLUMN public.customer_assets.brand IS 'Manufacturer/brand name of the installed asset';

-- 3. ADD BRAND & SCHEDULED COLUMNS TO INSTALLATIONS TABLE
ALTER TABLE IF EXISTS public.installations
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS scheduled_date text,
  ADD COLUMN IF NOT EXISTS scheduled_time text,
  ADD COLUMN IF NOT EXISTS ticket_id text;

-- 4. CREATE INDEXES FOR OPTIMAL QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_complaints_ticket_id ON public.complaints (ticket_id);
CREATE INDEX IF NOT EXISTS idx_installations_ticket_id ON public.installations (ticket_id);
CREATE INDEX IF NOT EXISTS idx_customer_assets_brand ON public.customer_assets (brand);
CREATE INDEX IF NOT EXISTS idx_complaints_scheduled_date ON public.complaints (scheduled_date);

-- 5. ENSURE COMPLAINT_TECHNICIANS JUNCTION TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.complaint_technicians (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_lead boolean DEFAULT false,
  phase integer DEFAULT 1,
  assigned_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.complaint_technicians ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'complaint_technicians' AND policyname = 'Allow read complaint_technicians'
  ) THEN
    CREATE POLICY "Allow read complaint_technicians" ON public.complaint_technicians FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'complaint_technicians' AND policyname = 'Allow insert complaint_technicians'
  ) THEN
    CREATE POLICY "Allow insert complaint_technicians" ON public.complaint_technicians FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'complaint_technicians' AND policyname = 'Allow update complaint_technicians'
  ) THEN
    CREATE POLICY "Allow update complaint_technicians" ON public.complaint_technicians FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'complaint_technicians' AND policyname = 'Allow delete complaint_technicians'
  ) THEN
    CREATE POLICY "Allow delete complaint_technicians" ON public.complaint_technicians FOR DELETE USING (true);
  END IF;
END $$;

-- ==============================================================================
-- DATA CLEANUP SCRIPT: Remove Mock/Old Data & Prep for 7-digit Sequential IDs
-- ==============================================================================

-- A. Remove dummy / mock complaint technicians and complaints created before yesterday
DELETE FROM public.complaint_technicians
WHERE complaint_id IN (
  SELECT id FROM public.complaints
  WHERE created_at < (CURRENT_DATE - INTERVAL '1 day')
     OR title ILIKE '%test%'
     OR title ILIKE '%mock%'
     OR customer_name ILIKE '%test%'
     OR customer_name ILIKE '%dummy%'
);

DELETE FROM public.complaints
WHERE created_at < (CURRENT_DATE - INTERVAL '1 day')
   OR title ILIKE '%test%'
   OR title ILIKE '%mock%'
   OR customer_name ILIKE '%test%'
   OR customer_name ILIKE '%dummy%';

-- B. Remove dummy / mock installation technicians and installations created before yesterday
DELETE FROM public.installation_technicians
WHERE installation_id IN (
  SELECT id FROM public.installations
  WHERE created_at < (CURRENT_DATE - INTERVAL '1 day')
     OR non_btl_customer_name ILIKE '%test%'
     OR non_btl_customer_name ILIKE '%mock%'
     OR notes ILIKE '%test%'
     OR equipment_details ILIKE '%test%'
);

DELETE FROM public.installations
WHERE created_at < (CURRENT_DATE - INTERVAL '1 day')
   OR non_btl_customer_name ILIKE '%test%'
   OR non_btl_customer_name ILIKE '%mock%'
   OR notes ILIKE '%test%'
   OR equipment_details ILIKE '%test%';

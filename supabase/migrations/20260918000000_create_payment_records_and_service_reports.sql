-- ==============================================================================
-- MIGRATION: Create Payment Records Table & Indexes for Service Reports
-- Description: Supports Chargeable Services, Invoicing, and Payment Management
-- ==============================================================================

-- 1. Create payment_records table if it does not exist
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  raw_ticket_id UUID,
  ticket_type TEXT DEFAULT 'complaint', -- 'complaint' or 'installation'
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  technician_name TEXT,
  service_charge NUMERIC(12, 2) DEFAULT 0,
  quotation_estimate NUMERIC(12, 2) DEFAULT 0,
  invoice_number TEXT NOT NULL,
  payment_status TEXT DEFAULT 'Pending', -- 'Pending', 'Partially Paid', 'Paid', 'Not Applicable'
  payment_received_date DATE,
  payment_remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_payment_records_ticket UNIQUE (ticket_id),
  CONSTRAINT uq_payment_records_invoice UNIQUE (invoice_number)
);

-- 2. If table was previously created with ticket_id as UUID, alter it to TEXT to support formatted IDs
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_records' AND column_name = 'ticket_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.payment_records ALTER COLUMN ticket_id TYPE TEXT;
  END IF;
END $$;

-- 3. Ensure all columns exist
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS raw_ticket_id UUID;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'complaint';
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS technician_name TEXT;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS service_charge NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS quotation_estimate NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS payment_received_date DATE;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS payment_remarks TEXT;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Ensure payment columns on complaints and installations
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Not Applicable';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS service_charge NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS quotation_estimate NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Not Applicable';
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS service_charge NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS quotation_estimate NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_payment_records_ticket_id ON public.payment_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_number ON public.payment_records(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_status ON public.payment_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_records_received_date ON public.payment_records(payment_received_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_customer_id ON public.payment_records(customer_id);

-- 6. Enable Row Level Security
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- 7. Policies: Authenticated users have full access (Admin, Supervisor, Manager)
DROP POLICY IF EXISTS "Allow authenticated full access to payment_records" ON public.payment_records;
CREATE POLICY "Allow authenticated full access to payment_records"
  ON public.payment_records FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow public/anon read if needed
DROP POLICY IF EXISTS "Allow anon read to payment_records" ON public.payment_records;
CREATE POLICY "Allow anon read to payment_records"
  ON public.payment_records FOR SELECT TO anon
  USING (true);

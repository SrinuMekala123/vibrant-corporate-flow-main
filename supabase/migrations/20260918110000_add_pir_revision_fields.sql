-- Add PIR revision tracking columns to complaints table
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS pir_revision_notes TEXT,
ADD COLUMN IF NOT EXISTS pir_revision_requested_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS pir_revision_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pir_resubmitted_at TIMESTAMP WITH TIME ZONE;

-- Relax pir_status check constraint to support all PIR workflow statuses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'complaints_pir_status_check'
  ) THEN
    ALTER TABLE public.complaints DROP CONSTRAINT complaints_pir_status_check;
  END IF;
END $$;

ALTER TABLE public.complaints 
ADD CONSTRAINT complaints_pir_status_check 
CHECK (pir_status IS NULL OR pir_status = ANY (ARRAY[
  'pending'::text, 
  'submitted'::text, 
  'pending_approval'::text, 
  'resubmitted'::text, 
  'approved'::text, 
  'rejected'::text, 
  'revision_requested'::text
]));

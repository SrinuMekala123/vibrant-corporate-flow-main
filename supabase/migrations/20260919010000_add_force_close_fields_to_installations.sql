-- ==============================================================================
-- ADD FORCE CLOSE AND HAPPINESS CODE FIELDS TO INSTALLATIONS TABLE
-- ==============================================================================
ALTER TABLE IF EXISTS public.installations
  ADD COLUMN IF NOT EXISTS force_closed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_close_reason text,
  ADD COLUMN IF NOT EXISTS force_close_comments text,
  ADD COLUMN IF NOT EXISTS force_closed_by text,
  ADD COLUMN IF NOT EXISTS force_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS happiness_code text,
  ADD COLUMN IF NOT EXISTS happiness_code_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS happiness_code_verified boolean DEFAULT false;

COMMENT ON COLUMN public.installations.force_closed IS 'Flag indicating whether installation was force closed by admin';
COMMENT ON COLUMN public.installations.force_close_reason IS 'Reason selected by admin for force closing (e.g. Customer unreachable)';
COMMENT ON COLUMN public.installations.force_close_comments IS 'Detailed explanation for force closure';

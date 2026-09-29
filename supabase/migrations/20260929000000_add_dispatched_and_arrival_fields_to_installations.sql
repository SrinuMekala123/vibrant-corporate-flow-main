-- Add missing columns to installations table
ALTER TABLE IF EXISTS public.installations
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_time timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_gps_lat numeric,
  ADD COLUMN IF NOT EXISTS arrival_gps_lng numeric;

COMMENT ON COLUMN public.installations.dispatched_at IS 'Timestamp when technician started journey to site';
COMMENT ON COLUMN public.installations.arrival_time IS 'Timestamp when technician arrived at site';
COMMENT ON COLUMN public.installations.arrival_gps_lat IS 'GPS latitude captured on arrival';
COMMENT ON COLUMN public.installations.arrival_gps_lng IS 'GPS longitude captured on arrival';

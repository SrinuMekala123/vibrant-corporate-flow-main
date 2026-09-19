-- ==============================================================================
-- ADD TECHNICIAN_ID, DESIGNATION, EMPLOYEE_ID & EXPERTISE TO PROFILES TABLE
-- Run this in your Supabase SQL Editor if columns are not yet present.
-- ==============================================================================

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS technician_id text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS expertise text;

-- Create indexes for performance on lookups
CREATE INDEX IF NOT EXISTS idx_profiles_technician_id ON public.profiles (technician_id);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles (employee_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

ALTER TABLE IF EXISTS public.customer_assets
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.customer_locations(id) ON DELETE SET NULL;

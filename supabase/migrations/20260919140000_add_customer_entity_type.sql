-- Classify customers as Individual or Company for filtering and form UX.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'Individual';

UPDATE public.customers
SET entity_type = 'Individual'
WHERE entity_type IS NULL OR entity_type NOT IN ('Individual', 'Company');

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_entity_type_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_entity_type_check
  CHECK (entity_type IN ('Individual', 'Company'));

CREATE INDEX IF NOT EXISTS idx_customers_entity_type
  ON public.customers (entity_type);

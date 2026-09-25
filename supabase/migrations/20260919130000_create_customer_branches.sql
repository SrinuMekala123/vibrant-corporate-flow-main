-- Allow a customer to be linked to multiple branch locations.
CREATE TABLE IF NOT EXISTS public.customer_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_branches_customer_id
  ON public.customer_branches (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_branches_branch_id
  ON public.customer_branches (branch_id);

ALTER TABLE public.customer_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view customer_branches" ON public.customer_branches;
CREATE POLICY "Authenticated can view customer_branches"
  ON public.customer_branches
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and supervisors manage customer_branches" ON public.customer_branches;
CREATE POLICY "Admins and supervisors manage customer_branches"
  ON public.customer_branches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

-- Backfill from legacy single branch_id column.
INSERT INTO public.customer_branches (customer_id, branch_id)
SELECT c.id, c.branch_id
FROM public.customers c
WHERE c.branch_id IS NOT NULL
ON CONFLICT (customer_id, branch_id) DO NOTHING;

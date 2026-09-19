-- ========================================================
-- ENABLE RLS ACCESS POLICIES FOR INSTALLATIONS
-- ========================================================

-- 1. Enable RLS on installations & installation_technicians
ALTER TABLE IF EXISTS public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.installation_technicians ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any to avoid duplication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installations' AND policyname = 'Allow authenticated users full access to installations') THEN
    DROP POLICY "Allow authenticated users full access to installations" ON public.installations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installations' AND policyname = 'Allow anon users full access to installations') THEN
    DROP POLICY "Allow anon users full access to installations" ON public.installations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installation_technicians' AND policyname = 'Allow authenticated users full access to installation_technicians') THEN
    DROP POLICY "Allow authenticated users full access to installation_technicians" ON public.installation_technicians;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installation_technicians' AND policyname = 'Allow anon users full access to installation_technicians') THEN
    DROP POLICY "Allow anon users full access to installation_technicians" ON public.installation_technicians;
  END IF;
END $$;

-- 3. Create full access policies for installations
CREATE POLICY "Allow authenticated users full access to installations"
  ON public.installations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon users full access to installations"
  ON public.installations
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 4. Create full access policies for installation_technicians
CREATE POLICY "Allow authenticated users full access to installation_technicians"
  ON public.installation_technicians
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon users full access to installation_technicians"
  ON public.installation_technicians
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

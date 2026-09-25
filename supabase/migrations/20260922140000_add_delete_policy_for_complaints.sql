-- Add DELETE RLS policy for complaints table
-- This allows admins and supervisors to delete complaints

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'Allow delete complaints'
  ) THEN
    CREATE POLICY "Allow delete complaints" ON public.complaints 
    FOR DELETE 
    USING (
      ("auth"."jwt"() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supervisor'::text])
    );
  END IF;
END $$;

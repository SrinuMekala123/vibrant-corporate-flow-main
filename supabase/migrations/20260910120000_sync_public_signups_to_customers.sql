-- Keep every public customer signup visible in the admin Customers page.
-- The unique index makes the trigger insert idempotent for retries.
CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_unique
  ON public.customers (user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_name text;
  signup_role text;
  signup_phone text;
BEGIN
  signup_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  signup_role := COALESCE(new.raw_user_meta_data->>'role', 'customer');
  signup_phone := new.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, email, full_name, role, phone, expertise, avatar_url)
  VALUES (
    new.id,
    new.email,
    signup_name,
    signup_role,
    signup_phone,
    new.raw_user_meta_data->>'expertise',
    COALESCE(signup_name, substring(new.email from 1 for 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  IF signup_role = 'customer' AND NULLIF(trim(signup_phone), '') IS NOT NULL THEN
    INSERT INTO public.customers (user_id, full_name, email, phone, customer_type, branch_id)
    VALUES (new.id, signup_name, new.email, signup_phone, 'Retail', NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone;
  END IF;

  RETURN new;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated, service_role;

-- Backfill customer rows for public accounts created before this sync was added.
INSERT INTO public.customers (user_id, full_name, email, phone, customer_type, branch_id)
SELECT
  p.id,
  p.full_name,
  p.email,
  p.phone,
  COALESCE(p.customer_type, 'Retail'),
  NULL
FROM public.profiles p
WHERE p.role = 'customer'
  AND NULLIF(trim(p.phone), '') IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

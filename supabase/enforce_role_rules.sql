-- Security Enforcement: Prevent unauthorized role changes on the profiles table
-- Only users with 'admin' role can change the 'role' column of any profile.

CREATE OR REPLACE FUNCTION check_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role / superuser to update roles (e.g. for sign-up/migrations)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- If the current updater is not an admin, block the update
    IF COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), '') IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'You are not authorized to change system roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_profile_role_protection ON public.profiles;
CREATE TRIGGER enforce_profile_role_protection
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_role_update();

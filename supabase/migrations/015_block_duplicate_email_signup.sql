-- ============================================================
-- Migration 015 — Block duplicate-email signups at the trigger.
--
-- Bug: Supabase only enforces email uniqueness across CONFIRMED auth users.
-- If a user does password signup, abandons before confirming, then later
-- registers with Google for the same email, Supabase creates a *second*
-- auth.users row. The existing handle_new_auth_user trigger then spins up
-- a second public.users + parent_profiles, granting the same human another
-- free-plan child quota.
--
-- Fix: reject the INSERT if another auth.users row already has this email
-- (case-insensitive). Operators must clean up the abandoned row manually
-- before the user can re-register. Belt-and-braces: the dashboard's
-- "Confirm email" setting should also be enabled so unconfirmed rows
-- expire automatically.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := NEW.id;
  v_name    TEXT := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_role    TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
BEGIN
  -- Reject the signup if another auth user already exists with this email.
  -- This catches the password-then-Google duplication that Supabase's own
  -- email-uniqueness check misses for unconfirmed accounts.
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(NEW.email)
    AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'An account with this email already exists. Please sign in instead.'
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Create public.users row
  INSERT INTO public.users (user_id, name, role)
  VALUES (v_user_id, v_name, v_role)
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-create parent_profiles row for parent accounts.
  -- pin_hash uses a placeholder — real PIN is set later via setup-pin screen.
  IF v_role = 'parent' THEN
    INSERT INTO public.parent_profiles (user_id, pin_hash)
    VALUES (v_user_id, '$2b$12$placeholder_pin_not_yet_set_xxxxx')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

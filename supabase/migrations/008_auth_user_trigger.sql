-- ============================================================
-- Migration 008: Auto-create public.users row on auth signup
--
-- Problem: child_profiles.parent_id FK references public.users(user_id)
-- but Supabase signup only creates auth.users — no public.users row.
-- This trigger bridges the gap.
--
-- Run this in: Supabase Dashboard → SQL Editor → Run
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
  -- Create public.users row
  INSERT INTO public.users (user_id, name, role)
  VALUES (v_user_id, v_name, v_role)
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-create parent_profiles row for parent accounts
  -- pin_hash uses a placeholder — real PIN is set later via setup-pin screen
  IF v_role = 'parent' THEN
    INSERT INTO public.parent_profiles (user_id, pin_hash)
    VALUES (v_user_id, '$2b$12$placeholder_pin_not_yet_set_xxxxx')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if it already exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- Back-fill: create public.users + parent_profiles rows for any
-- auth users who signed up before this trigger was added
-- ============================================================
INSERT INTO public.users (user_id, name, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'role', 'parent')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.user_id = au.id
);

INSERT INTO public.parent_profiles (user_id, pin_hash)
SELECT
  u.user_id,
  '$2b$12$placeholder_pin_not_yet_set_xxxxx'
FROM public.users u
WHERE u.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM public.parent_profiles pp WHERE pp.user_id = u.user_id
  );

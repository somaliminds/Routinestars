-- ============================================================
-- Migration 041: Anon-readable signups flag (for the pre-auth signup gate)
--
-- signups_enabled (migration 038) lives in app_config, which only authenticated
-- users may read. But the signup screen runs BEFORE auth, so it cannot read the
-- flag directly. Rather than open the whole app_config table to anon, expose a
-- single whitelisted SECURITY DEFINER function that returns just this one
-- non-sensitive boolean. Fails OPEN (true) if the row is missing.
-- (maintenance_mode is enforced AFTER auth, so it keeps the authenticated-only
-- app_config read — no anon access needed there.)
-- Depends on migration 038.
-- ============================================================

CREATE OR REPLACE FUNCTION public.signups_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT value = 'true'::jsonb FROM public.app_config WHERE key = 'signups_enabled'),
    true
  );
$$;
REVOKE ALL ON FUNCTION public.signups_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signups_enabled() TO anon, authenticated;

-- ============================================================
-- Migration 043: Revoke anon EXECUTE on the admin-only RPCs
--
-- Found by the live smoke test (2026-10-05): an anonymous caller could EXECUTE
-- the admin RPCs. Supabase's default privileges grant EXECUTE on new public
-- functions to `anon` EXPLICITLY (ACL showed anon=X/postgres), so the
-- `REVOKE ALL ... FROM PUBLIC` in migrations 038/039/040 never removed it.
-- No data was exposed — every one of these functions fails closed internally
-- (is_admin() check -> empty result / 'not authorised') — but the intended
-- defense-in-depth layer was not actually in place. This puts it in place.
--
-- Deliberately NOT revoked from anon:
--   - is_admin():        RLS policies call it; without EXECUTE an anon policy
--                        check would ERROR instead of evaluating to false.
--   - signups_enabled(): the pre-auth signup gate — anon access is the point.
--   - get_boot_context(): returns NULL for anon; harmless.
-- `authenticated` keeps EXECUTE (admins are authenticated users; the internal
-- is_admin() gate still decides).
-- Depends on migrations 038, 039, 040.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.admin_overview_metrics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_recent_ai_log(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_save_activity_set(jsonb) FROM anon;

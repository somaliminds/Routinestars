-- ============================================================
-- Migration 047: Erasing a login also erases the person's app data
--
-- public.users has no foreign key to auth.users, so deleting someone from the
-- Supabase Auth dashboard removed only their LOGIN — their public.users row and
-- everything that cascades from it (child profiles, completions, schedules…)
-- stayed behind with no owner. Found on 2026-10-05: 3 such orphan accounts
-- holding 3 children's data, inflating the admin dashboard and defeating
-- right-to-erasure.
--
-- This AFTER DELETE trigger on auth.users removes the matching public.users
-- row, so the existing ON DELETE CASCADE / SET NULL foreign keys finish the
-- erasure. The app's own deletion paths (delete-account, admin-users) already
-- delete public data first, so for them the trigger finds nothing to do.
-- If a cascade is blocked (e.g. day_schedules.created_by NOT NULL from a
-- cross-family schedule), the whole auth deletion fails loudly instead of
-- leaving an orphan behind.
-- Depends on migrations 001 + 008.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.users WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
-- Trigger-only function: nobody should call it over the API.
REVOKE ALL ON FUNCTION public.handle_auth_user_deleted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_auth_user_deleted() FROM anon, authenticated;

CREATE OR REPLACE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

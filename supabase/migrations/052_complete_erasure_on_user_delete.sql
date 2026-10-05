-- ============================================================
-- Migration 052: Deleting a person erases everything they own, and nothing
--                they did for another family can block it
--
-- Deleting public.users (delete-account, admin-users, the 047 auth trigger, or
-- SQL) relied on FK actions alone, which left two right-to-erasure gaps:
--  1. activity_sets.created_by_parent_id is ON DELETE SET NULL, so a deleted
--     parent's custom routines (+ steps) survived with NO owner — invisible to
--     everyone, never erased.
--  2. day_schedules.created_by is NOT NULL with NO ACTION, so a schedule a
--     person created for ANOTHER family's child blocked deleting that person
--     (found 2026-10-05: orphan 3d0230a3… can't be erased because of one).
--
-- A BEFORE DELETE trigger on public.users now erases in a safe order:
--  a. their children and everything under them (what the cascade did anyway,
--     done first so (b) no longer meets their own children's schedules);
--  b. their custom sets + steps — except a set another family still has
--     scheduled (cross-family scheduling is blocked since 048; only stale test
--     rows remain), which keeps the old SET NULL behaviour rather than
--     deleting another family's history;
--  c. schedules they created for another family's child stay with that family
--     and are credited to the child's own parent.
-- Only CREATE FUNCTION / CREATE TRIGGER — no FK or column is dropped.
-- ============================================================

CREATE OR REPLACE FUNCTION public.erase_user_owned_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- a. Children and everything under them (schedules, completions, rewards…).
  DELETE FROM public.child_profiles WHERE parent_id = OLD.user_id;

  -- b. Their private custom routines (steps cascade), unless another family
  --    still has the set scheduled — their own children's schedules are gone.
  DELETE FROM public.activity_sets a
   WHERE a.created_by_parent_id = OLD.user_id
     AND a.is_custom = true
     AND NOT EXISTS (SELECT 1 FROM public.scheduled_sets ss WHERE ss.set_id = a.set_id);

  -- c. Schedules they made for another family's child belong to that family.
  UPDATE public.day_schedules ds
     SET created_by = c.parent_id
    FROM public.child_profiles c
   WHERE ds.created_by = OLD.user_id
     AND c.profile_id = ds.child_id;

  RETURN OLD;
END;
$$;
-- Trigger-only function: nobody should call it over the API.
REVOKE ALL ON FUNCTION public.erase_user_owned_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_user_owned_data() FROM anon, authenticated;

CREATE OR REPLACE TRIGGER before_user_deleted
  BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.erase_user_owned_data();

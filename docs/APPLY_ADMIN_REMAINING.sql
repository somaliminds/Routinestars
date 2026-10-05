-- ============================================================================
-- RoutineStars admin rollout — REMAINING PASTE (needs a human: contains DROP)
--
-- Already done directly on the live DB via the Supabase MCP (2026-10-05):
--   039 admin_recent_ai_log RPC · 040 is_active + atomic save RPC ·
--   041 signups_enabled RPC · admin bootstrap (somaliminds0 = owner).
--   040 was tested end-to-end inside a deliberately rolled-back transaction.
--
-- The MCP declines any statement containing DROP in this (non-interactive)
-- setup, so two items are left for you:
--   1. 039 cleanup — remove the old column-blind ai_generation_log admin policy.
--      It was already neutralised in place (USING (false)) so it grants nothing
--      today; this just tidies it away.
--   2. 042 — ON DELETE SET NULL on completions.approved_by and
--      lockout_events.unlocked_by, so deleting a care-team approver can complete.
--      (Postgres 17 can only change an FK's ON DELETE action by drop + re-add.)
--
-- HOW TO USE: Supabase dashboard → SQL Editor → paste this WHOLE file → Run.
-- Atomic (one transaction): if anything fails, nothing changes. Then the result
-- grid shows a verification table — every row should read 'true'.
-- ============================================================================

BEGIN;

-- 1. 039 cleanup
DROP POLICY IF EXISTS "ai_generation_log_admin_read" ON public.ai_generation_log;

-- 2. 042 — verbatim from supabase/migrations/042_erasure_fk_set_null.sql
-- ============================================================
-- Migration 042: Let lawful erasure complete for cross-family references
--
-- When an admin deletes a user, public.users cascades to the user's OWN data.
-- But a care-team member (e.g. a therapist) may have approved completions or
-- unlocked routines for OTHER families' children. Those columns reference
-- public.users with the default NO ACTION, so the delete FK-blocks and (now,
-- after the admin-users fix) fails honestly. Switching them to ON DELETE SET
-- NULL lets the erasure complete while preserving the child's row (the actor
-- simply becomes unknown).
--
-- Only the NULLABLE references are changed here:
--   - completions.approved_by   (nullable)      -> SET NULL
--   - lockout_events.unlocked_by (nullable)     -> SET NULL
-- day_schedules.created_by is NOT NULL, so it can't be SET NULL without also
-- dropping NOT NULL — deliberately left as-is (such deletes fail honestly).
-- Constraints are located by column so the auto-generated name doesn't matter.
-- Depends on migration 001.
-- ============================================================

DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
    FROM pg_constraint con
   WHERE con.conrelid = 'public.completions'::regclass
     AND con.contype = 'f'
     AND con.conkey = ARRAY[
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.completions'::regclass AND attname = 'approved_by')
     ];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.completions DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE public.completions
    ADD CONSTRAINT completions_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
END $$;

DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
    FROM pg_constraint con
   WHERE con.conrelid = 'public.lockout_events'::regclass
     AND con.contype = 'f'
     AND con.conkey = ARRAY[
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.lockout_events'::regclass AND attname = 'unlocked_by')
     ];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.lockout_events DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE public.lockout_events
    ADD CONSTRAINT lockout_events_unlocked_by_fkey
    FOREIGN KEY (unlocked_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
END $$;

COMMIT;

-- ============================ VERIFICATION =================================
select 'old column-blind ai_log admin policy removed' as item, (not exists(select 1 from pg_policies where schemaname='public' and tablename='ai_generation_log' and policyname='ai_generation_log_admin_read'))::text as ok
union all select 'parents still read their own AI logs', (exists(select 1 from pg_policies where schemaname='public' and tablename='ai_generation_log' and policyname='ai_log_parent_read'))::text
union all select 'fk completions.approved_by = SET NULL', (exists(select 1 from pg_constraint where conname='completions_approved_by_fkey' and confdeltype='n'))::text
union all select 'fk lockout_events.unlocked_by = SET NULL', (exists(select 1 from pg_constraint where conname='lockout_events_unlocked_by_fkey' and confdeltype='n'))::text;

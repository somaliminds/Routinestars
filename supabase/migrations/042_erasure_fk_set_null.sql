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

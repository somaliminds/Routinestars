-- ============================================================
-- Migration 046: Caller check on increment_child_stars
--
-- Closes the follow-up left open by 044. increment_child_stars is SECURITY
-- DEFINER (it bypasses RLS on child_profiles) and, after 044, refused bad
-- amounts and anon — but any signed-in account (signups are open) could still
-- ADD stars to any child whose profile id it knew.
--
-- Legitimate callers, established from the code + live data (2026-10-05):
--   - the child's tablet session — the step sequencer (useStepSequencer) and
--     offline sync (useSyncPending). Today that session is the PARENT's login;
--     the schema also supports a child's own login via child_profiles.user_id
--     (completions_child_* policies), so that identity is allowed too.
--   - the parent on the approval screen ((parent)/approve/[completionId]).
--   - the reward-engine edge function, which verifies its caller itself and
--     then calls this with the service-role key.
-- TAs and care-team members never award stars (TA screens are read-only;
-- care-team "approvers" have no completions policy), so they are not allowed.
-- If a future flow needs them, extend the check deliberately.
-- Depends on migration 044.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_child_stars(p_child_id uuid, p_stars integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Stars are only ever ADDED by the app and the reward engine. Refuse anything
  -- else so nobody can wipe out or overflow a child's stars. (044)
  IF p_stars IS NULL OR p_stars < 0 OR p_stars > 10000 THEN
    RAISE EXCEPTION 'invalid star amount';
  END IF;

  -- Only the reward engine (service role), the child's parent, or the child's
  -- own linked login may award stars to this child. (046)
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1
         FROM public.child_profiles c
        WHERE c.profile_id = p_child_id
          AND (c.parent_id = auth.uid() OR c.user_id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  UPDATE public.child_profiles
     SET total_stars = total_stars + p_stars
   WHERE profile_id = p_child_id;
END;
$$;
-- CREATE OR REPLACE keeps the existing ACL (044 revoked PUBLIC and anon).

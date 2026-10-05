-- ============================================================
-- Migration 044: Harden pre-existing SECURITY DEFINER helpers
--
-- Found by the Supabase security advisor, run as part of verifying the admin
-- rollout (2026-10-05).
--
-- 1. increment_child_stars(p_child_id, p_stars) — SECURITY DEFINER (bypasses RLS
--    on child_profiles), no authorization check, unbounded p_stars, executable by
--    anon. Anyone holding the public app key and a child's id could wipe out
--    (negative p_stars) or overflow that child's stars. Every legitimate caller
--    (step sequencer, parent approval, offline sync, reward-engine) only ever ADDS
--    stars and runs authenticated or as service_role. Interim hardening that
--    changes nothing for them:
--      - reject NULL, negative or absurd (> 10,000) amounts. The largest
--        legitimate single award on 2026-10-05 was 15 (a whole set's stars);
--        total_stars is NOT NULL, so a NULL amount already errored before.
--      - revoke anon EXECUTE (no legitimate caller is anonymous).
--      - pin search_path (the body is fully schema-qualified).
--    STILL OPEN (follow-up): a signed-in user who knows another child's id can
--    still ADD stars to it. Closing that needs a caller-relationship check
--    (parent / care team / child account / service role) verified per role.
--
-- 2. effective_plan(p_user_id) — returned the plan tier of ANY user id to anon.
--    Only the quota triggers call it and both are SECURITY DEFINER (run as
--    owner); no RLS policy references it. Revoking anon changes nothing for them.
--
-- 3. Pin search_path on three helpers the linter flags as "role mutable". Their
--    bodies are fully schema-qualified, so this cannot change their behaviour.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_child_stars(p_child_id uuid, p_stars integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Stars are only ever ADDED by the app and the reward engine. Refuse anything
  -- else so nobody can wipe out or overflow a child's stars.
  IF p_stars IS NULL OR p_stars < 0 OR p_stars > 10000 THEN
    RAISE EXCEPTION 'invalid star amount';
  END IF;
  UPDATE public.child_profiles
     SET total_stars = total_stars + p_stars
   WHERE profile_id = p_child_id;
END;
$$;
-- This function predates the "REVOKE ... FROM PUBLIC" convention, so its ACL
-- also carried a PUBLIC grant (=X/postgres) that anon inherits — revoking the
-- explicit anon entry alone left anon able to call it (caught by the post-apply
-- test). authenticated and service_role keep their own explicit grants.
REVOKE EXECUTE ON FUNCTION public.increment_child_stars(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_child_stars(uuid, integer) FROM anon;

REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM anon;

ALTER FUNCTION public.get_current_user_id() SET search_path = '';
ALTER FUNCTION public.is_parent_of(uuid) SET search_path = '';
ALTER FUNCTION public.touch_ehcp_outcomes_updated_at() SET search_path = '';

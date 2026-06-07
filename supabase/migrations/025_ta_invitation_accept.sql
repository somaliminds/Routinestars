-- ============================================================
-- Migration 025 — Let invitees read their own care-team invitations
-- and accept them safely.
--
-- Bug surfaced during Sprint 4.3 testing: a freshly-invited School TA
-- signs up, AuthGuard tries to auto-accept their pending invitation,
-- but the existing parent-only RLS policy on care_team_members
-- (migration 006) silently blocks the UPDATE. detectTaRole then sees
-- 0 accepted invitations and routes the user as a parent.
--
-- Fix:
--   1. SELECT policy: invitees can read rows where the email matches
--      their auth.email(). Needed by AuthGuard.detectTaRole and by
--      the TA app's fetchLinkedChildren.
--   2. accept_my_care_team_invitations() RPC: a SECURITY DEFINER
--      function that sets accepted_at = NOW() on every still-pending
--      row matching the caller's email. Returns the number of rows
--      accepted. Bypasses the parent-only UPDATE policy without giving
--      invitees blanket UPDATE access (which would let them escalate
--      their own role from view_only to school_ta).
-- ============================================================

-- 1. Read own invitations
CREATE POLICY "care_team_members_invitee_read" ON public.care_team_members
  FOR SELECT
  USING (email = auth.email());

-- 2. Accept own invitations via RPC (SECURITY DEFINER so it bypasses
--    the parent_manage_care_team UPDATE check). Only flips accepted_at
--    on rows where the caller's email matches AND accepted_at IS NULL,
--    so it cannot change anyone else's row, cannot un-accept, and
--    cannot change role / environment / child_id.
CREATE OR REPLACE FUNCTION public.accept_my_care_team_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.email();
  v_count INTEGER;
BEGIN
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.care_team_members
  SET    accepted_at = NOW()
  WHERE  email = v_email
    AND  accepted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_my_care_team_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_my_care_team_invitations() TO authenticated;

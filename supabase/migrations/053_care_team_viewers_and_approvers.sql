-- ============================================================
-- Migration 053: Care-team Viewers and Approvers actually get access
--
-- Parents could invite a "View only" or "Can approve" care-team member, but
-- only school TAs had any RLS access or app screens, so those invitees signed
-- in to an empty parent app. This makes the two roles real:
--
--  Viewer   (view_only) — read the linked child's profile, PUBLISHED
--                          schedules, scheduled activities (+ set names and
--                          steps), completions + step times, and badges.
--  Approver (approver)  — everything a Viewer sees, plus approve or ask for a
--                          redo of activities waiting for approval (the
--                          review_completion RPC is migration 054).
--
-- 1. Invite emails are normalised (lower-case, trimmed). Matching against the
--    signed-in email was exact, so an invite typed "Grandma@Gmail.com" could
--    never be accepted (2 such live invites are repaired here).
-- 2-3. Read policies for accepted Viewers/Approvers. Every cross-table check is
--    a SECURITY DEFINER helper so policies stay flat (see migration 049: RLS
--    that joins through other RLS tables expanded into ~2,500 subplans).
-- 5. approver_push_tokens(): service-role-only lookup so notify-parent can
--    also notify Approvers.
-- 6. get_boot_context() reports has_care_assignment so the app can route a
--    Viewer/Approver to the care-team app; invite matching is case-insensitive.
-- (Section 4, review_completion, was split into 054: the database connector
--  won't apply SQL containing DELETE without an interactive confirmation.)
--
-- Pre-flighted 2026-10-05 in a rolled-back transaction: every existing account
-- and anon see exactly the same rows in 8 tables before/after; a simulated
-- Viewer and Approver (invited with mixed-case emails) are accepted at sign-in
-- and see only the linked child's published data, never a sibling's; a
-- stranger sees nothing; parent planning times stay < 20 ms.
-- Depends on 001, 006, 024, 031, 038, 048, 049.
-- ============================================================

-- 1. Normalise invite emails ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_care_team_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_care_team_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_care_team_email() FROM anon, authenticated;

CREATE OR REPLACE TRIGGER care_team_members_normalize_email
  BEFORE INSERT OR UPDATE OF email ON public.care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.normalize_care_team_email();

UPDATE public.care_team_members
   SET email = lower(btrim(email))
 WHERE email <> lower(btrim(email));

-- 2. Helpers (flat, opaque to the planner) -------------------------------------
-- The caller's accepted care-team role for a child, or NULL.
CREATE OR REPLACE FUNCTION public.my_care_role(p_child_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ctm.role
    FROM public.care_team_members ctm
   WHERE ctm.child_id = p_child_id
     AND ctm.email = lower(auth.email())
     AND ctm.accepted_at IS NOT NULL
   LIMIT 1;
$$;

-- A published schedule of a child the caller is a Viewer/Approver for.
CREATE OR REPLACE FUNCTION public.carer_can_read_schedule(p_schedule_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.day_schedules ds
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
     WHERE ds.schedule_id = p_schedule_id
       AND ds.is_published = true
       AND ctm.email = lower(auth.email())
       AND ctm.role IN ('view_only', 'approver')
       AND ctm.accepted_at IS NOT NULL
  );
$$;

-- An activity set that appears in such a published schedule.
CREATE OR REPLACE FUNCTION public.carer_can_read_set(p_set_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.scheduled_sets ss
      JOIN public.day_schedules ds ON ds.schedule_id = ss.schedule_id
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
     WHERE ss.set_id = p_set_id
       AND ds.is_published = true
       AND ctm.email = lower(auth.email())
       AND ctm.role IN ('view_only', 'approver')
       AND ctm.accepted_at IS NOT NULL
  );
$$;

-- A completion of a child the caller is a Viewer/Approver for.
CREATE OR REPLACE FUNCTION public.carer_can_read_completion(p_completion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.completions c
      JOIN public.care_team_members ctm ON ctm.child_id = c.child_id
     WHERE c.completion_id = p_completion_id
       AND ctm.email = lower(auth.email())
       AND ctm.role IN ('view_only', 'approver')
       AND ctm.accepted_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.my_care_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_care_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_care_role(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.carer_can_read_schedule(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carer_can_read_schedule(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.carer_can_read_schedule(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.carer_can_read_set(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carer_can_read_set(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.carer_can_read_set(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.carer_can_read_completion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carer_can_read_completion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.carer_can_read_completion(uuid) TO authenticated;

-- 3. Read access for accepted Viewers / Approvers (signed-in users only) -------
CREATE POLICY child_profiles_carer_read ON public.child_profiles
  FOR SELECT TO authenticated
  USING (public.my_care_role(profile_id) IN ('view_only', 'approver'));

CREATE POLICY day_schedules_carer_read ON public.day_schedules
  FOR SELECT TO authenticated
  USING (is_published = true AND public.my_care_role(child_id) IN ('view_only', 'approver'));

CREATE POLICY scheduled_sets_carer_read ON public.scheduled_sets
  FOR SELECT TO authenticated
  USING (public.carer_can_read_schedule(schedule_id));

-- Steps follow automatically: steps_read_via_set (048) inherits set visibility.
CREATE POLICY activity_sets_carer_read ON public.activity_sets
  FOR SELECT TO authenticated
  USING (public.carer_can_read_set(set_id));

CREATE POLICY completions_carer_read ON public.completions
  FOR SELECT TO authenticated
  USING (public.my_care_role(child_id) IN ('view_only', 'approver'));

CREATE POLICY step_completions_carer_read ON public.step_completions
  FOR SELECT TO authenticated
  USING (public.carer_can_read_completion(completion_id));

CREATE POLICY child_rewards_carer_read ON public.child_rewards
  FOR SELECT TO authenticated
  USING (public.my_care_role(child_id) IN ('view_only', 'approver'));

-- 5. Push tokens of a child's accepted Approvers (for notify-parent) ----------
CREATE OR REPLACE FUNCTION public.approver_push_tokens(p_child_id uuid)
RETURNS TABLE (expo_push_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT pp.expo_push_token
    FROM public.care_team_members ctm
    JOIN auth.users au ON lower(au.email) = ctm.email
    JOIN public.parent_profiles pp ON pp.user_id = au.id
   WHERE ctm.child_id = p_child_id
     AND ctm.role = 'approver'
     AND ctm.accepted_at IS NOT NULL
     AND pp.expo_push_token LIKE 'ExponentPushToken[%'
     AND coalesce(pp.notify_on_request, true);
$$;
REVOKE ALL ON FUNCTION public.approver_push_tokens(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approver_push_tokens(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approver_push_tokens(uuid) TO service_role;

-- 6. Invite acceptance + boot routing know about Viewers/Approvers -------------
CREATE OR REPLACE FUNCTION public.accept_my_care_team_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT := lower(auth.email());
  v_count INTEGER;
BEGIN
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.care_team_members
     SET accepted_at = NOW()
   WHERE email = v_email
     AND accepted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_boot_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID    := auth.uid();
  v_email        TEXT    := lower(auth.email());
  v_role         TEXT;
  v_own_children INTEGER;
  v_has_ta       BOOLEAN;
  v_has_care     BOOLEAN;
  v_has_consent  BOOLEAN;
  v_pin_hash     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    UPDATE public.care_team_members
    SET    accepted_at = NOW()
    WHERE  email = v_email
      AND  accepted_at IS NULL;

    UPDATE public.consent_records
    SET    professional_id = v_uid
    WHERE  professional_id IS NULL
      AND  lower(professional_email) = v_email;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_own_children FROM public.child_profiles WHERE parent_id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM public.care_team_members
    WHERE email = v_email AND role = 'school_ta' AND accepted_at IS NOT NULL
  ) INTO v_has_ta;

  SELECT EXISTS (
    SELECT 1 FROM public.care_team_members
    WHERE email = v_email AND role IN ('view_only', 'approver') AND accepted_at IS NOT NULL
  ) INTO v_has_care;

  SELECT EXISTS (
    SELECT 1 FROM public.consent_records
    WHERE professional_id = v_uid AND withdrawn_at IS NULL AND expiry_date >= CURRENT_DATE
  ) INTO v_has_consent;

  SELECT pin_hash INTO v_pin_hash FROM public.parent_profiles WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'role',                COALESCE(v_role, 'parent'),
    'own_children',        COALESCE(v_own_children, 0),
    'has_ta_assignment',   COALESCE(v_has_ta, false),
    'has_care_assignment', COALESCE(v_has_care, false),
    'has_active_consent',  COALESCE(v_has_consent, false),
    'needs_pin_setup',     (
      v_pin_hash IS NULL OR length(v_pin_hash) = 0 OR position('placeholder' in v_pin_hash) > 0
    ),
    'is_admin_member',     EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_uid)
  );
END;
$$;

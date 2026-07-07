-- ============================================================
-- Migration 031: get_boot_context() — single-round-trip boot loader
--
-- AuthGuard (app/_layout.tsx) previously fired up to ~6 SEQUENTIAL Supabase
-- round-trips on every sign-in to decide the user's role + PIN state:
--   users.role → accept_my_care_team_invitations → (child count + TA count)
--   → accept_professional_consents → (child count again + consent rows)
--   → parent_profiles.pin_hash
-- That serial chain is the single biggest contributor to slow cold starts,
-- and professional-role detection made it worse.
--
-- This function collapses all of it into ONE call. It performs the same two
-- idempotent claims (TA invitations + professional consents) as side effects
-- so the counts it returns are post-claim, then returns every signal the
-- guard needs as a single JSON object. Behaviour is intentionally identical
-- to the old JS path — this is a pure performance change.
--
-- SECURITY DEFINER (same rationale as accept_my_care_team_invitations /
-- accept_professional_consents in migrations 025 + 029): the two UPDATEs are
-- blocked by parent-only RLS otherwise. Explicit empty search_path.
-- Depends on migrations 025, 028, 029.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_boot_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID    := auth.uid();
  v_email        TEXT    := auth.email();
  v_role         TEXT;
  v_own_children INTEGER;
  v_has_ta       BOOLEAN;
  v_has_consent  BOOLEAN;
  v_pin_hash     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- ── Idempotent claims (mirror migrations 025 + 029 exactly) ──
  -- Accept any pending care-team invitations addressed to this email.
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    UPDATE public.care_team_members
    SET    accepted_at = NOW()
    WHERE  email = v_email
      AND  accepted_at IS NULL;

    -- Link this account to any consents addressed to its email.
    UPDATE public.consent_records
    SET    professional_id = v_uid
    WHERE  professional_id IS NULL
      AND  lower(professional_email) = lower(v_email);
  END IF;

  -- ── Signals (all post-claim) ──
  SELECT role INTO v_role
  FROM public.users
  WHERE user_id = v_uid;

  SELECT COUNT(*) INTO v_own_children
  FROM public.child_profiles
  WHERE parent_id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM public.care_team_members
    WHERE email = v_email
      AND role = 'school_ta'
      AND accepted_at IS NOT NULL
  ) INTO v_has_ta;

  SELECT EXISTS (
    SELECT 1 FROM public.consent_records
    WHERE professional_id = v_uid
      AND withdrawn_at IS NULL
      AND expiry_date >= CURRENT_DATE
  ) INTO v_has_consent;

  SELECT pin_hash INTO v_pin_hash
  FROM public.parent_profiles
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'role',               COALESCE(v_role, 'parent'),
    'own_children',       COALESCE(v_own_children, 0),
    'has_ta_assignment',  COALESCE(v_has_ta, false),
    'has_active_consent', COALESCE(v_has_consent, false),
    -- Placeholder / empty pin_hash means the parent still owes setup-pin.
    'needs_pin_setup',    (
      v_pin_hash IS NULL
      OR length(v_pin_hash) = 0
      OR position('placeholder' in v_pin_hash) > 0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_boot_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_boot_context() TO authenticated;

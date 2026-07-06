-- ============================================================
-- Migration 029: Professional read access (Phase B2)
--
-- ⚠️ SENSITIVE: this migration adds NEW read policies to LIVE tables that
-- hold real children's data. Review carefully before applying.
--
-- What it does — and does NOT do:
--   • ADDS a SELECT-only policy to each evidence table that lets a
--     professional read a child's data ONLY when an active, non-expired,
--     non-withdrawn consent naming them grants the relevant data category.
--   • Does NOT modify or remove any existing parent/child policy. RLS
--     policies are OR-combined, so parents/children keep exactly the access
--     they already have; this only *adds* consented-professional read.
--   • Grants NO write access to professionals on these tables. Their
--     contributions go to a separate table (Phase B4), never here.
--
-- Enforcement is centralised in has_active_consent(), so scope changes in
-- future never require touching every table again.
--
-- Basis: docs/compliance/DPIA_professional_portal.md; research §F/§G;
-- consent model in migration 028.
-- ============================================================

-- ── Consent-check helper ────────────────────────────────────
-- True iff the CURRENT auth user holds an active consent to view the given
-- data category for the given child. SECURITY DEFINER so it can read
-- consent_records regardless of the caller's own row policies; explicit
-- empty search_path (avoids the mutable-search-path advisor warning).
CREATE OR REPLACE FUNCTION public.has_active_consent(p_child_id UUID, p_category TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consent_records c
    WHERE c.child_id = p_child_id
      AND c.withdrawn_at IS NULL
      AND c.expiry_date >= CURRENT_DATE
      AND p_category = ANY (c.data_categories)
      AND (
        c.professional_id = auth.uid()
        OR lower(c.professional_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Restrict who can call it (defence in depth — it's only meant for RLS).
REVOKE ALL ON FUNCTION public.has_active_consent(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_consent(UUID, TEXT) TO authenticated;

-- ── Professional SELECT policies (additive, per data category) ──

-- Basic profile (name, age, avatar)
CREATE POLICY "child_profiles_professional_read" ON public.child_profiles
  FOR SELECT USING (public.has_active_consent(profile_id, 'PROFILE_BASICS'));

-- EHCP outcomes
CREATE POLICY "ehcp_outcomes_professional_read" ON public.ehcp_outcomes
  FOR SELECT USING (public.has_active_consent(child_id, 'OUTCOMES'));

-- APDR cycles
CREATE POLICY "apdr_cycles_professional_read" ON public.apdr_cycles
  FOR SELECT USING (public.has_active_consent(child_id, 'APDR'));

-- Routine completion data / progress (also carries environment tags)
CREATE POLICY "completions_professional_read" ON public.completions
  FOR SELECT USING (public.has_active_consent(child_id, 'COMPLETIONS'));

-- Emotional check-ins (Zones of Regulation)
CREATE POLICY "emotional_checkins_professional_read" ON public.emotional_checkins
  FOR SELECT USING (public.has_active_consent(child_id, 'EMOTIONAL_CHECKINS'));

-- Annual review record (shared documents)
CREATE POLICY "annual_reviews_professional_read" ON public.annual_reviews
  FOR SELECT USING (public.has_active_consent(child_id, 'DOCUMENTS'));

-- ── Claim consents on professional sign-up ──────────────────
-- When an invited professional signs up, link their new account id to
-- every pending consent addressed to their email. SECURITY DEFINER because
-- the parent-only consent policy would otherwise block the professional
-- from updating the row (same pattern as accept_my_care_team_invitations,
-- migration 025).
CREATE OR REPLACE FUNCTION public.accept_professional_consents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.consent_records
  SET professional_id = auth.uid()
  WHERE professional_id IS NULL
    AND lower(professional_email) = lower(COALESCE(auth.jwt() ->> 'email', ''));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_professional_consents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_professional_consents() TO authenticated;

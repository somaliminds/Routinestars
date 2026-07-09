-- ============================================================
-- Migration 032: Enforce MFA (aal2) at the RLS layer for professionals
--
-- ⚠️ SECURITY FIX (audit C1). The professional portal's MfaGate is a
-- CLIENT-SIDE React component — it stops the app UI rendering, but it does
-- NOT stop a direct REST/PostgREST call. has_active_consent() (migration
-- 029) gated professional read access on consent validity alone, never on
-- the caller's authenticator-assurance level. Result: a professional (or
-- anyone holding a professional's aal1 token) could read every consented
-- child's data WITHOUT completing MFA, contradicting the DPIA.
--
-- This migration moves the MFA requirement into the database. After a TOTP
-- challenge Supabase upgrades the session JWT's `aal` claim to 'aal2';
-- has_active_consent() now additionally requires aal2, so the RLS policies
-- that depend on it (child_profiles / ehcp_outcomes / apdr_cycles /
-- completions / emotional_checkins / annual_reviews reads in migration 029,
-- and professional_contributions writes in migration 030) all deny an
-- aal1 professional at the row level.
--
-- ── Not affected ──
--   • Parents and children: none of their policies call has_active_consent,
--     so parent/child access is completely unchanged.
--   • Professional ROLE ROUTING: get_boot_context / fetchMyConsents read
--     consent_records directly (not via has_active_consent), so a freshly
--     signed-in professional is still routed into the portal at aal1 — the
--     MfaGate then forces enrolment, the JWT becomes aal2, and only THEN do
--     the data policies open. The end-to-end flow is preserved.
--
-- CREATE OR REPLACE keeps the same signature, so all dependent policies pick
-- up the new definition with no policy churn. Depends on migration 029.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_active_consent(p_child_id UUID, p_category TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    -- MFA gate: the caller must have completed a second factor this session.
    -- Missing/absent claim is treated as aal1 (deny). Parents/children never
    -- reach this function, so this only ever constrains professionals.
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND EXISTS (
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

REVOKE ALL ON FUNCTION public.has_active_consent(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_consent(UUID, TEXT) TO authenticated;

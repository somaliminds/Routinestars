-- ============================================================
-- Migration 028: Consent ledger + access audit log (Phase B foundation)
--
-- The governance layer the multi-professional portal is built on. NO
-- professional may access a child's data without a matching, non-expired,
-- non-withdrawn consent record, and EVERY access/contribution/export is
-- written to an append-only audit log.
--
-- Legal basis: UK GDPR (explicit parental consent, Art.6(1)(a)/Art.9(2)(a);
-- under-13 Art.8), DfE information-sharing "seven golden rules", ICO
-- Children's Code. See docs/compliance/DPIA_professional_portal.md and
-- docs/research/send-framework §G.
--
-- This migration creates only the data layer + RLS. Professional auth,
-- role-scoped views, and UI come in later Phase B increments.
-- ============================================================

-- ── Consent ledger (DPIA §4.1) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_records (
  consent_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,

  -- Who consented (the parent granting access on the child's behalf)
  consent_given_by    UUID NOT NULL,                 -- auth.uid() of the parent
  relationship        TEXT NOT NULL DEFAULT 'parent'
                        CHECK (relationship IN ('parent', 'guardian')),
  consent_date        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The professional being granted access. professional_id is filled when
  -- the invited professional accepts + signs up; until then we match on email.
  professional_id     UUID,
  professional_email  TEXT NOT NULL,
  professional_role   TEXT NOT NULL,                 -- app-validated (§F1 role set)
  professional_org    TEXT,

  -- Scope + purpose (data minimisation — least by default)
  data_categories     TEXT[] NOT NULL DEFAULT '{}',  -- e.g. OUTCOMES, APDR, COMPLETIONS…
  purpose             TEXT,

  -- Time-limited + withdrawable (both mandatory in the DPIA)
  expiry_date         DATE NOT NULL,
  withdrawn_at        TIMESTAMPTZ,
  withdrawn_by        UUID,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_child ON public.consent_records(child_id);
CREATE INDEX IF NOT EXISTS idx_consent_professional ON public.consent_records(professional_id);
CREATE INDEX IF NOT EXISTS idx_consent_email ON public.consent_records(lower(professional_email));

-- ── Access / information-sharing audit log (DPIA §4.2) ──────
-- Append-only: policies grant INSERT + SELECT only. No UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS public.access_audit_log (
  event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id            UUID NOT NULL,                 -- who did it (auth.uid())
  actor_role          TEXT,
  child_id            UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  data_categories     TEXT[] NOT NULL DEFAULT '{}',
  action              TEXT NOT NULL CHECK (action IN ('VIEW', 'CONTRIBUTE', 'EXPORT')),
  purpose             TEXT,
  lawful_basis        TEXT,
  consent_id          UUID REFERENCES public.consent_records(consent_id) ON DELETE SET NULL,
  decision_rationale  TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_child ON public.access_audit_log(child_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.access_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON public.access_audit_log(occurred_at);

-- ── RLS: consent_records ────────────────────────────────────
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Parents: full control over consents for their own children (grant, edit
-- scope, withdraw). Inline EXISTS, matching migrations 021/026/027.
CREATE POLICY "consent_parent_all" ON public.consent_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = consent_records.child_id
      AND parent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = consent_records.child_id
      AND parent_id = auth.uid()
    )
  );

-- Professionals: read-only view of consents that name them (so a client can
-- discover what they are authorised for). Matches by account id once signed
-- up, or by email before then.
CREATE POLICY "consent_professional_read" ON public.consent_records
  FOR SELECT USING (
    professional_id = auth.uid()
    OR lower(professional_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- ── RLS: access_audit_log (append-only) ─────────────────────
ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated may write a log row, but only attributing it to
-- themselves (actor_id must be their own id). No UPDATE/DELETE policies →
-- the log is append-only.
CREATE POLICY "audit_insert_self" ON public.access_audit_log
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- Parents may read the full access log for their own children (transparency —
-- ICO Children's Code standard 4 + 11).
CREATE POLICY "audit_parent_read" ON public.access_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = access_audit_log.child_id
      AND parent_id = auth.uid()
    )
  );

-- Professionals may read their own actions.
CREATE POLICY "audit_actor_read" ON public.access_audit_log
  FOR SELECT USING (actor_id = auth.uid());

-- ── updated_at trigger for consent_records ──────────────────
CREATE OR REPLACE FUNCTION public.touch_consent_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consent_records_updated_at ON public.consent_records;
CREATE TRIGGER trg_consent_records_updated_at
  BEFORE UPDATE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_consent_records_updated_at();

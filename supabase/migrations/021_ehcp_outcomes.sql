-- ============================================================
-- Migration 021 — EHCP outcomes per child.
--
-- Phase 5 / Sprint 2, Feature 1.
--
-- Education, Health and Care Plans (EHCPs) are the legally-binding UK
-- SEN document that sets out a child's needs, the provision required to
-- meet them, and the outcomes the system is working toward. EHCPs are
-- reviewed annually — and the review meeting demands evidence of
-- progress against each outcome. SENCOs and parents currently spend
-- hours collating that evidence by hand from observation notes, school
-- reports, and memory.
--
-- This table stores the outcomes themselves. Migration 022 will link
-- activity_sets to outcomes so completion data can be aggregated into
-- an evidence pack at review time.
--
-- Categories follow the UK SEN Code of Practice (2015) sections on
-- broad areas of need. "OTHER" is a catch-all for outcomes that don't
-- map cleanly.
--
-- No clinical claim is made — this is a data-capture tool to support
-- the parent / SENCO at review time. The annual review itself is a
-- statutory process owned by the Local Authority.
-- ============================================================

CREATE TABLE public.ehcp_outcomes (
  outcome_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id      UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  outcome_text  TEXT NOT NULL CHECK (length(outcome_text) BETWEEN 5 AND 1000),
  category      VARCHAR(20) NOT NULL CHECK (
    category IN ('COMMUNICATION', 'COGNITION', 'SOCIAL_EMOTIONAL', 'SENSORY_PHYSICAL', 'INDEPENDENCE', 'OTHER')
  ),
  target_date   DATE,
  status        VARCHAR(15) NOT NULL DEFAULT 'ACTIVE' CHECK (
    status IN ('ACTIVE', 'ACHIEVED', 'DISCONTINUED')
  ),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ehcp_outcomes_child ON public.ehcp_outcomes(child_id);
CREATE INDEX idx_ehcp_outcomes_status ON public.ehcp_outcomes(status) WHERE status = 'ACTIVE';

-- updated_at trigger so the UI can sort by "recently edited" without
-- relying on clients to set the column.
CREATE OR REPLACE FUNCTION public.touch_ehcp_outcomes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ehcp_outcomes_updated_at
  BEFORE UPDATE ON public.ehcp_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.touch_ehcp_outcomes_updated_at();

ALTER TABLE public.ehcp_outcomes ENABLE ROW LEVEL SECURITY;

-- Parents: full access for their own children's outcomes. Inlined EXISTS
-- so the migration is self-contained (matches pattern from 014, 017, 018).
CREATE POLICY "ehcp_outcomes_parent_all" ON public.ehcp_outcomes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = ehcp_outcomes.child_id
      AND parent_id = auth.uid()
    )
  );

-- Children: read-only access to their own outcomes. The child app might
-- want to surface "today's outcomes" as gentle motivation, though this
-- isn't built yet — wiring the policy now avoids a future migration.
CREATE POLICY "ehcp_outcomes_child_read" ON public.ehcp_outcomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = ehcp_outcomes.child_id
      AND user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.ehcp_outcomes IS
  'Parent-entered EHCP outcomes per child. Source of truth for the '
  'annual review evidence pack generated from completion data. Not '
  'clinical data; supports the statutory review, does not replace it.';

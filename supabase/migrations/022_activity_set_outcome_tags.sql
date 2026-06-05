-- ============================================================
-- Migration 022 — Activity-set ↔ EHCP outcome tagging.
--
-- Phase 5 / Sprint 2, Feature 2.
--
-- Junction table letting a parent tag any activity_set as contributing
-- toward one or more EHCP outcomes. The annual-review evidence pack
-- (Feature 2.3) aggregates completion data for each outcome by joining
-- through this table.
--
-- Examples in practice:
--   - "Brushing teeth" set → "Daily living skills" outcome
--   - "Morning routine" set → "Independence in dressing" outcome AND
--     "Following multi-step instructions" outcome (M:N)
--
-- The junction is per-(set, outcome). Both sides have unique constraints
-- so the same set can't be double-tagged onto the same outcome. ON DELETE
-- CASCADE on both sides means tag rows disappear automatically when
-- either the set or the outcome is removed.
-- ============================================================

CREATE TABLE public.activity_set_outcome_tags (
  tag_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id       UUID NOT NULL REFERENCES public.activity_sets(set_id) ON DELETE CASCADE,
  outcome_id   UUID NOT NULL REFERENCES public.ehcp_outcomes(outcome_id) ON DELETE CASCADE,
  tagged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (set_id, outcome_id)
);

CREATE INDEX idx_tags_set_id ON public.activity_set_outcome_tags(set_id);
CREATE INDEX idx_tags_outcome_id ON public.activity_set_outcome_tags(outcome_id);

ALTER TABLE public.activity_set_outcome_tags ENABLE ROW LEVEL SECURITY;

-- Parents: full access if they own the OUTCOME (= the outcome belongs
-- to one of their children). This implicitly limits tagging to sets
-- they can read AND outcomes they own, which is exactly the right
-- scope. Inlined EXISTS — no dependency on migration 002.
CREATE POLICY "tags_parent_all" ON public.activity_set_outcome_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.ehcp_outcomes o
      JOIN public.child_profiles cp ON cp.profile_id = o.child_id
      WHERE o.outcome_id = activity_set_outcome_tags.outcome_id
      AND cp.parent_id = auth.uid()
    )
  );

-- Children: read-only. The child app may surface "this is helping with X"
-- as gentle context in future iterations. Policy is here now so we don't
-- need a follow-up migration when that UI ships.
CREATE POLICY "tags_child_read" ON public.activity_set_outcome_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ehcp_outcomes o
      JOIN public.child_profiles cp ON cp.profile_id = o.child_id
      WHERE o.outcome_id = activity_set_outcome_tags.outcome_id
      AND cp.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.activity_set_outcome_tags IS
  'M:N link between activity_sets and ehcp_outcomes. Drives the annual '
  'review evidence pack — completion data is aggregated by outcome via '
  'this junction.';

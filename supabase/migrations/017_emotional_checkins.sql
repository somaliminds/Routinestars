-- ============================================================
-- Migration 017 — Zones of Regulation emotional check-ins.
--
-- Phase 5 / Sprint 1, Feature 4.
--
-- Zones of Regulation is an evidence-based emotional-regulation
-- curriculum used in UK SEN schools. The child identifies their current
-- emotional state with a colour-coded picker:
--   - BLUE   = low energy / sad / tired
--   - GREEN  = calm / ready / focused (the "ready to learn" zone)
--   - YELLOW = elevated / wiggly / frustrated / silly
--   - RED    = overwhelmed / angry / out of control
--
-- The child is prompted at the start of the day and after challenging
-- moments (e.g. after a lockout / approval flow). Parents see trends in
-- the weekly report — useful for spotting patterns ("Tuesday RED zone
-- spike since the new swimming activity started").
--
-- No clinical claim is made. This is a self-report tool that surfaces
-- the child's perceived state to themselves and to their parents.
-- ============================================================

CREATE TABLE public.emotional_checkins (
  checkin_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id     UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  zone         VARCHAR(8) NOT NULL CHECK (zone IN ('BLUE', 'GREEN', 'YELLOW', 'RED')),
  context      TEXT,                       -- optional: "after bedtime routine", "first thing", etc.
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emotional_checkins_child_date
  ON public.emotional_checkins(child_id, occurred_at DESC);

ALTER TABLE public.emotional_checkins ENABLE ROW LEVEL SECURITY;

-- Parents: full access to their own children's check-ins.
-- Inlined EXISTS rather than public.is_parent_of() so this migration can
-- be applied even if migration 002 hasn't run yet (or its helper function
-- got dropped). Matches the pattern used by migrations 014 and 018.
CREATE POLICY "emotional_checkins_parent_all" ON public.emotional_checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = emotional_checkins.child_id
      AND parent_id = auth.uid()
    )
  );

-- Children: can insert and read their own check-ins.
CREATE POLICY "emotional_checkins_child_insert" ON public.emotional_checkins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = emotional_checkins.child_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "emotional_checkins_child_read" ON public.emotional_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = emotional_checkins.child_id
      AND user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.emotional_checkins IS
  'Self-reported Zones of Regulation emotional state (BLUE/GREEN/YELLOW/RED). '
  'Prompted at start of day and after challenging moments. Not clinical data.';

-- ============================================================
-- Migration 027: APDR cycles (Phase A · Graduated Approach backbone)
--
-- The Graduated Approach — Assess, Plan, Do, Review — is the statutory
-- cycle schools must evidence for SEN support and EHC needs assessments
-- (SEND Code of Practice 6.44–6.67; research docs/research/send-framework
-- §B). Each cycle belongs to an EHCP outcome. RoutineStars auto-computes
-- the quantitative "Do/Review" evidence (completion % over the cycle
-- window) at view time from live completion data — this table stores the
-- narrative each phase requires plus the cycle window and decision.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apdr_cycles (
  cycle_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id      UUID NOT NULL REFERENCES public.ehcp_outcomes(outcome_id) ON DELETE CASCADE,
  -- child_id denormalised so RLS can gate via child_profiles.parent_id
  -- without a join through ehcp_outcomes.
  child_id        UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,

  cycle_number    INTEGER NOT NULL DEFAULT 1,

  -- The "Do" window: the period this cycle's provision ran. Auto progress
  -- data is computed for [window_from, window_to].
  window_from     DATE,
  window_to       DATE,

  -- Assess
  assess_notes    TEXT,   -- baseline, identified need, views triangulated
  -- Plan
  plan_target     TEXT,   -- the SMART short-term target for this cycle
  plan_provision  TEXT,   -- what support is being given (frequency/duration)
  -- Do
  do_notes        TEXT,   -- adaptations + fidelity notes (quant. auto-filled)
  -- Review
  review_progress TEXT,   -- progress vs the plan target
  review_decision TEXT CHECK (review_decision IN ('CONTINUE', 'MODIFY', 'ESCALATE')),

  status          TEXT NOT NULL DEFAULT 'ASSESS'
                    CHECK (status IN ('ASSESS', 'PLAN', 'DO', 'REVIEW', 'COMPLETE')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apdr_cycles_outcome ON public.apdr_cycles(outcome_id);
CREATE INDEX IF NOT EXISTS idx_apdr_cycles_child ON public.apdr_cycles(child_id);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.apdr_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apdr_cycles_parent_all" ON public.apdr_cycles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = apdr_cycles.child_id
      AND parent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = apdr_cycles.child_id
      AND parent_id = auth.uid()
    )
  );

-- updated_at trigger with explicit search_path (avoids advisor warning)
CREATE OR REPLACE FUNCTION public.touch_apdr_cycles_updated_at()
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

DROP TRIGGER IF EXISTS trg_apdr_cycles_updated_at ON public.apdr_cycles;
CREATE TRIGGER trg_apdr_cycles_updated_at
  BEFORE UPDATE ON public.apdr_cycles
  FOR EACH ROW EXECUTE FUNCTION public.touch_apdr_cycles_updated_at();

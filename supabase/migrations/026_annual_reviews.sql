-- ============================================================
-- Migration 026: Annual Review records (Phase A · C5 persistence)
--
-- Stores the human-completed parts of the statutory EHCP annual review
-- (SEND Code of Practice Ch.11; SEND Regs 2014 reg.18). The auto-generated
-- progress section still comes from live completion data at export time;
-- this table persists the parent contribution, the child's views, review
-- metadata, and the review recommendation so parents don't retype them.
--
-- One editable review draft per child (child_id UNIQUE, upserted). Review
-- history across years is a later enhancement.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.annual_reviews (
  review_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                  UUID NOT NULL UNIQUE
                              REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,

  -- Review metadata
  ehcp_date_issued          DATE,
  review_date               DATE,
  review_chair              TEXT,
  attendees                 TEXT,

  -- Parent / carer contribution
  parent_strengths          TEXT,
  parent_progress           TEXT,
  parent_concerns           TEXT,
  parent_aspirations        TEXT,
  parent_requested_changes  TEXT,

  -- Child / young person's views
  child_communication_method TEXT,
  child_how_i_feel          TEXT,
  child_going_well          TEXT,
  child_difficult           TEXT,
  child_want_to_change      TEXT,
  child_goals               TEXT,

  -- Review recommendation
  recommendation            TEXT CHECK (recommendation IN ('MAINTAIN', 'AMEND', 'CEASE')),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annual_reviews_child ON public.annual_reviews(child_id);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.annual_reviews ENABLE ROW LEVEL SECURITY;

-- Parents: full access for their own children's review records. Inlined
-- EXISTS so the migration is self-contained (matches 014, 017, 018, 021).
CREATE POLICY "annual_reviews_parent_all" ON public.annual_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = annual_reviews.child_id
      AND parent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = annual_reviews.child_id
      AND parent_id = auth.uid()
    )
  );

-- Keep updated_at fresh, with an explicit search_path (avoids the
-- function_search_path_mutable advisor warning).
CREATE OR REPLACE FUNCTION public.touch_annual_reviews_updated_at()
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

DROP TRIGGER IF EXISTS trg_annual_reviews_updated_at ON public.annual_reviews;
CREATE TRIGGER trg_annual_reviews_updated_at
  BEFORE UPDATE ON public.annual_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_annual_reviews_updated_at();

-- ============================================================
-- Migration 030: Professional contributions (Phase B4)
--
-- Lets a consented professional add structured input (advice, a suggested
-- target, or a note) tagged to a child's EHCP outcome — WITHOUT the ability
-- to edit the child's core records (DPIA: contribution-only scope; keeps
-- RoutineStars out of regulated case-management). Parents read everything
-- professionals add.
--
-- Requires an active OUTCOMES-scoped consent to write (has_active_consent
-- from migration 029). Depends on migrations 028 + 029.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.professional_contributions (
  contribution_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  -- Optional link to a specific outcome; null = general input.
  outcome_id       UUID REFERENCES public.ehcp_outcomes(outcome_id) ON DELETE SET NULL,

  author_id        UUID NOT NULL,          -- the professional's auth.uid()
  author_role      TEXT,
  author_email     TEXT,                   -- for parent-facing display

  kind             TEXT NOT NULL DEFAULT 'ADVICE'
                     CHECK (kind IN ('ADVICE', 'TARGET', 'NOTE')),
  content          TEXT NOT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contrib_child ON public.professional_contributions(child_id);
CREATE INDEX IF NOT EXISTS idx_contrib_outcome ON public.professional_contributions(outcome_id);
CREATE INDEX IF NOT EXISTS idx_contrib_author ON public.professional_contributions(author_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.professional_contributions ENABLE ROW LEVEL SECURITY;

-- Professionals: create their own contributions, but only for a child they
-- currently have an active OUTCOMES-scoped consent for.
CREATE POLICY "contrib_professional_insert" ON public.professional_contributions
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND public.has_active_consent(child_id, 'OUTCOMES')
  );

-- Professionals: read/update/delete only their own contributions.
CREATE POLICY "contrib_professional_select_own" ON public.professional_contributions
  FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "contrib_professional_update_own" ON public.professional_contributions
  FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "contrib_professional_delete_own" ON public.professional_contributions
  FOR DELETE USING (author_id = auth.uid());

-- Parents: read all contributions for their own children (they must see
-- what professionals have added). Read-only — parents don't edit them.
CREATE POLICY "contrib_parent_read" ON public.professional_contributions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = professional_contributions.child_id
      AND parent_id = auth.uid()
    )
  );

-- updated_at trigger (explicit search_path)
CREATE OR REPLACE FUNCTION public.touch_contributions_updated_at()
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

DROP TRIGGER IF EXISTS trg_contributions_updated_at ON public.professional_contributions;
CREATE TRIGGER trg_contributions_updated_at
  BEFORE UPDATE ON public.professional_contributions
  FOR EACH ROW EXECUTE FUNCTION public.touch_contributions_updated_at();

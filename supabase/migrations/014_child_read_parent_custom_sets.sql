-- ============================================================
-- Migration 014 — Children can read their parent's custom activity sets.
--
-- Bug: the existing `activity_sets_default_read` policy only matched
--   is_custom = FALSE OR created_by_parent_id = auth.uid()
-- so a child (whose auth.uid() is their own user, not the parent's)
-- could not SELECT custom sets their parent had scheduled for them.
-- Result: custom sets appeared on the parent's schedule builder but
-- silently dropped out of the child's home screen activity list.
--
-- Fix: add a permissive SELECT policy granting a child read access to
-- custom activity_sets whose creator is the parent of one of that
-- child's profiles. PostgreSQL combines permissive policies with OR,
-- so built-in sets and the parent's own custom sets remain readable.
-- ============================================================

CREATE POLICY "activity_sets_child_read_parents_custom" ON public.activity_sets
  FOR SELECT USING (
    is_custom = TRUE
    AND EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.user_id = auth.uid()
      AND cp.parent_id = activity_sets.created_by_parent_id
    )
  );

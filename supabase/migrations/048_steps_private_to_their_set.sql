-- ============================================================
-- Migration 048: A family's custom routine steps are private to that family
--
-- steps_read_all (USING auth.uid() IS NOT NULL) let ANY signed-in account read
-- EVERY step — including other families' custom routines (titles, instructions,
-- audio/illustration URLs) — even though activity_sets already hid those sets.
--
-- 1. Steps now inherit their set's visibility: you can read a step exactly when
--    you can read its activity set (built-in content; your own custom sets; a
--    child login → its parent's custom sets; an accepted school TA → sets
--    scheduled for their linked children; admins). The subquery runs under
--    activity_sets' own RLS, so future set-visibility rules carry over to steps.
-- 2. steps_ta_read duplicated activity_sets_ta_read and is now covered by (1).
--    It is neutralised (USING false — the planner folds it away) rather than
--    dropped; dropping it later is purely cosmetic.
-- 3. scheduled_sets_parent_all had no WITH CHECK, so a parent could schedule
--    ANY set_id, including another family's custom set (found: 2 past test rows,
--    2026-06-04). A parent may now only schedule built-in sets or their own.
--    The check goes through a SECURITY DEFINER helper because referencing
--    activity_sets directly from a scheduled_sets policy is a policy cycle
--    (activity_sets_ta_read reads scheduled_sets) → 42P17 infinite recursion.
--
-- Pre-flighted against all 8 accounts in a rolled-back transaction: each still
-- sees every step its own sets, children's schedules, TA links and completions
-- need, and nothing else; anon sees 0; an unknown account sees only built-in
-- steps; a simulated school TA sees its linked child's custom steps (24/24) and
-- can still update status; parents can schedule built-in + own sets, not others'.
-- ALTER POLICY only (no DROP). To revert (1):
--   ALTER POLICY steps_read_via_set ON public.steps TO public USING (auth.uid() IS NOT NULL);
-- ============================================================

-- 1. Steps inherit their activity set's visibility
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'steps' AND policyname = 'steps_read_all') THEN
    ALTER POLICY steps_read_all ON public.steps RENAME TO steps_read_via_set;
  END IF;
END $$;

ALTER POLICY steps_read_via_set ON public.steps
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.activity_sets a WHERE a.set_id = steps.set_id));

-- 2. Redundant TA read path (covered by activity_sets_ta_read via (1))
ALTER POLICY steps_ta_read ON public.steps USING (false);

-- 3. A parent may only schedule a set they own or a built-in set
CREATE OR REPLACE FUNCTION public.can_schedule_set(p_set_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activity_sets a
     WHERE a.set_id = p_set_id
       AND (a.is_custom = false OR a.created_by_parent_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.can_schedule_set(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_schedule_set(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_schedule_set(uuid) TO authenticated;

ALTER POLICY scheduled_sets_parent_all ON public.scheduled_sets
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.day_schedules ds
              JOIN public.child_profiles cp ON cp.profile_id = ds.child_id
             WHERE ds.schedule_id = scheduled_sets.schedule_id
               AND cp.parent_id = auth.uid())
    AND public.can_schedule_set(scheduled_sets.set_id)
  );

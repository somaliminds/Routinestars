-- ============================================================
-- Migration 049: Flatten the activity-set visibility policies (planner blow-up)
--
-- Two activity_sets policies looked through other RLS-protected tables:
--   activity_sets_ta_read                   -> scheduled_sets ⋈ day_schedules ⋈ care_team_members
--   activity_sets_child_read_parents_custom -> child_profiles
-- Postgres expands the policies of every table a policy touches, recursively,
-- so each reference to activity_sets dragged in the scheduled_sets ->
-- day_schedules -> child_profiles -> care_team_members policies many times
-- over. The steps policies reference activity_sets 2-3 times, so for a parent
-- (measured 2026-10-05, planning time only):
--   UPDATE / DELETE one step : ~1.0 s before 048, ~4 s after 048 (≈2,500
--                              subplans) — against an 8 s statement timeout
--   SELECT steps by set      : 121 ms before 048, 224 ms after
-- Both checks now live in small SECURITY DEFINER helpers, which the planner
-- treats as opaque function calls, so every policy is flat:
--   UPDATE / DELETE a step ~1 ms, SELECT steps ~5 ms, SELECT activity_sets ~0.1 ms.
--
-- Same rows as before (persona-verified against every account plus a simulated
-- school TA): the TA helper keeps the published-schedule requirement that
-- day_schedules RLS used to impose, and both policies now apply to signed-in
-- users only (anon could never match them — no uid, no email).
-- ============================================================

CREATE OR REPLACE FUNCTION public.ta_can_read_set(p_set_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- The caller is an accepted school TA for a child whose PUBLISHED schedule
  -- includes this set — what activity_sets_ta_read matched under RLS.
  SELECT EXISTS (
    SELECT 1
      FROM public.scheduled_sets ss
      JOIN public.day_schedules ds ON ds.schedule_id = ss.schedule_id
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
     WHERE ss.set_id = p_set_id
       AND ds.is_published = true
       AND ctm.email = auth.email()
       AND ctm.role = 'school_ta'
       AND ctm.accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_child_of(p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- The caller is a child login whose parent is p_parent_id.
  SELECT EXISTS (
    SELECT 1 FROM public.child_profiles cp
     WHERE cp.user_id = auth.uid() AND cp.parent_id = p_parent_id
  );
$$;

REVOKE ALL ON FUNCTION public.ta_can_read_set(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ta_can_read_set(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ta_can_read_set(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_child_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_child_of(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_child_of(uuid) TO authenticated;

ALTER POLICY activity_sets_ta_read ON public.activity_sets
  TO authenticated
  USING (public.ta_can_read_set(set_id));

ALTER POLICY activity_sets_child_read_parents_custom ON public.activity_sets
  TO authenticated
  USING (is_custom = true AND public.is_child_of(created_by_parent_id));

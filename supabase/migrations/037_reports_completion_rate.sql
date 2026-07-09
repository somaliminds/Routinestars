-- ============================================================
-- Migration 037: get_completion_rate_30d() — collapse reports N+1 (audit M1)
--
-- The reports screen built its 30-day chart by looping 30 times, firing up to
-- two queries per day (day_schedules lookup + scheduled_sets count) — up to 60
-- sequential round-trips per view, per child. This returns the whole 30-day
-- series in ONE call.
--
-- SECURITY INVOKER (not DEFINER): the function runs as the caller, so the
-- existing parent/child RLS on day_schedules + scheduled_sets still applies —
-- a parent only ever sees their own child's data. Every calendar day in the
-- last 30 is returned (zero-filled) so the client renders a continuous chart.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_completion_rate_30d(p_child_id UUID)
RETURNS TABLE (day DATE, scheduled INT, completed INT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    d::date AS day,
    COALESCE(cnt.scheduled, 0)::int AS scheduled,
    COALESCE(cnt.completed, 0)::int AS completed
  FROM generate_series(
         CURRENT_DATE - INTERVAL '29 days',
         CURRENT_DATE,
         INTERVAL '1 day'
       ) AS d
  LEFT JOIN (
    SELECT
      ds.schedule_date,
      COUNT(ss.scheduled_set_id) AS scheduled,
      COUNT(ss.scheduled_set_id) FILTER (WHERE ss.status IN ('APPROVED', 'LOCKED')) AS completed
    FROM public.day_schedules ds
    JOIN public.scheduled_sets ss ON ss.schedule_id = ds.schedule_id
    WHERE ds.child_id = p_child_id
      AND ds.schedule_date >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY ds.schedule_date
  ) cnt ON cnt.schedule_date = d::date
  ORDER BY day;
$$;

REVOKE ALL ON FUNCTION public.get_completion_rate_30d(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_completion_rate_30d(UUID) TO authenticated;

-- ============================================================
-- Migration 020 — Fix due_transition_warnings timezone handling.
--
-- Bug: the original RPC compared (schedule_date + start_time) — which
-- is a naive (unzoned) timestamp typed by the parent in their LOCAL
-- clock — against (NOW() AT TIME ZONE 'UTC'). For UK users in BST that
-- shifts every warning by +1 hour: a parent who types 12:30 PM expecting
-- lunchtime gets the warning at 13:30 BST.
--
-- Fix: interpret the unzoned timestamp as Europe/London local time, then
-- compare directly with NOW() (which is timezone-aware). 'Europe/London'
-- handles BST/GMT switchover correctly so this stays right across the
-- year without further code changes.
--
-- LIMITATION: hard-coded to UK time. Acceptable for the UK-first MVP.
-- When we ship to non-UK users, store the timezone on child_profiles or
-- parent_profiles and reference it here.
-- ============================================================

CREATE OR REPLACE FUNCTION public.due_transition_warnings(
  p_from_min INT,
  p_to_min   INT
)
RETURNS TABLE (
  scheduled_set_id UUID,
  schedule_id      UUID,
  set_id           UUID,
  start_time       TIME,
  schedule_date    DATE,
  child_name       TEXT,
  parent_id        UUID,
  set_name         TEXT,
  set_icon         TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ss.scheduled_set_id,
    ss.schedule_id,
    ss.set_id,
    ss.start_time,
    ds.schedule_date,
    cp.child_name::TEXT,
    cp.parent_id,
    aset.set_name::TEXT,
    aset.icon_emoji::TEXT
  FROM   public.scheduled_sets ss
  JOIN   public.day_schedules  ds   ON ds.schedule_id   = ss.schedule_id
  JOIN   public.child_profiles cp   ON cp.profile_id    = ds.child_id
  JOIN   public.activity_sets  aset ON aset.set_id      = ss.set_id
  WHERE  ds.is_published = TRUE
    AND  ss.status = 'PENDING'
    AND  ds.schedule_date = (NOW() AT TIME ZONE 'Europe/London')::DATE
    AND  ((ds.schedule_date + ss.start_time) AT TIME ZONE 'Europe/London') BETWEEN
           NOW() + (p_from_min || ' minutes')::INTERVAL
           AND
           NOW() + (p_to_min   || ' minutes')::INTERVAL
$$;

REVOKE ALL ON FUNCTION public.due_transition_warnings(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_transition_warnings(INT, INT) TO service_role;

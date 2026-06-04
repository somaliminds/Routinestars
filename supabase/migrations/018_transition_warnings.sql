-- ============================================================
-- Migration 018 — Transition warnings opt-in + dedupe log.
--
-- Phase 5 / Sprint 1, Feature 2.
--
-- Unanticipated transitions are the single biggest meltdown trigger
-- in autistic children. A 5-minute and 1-minute heads-up before each
-- scheduled activity changes "sudden disruption" into "predictable
-- shift" — the evidence is overwhelming.
--
-- This migration prepares the data:
--   - parent_profiles.notify_transition_warnings: opt-in per parent
--     (defaults TRUE; the parent can disable in Settings if they don't
--     want their phone buzzing every few minutes).
--   - transition_warning_log: dedupe write. The cron + Edge Function
--     can be invoked at the same minute window more than once
--     (cron jitter, retries) without sending duplicate pushes.
--     Unique on (scheduled_set_id, warning_type) — at most one
--     5-min warning and one 1-min warning per scheduled set.
-- ============================================================

ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS notify_transition_warnings BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.parent_profiles.notify_transition_warnings IS
  'When TRUE, parent receives push notifications 5 minutes and 1 minute '
  'before each child activity starts. Per-parent toggle in Settings.';

CREATE TABLE public.transition_warning_log (
  warning_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_set_id  UUID NOT NULL REFERENCES public.scheduled_sets(scheduled_set_id) ON DELETE CASCADE,
  warning_type      VARCHAR(8) NOT NULL CHECK (warning_type IN ('FIVE_MIN', 'ONE_MIN')),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheduled_set_id, warning_type)
);

CREATE INDEX idx_transition_warning_log_set
  ON public.transition_warning_log(scheduled_set_id);

ALTER TABLE public.transition_warning_log ENABLE ROW LEVEL SECURITY;

-- The log is written by the service-role Edge Function, not by clients.
-- Parents can read entries for their own children to debug or audit, but
-- nothing else.
CREATE POLICY "transition_warning_log_parent_read" ON public.transition_warning_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_sets ss
      JOIN public.day_schedules ds ON ds.schedule_id = ss.schedule_id
      JOIN public.child_profiles cp ON cp.profile_id = ds.child_id
      WHERE ss.scheduled_set_id = transition_warning_log.scheduled_set_id
      AND cp.parent_id = auth.uid()
    )
  );

-- ============================================================
-- RPC: due_transition_warnings(p_from_min, p_to_min)
--
-- Returns the scheduled_sets whose computed start timestamp (= the
-- schedule's date combined with the set's TIME-of-day start) falls
-- between NOW() + p_from_min minutes and NOW() + p_to_min minutes.
--
-- Called by the send-transition-warnings Edge Function. Uses
-- SECURITY DEFINER so the function can read across RLS — only the
-- service-role Edge Function should ever call it.
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
    AND  ds.schedule_date = (NOW() AT TIME ZONE 'UTC')::DATE
    AND  (ds.schedule_date + ss.start_time) BETWEEN
           (NOW() AT TIME ZONE 'UTC') + (p_from_min || ' minutes')::INTERVAL
           AND
           (NOW() AT TIME ZONE 'UTC') + (p_to_min   || ' minutes')::INTERVAL
$$;

REVOKE ALL ON FUNCTION public.due_transition_warnings(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_transition_warnings(INT, INT) TO service_role;

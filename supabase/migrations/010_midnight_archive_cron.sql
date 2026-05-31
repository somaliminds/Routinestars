-- ============================================================
-- Migration 010: Midnight Auto-Archive Cron Job
-- Spec: Section 11.2 — "All locked sets archive at midnight,
--       ready for next day's fresh schedule."
--
-- Runs daily at 00:00 UTC.
-- Sets any PENDING / IN_PROGRESS / PAUSED scheduled_sets
-- from PREVIOUS days to SKIPPED so yesterday's incomplete
-- tasks don't linger on the child's home screen.
--
-- Requires: pg_cron extension enabled in Supabase dashboard
--           (Database → Extensions → pg_cron)
-- ============================================================

-- Enable pg_cron (safe to re-run if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it was registered under the same name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'routinestars-midnight-archive') THEN
    PERFORM cron.unschedule('routinestars-midnight-archive');
  END IF;
END $$;

-- Schedule the archive job: every day at 00:00 UTC
SELECT cron.schedule(
  'routinestars-midnight-archive',
  '0 0 * * *',
  $$
    -- Mark yesterday's unfinished sets as SKIPPED
    UPDATE public.scheduled_sets ss
    SET    status = 'SKIPPED'
    FROM   public.day_schedules ds
    WHERE  ss.schedule_id = ds.schedule_id
      AND  ds.schedule_date < CURRENT_DATE
      AND  ss.status IN ('PENDING', 'IN_PROGRESS', 'PAUSED');
  $$
);

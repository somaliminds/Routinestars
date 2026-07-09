-- ============================================================
-- Migration 036: Data retention cron (audit H3 / UK GDPR)
--
-- CLAUDE.md mandates a 90-day retention on completion data. Nothing enforced
-- it, so completion history grew unbounded — a UK GDPR storage-limitation gap
-- (and, over time, a performance drag on the reports queries).
--
-- This schedules a daily purge of completion rows older than 90 days.
-- step_completions cascade from completions (ON DELETE CASCADE), so they are
-- removed automatically. The 30-day / weekly report views all sit inside the
-- window, so parents see no change.
--
-- Requires the pg_cron extension (Database → Extensions → pg_cron).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent re-register.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'routinestars-purge-old-completions') THEN
    PERFORM cron.unschedule('routinestars-purge-old-completions');
  END IF;
END $$;

-- Every day at 03:30 UTC (off-peak): delete completions older than 90 days.
SELECT cron.schedule(
  'routinestars-purge-old-completions',
  '30 3 * * *',
  $$
    DELETE FROM public.completions
    WHERE started_at < now() - INTERVAL '90 days';
  $$
);

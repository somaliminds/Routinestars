-- ============================================================
-- Migration 019 — Cron job that fires send-transition-warnings.
--
-- Runs every minute. The Edge Function does its own dedupe via
-- transition_warning_log, so cron jitter / retries are safe.
--
-- BEFORE APPLYING THIS MIGRATION:
--   1. Deploy the Edge Function:
--        supabase functions deploy send-transition-warnings
--   2. Replace <PROJECT_REF> below with your Supabase project ref.
--      Find it under Dashboard → Project Settings → General.
--   3. Replace <SERVICE_ROLE_KEY> below with the value from
--      Dashboard → Project Settings → API → service_role key.
--      The key is a Bearer credential — do NOT commit it to git.
--      A safer pattern: store it via
--        ALTER DATABASE postgres SET app.settings.service_role_key
--             = '<SERVICE_ROLE_KEY>';
--      then reference via current_setting('app.settings.service_role_key').
--      Both patterns are shown below — comment out the one you don't
--      want.
--
-- Requires: pg_net extension. Enable in Dashboard → Database →
-- Extensions → pg_net.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'routinestars-transition-warnings') THEN
    PERFORM cron.unschedule('routinestars-transition-warnings');
  END IF;
END $$;

SELECT cron.schedule(
  'routinestars-transition-warnings',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://<PROJECT_REF>.functions.supabase.co/send-transition-warnings',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        -- Option A: paste the service-role key here (NOT recommended in git)
        -- 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
        -- Option B: read from a session var set via ALTER DATABASE
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $cron$
);

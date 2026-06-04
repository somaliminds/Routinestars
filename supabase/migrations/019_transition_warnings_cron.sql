-- ============================================================
-- Migration 019 — Cron job that fires send-transition-warnings.
--
-- Runs every minute. The Edge Function does its own dedupe via
-- transition_warning_log, so cron jitter / retries are safe.
--
-- BEFORE APPLYING THIS MIGRATION:
--
--   1. Deploy the Edge Function:
--        supabase functions deploy send-transition-warnings
--
--   2. Enable pg_net (Dashboard → Database → Extensions → pg_net).
--      Vault is enabled by default on Supabase but check it's listed in
--      the same Extensions page if the SELECT in step 3 fails.
--
--   3. Store the service-role key in Supabase Vault. In SQL Editor:
--
--        SELECT vault.create_secret(
--          '<paste your service_role key here>',
--          'service_role_key'
--        );
--
--      Vault encrypts the key at rest with pgsodium; database backups,
--      snapshots, and physical exfiltration only see ciphertext. This
--      is the recommended pattern for production.
--
--   4. Replace <PROJECT_REF> below with your project ref (Dashboard →
--      Project Settings → General → Reference ID). Strip any angle
--      brackets — the URL should be a clean hostname.
--
-- Two fallback authorisation patterns are commented at the bottom for
-- emergencies (Vault unavailable, etc.). Do NOT uncomment them in
-- production — the raw-bearer pattern hard-codes credentials into git
-- and the ALTER DATABASE pattern stores them in plaintext system tables
-- that show up in backups.
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
        -- Recommended: Vault. Encrypted at rest, decrypted only at query
        -- time, never visible in backups or system tables.
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        )

        -- Fallback A — ALTER DATABASE session var (PLAINTEXT in system
        -- tables, visible in backups; only use temporarily):
        --   ALTER DATABASE postgres SET app.settings.service_role_key
        --     = '<SERVICE_ROLE_KEY>';
        -- Then swap the Authorization line above for:
        --   'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)

        -- Fallback B — raw bearer (NEVER commit this; key ends up in git):
        --   'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $cron$
);

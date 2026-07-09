-- ============================================================
-- Migration 034: Stripe webhook idempotency ledger (audit H2)
--
-- Stripe delivers events AT LEAST ONCE and retries on any non-2xx or timeout,
-- so the webhook will receive duplicates. Subscription-state upserts happen to
-- be idempotent today, but the moment any handler branch does something
-- side-effecting (grant credits, send an email, increment a counter) a retry
-- double-fires it. This table lets the function claim each event id exactly
-- once and skip duplicates.
--
-- The webhook claims the row BEFORE processing and deletes it again if the
-- handler throws, so a genuinely failed event is reprocessed on Stripe's
-- retry while a successful one is never repeated.
--
-- Service-role only: RLS is enabled with NO policies, so only the webhook's
-- service-role client (which bypasses RLS) can read/write it. No client ever
-- touches it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id     TEXT PRIMARY KEY,          -- Stripe's evt_… id (globally unique)
  event_type   TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies — locks the table to the service role.

-- Optional housekeeping: an index to prune old rows by age if desired later.
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_at
  ON public.processed_stripe_events (processed_at);

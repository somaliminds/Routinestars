-- ============================================================
-- Migration 033: PIN brute-force protection (audit C2)
--
-- verify-pin is a public Edge Function (verify_jwt = false) with no attempt
-- limit: anyone with a user_id could hammer the 4-digit space (10,000 combos)
-- with no lockout. bcrypt cost-12 slows but does not stop it.
--
-- This adds per-account attempt tracking. The verify-pin function (updated in
-- the same change) now: (1) requires the caller's JWT and that it matches the
-- user_id — so only the signed-in owner can attempt, which ALSO prevents a
-- third party from locking out a victim; (2) counts consecutive failures and
-- applies a timed lockout.
--
-- Columns are additive with safe defaults, so existing rows and the current
-- happy path are unaffected (0 failures, never locked).
-- ============================================================

ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS pin_attempt_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until  TIMESTAMPTZ;

COMMENT ON COLUMN public.parent_profiles.pin_attempt_count IS
  'Consecutive failed PIN attempts; reset to 0 on success (audit C2).';
COMMENT ON COLUMN public.parent_profiles.pin_locked_until IS
  'If set and in the future, PIN verification is locked until this time (audit C2).';

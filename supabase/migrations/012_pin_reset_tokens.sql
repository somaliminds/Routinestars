-- =============================================================================
-- Migration 012: PIN system — definitive schema
-- =============================================================================
-- Fixes:
--   1. Makes pin_hash nullable — new accounts exist before PIN is set during
--      onboarding. All PIN functions already handle null gracefully.
--   2. Adds pin_reset_token + pin_reset_expires_at for the forgot-PIN email flow.
--   3. Adds index on pin_reset_token for O(1) token lookups.
--
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards throughout).
-- =============================================================================

-- 1. Allow pin_hash to be null (new accounts before onboarding PIN step)
ALTER TABLE public.parent_profiles
  ALTER COLUMN pin_hash DROP NOT NULL;

-- 2. Reset token columns
ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS pin_reset_token      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pin_reset_expires_at  TIMESTAMPTZ;

-- 3. Index for fast single-token lookup (partial — only rows with a live token)
CREATE INDEX IF NOT EXISTS idx_parent_profiles_pin_reset_token
  ON public.parent_profiles (pin_reset_token)
  WHERE pin_reset_token IS NOT NULL;

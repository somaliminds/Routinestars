-- ============================================================
-- Migration 023 — AI scaffolding (rails only, no AI calls yet).
--
-- Phase 5 / Sprint 2, Feature 4.
--
-- This migration lays the data plumbing for Sprint 3's AI routine
-- generator without enabling any AI calls. The rails are:
--
--   1. parent_profiles.ai_routine_gen_enabled (default FALSE).
--      Per-parent opt-in. UK GDPR Article 22 requires explicit consent
--      for automated decision-making; the default-off posture is the
--      conservative default that the Information Commissioner expects.
--
--   2. ai_generation_log table. Every call to the (future) generate-
--      routine Edge Function writes one row BEFORE the LLM is invoked,
--      then updates it after. Stores the input prompt, input metadata,
--      model version, which tool the model called, the raw response,
--      whether validation passed, the rejection reason if any, and
--      (eventually) the set_id if the parent chose to save the draft.
--      Retention: 90 days for prompt + raw_response (GDPR minimise),
--      forever for the metadata fields (model_version, tool_called,
--      passed_validation, created_at) for audit purposes.
--
-- No Edge Function is wired here. The send-routine-gen function exists
-- as a stub that returns a 503 until the operator flips a server-side
-- feature flag (TODO: separate `app_feature_flags` table in Sprint 3).
-- ============================================================

ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS ai_routine_gen_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.parent_profiles.ai_routine_gen_enabled IS
  'Per-parent opt-in for the AI routine generator. Defaults FALSE to '
  'comply with UK GDPR Article 22 default-off posture for automated '
  'decision-making. Parent must explicitly toggle in Settings.';

CREATE TABLE public.ai_generation_log (
  log_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature           VARCHAR(40) NOT NULL CHECK (feature IN ('routine_gen')),
  input_prompt      TEXT,           -- nullable so we can purge after 90d retention
  input_meta        JSONB,          -- e.g. { child_age_band, child_first_name, prompt_length }
  model_version     VARCHAR(60),
  tool_called       VARCHAR(40),    -- 'create_routine' | 'refuse_request' | NULL on failure
  raw_response      JSONB,          -- nullable so we can purge after 90d retention
  passed_validation BOOLEAN,
  rejection_reason  TEXT,           -- one of a fixed set of refusal codes when refused
  saved_as_set_id   UUID REFERENCES public.activity_sets(set_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_log_parent ON public.ai_generation_log(parent_user_id, created_at DESC);
CREATE INDEX idx_ai_log_validation ON public.ai_generation_log(passed_validation)
  WHERE passed_validation = FALSE;

ALTER TABLE public.ai_generation_log ENABLE ROW LEVEL SECURITY;

-- Parents can read their own log. Useful for "Show me what AI suggestions
-- I've made" / future transparency UI / GDPR Subject Access Request.
CREATE POLICY "ai_log_parent_read" ON public.ai_generation_log
  FOR SELECT USING (parent_user_id = auth.uid());

-- Inserts and updates come from the service-role Edge Function only.
-- No client-side INSERT/UPDATE policy by design.

COMMENT ON TABLE public.ai_generation_log IS
  'Immutable audit log of every AI routine-generation call. Prompt + '
  'raw response purged after 90 days; metadata retained for ongoing '
  'audit. Read by the parent under their own row only.';

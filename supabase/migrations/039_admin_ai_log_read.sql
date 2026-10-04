-- ============================================================
-- Migration 039: Admin read access to the AI generation log
--
-- Oversight: admins review AI routine-generation activity (what was asked,
-- whether governance passed/refused). The log (migration 023) stores an
-- input_meta JSONB that may hold a child's first name / age band — admins see
-- the governance OUTCOME, not a child's records, so this is an acceptable
-- oversight read under the privacy boundary. Additive SELECT policy only.
-- Depends on migrations 023 + 038.
-- ============================================================

CREATE POLICY "ai_generation_log_admin_read" ON public.ai_generation_log
  FOR SELECT USING (public.is_admin());

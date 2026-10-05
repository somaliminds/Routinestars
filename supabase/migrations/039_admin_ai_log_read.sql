-- ============================================================
-- Migration 039: Admin oversight of the AI generation log (column-safe)
--
-- Oversight goal: admins review AI routine-generation ACTIVITY (what tool was
-- called, whether governance passed/refused, when) — NOT the inputs.
--
-- IMPORTANT (privacy boundary): ai_generation_log also stores input_meta
-- (child_first_name + age_band), input_prompt and raw_response (migration 023).
-- A plain RLS SELECT policy is COLUMN-BLIND — `USING (is_admin())` would let an
-- admin read those child-identifying columns via a direct API/SQL select, which
-- violates the #1 invariant (admins get ZERO row access to a child's special-
-- category data). So we do NOT add a table policy. Instead admins read through a
-- SECURITY DEFINER function that returns ONLY the safe oversight columns.
-- Depends on migrations 023 + 038.
-- ============================================================

-- Defensive: remove the column-blind policy if an earlier revision applied it.
DROP POLICY IF EXISTS "ai_generation_log_admin_read" ON public.ai_generation_log;

CREATE OR REPLACE FUNCTION public.admin_recent_ai_log(p_limit integer DEFAULT 100)
RETURNS TABLE (
  log_id            uuid,
  feature           text,
  tool_called       text,
  passed_validation boolean,
  rejection_reason  text,
  created_at        timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT l.log_id, l.feature::text, l.tool_called::text,
         l.passed_validation, l.rejection_reason, l.created_at
  FROM public.ai_generation_log l
  WHERE public.is_admin()            -- fail-closed: non-admins get zero rows
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;
REVOKE ALL ON FUNCTION public.admin_recent_ai_log(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recent_ai_log(integer) TO authenticated;

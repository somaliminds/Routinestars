-- ============================================================
-- Migration 035: Server-side plan quota enforcement (audit H1)
--
-- Plan limits were enforced ONLY in the client (canAddChild / canAddCustomSet
-- in subscription.store.ts). RLS knows nothing about tier, so a user could
-- exceed their plan by calling the API directly or by continuing to use the
-- app after a downgrade. Every paid limit was on the honour system.
--
-- This enforces the two money-gating limits in the database via BEFORE INSERT
-- triggers, which fire regardless of caller role (unlike RLS, service-role
-- callers are still subject to triggers).
--
-- Limits mirror src/lib/stripe.ts EXACTLY:
--   FREE     → 1 child,  no custom sets
--   STARTER  → 1 child,  custom sets
--   FAMILY   → 5 children, custom sets
--   SCHOOL   → 30 children, custom sets
--
-- ── Non-breaking ──
--   • Triggers fire on INSERT only. Accounts already over a limit keep their
--     existing rows; they simply cannot add MORE until under the limit.
--   • The first child on a fresh account (0 existing, FREE max 1) is allowed,
--     so onboarding is unaffected.
--   • Built-in activity sets (is_custom = FALSE) are never gated.
-- ============================================================

-- Effective plan for a user — mirrors subscription.store.ts getPlanKey():
-- no row / canceled / past_due all collapse to FREE; otherwise the plan.
CREATE OR REPLACE FUNCTION public.effective_plan(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN s.plan IS NULL THEN 'FREE'
    WHEN s.status IN ('canceled', 'past_due') THEN 'FREE'
    ELSE s.plan
  END
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.subscriptions s ON s.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.effective_plan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_plan(UUID) TO authenticated;

-- ── Child-profile quota ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_child_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan  TEXT;
  v_max   INT;
  v_count INT;
BEGIN
  v_plan := public.effective_plan(NEW.parent_id);
  v_max  := CASE v_plan
              WHEN 'FAMILY' THEN 5
              WHEN 'SCHOOL' THEN 30
              ELSE 1                    -- FREE and STARTER
            END;

  SELECT COUNT(*) INTO v_count
  FROM public.child_profiles
  WHERE parent_id = NEW.parent_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'child_limit_reached: your plan allows % child profile(s)', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_child_quota ON public.child_profiles;
CREATE TRIGGER trg_enforce_child_quota
  BEFORE INSERT ON public.child_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_quota();

-- ── Custom activity-set quota ───────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_custom_set_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only parent-created custom sets are gated; built-in/seed sets pass through.
  IF NEW.is_custom IS TRUE AND NEW.created_by_parent_id IS NOT NULL THEN
    IF public.effective_plan(NEW.created_by_parent_id) = 'FREE' THEN
      RAISE EXCEPTION 'custom_sets_not_in_plan: upgrade to create custom activity sets'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_custom_set_quota ON public.activity_sets;
CREATE TRIGGER trg_enforce_custom_set_quota
  BEFORE INSERT ON public.activity_sets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_custom_set_quota();

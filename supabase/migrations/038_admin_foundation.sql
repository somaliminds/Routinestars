-- ============================================================
-- Migration 038: Admin panel foundation
--
-- Internal admin panel for RoutineStars Ltd staff. PRIVACY-FIRST: admins run
-- the BUSINESS (users, subscriptions, content, metrics, oversight) and get NO
-- row access to children's special-category data (EHCP outcomes, completions,
-- emotional check-ins, schedules, contributions). Aggregate numbers are served
-- by SECURITY DEFINER RPCs that return COUNTS only.
--
-- Security model mirrors the professional portal:
--   - admin_users table (not users.role) — granted out-of-band.
--   - is_admin() requires aal2, so an un-MFA'd admin token reads nothing even
--     via direct API (the MfaGate UI is not the real gate — RLS is).
--   - a self-read policy lets a user detect their own admin membership BEFORE
--     MFA (for routing), while is_admin() gates the actual operational data.
--   - every admin action is written to admin_audit_log.
--
-- BOOTSTRAP: there is no API path to create the first admin (no INSERT policy).
-- After applying, grant yourself owner in the SQL editor:
--   INSERT INTO public.admin_users (user_id, admin_role)
--   VALUES ('<your auth.users id>', 'owner');
-- ============================================================

-- ── Admin roster ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  admin_role TEXT NOT NULL DEFAULT 'owner' CHECK (admin_role IN ('owner', 'support')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- True iff the caller is an admin AND has completed MFA this session (aal2).
-- SECURITY DEFINER so it reads admin_users without tripping that table's RLS
-- (no recursion). Gates all admin operational access.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- A user may read their OWN admin row (pre-MFA) so the app can route them into
-- the admin area before the MFA gate. Reading the full roster requires aal2.
CREATE POLICY "admin_users_self_read" ON public.admin_users
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_users_admin_read_all" ON public.admin_users
  FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policies: the roster is managed in the SQL editor
-- (service role) only — safest for a privileged list.

-- ── Admin action audit (append-only) ────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id    UUID NOT NULL,
  action      TEXT NOT NULL,              -- e.g. 'SUBSCRIPTION_OVERRIDE', 'SET_FLAG'
  target_type TEXT,                       -- 'user' | 'subscription' | 'activity_set' | 'config'
  target_id   TEXT,
  detail      JSONB
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_audit_insert" ON public.admin_audit_log
  FOR INSERT WITH CHECK (public.is_admin() AND admin_id = auth.uid());
CREATE POLICY "admin_audit_read" ON public.admin_audit_log
  FOR SELECT USING (public.is_admin());

-- ── App config / feature flags ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Any signed-in client may READ flags (so the app can honour maintenance mode,
-- AI kill-switch, etc.); only admins may write.
CREATE POLICY "app_config_read" ON public.app_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "app_config_admin_write" ON public.app_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.app_config (key, value, description) VALUES
  ('maintenance_mode', 'false'::jsonb, 'When true, the app shows a maintenance screen to all users'),
  ('ai_generation_enabled', 'true'::jsonb, 'Global kill-switch for AI routine generation'),
  ('signups_enabled', 'true'::jsonb, 'When false, new parent signups are blocked')
ON CONFLICT (key) DO NOTHING;

-- ── Admin oversight policies (operational tables only) ──────
-- NOTE: deliberately NO admin policies on child_profiles, ehcp_outcomes,
-- apdr_cycles, completions, step_completions, emotional_checkins,
-- annual_reviews, professional_contributions, day_schedules, scheduled_sets.
-- Admins never get row access to children's data (privacy boundary).
CREATE POLICY "subscriptions_admin_read" ON public.subscriptions
  FOR SELECT USING (public.is_admin());
CREATE POLICY "subscriptions_admin_update" ON public.subscriptions
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "users_admin_read" ON public.users
  FOR SELECT USING (public.is_admin());

-- Admins manage the shared built-in activity sets + steps (content everyone sees).
CREATE POLICY "activity_sets_admin_all" ON public.activity_sets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "steps_admin_all" ON public.steps
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Read-only oversight of the consent ledger + its access audit trail.
CREATE POLICY "consent_records_admin_read" ON public.consent_records
  FOR SELECT USING (public.is_admin());
CREATE POLICY "access_audit_admin_read" ON public.access_audit_log
  FOR SELECT USING (public.is_admin());

-- ── Aggregate metrics (COUNTS only — no children's rows) ────
CREATE OR REPLACE FUNCTION public.admin_overview_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  RETURN jsonb_build_object(
    'users_total', (SELECT count(*) FROM public.users),
    'parents_total', (SELECT count(*) FROM public.users WHERE role = 'parent'),
    'children_total', (SELECT count(*) FROM public.child_profiles),
    'signups_30d', (SELECT count(*) FROM public.users WHERE created_at >= now() - interval '30 days'),
    'subs_by_plan', (
      SELECT coalesce(jsonb_object_agg(plan, c), '{}'::jsonb)
      FROM (
        SELECT plan, count(*) AS c FROM public.subscriptions
        WHERE status IN ('active', 'trialing') GROUP BY plan
      ) t
    ),
    'subs_past_due', (SELECT count(*) FROM public.subscriptions WHERE status = 'past_due'),
    'subs_canceled_30d', (
      SELECT count(*) FROM public.subscriptions
      WHERE status = 'canceled' AND updated_at >= now() - interval '30 days'
    ),
    'consents_active', (
      SELECT count(*) FROM public.consent_records
      WHERE withdrawn_at IS NULL AND expiry_date >= CURRENT_DATE
    ),
    'activity_sets_builtin', (SELECT count(*) FROM public.activity_sets WHERE is_custom = false),
    'activity_sets_custom', (SELECT count(*) FROM public.activity_sets WHERE is_custom = true),
    'completions_7d', (
      SELECT count(*) FROM public.completions WHERE started_at >= now() - interval '7 days'
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_overview_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_overview_metrics() TO authenticated;

-- ── Extend get_boot_context (031) with admin membership ─────
-- So the AuthGuard can route an admin into the panel in the same single
-- round-trip. No aal check here — this is routing detection; is_admin() (aal2)
-- still gates the actual operational data once past the MFA gate.
CREATE OR REPLACE FUNCTION public.get_boot_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID    := auth.uid();
  v_email        TEXT    := auth.email();
  v_role         TEXT;
  v_own_children INTEGER;
  v_has_ta       BOOLEAN;
  v_has_consent  BOOLEAN;
  v_pin_hash     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    UPDATE public.care_team_members
    SET    accepted_at = NOW()
    WHERE  email = v_email
      AND  accepted_at IS NULL;

    UPDATE public.consent_records
    SET    professional_id = v_uid
    WHERE  professional_id IS NULL
      AND  lower(professional_email) = lower(v_email);
  END IF;

  SELECT role INTO v_role FROM public.users WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_own_children FROM public.child_profiles WHERE parent_id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM public.care_team_members
    WHERE email = v_email AND role = 'school_ta' AND accepted_at IS NOT NULL
  ) INTO v_has_ta;

  SELECT EXISTS (
    SELECT 1 FROM public.consent_records
    WHERE professional_id = v_uid AND withdrawn_at IS NULL AND expiry_date >= CURRENT_DATE
  ) INTO v_has_consent;

  SELECT pin_hash INTO v_pin_hash FROM public.parent_profiles WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'role',               COALESCE(v_role, 'parent'),
    'own_children',       COALESCE(v_own_children, 0),
    'has_ta_assignment',  COALESCE(v_has_ta, false),
    'has_active_consent', COALESCE(v_has_consent, false),
    'needs_pin_setup',    (
      v_pin_hash IS NULL OR length(v_pin_hash) = 0 OR position('placeholder' in v_pin_hash) > 0
    ),
    'is_admin_member',    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_uid)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_boot_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_boot_context() TO authenticated;

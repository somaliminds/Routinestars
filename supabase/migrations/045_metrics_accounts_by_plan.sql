-- ============================================================
-- Migration 045: Dashboard plan breakdown counts ACCOUNTS by effective plan
--
-- Found in live admin-panel testing (2026-10-05): the "Active subscriptions by
-- plan" card showed FREE = 0 while every parent was on the free tier. It
-- counted subscription ROWS with status active/trialing — but a free user
-- usually has no subscription row at all (or a canceled one), so FREE could
-- never be right. subs_by_plan now counts parent accounts by
-- effective_plan() (migration 035: no row / canceled / past_due -> FREE).
-- Paid totals and est. MRR are unchanged in meaning (effective_plan returns
-- the paid plan for an active/trialing subscription).
-- Everything else is identical to migration 038.
-- Depends on migrations 035 + 038.
-- ============================================================

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
    -- Parent accounts by EFFECTIVE plan, FREE included.
    'subs_by_plan', (
      SELECT coalesce(jsonb_object_agg(plan, c), '{}'::jsonb)
      FROM (
        SELECT public.effective_plan(u.user_id) AS plan, count(*) AS c
        FROM public.users u
        WHERE u.role = 'parent'
        GROUP BY 1
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

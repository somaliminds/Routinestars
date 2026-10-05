-- ============================================================
-- Migration 050: Archive built-in sets · admin writes atomic + audited ·
--                admin row access limited to built-in content
--
-- 1. activity_sets.is_archived — an admin can retire a built-in set without
--    deleting it (scheduled_sets.set_id is ON DELETE RESTRICT and children's
--    history references it). The app hides archived sets only where parents
--    PICK sets (library, schedule-builder palette, onboarding wizard); anything
--    already scheduled still resolves by set_id, so no child's day changes.
-- 2. admin_set_activity_set_archived(set_id, archived) — is_admin()-gated,
--    built-in sets only, audited (CONTENT_ARCHIVE / CONTENT_RESTORE).
-- 3. admin_save_activity_set only edits BUILT-IN sets. It accepted any set_id,
--    so a direct RPC call could rewrite a family's private custom set. Body is
--    otherwise identical to migration 040.
-- 4. admin_set_config(key, value) — the flag change and its audit row in ONE
--    transaction. The client used to update app_config and then insert the
--    audit row separately; postgrest never throws, so a failed audit insert
--    went unnoticed while the change itself stood.
-- 5. activity_sets_admin_all / steps_admin_all narrowed to built-in content.
--    The admin panel never reads families' custom routines (counts come from
--    admin_overview_metrics), so admins no longer get row access to them.
-- 6. admin_overview_metrics.activity_sets_builtin counts LIVE (non-archived)
--    built-in sets — what families can actually pick.
-- No DROP / DELETE. Depends on migrations 038, 040, 045.
-- ============================================================

-- 1. Archive flag
ALTER TABLE public.activity_sets
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 2. Archive / restore a built-in set
CREATE OR REPLACE FUNCTION public.admin_set_activity_set_archived(p_set_id uuid, p_archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  IF p_set_id IS NULL OR p_archived IS NULL THEN
    RAISE EXCEPTION 'set and archived flag are required';
  END IF;

  UPDATE public.activity_sets
     SET is_archived = p_archived
   WHERE set_id = p_set_id AND is_custom = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'built-in set not found';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, detail)
  VALUES (auth.uid(),
          CASE WHEN p_archived THEN 'CONTENT_ARCHIVE' ELSE 'CONTENT_RESTORE' END,
          'activity_set', p_set_id::text, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_activity_set_archived(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_activity_set_archived(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_activity_set_archived(uuid, boolean) TO authenticated;

-- 3. Content save: built-in sets only (otherwise identical to 040)
CREATE OR REPLACE FUNCTION public.admin_save_activity_set(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set_id  uuid := NULLIF(p->>'set_id', '')::uuid;
  v_admin   uuid := auth.uid();
  v_created boolean := false;
  v_total   int := 0;
  v_i       int := 0;
  v_step    jsonb;
  v_sid     uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT COALESCE(SUM(GREATEST(0, (s->>'duration_seconds')::int)), 0)
    INTO v_total
    FROM jsonb_array_elements(COALESCE(p->'steps', '[]'::jsonb)) s;

  -- 1. Upsert the set.
  IF v_set_id IS NULL THEN
    INSERT INTO public.activity_sets
      (set_name, icon_emoji, category, requires_approval, total_duration_mins,
       is_custom, created_by_parent_id)
    VALUES
      (NULLIF(p->>'set_name', ''), COALESCE(NULLIF(p->>'icon_emoji', ''), '📋'),
       p->>'category', COALESCE((p->>'requires_approval')::boolean, false),
       GREATEST(1, CEIL(v_total / 60.0))::int, false, NULL)
    RETURNING set_id INTO v_set_id;
    v_created := true;
  ELSE
    UPDATE public.activity_sets
       SET set_name            = NULLIF(p->>'set_name', ''),
           icon_emoji          = COALESCE(NULLIF(p->>'icon_emoji', ''), icon_emoji),
           category            = p->>'category',
           requires_approval   = COALESCE((p->>'requires_approval')::boolean, false),
           total_duration_mins = GREATEST(1, CEIL(v_total / 60.0))::int
     WHERE set_id = v_set_id
       AND is_custom = false;  -- never a family's custom set
    IF NOT FOUND THEN
      RAISE EXCEPTION 'built-in set not found';
    END IF;
  END IF;

  -- 2. Park every existing step of the set in the high band and tentatively
  --    archive it. All old values are < 1,000,000, so no new value can equal any
  --    row's old value — the immediate unique check cannot trip.
  UPDATE public.steps
     SET order_index = order_index + 1000000,
         is_active   = false
   WHERE set_id = v_set_id;

  -- 3. Upsert the incoming active steps into 0..n-1 (free: everything is parked).
  FOR v_step IN SELECT value FROM jsonb_array_elements(COALESCE(p->'steps', '[]'::jsonb))
  LOOP
    v_sid := NULLIF(v_step->>'step_id', '')::uuid;
    IF v_sid IS NULL THEN
      INSERT INTO public.steps
        (set_id, order_index, title, instruction_text, duration_seconds, reward_stars, is_active)
      VALUES
        (v_set_id, v_i, LEFT(COALESCE(NULLIF(v_step->>'title', ''), 'Step'), 120),
         COALESCE(v_step->>'instruction_text', ''),
         GREATEST(5, LEAST(COALESCE((v_step->>'duration_seconds')::int, 30), 86400)),
         GREATEST(0, LEAST(COALESCE((v_step->>'reward_stars')::int, 1), 100)),
         true);
    ELSE
      UPDATE public.steps
         SET order_index      = v_i,
             title            = LEFT(COALESCE(NULLIF(v_step->>'title', ''), 'Step'), 120),
             instruction_text = COALESCE(v_step->>'instruction_text', ''),
             duration_seconds = GREATEST(5, LEAST(COALESCE((v_step->>'duration_seconds')::int, 30), 86400)),
             reward_stars     = GREATEST(0, LEAST(COALESCE((v_step->>'reward_stars')::int, 1), 100)),
             is_active        = true
       WHERE step_id = v_sid AND set_id = v_set_id;
    END IF;
    v_i := v_i + 1;
  END LOOP;

  -- 4. Renormalise the still-archived (parked) steps to n..n+m-1, keeping their
  --    relative order. Active rows hold 0..n-1 and these rows' old values are all
  --    >= 1,000,000, so nothing collides; afterwards every value is < 1,000,000
  --    again (the invariant step 2 relies on next time). History is untouched.
  WITH arch AS (
    SELECT step_id, row_number() OVER (ORDER BY order_index) - 1 AS rn
      FROM public.steps
     WHERE set_id = v_set_id AND is_active = false
  )
  UPDATE public.steps s SET order_index = v_i + a.rn
    FROM arch a WHERE s.step_id = a.step_id;

  -- 5. Audit.
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, detail)
  VALUES (v_admin,
          CASE WHEN v_created THEN 'CONTENT_CREATE' ELSE 'CONTENT_EDIT' END,
          'activity_set', v_set_id::text,
          jsonb_build_object('active_steps', v_i));

  RETURN v_set_id;
END;
$$;

-- 4. Feature flag change + audit row, atomically
CREATE OR REPLACE FUNCTION public.admin_set_config(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  IF p_value IS NULL THEN
    RAISE EXCEPTION 'value is required';
  END IF;

  UPDATE public.app_config
     SET value = p_value, updated_by = auth.uid(), updated_at = now()
   WHERE key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown setting';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, detail)
  VALUES (auth.uid(), 'SET_FLAG', 'config', p_key, p_value);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_config(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_config(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_config(text, jsonb) TO authenticated;

-- 5. Admin row access: built-in content only
ALTER POLICY activity_sets_admin_all ON public.activity_sets
  USING (public.is_admin() AND is_custom = false)
  WITH CHECK (public.is_admin() AND is_custom = false);

ALTER POLICY steps_admin_all ON public.steps
  USING (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.activity_sets a WHERE a.set_id = steps.set_id AND a.is_custom = false))
  WITH CHECK (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.activity_sets a WHERE a.set_id = steps.set_id AND a.is_custom = false));

-- 6. Dashboard metrics: live built-in sets (otherwise identical to 045)
CREATE OR REPLACE FUNCTION public.admin_overview_metrics()
RETURNS jsonb
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
    -- Live built-in sets only: archived ones are retired from every picker.
    'activity_sets_builtin', (
      SELECT count(*) FROM public.activity_sets WHERE is_custom = false AND is_archived = false
    ),
    'activity_sets_custom', (SELECT count(*) FROM public.activity_sets WHERE is_custom = true),
    'completions_7d', (
      SELECT count(*) FROM public.completions WHERE started_at >= now() - interval '7 days'
    )
  );
END;
$$;

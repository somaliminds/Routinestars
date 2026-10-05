-- ============================================================
-- Migration 040: Content editor hardening — soft-archive + atomic save
--
-- Fixes (from the admin-panel adversarial review):
--  [3] Removing a built-in step used to hard-DELETE it, and steps.step_id
--      cascades to step_completions — erasing children's history platform-wide.
--      Now removal SOFT-ARCHIVES (is_active = false); history survives and
--      child-facing reads filter is_active.
--  [1][2][4] The editor's save was a client-side sequence of independent
--      writes. postgrest-js never throws, so failures were swallowed and the
--      non-atomic two-phase reorder could strand steps at a high order_index,
--      corrupting the shared set's order for every family. The whole save now
--      runs as ONE is_admin()-gated transaction (admin_save_activity_set).
--  [7] The save is audited (admin_audit_log).
--
-- UNIQUE(set_id, order_index) is made DEFERRABLE so the atomic reorder can pass
-- through intermediate states and be checked once at commit.
-- Depends on migrations 001 + 038.
-- ============================================================

-- 1. Soft-archive flag. Default true so every existing step stays visible.
ALTER TABLE public.steps
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Make the (set_id, order_index) uniqueness deferrable (find the existing
--    constraint by its columns, regardless of its auto-generated name).
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
    FROM pg_constraint con
   WHERE con.conrelid = 'public.steps'::regclass
     AND con.contype = 'u'
     AND (
       SELECT array_agg(att.attname ORDER BY att.attname)
         FROM unnest(con.conkey) k
         JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
     ) = ARRAY['order_index', 'set_id'];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.steps DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.steps
  ADD CONSTRAINT steps_set_id_order_index_key
  UNIQUE (set_id, order_index) DEFERRABLE INITIALLY IMMEDIATE;

-- 3. Atomic, audited, is_admin()-gated save for a built-in activity set + steps.
--    Payload:
--      { set_id?, set_name, icon_emoji, category, requires_approval,
--        steps: [ { step_id?, title, instruction_text, duration_seconds,
--                   reward_stars } ] }  // steps[] = the desired ACTIVE list, in order
--    Any existing step of the set NOT present in steps[] is soft-archived.
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

  -- Defer uniqueness so the reorder can pass through intermediate collisions.
  SET CONSTRAINTS ALL DEFERRED;

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
     WHERE set_id = v_set_id;
  END IF;

  -- 2. Tentatively archive every existing step of the set; the active ones are
  --    re-activated below. Anything left archived was removed by the admin.
  UPDATE public.steps SET is_active = false WHERE set_id = v_set_id;

  -- 3. Upsert the incoming active steps into contiguous order_index 0..n-1.
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

  -- 4. Push the still-archived steps above the active range (unique, checked at
  --    commit). Their step_completions history is untouched.
  WITH arch AS (
    SELECT step_id, row_number() OVER (ORDER BY step_id) - 1 AS rn
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
REVOKE ALL ON FUNCTION public.admin_save_activity_set(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_activity_set(jsonb) TO authenticated;

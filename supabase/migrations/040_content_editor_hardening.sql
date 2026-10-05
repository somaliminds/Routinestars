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
-- Reordering under UNIQUE(set_id, order_index) WITHOUT a deferrable constraint:
-- every step of the set is first parked in a high band (+1,000,000), active
-- steps are then placed at 0..n-1, and archived steps renormalised to n..n+m-1.
-- Each stage writes values that cannot collide with any row's old value, so the
-- immediate unique check never trips. This holds because order_index is always
-- < 1,000,000 between saves (step 4 renormalises; live max was 9 on 2026-10-05).
-- Being one function call, it is atomic — any error rolls the whole save back.
-- (Supersedes an earlier draft that made the constraint DEFERRABLE, which meant
-- removing and re-adding it; this version needs no destructive statement.)
-- Depends on migrations 001 + 038.
-- ============================================================

-- 1. Soft-archive flag. Default true so every existing step stays visible.
ALTER TABLE public.steps
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Atomic, audited, is_admin()-gated save for a built-in activity set + steps.
--    Payload:
--      { set_id?, set_name, icon_emoji, category, requires_approval,
--        steps: [ { step_id?, title, instruction_text, duration_seconds,
--                   reward_stars } ] }  -- steps[] = the desired ACTIVE list, in order
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
REVOKE ALL ON FUNCTION public.admin_save_activity_set(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_activity_set(jsonb) TO authenticated;

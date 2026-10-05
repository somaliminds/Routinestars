-- ============================================================================
-- RoutineStars — admin rollout: ONE-TIME APPLY BUNDLE (migrations 039 → 042)
--
-- HOW TO USE: Supabase dashboard → SQL Editor → paste this WHOLE file → Run.
--
-- Atomic: everything runs inside one transaction. If any statement fails,
-- NOTHING is applied (no half-migrated state). Takes < 1 second.
--
-- Source of truth = supabase/migrations/039..042 (concatenated verbatim below).
-- Pre-flighted against the live DB on 2026-10-05: every constraint lookup,
-- column type and jsonb idiom used here was verified read-only first.
--
-- After it runs, the result grid shows a verification table — every row
-- should read 'true' EXCEPT the "column-blind policy" row, which must be 'false'.
-- ============================================================================

BEGIN;


-- >>>>>>>>>>>>>>>>>>>> 039_admin_ai_log_read.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 040_content_editor_hardening.sql >>>>>>>>>>>>>>>>>>>>
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
       -- attname is type `name`; cast to text so it compares with a text[] literal
       -- (name[] = text[] has no operator — verified against the live DB).
       SELECT array_agg(att.attname::text ORDER BY att.attname::text)
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

-- >>>>>>>>>>>>>>>>>>>> 041_signups_flag_rpc.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- Migration 041: Anon-readable signups flag (for the pre-auth signup gate)
--
-- signups_enabled (migration 038) lives in app_config, which only authenticated
-- users may read. But the signup screen runs BEFORE auth, so it cannot read the
-- flag directly. Rather than open the whole app_config table to anon, expose a
-- single whitelisted SECURITY DEFINER function that returns just this one
-- non-sensitive boolean. Fails OPEN (true) if the row is missing.
-- (maintenance_mode is enforced AFTER auth, so it keeps the authenticated-only
-- app_config read — no anon access needed there.)
-- Depends on migration 038.
-- ============================================================

CREATE OR REPLACE FUNCTION public.signups_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT value = 'true'::jsonb FROM public.app_config WHERE key = 'signups_enabled'),
    true
  );
$$;
REVOKE ALL ON FUNCTION public.signups_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signups_enabled() TO anon, authenticated;

-- >>>>>>>>>>>>>>>>>>>> 042_erasure_fk_set_null.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- Migration 042: Let lawful erasure complete for cross-family references
--
-- When an admin deletes a user, public.users cascades to the user's OWN data.
-- But a care-team member (e.g. a therapist) may have approved completions or
-- unlocked routines for OTHER families' children. Those columns reference
-- public.users with the default NO ACTION, so the delete FK-blocks and (now,
-- after the admin-users fix) fails honestly. Switching them to ON DELETE SET
-- NULL lets the erasure complete while preserving the child's row (the actor
-- simply becomes unknown).
--
-- Only the NULLABLE references are changed here:
--   - completions.approved_by   (nullable)      -> SET NULL
--   - lockout_events.unlocked_by (nullable)     -> SET NULL
-- day_schedules.created_by is NOT NULL, so it can't be SET NULL without also
-- dropping NOT NULL — deliberately left as-is (such deletes fail honestly).
-- Constraints are located by column so the auto-generated name doesn't matter.
-- Depends on migration 001.
-- ============================================================

DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
    FROM pg_constraint con
   WHERE con.conrelid = 'public.completions'::regclass
     AND con.contype = 'f'
     AND con.conkey = ARRAY[
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.completions'::regclass AND attname = 'approved_by')
     ];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.completions DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE public.completions
    ADD CONSTRAINT completions_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
END $$;

DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
    FROM pg_constraint con
   WHERE con.conrelid = 'public.lockout_events'::regclass
     AND con.contype = 'f'
     AND con.conkey = ARRAY[
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.lockout_events'::regclass AND attname = 'unlocked_by')
     ];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.lockout_events DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE public.lockout_events
    ADD CONSTRAINT lockout_events_unlocked_by_fkey
    FOREIGN KEY (unlocked_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
END $$;

COMMIT;

-- ============================ VERIFICATION =================================
select 'fn:admin_recent_ai_log (039)' as item, (to_regprocedure('public.admin_recent_ai_log(integer)') is not null)::text as ok
union all select 'policy:ai_log column-blind admin_read  (MUST be false)', (exists(select 1 from pg_policies where schemaname='public' and tablename='ai_generation_log' and policyname='ai_generation_log_admin_read'))::text
union all select 'fn:admin_save_activity_set (040)', (to_regprocedure('public.admin_save_activity_set(jsonb)') is not null)::text
union all select 'col:steps.is_active (040)', (exists(select 1 from information_schema.columns where table_schema='public' and table_name='steps' and column_name='is_active'))::text
union all select 'constraint:steps unique DEFERRABLE (040)', (exists(select 1 from pg_constraint where conrelid='public.steps'::regclass and contype='u' and condeferrable))::text
union all select 'fn:signups_enabled (041)', (to_regprocedure('public.signups_enabled()') is not null)::text
union all select 'fk:completions.approved_by SET NULL (042)', (exists(select 1 from pg_constraint where conname='completions_approved_by_fkey' and confdeltype='n'))::text
union all select 'fk:lockout_events.unlocked_by SET NULL (042)', (exists(select 1 from pg_constraint where conname='lockout_events_unlocked_by_fkey' and confdeltype='n'))::text;

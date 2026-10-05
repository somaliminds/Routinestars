-- =====================================================================
-- RoutineStars — apply 052 (complete erasure) + remove the 3 orphan accounts
-- Project: ujzsteariqmqizzraccw  (Supabase dashboard → SQL Editor)
--
-- Run the THREE steps separately, in order (select a step's text, press Run).
-- Steps 1 and 3 change data; step 2 is a dress rehearsal that changes nothing.
-- Claude's database connector declined these because they contain DELETE
-- statements that need an interactive confirmation it can't show.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- STEP 1 — install migration 052 (BEFORE DELETE trigger on public.users)
-- Same SQL as supabase/migrations/052_complete_erasure_on_user_delete.sql.
-- Expected: the final SELECT returns one row, every column true.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.erase_user_owned_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- a. Children and everything under them (schedules, completions, rewards…).
  DELETE FROM public.child_profiles WHERE parent_id = OLD.user_id;

  -- b. Their private custom routines (steps cascade), unless another family
  --    still has the set scheduled — their own children's schedules are gone.
  DELETE FROM public.activity_sets a
   WHERE a.created_by_parent_id = OLD.user_id
     AND a.is_custom = true
     AND NOT EXISTS (SELECT 1 FROM public.scheduled_sets ss WHERE ss.set_id = a.set_id);

  -- c. Schedules they made for another family's child belong to that family.
  UPDATE public.day_schedules ds
     SET created_by = c.parent_id
    FROM public.child_profiles c
   WHERE ds.created_by = OLD.user_id
     AND c.profile_id = ds.child_id;

  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.erase_user_owned_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_user_owned_data() FROM anon, authenticated;

CREATE OR REPLACE TRIGGER before_user_deleted
  BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.erase_user_owned_data();

SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'before_user_deleted'
                AND tgrelid = 'public.users'::regclass AND tgenabled = 'O')        AS trigger_installed,
       (SELECT prosecdef FROM pg_proc WHERE oid = 'public.erase_user_owned_data()'::regprocedure) AS security_definer,
       NOT has_function_privilege('anon', 'public.erase_user_owned_data()', 'EXECUTE')          AS anon_cannot_call,
       NOT has_function_privilege('authenticated', 'public.erase_user_owned_data()', 'EXECUTE') AS users_cannot_call;


-- ─────────────────────────────────────────────────────────────────────
-- STEP 2 — dress rehearsal. CHANGES NOTHING: it deletes inside a block that
-- always ends by raising an error, which rolls everything back. The "error"
-- message IS the result. It erases the 3 orphans, then two real accounts
-- (015fdacc… with 2 custom sets, e836f009… the largest), and reports.
-- Expected message (numbers can differ slightly if data changed today):
--   orphan 3d0230a3 deleted=1 / orphan cb6ad3c2 deleted=1 / orphan 2f770d42 deleted=1
--   fc690a4b.created_by now=e836f009      (the schedule that used to block it)
--   015fdacc deleted; their custom sets left=0 ownerless_custom=0
--   e836f009 deleted; ownerless_custom=1 (expect 1: Chill time) …
-- Any line containing FAILED means stop and send me the message.
-- ─────────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_res text := ''; v_snap text; v_n int; v_u uuid;
  v_orphans uuid[] := ARRAY['3d0230a3-a2ec-4156-8677-e92fec7b256e',
                            'cb6ad3c2-eeed-4919-b0b0-9f20c095b2b3',
                            '2f770d42-574e-4c89-a8b4-0ea9743af995']::uuid[];
  v_p015 uuid; v_pe83 uuid;
BEGIN
  SELECT format('users=%s children=%s custom_sets=%s ownerless_custom=%s steps=%s schedules=%s',
    (SELECT count(*) FROM public.users), (SELECT count(*) FROM public.child_profiles),
    (SELECT count(*) FROM public.activity_sets WHERE is_custom),
    (SELECT count(*) FROM public.activity_sets WHERE is_custom AND created_by_parent_id IS NULL),
    (SELECT count(*) FROM public.steps), (SELECT count(*) FROM public.day_schedules)) INTO v_snap;
  v_res := v_res || E'\nBEFORE ' || v_snap;

  FOREACH v_u IN ARRAY v_orphans LOOP
    BEGIN
      DELETE FROM public.users WHERE user_id = v_u AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v_u);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_res := v_res || format(E'\norphan %s deleted=%s', left(v_u::text, 8), v_n);
    EXCEPTION WHEN others THEN v_res := v_res || format(E'\norphan %s FAILED %s', left(v_u::text, 8), SQLERRM);
    END;
  END LOOP;
  v_res := v_res || ' | fc690a4b.created_by now=' || coalesce((SELECT left(created_by::text, 8)
             FROM public.day_schedules WHERE schedule_id::text LIKE 'fc690a4b%'), 'gone');

  SELECT user_id INTO v_p015 FROM public.users WHERE user_id::text LIKE '015fdacc%';
  BEGIN
    DELETE FROM public.users WHERE user_id = v_p015;
    v_res := v_res || format(E'\n015fdacc deleted; their custom sets left=%s ownerless_custom=%s',
      (SELECT count(*) FROM public.activity_sets WHERE created_by_parent_id = v_p015),
      (SELECT count(*) FROM public.activity_sets WHERE is_custom AND created_by_parent_id IS NULL));
  EXCEPTION WHEN others THEN v_res := v_res || E'\n015fdacc FAILED ' || SQLERRM;
  END;

  SELECT user_id INTO v_pe83 FROM public.users WHERE user_id::text LIKE 'e836f009%';
  BEGIN
    DELETE FROM public.users WHERE user_id = v_pe83;
    v_res := v_res || format(E'\ne836f009 deleted; ownerless_custom=%s (expect 1: %s) its_steps=%s',
      (SELECT count(*) FROM public.activity_sets WHERE is_custom AND created_by_parent_id IS NULL),
      (SELECT string_agg(set_name, ',') FROM public.activity_sets WHERE is_custom AND created_by_parent_id IS NULL),
      (SELECT count(*) FROM public.steps s JOIN public.activity_sets a ON a.set_id = s.set_id
        WHERE a.is_custom AND a.created_by_parent_id IS NULL));
  EXCEPTION WHEN others THEN v_res := v_res || E'\ne836f009 FAILED ' || SQLERRM;
  END;

  SELECT format('users=%s children=%s custom_sets=%s ownerless_custom=%s steps=%s schedules=%s',
    (SELECT count(*) FROM public.users), (SELECT count(*) FROM public.child_profiles),
    (SELECT count(*) FROM public.activity_sets WHERE is_custom),
    (SELECT count(*) FROM public.activity_sets WHERE is_custom AND created_by_parent_id IS NULL),
    (SELECT count(*) FROM public.steps), (SELECT count(*) FROM public.day_schedules)) INTO v_snap;
  v_res := v_res || E'\nAFTER  ' || v_snap;
  RAISE EXCEPTION 'REHEARSAL — nothing was changed:%', v_res;
END $do$;


-- ─────────────────────────────────────────────────────────────────────
-- STEP 3 — REAL clean-up: erase the 3 orphan accounts (no login exists for
-- any of them). Cascades to their 3 children and all those children's data;
-- the one schedule 3d0230a3 made for e836f009's child is handed to e836f009.
-- The NOT EXISTS guard means a row is only deleted if it truly has no login.
-- The editor shows the LAST result only. Expected: orphans_left = 0 and
-- fc690a4b_created_by starting with e836f009.
-- ─────────────────────────────────────────────────────────────────────
WITH gone AS (
  DELETE FROM public.users u
   WHERE u.user_id IN ('3d0230a3-a2ec-4156-8677-e92fec7b256e',
                       'cb6ad3c2-eeed-4919-b0b0-9f20c095b2b3',
                       '2f770d42-574e-4c89-a8b4-0ea9743af995')
     AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.user_id)
  RETURNING 1
)
SELECT count(*) AS deleted_now FROM gone;

SELECT (SELECT count(*) FROM public.users u
         WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.user_id)) AS orphans_left,
       (SELECT created_by::text FROM public.day_schedules
         WHERE schedule_id::text LIKE 'fc690a4b%')                               AS fc690a4b_created_by;

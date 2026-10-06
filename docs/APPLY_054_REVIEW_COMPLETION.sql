-- =====================================================================
-- RoutineStars — apply migration 054: review_completion
-- (approve / redo for parents AND care-team Approvers)
-- Project: ujzsteariqmqizzraccw  (Supabase dashboard → SQL Editor)
--
-- Paste this whole file and press Run. It only (re)creates one function.
-- Claude's database connector declined to apply it because the redo branch
-- contains a DELETE (the attempt being redone), which needs an interactive
-- confirmation the connector can't show.
--
-- Until this runs, tapping Approve or Redo in the app shows
-- "Could not save. Please check your connection and try again."
--
-- Expected: the final SELECT returns one row with every column = true.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.review_completion(
  p_completion_id uuid,
  p_approve boolean,
  p_gold_star boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_comp   record;
  v_status text;
  v_stars  int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  IF p_completion_id IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'completion and decision are required';
  END IF;

  -- Lock the completion so a parent and an approver can't both review it.
  SELECT c.completion_id, c.child_id, c.scheduled_set_id, c.stars_earned,
         c.completed_at, c.parent_approved, cp.parent_id
    INTO v_comp
    FROM public.completions c
    JOIN public.child_profiles cp ON cp.profile_id = c.child_id
   WHERE c.completion_id = p_completion_id
     FOR UPDATE OF c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'completion not found';
  END IF;

  -- Only the child's parent or an accepted Approver for this child.
  IF v_comp.parent_id IS DISTINCT FROM v_uid
     AND coalesce(public.my_care_role(v_comp.child_id), '') <> 'approver' THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT ss.status INTO v_status
    FROM public.scheduled_sets ss
   WHERE ss.scheduled_set_id = v_comp.scheduled_set_id
     FOR UPDATE;
  IF v_comp.completed_at IS NULL OR v_comp.parent_approved
     OR v_status IS DISTINCT FROM 'AWAITING_APPROVAL' THEN
    RAISE EXCEPTION 'already reviewed';
  END IF;

  IF p_approve THEN
    IF (SELECT count(*) FROM public.completions
         WHERE approved_by = v_uid AND approved_at > now() - interval '1 minute') >= 10 THEN
      RAISE EXCEPTION 'too many approvals — please wait a minute';
    END IF;

    v_stars := greatest(0, coalesce(v_comp.stars_earned, 0))
             + CASE WHEN coalesce(p_gold_star, false) THEN 5 ELSE 0 END;

    UPDATE public.completions
       SET parent_approved = true, approved_at = now(), approved_by = v_uid
     WHERE completion_id = p_completion_id;
    UPDATE public.scheduled_sets
       SET status = 'APPROVED', updated_at = now()
     WHERE scheduled_set_id = v_comp.scheduled_set_id;
    UPDATE public.child_profiles
       SET total_stars = total_stars + v_stars
     WHERE profile_id = v_comp.child_id;

    RETURN jsonb_build_object('decision', 'approved', 'child_id', v_comp.child_id,
                              'stars_awarded', v_stars);
  END IF;

  -- Redo: the child starts the set again from scratch (step_completions cascade).
  UPDATE public.scheduled_sets
     SET status = 'PENDING', updated_at = now()
   WHERE scheduled_set_id = v_comp.scheduled_set_id;
  DELETE FROM public.completions WHERE completion_id = p_completion_id;

  RETURN jsonb_build_object('decision', 'redo', 'child_id', v_comp.child_id,
                            'stars_awarded', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.review_completion(uuid, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_completion(uuid, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_completion(uuid, boolean, boolean) TO authenticated;


SELECT to_regprocedure('public.review_completion(uuid,boolean,boolean)') IS NOT NULL      AS installed,
       (SELECT prosecdef FROM pg_proc
         WHERE oid = 'public.review_completion(uuid,boolean,boolean)'::regprocedure)       AS security_definer,
       NOT has_function_privilege('anon', 'public.review_completion(uuid,boolean,boolean)', 'EXECUTE')
                                                                                         AS anon_cannot_call,
       has_function_privilege('authenticated', 'public.review_completion(uuid,boolean,boolean)', 'EXECUTE')
                                                                                         AS signed_in_can_call;

-- ============================================================
-- Migration 054: review_completion — one atomic approve/redo for parents AND
--                care-team Approvers (pairs with 053)
--
-- The parent app approved with three separate client writes (completion,
-- scheduled set, stars) and redid with an update + two deletes — none of them
-- error-checked (postgrest returns errors instead of throwing), approved_by /
-- approved_at were never recorded, and an Approver had no way to act at all.
--
-- review_completion(completion, approve, gold_star):
--  * caller must be the child's parent or an accepted Approver for that child;
--  * locks the completion so a parent and an Approver can't both review it, and
--    refuses anything not AWAITING_APPROVAL ("already reviewed");
--  * approve: marks approved (approved_by/approved_at), sets the scheduled set
--    APPROVED and adds stars_earned (+5 for a gold star) to the child — the
--    child's waiting screen reacts to the completion UPDATE as before;
--  * redo: scheduled set back to PENDING and the attempt is deleted (its step
--    times cascade) — the child's sequencer resumes any unfinished completion,
--    so the attempt must go, not be reset;
--  * at most 10 approvals per reviewer per minute (security checklist).
-- Badges/streak bonuses stay in the reward-engine edge function, which the
-- client calls after an approval (it now also accepts Approvers).
-- Applied by the user in the SQL editor: the database connector declines SQL
-- containing DELETE without an interactive confirmation.
-- ============================================================

-- Approve / redo — one atomic, authorised call for parents and approvers ----
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


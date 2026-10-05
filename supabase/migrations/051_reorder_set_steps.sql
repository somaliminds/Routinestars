-- ============================================================
-- Migration 051: Reordering a custom set's steps actually saves
--
-- The parent's activity-set editor reordered steps by updating each step's
-- order_index one at a time. steps has a NON-deferrable UNIQUE(set_id,
-- order_index), so moving step B into A's slot collides while A still holds
-- it: every swap failed with 23505, postgrest returned the error instead of
-- throwing, and the screen showed an order that was never saved (it reverted
-- on reload). Reproduced 2026-10-05 against a real custom set.
--
-- reorder_set_steps(set_id, step_ids[]) does the whole reorder in one call with
-- the same collision-free scheme as admin_save_activity_set (040): park every
-- step of the set at +1,000,000, place the listed steps at 0..n-1, then put any
-- unlisted step after them in its old relative order.
-- SECURITY INVOKER: steps RLS still applies, and the caller must own the
-- custom set — it never touches built-in or another family's sets.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reorder_set_steps(p_set_id uuid, p_step_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_n int := coalesce(cardinality(p_step_ids), 0);
BEGIN
  IF p_set_id IS NULL OR v_n = 0 THEN
    RAISE EXCEPTION 'set and step order are required';
  END IF;
  IF v_n <> (SELECT count(DISTINCT x) FROM unnest(p_step_ids) AS x) THEN
    RAISE EXCEPTION 'a step appears twice in the order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activity_sets a
                  WHERE a.set_id = p_set_id
                    AND a.is_custom = true
                    AND a.created_by_parent_id = auth.uid()) THEN
    RAISE EXCEPTION 'set not found';
  END IF;

  -- 1. Park every step of the set in the high band (all values are < 1,000,000
  --    between calls, so no parked value can collide with an unparked one).
  UPDATE public.steps SET order_index = order_index + 1000000 WHERE set_id = p_set_id;

  -- 2. Listed steps take 0..n-1 in the requested order.
  UPDATE public.steps s
     SET order_index = t.ord - 1
    FROM unnest(p_step_ids) WITH ORDINALITY AS t(step_id, ord)
   WHERE s.step_id = t.step_id AND s.set_id = p_set_id;

  -- 3. Any step not listed (e.g. added on another device meanwhile) follows,
  --    keeping its old relative order; every value is < 1,000,000 again.
  WITH rest AS (
    SELECT step_id, row_number() OVER (ORDER BY order_index) - 1 AS rn
      FROM public.steps
     WHERE set_id = p_set_id AND order_index >= 1000000
  )
  UPDATE public.steps s SET order_index = v_n + r.rn
    FROM rest r WHERE s.step_id = r.step_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reorder_set_steps(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_set_steps(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.reorder_set_steps(uuid, uuid[]) TO authenticated;

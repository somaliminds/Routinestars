/**
 * step-order.ts — order_index rules for a parent's custom activity sets.
 *
 * steps has a NON-deferrable UNIQUE(set_id, order_index), and order_index is an
 * ordering key, not a position: built-in sets (and copies of them made before
 * October 2026) start at 1, and deleting a step leaves a gap. So:
 *  - a new step goes one past the HIGHEST index (steps.length can be an index
 *    that is still taken -> the insert failed and the step silently vanished);
 *  - a reorder is saved in ONE call (reorder_set_steps, migration 051) — one
 *    UPDATE per step collides with the step still holding the target slot, so
 *    every move used to fail and revert on reload.
 */
import { supabase } from './supabase';

/** order_index for a step appended to `steps` (0 when the set is empty). */
export function nextStepIndex(steps: readonly { order_index: number }[]): number {
  return steps.reduce((max, s) => Math.max(max, s.order_index), -1) + 1;
}

/** Save a custom set's new step order atomically. Throws on failure. */
export async function saveStepOrder(setId: string, stepIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_set_steps', {
    p_set_id: setId,
    p_step_ids: stepIds,
  });
  if (error) throw new Error(error.message);
}

/**
 * useSyncPending — Sprint 4.3
 *
 * Flushes the offline pending_completions queue to Supabase
 * whenever the app gains network connectivity.
 *
 * Called once from the root _layout.tsx after auth initialises.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  getPendingCompletions,
  deletePendingCompletion,
  pendingCompletionCount,
} from '@/lib/offline-db';

async function flushPendingCompletions(): Promise<void> {
  const count = await pendingCompletionCount();
  if (count === 0) return;

  const pending = await getPendingCompletions();

  for (const item of pending) {
    try {
      // 1. Create completion row
      const { data: comp, error: compErr } = await supabase
        .from('completions')
        .insert({
          scheduled_set_id: item.scheduled_set_id,
          child_id: item.child_id,
          stars_earned: item.stars_earned,
          completed_at: item.completed_at,
          parent_approved: !item.requires_approval,
        })
        .select('completion_id')
        .single();

      if (compErr || !comp) continue;

      // 2. Insert step_completions
      if (item.step_completions.length > 0) {
        await supabase.from('step_completions').insert(
          item.step_completions.map((sc) => ({
            completion_id: comp.completion_id,
            step_id: sc.step_id,
            time_taken_seconds: sc.time_taken_seconds,
          })),
        );
      }

      // 3. Update scheduled_set status
      const newStatus = item.requires_approval ? 'AWAITING_APPROVAL' : 'APPROVED';
      await supabase
        .from('scheduled_sets')
        .update({ status: newStatus })
        .eq('scheduled_set_id', item.scheduled_set_id);

      // 4. Stars + reward engine (fire-and-forget)
      if (!item.requires_approval) {
        void supabase.rpc('increment_child_stars', {
          p_child_id: item.child_id,
          p_stars: item.stars_earned,
        });
        void supabase.functions.invoke('reward-engine', {
          body: { child_id: item.child_id, completion_id: comp.completion_id },
        });
      } else {
        void supabase.functions.invoke('notify-parent', {
          body: {
            child_id: item.child_id,
            completion_id: comp.completion_id,
            set_name: item.set_name,
            child_name: item.child_name,
          },
        });
      }

      // 5. Remove from queue
      await deletePendingCompletion(item.id);
    } catch {
      // Still offline or partial failure — leave in queue for next attempt
    }
  }
}

export function useSyncPending(isAuthenticated: boolean): void {
  const isFlushing = useRef(false);

  const tryFlush = async () => {
    if (isFlushing.current) return;
    isFlushing.current = true;
    try {
      await flushPendingCompletions();
    } finally {
      isFlushing.current = false;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Flush on mount
    void tryFlush();

    // Flush when app returns to foreground
    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') void tryFlush();
      },
    );

    return () => subscription.remove();
  }, [isAuthenticated]);
}

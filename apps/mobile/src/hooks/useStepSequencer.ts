/**
 * useStepSequencer — Sprint 2.2 / 2.4
 * Manages the full state machine for a child completing an activity set step-by-step.
 *
 * Flow:
 *  1. Fetch steps for the scheduled set.
 *  2. On first tick, create a `completions` row + set status → IN_PROGRESS.
 *  3. On each BIG TICK: save step_completion, accumulate stars, advance index.
 *  4. On last step: mark completion done, update scheduled_set status.
 *     → requiresApproval  → AWAITING_APPROVAL + notify parent via push
 *     → !requiresApproval → APPROVED + update child total_stars + run reward engine
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { enqueuePendingCompletion } from '@/lib/offline-db';
import { isSuspiciouslyFast } from '@/lib/fast-finish';
import type { StepRow } from '@/types/database';

interface SequencerSet {
  setId: string;
  setName: string;
  iconEmoji: string;
  requiresApproval: boolean;
}

// Fast-finish escalation (anti-cheat layer 3): when a set that would normally
// auto-approve is finished suspiciously fast, it is escalated to
// AWAITING_APPROVAL instead — the child sees the ordinary "waiting for a
// grown-up" screen (never an accusation), and the parent decides. Thresholds
// live in @/lib/fast-finish (shared with the parent approval screen's notice).

export interface StepSequencerState {
  isLoading: boolean;
  error: string | null;
  steps: StepRow[];
  currentIndex: number;
  currentStep: StepRow | null;
  elapsedSeconds: number;
  starsEarned: number;
  isComplete: boolean;
  requiresApproval: boolean;
  setName: string;
  iconEmoji: string;
  /** Badges newly earned on completion — populated after reward engine runs */
  newlyEarnedBadges: string[];
  /** The completion_id for Realtime subscription (set once completion record is created) */
  completionId: string | null;
  /** Call this when the child presses BIG TICK */
  markStepComplete: () => Promise<void>;
}

export function useStepSequencer(
  scheduledSetId: string,
  childId: string,
  childName: string,
): StepSequencerState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [setInfo, setSetInfo] = useState<SequencerSet | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [newlyEarnedBadges, setNewlyEarnedBadges] = useState<string[]>([]);
  // Set at completion time when a suspiciously fast no-approval run is
  // escalated to the parent (fast-finish, layer 3).
  const [escalatedToApproval, setEscalatedToApproval] = useState(false);

  // Refs so interval callbacks always see current values without re-subscribing
  const completionIdRef = useRef<string | null>(null);
  const stepStartTimeRef = useRef<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track step timings for offline queue
  const stepTimingsRef = useRef<{ step_id: string; time_taken_seconds: number }[]>([]);
  // Guard setState calls in async callbacks against post-unmount execution
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load steps on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);

        // 1. Fetch scheduled_set to get set_id
        const { data: scheduledSet, error: ssErr } = await supabase
          .from('scheduled_sets')
          .select('set_id, status')
          .eq('scheduled_set_id', scheduledSetId)
          .single();

        if (ssErr || !scheduledSet) throw ssErr ?? new Error('Set not found');
        if (cancelled) return;

        // 2. Fetch activity_set details
        const { data: actSet, error: actErr } = await supabase
          .from('activity_sets')
          .select('set_name, icon_emoji, requires_approval')
          .eq('set_id', scheduledSet.set_id)
          .single();

        if (actErr || !actSet) throw actErr ?? new Error('Activity set not found');
        if (cancelled) return;

        // 3. Fetch steps ordered by order_index
        const { data: fetchedSteps, error: stepsErr } = await supabase
          .from('steps')
          .select('*')
          .eq('set_id', scheduledSet.set_id)
          .order('order_index');

        if (stepsErr) throw stepsErr;
        if (cancelled) return;

        const loadedSteps = (fetchedSteps ?? []) as StepRow[];

        // 4. Check for an existing in-progress completion (resume support)
        const { data: existingCompletion } = await supabase
          .from('completions')
          .select('completion_id, stars_earned')
          .eq('scheduled_set_id', scheduledSetId)
          .eq('child_id', childId)
          .is('completed_at', null)
          .maybeSingle();

        if (cancelled) return;

        if (existingCompletion) {
          completionIdRef.current = existingCompletion.completion_id;
          setStarsEarned(existingCompletion.stars_earned);

          // Find which steps are already done
          const { data: doneSteps } = await supabase
            .from('step_completions')
            .select('step_id')
            .eq('completion_id', existingCompletion.completion_id);

          if (cancelled) return;
          const doneIds = new Set((doneSteps ?? []).map((d) => d.step_id));
          const nextIdx = loadedSteps.findIndex((s) => !doneIds.has(s.step_id));
          setCurrentIndex(nextIdx === -1 ? loadedSteps.length - 1 : nextIdx);
        } else {
          // 5. Create a new completion record
          const { data: newCompletion, error: compErr } = await supabase
            .from('completions')
            .insert({
              scheduled_set_id: scheduledSetId,
              child_id: childId,
              stars_earned: 0,
              parent_approved: false,
            })
            .select('completion_id')
            .single();

          if (compErr || !newCompletion) throw compErr ?? new Error('Could not start activity');
          if (cancelled) return;

          completionIdRef.current = newCompletion.completion_id;

          // 6. Mark scheduled_set as IN_PROGRESS
          await supabase
            .from('scheduled_sets')
            .update({ status: 'IN_PROGRESS' })
            .eq('scheduled_set_id', scheduledSetId);
        }

        setSetInfo({
          setId: scheduledSet.set_id,
          setName: actSet.set_name,
          iconEmoji: actSet.icon_emoji,
          requiresApproval: actSet.requires_approval,
        });
        setSteps(loadedSteps);
        stepStartTimeRef.current = new Date();
      } catch {
        if (!cancelled) {
          setError('Something went wrong loading this activity. Please try again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [scheduledSetId, childId]);

  // ── Per-step countdown timer ─────────────────────────────────────────────
  useEffect(() => {
    if (isLoading || isComplete || steps.length === 0) return;

    setElapsedSeconds(0);
    stepStartTimeRef.current = new Date();

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isLoading, isComplete, steps.length]);

  // ── markStepComplete ─────────────────────────────────────────────────────
  const markStepComplete = useCallback(async () => {
    const completionId = completionIdRef.current;
    if (!completionId || steps.length === 0 || isComplete) return;

    const step = steps[currentIndex];
    if (!step) return;

    const timeTaken = Math.round(
      (new Date().getTime() - stepStartTimeRef.current.getTime()) / 1000,
    );
    const newStarsEarned = starsEarned + step.reward_stars;
    const isLastStep = currentIndex === steps.length - 1;

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Accumulate step timing for offline queue
    stepTimingsRef.current.push({ step_id: step.step_id, time_taken_seconds: timeTaken });

    // Save step_completion (best-effort — offline will catch up via sync)
    await supabase.from('step_completions').insert({
      completion_id: completionId,
      step_id: step.step_id,
      time_taken_seconds: timeTaken,
    });

    // Update running stars on completion record
    await supabase
      .from('completions')
      .update({ stars_earned: newStarsEarned })
      .eq('completion_id', completionId);

    setStarsEarned(newStarsEarned);

    if (isLastStep) {
      const setRequiresApproval = setInfo?.requiresApproval ?? false;

      // Fast-finish check over the steps measured THIS session (resume-safe:
      // steps completed in an earlier session aren't in stepTimingsRef, so
      // both sides of the comparison cover the same steps).
      const durationByStepId = new Map(steps.map((s) => [s.step_id, s.duration_seconds]));
      const measured = stepTimingsRef.current;
      const expectedSecs = measured.reduce(
        (sum, t) => sum + (durationByStepId.get(t.step_id) ?? 0),
        0,
      );
      const actualSecs = measured.reduce((sum, t) => sum + t.time_taken_seconds, 0);
      const suspiciouslyFast = isSuspiciouslyFast(actualSecs, expectedSecs);

      const requiresApproval = setRequiresApproval || suspiciouslyFast;
      if (!setRequiresApproval && suspiciouslyFast) setEscalatedToApproval(true);

      const newStatus = requiresApproval ? 'AWAITING_APPROVAL' : 'APPROVED';
      const completedAt = new Date().toISOString();

      try {
        // Mark completion done
        const { error: compErr } = await supabase
          .from('completions')
          .update({
            completed_at: completedAt,
            parent_approved: !requiresApproval,
          })
          .eq('completion_id', completionId);

        if (compErr) throw compErr;

        // Update scheduled_set status
        await supabase
          .from('scheduled_sets')
          .update({ status: newStatus })
          .eq('scheduled_set_id', scheduledSetId);
      } catch {
        // Network unavailable — queue for sync when reconnected
        await enqueuePendingCompletion({
          scheduledSetId,
          childId,
          starsEarned: newStarsEarned,
          completedAt,
          requiresApproval,
          setName: setInfo?.setName ?? '',
          childName,
          stepCompletions: stepTimingsRef.current,
        });
      }

      // If approval needed, push-notify the parent (fire-and-forget — never blocks child)
      if (requiresApproval) {
        void supabase.functions.invoke('notify-parent', {
          body: {
            child_id: childId,
            completion_id: completionId,
            set_name: setInfo?.setName ?? '',
            child_name: childName,
          },
        });
      }

      // If no approval needed, increment child's total_stars atomically via RPC
      if (!requiresApproval) {
        await supabase.rpc('increment_child_stars', {
          p_child_id: childId,
          p_stars: newStarsEarned,
        });

        // Run reward engine to check badges + streak (fire-and-forget on error)
        const completionIdForReward = completionIdRef.current;
        if (completionIdForReward) {
          void supabase.functions
            .invoke('reward-engine', {
              body: { child_id: childId, completion_id: completionIdForReward },
            })
            .then(({ data }) => {
              // Guard: don't update state if the hook has been unmounted
              if (!mountedRef.current) return;
              const result = data as {
                badges_newly_earned?: string[];
                bonus_stars?: number;
              } | null;
              const badges = result?.badges_newly_earned ?? [];
              if (badges.length > 0) setNewlyEarnedBadges(badges);
              // Award bonus stars (set complete, on-time, weekend, streaks, perfect day)
              const extraStars = result?.bonus_stars ?? 0;
              if (extraStars > 0) {
                void supabase.rpc('increment_child_stars', {
                  p_child_id: childId,
                  p_stars: extraStars,
                });
              }
            });
        }
      }

      setIsComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [steps, currentIndex, starsEarned, isComplete, setInfo, scheduledSetId, childId, childName]);

  return {
    isLoading,
    error,
    steps,
    currentIndex,
    currentStep: steps[currentIndex] ?? null,
    elapsedSeconds,
    starsEarned,
    isComplete,
    // Escalated fast-finish runs behave exactly like approval sets from the
    // child's point of view — the ordinary "waiting for a grown-up" screen.
    requiresApproval: (setInfo?.requiresApproval ?? false) || escalatedToApproval,
    setName: setInfo?.setName ?? '',
    iconEmoji: setInfo?.iconEmoji ?? '📋',
    newlyEarnedBadges,
    completionId: completionIdRef.current,
    markStepComplete,
  };
}

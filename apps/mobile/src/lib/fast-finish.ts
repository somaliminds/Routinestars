/**
 * fast-finish.ts — shared thresholds for the anti-cheat layer 3.
 *
 * A run is "suspiciously fast" when the recorded step times add up to less
 * than FAST_FINISH_RATIO of the expected durations, provided the measured
 * steps were expected to take at least MIN_EXPECTED_SECONDS (so genuinely
 * short routines are never flagged).
 *
 * Used by useStepSequencer (escalates no-approval sets to AWAITING_APPROVAL)
 * and the parent approval screen (shows the "finished unusually fast" notice).
 * Child-facing surfaces never reference this — the child is never accused.
 */

export const FAST_FINISH_RATIO = 0.25;
export const FAST_FINISH_MIN_EXPECTED_SECONDS = 60;

export function isSuspiciouslyFast(actualSeconds: number, expectedSeconds: number): boolean {
  return (
    expectedSeconds >= FAST_FINISH_MIN_EXPECTED_SECONDS &&
    actualSeconds < expectedSeconds * FAST_FINISH_RATIO
  );
}

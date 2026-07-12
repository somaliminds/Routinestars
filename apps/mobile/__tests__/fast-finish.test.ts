/**
 * Tests for the fast-finish anti-cheat thresholds (layer 3).
 * These gate both the child-side escalation (useStepSequencer) and the
 * parent-side "finished unusually fast" notice.
 */
import {
  isSuspiciouslyFast,
  FAST_FINISH_RATIO,
  FAST_FINISH_MIN_EXPECTED_SECONDS,
} from '../src/lib/fast-finish';

describe('isSuspiciouslyFast', () => {
  it('flags a 10-minute routine done in under 2.5 minutes', () => {
    expect(isSuspiciouslyFast(120, 600)).toBe(true); // 20% of expected
  });

  it('does not flag a routine done at a normal pace', () => {
    expect(isSuspiciouslyFast(480, 600)).toBe(false); // 80% of expected
  });

  it('does not flag exactly at the ratio boundary (strictly under only)', () => {
    expect(isSuspiciouslyFast(600 * FAST_FINISH_RATIO, 600)).toBe(false);
    expect(isSuspiciouslyFast(600 * FAST_FINISH_RATIO - 1, 600)).toBe(true);
  });

  it('never flags trivially short routines, however fast', () => {
    expect(isSuspiciouslyFast(1, FAST_FINISH_MIN_EXPECTED_SECONDS - 1)).toBe(false);
    expect(isSuspiciouslyFast(0, 30)).toBe(false);
  });

  it('flags at the minimum expected duration when fast enough', () => {
    const min = FAST_FINISH_MIN_EXPECTED_SECONDS;
    expect(isSuspiciouslyFast(min * FAST_FINISH_RATIO - 1, min)).toBe(true);
  });

  it('handles zero expected duration (no data) without flagging', () => {
    expect(isSuspiciouslyFast(0, 0)).toBe(false);
  });
});

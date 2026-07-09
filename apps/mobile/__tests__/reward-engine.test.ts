/**
 * Tests for reward engine streak bonus logic — Sprint 4.4
 *
 * Tests the pure streak-bonus calculation that the reward-engine Edge Function applies.
 * Extracted as a pure function so it can be tested without Deno/Supabase dependencies.
 */

// ── Pure helpers mirroring reward-engine/index.ts logic ──────────────────────

function calculateStreakBonus(newStreak: number): number {
  if (newStreak === 7) return 50;
  if (newStreak === 3) return 15;
  return 0;
}

function calculateStreakFromDates(completionDates: string[]): number {
  if (completionDates.length === 0) return 0;

  const sorted = [...new Set(completionDates)].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function isEarlyBirdEligible(completionTimes: { setId: string; time: string }[]): boolean {
  const WAKING_UP = '00000000-0000-0000-0000-000000000001';
  const BREAKFAST = '00000000-0000-0000-0000-000000000004';

  const wakingTime = completionTimes.find((c) => c.setId === WAKING_UP)?.time;
  const breakfastTime = completionTimes.find((c) => c.setId === BREAKFAST)?.time;

  if (!wakingTime || !breakfastTime) return false;

  const cutoff = new Date(wakingTime);
  cutoff.setHours(8, 0, 0, 0);

  return new Date(wakingTime) < cutoff && new Date(breakfastTime) < cutoff;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('calculateStreakBonus', () => {
  it('awards 15 bonus stars for a 3-day streak', () => {
    expect(calculateStreakBonus(3)).toBe(15);
  });

  it('awards 50 bonus stars for a 7-day streak', () => {
    expect(calculateStreakBonus(7)).toBe(50);
  });

  it('awards no bonus for other streak lengths', () => {
    expect(calculateStreakBonus(1)).toBe(0);
    expect(calculateStreakBonus(2)).toBe(0);
    expect(calculateStreakBonus(4)).toBe(0);
    expect(calculateStreakBonus(5)).toBe(0);
    expect(calculateStreakBonus(6)).toBe(0);
    expect(calculateStreakBonus(8)).toBe(0);
  });
});

describe('calculateStreakFromDates', () => {
  it('returns 0 for empty dates', () => {
    expect(calculateStreakFromDates([])).toBe(0);
  });

  it('returns 1 for single date', () => {
    expect(calculateStreakFromDates(['2026-01-01'])).toBe(1);
  });

  it('calculates consecutive days correctly', () => {
    expect(calculateStreakFromDates(['2026-01-03', '2026-01-02', '2026-01-01'])).toBe(3);
  });

  it('stops at a gap in the sequence', () => {
    // Gap between 01-02 and 01-04 — streak should be 1 (just the last day)
    expect(calculateStreakFromDates(['2026-01-05', '2026-01-04', '2026-01-02', '2026-01-01'])).toBe(
      2,
    );
  });

  it('deduplicates dates (multiple completions same day)', () => {
    expect(calculateStreakFromDates(['2026-01-03', '2026-01-03', '2026-01-02', '2026-01-01'])).toBe(
      3,
    );
  });

  it('correctly identifies a 7-day streak', () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-01-07');
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0] as string;
    });
    expect(calculateStreakFromDates(dates)).toBe(7);
  });
});

describe('isEarlyBirdEligible', () => {
  const WAKING_UP = '00000000-0000-0000-0000-000000000001';
  const BREAKFAST = '00000000-0000-0000-0000-000000000004';

  it('qualifies when both sets completed before 08:00', () => {
    const completions = [
      { setId: WAKING_UP, time: '2026-01-01T06:30:00Z' },
      { setId: BREAKFAST, time: '2026-01-01T07:15:00Z' },
    ];
    expect(isEarlyBirdEligible(completions)).toBe(true);
  });

  it('does not qualify when breakfast is after 08:00', () => {
    const completions = [
      { setId: WAKING_UP, time: '2026-01-01T06:30:00Z' },
      { setId: BREAKFAST, time: '2026-01-01T08:30:00Z' },
    ];
    expect(isEarlyBirdEligible(completions)).toBe(false);
  });

  it('does not qualify when waking up set is missing', () => {
    const completions = [{ setId: BREAKFAST, time: '2026-01-01T07:00:00Z' }];
    expect(isEarlyBirdEligible(completions)).toBe(false);
  });

  it('does not qualify when breakfast set is missing', () => {
    const completions = [{ setId: WAKING_UP, time: '2026-01-01T06:00:00Z' }];
    expect(isEarlyBirdEligible(completions)).toBe(false);
  });
});

describe('streak milestone bonus integration', () => {
  it('3-day streak earns exactly 15 bonus stars', () => {
    const dates = ['2026-01-03', '2026-01-02', '2026-01-01'];
    const streak = calculateStreakFromDates(dates);
    const bonus = calculateStreakBonus(streak);
    expect(streak).toBe(3);
    expect(bonus).toBe(15);
  });

  it('7-day streak earns exactly 50 bonus stars', () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-01-07');
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0] as string;
    });
    const streak = calculateStreakFromDates(dates);
    const bonus = calculateStreakBonus(streak);
    expect(streak).toBe(7);
    expect(bonus).toBe(50);
  });
});

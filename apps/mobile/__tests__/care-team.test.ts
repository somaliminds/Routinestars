/**
 * Tests for the care-team app's pure helpers — status wording, the 7-day
 * window, the weekly done/total summary and joining memberships to children.
 */

// Mock supabase so the module can be imported without .env vars in CI.
// jest.mock is hoisted above the imports below by the Jest transformer.
/* eslint-disable import/first */
jest.mock('../src/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import {
  careRoleLabel,
  isDone,
  joinCareLinks,
  lastNDays,
  shortTime,
  statusInfo,
  summariseWeek,
} from '../src/lib/care-team';

describe('statusInfo', () => {
  it('uses plain language for every status a scheduled activity can have', () => {
    expect(statusInfo('PENDING')).toEqual({ label: 'Not started', tone: 'neutral' });
    expect(statusInfo('IN_PROGRESS').label).toBe('In progress');
    expect(statusInfo('PAUSED').label).toBe('Paused');
    expect(statusInfo('AWAITING_APPROVAL')).toEqual({
      label: 'Waiting for approval',
      tone: 'waiting',
    });
    expect(statusInfo('APPROVED')).toEqual({ label: 'Done', tone: 'done' });
    expect(statusInfo('LOCKED')).toEqual({ label: 'Done', tone: 'done' });
    expect(statusInfo('SKIPPED').label).toBe('Skipped');
  });

  it('treats an unknown status as not started rather than crashing', () => {
    expect(statusInfo('SOMETHING_NEW').label).toBe('Not started');
  });
});

describe('isDone', () => {
  it('counts approved and locked as done, nothing else', () => {
    expect(isDone('APPROVED')).toBe(true);
    expect(isDone('LOCKED')).toBe(true);
    expect(isDone('AWAITING_APPROVAL')).toBe(false);
    expect(isDone('SKIPPED')).toBe(false);
  });
});

describe('lastNDays', () => {
  it('returns the 7 days ending on the given date, oldest first', () => {
    expect(lastNDays('2026-10-05', 7)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
  });

  it('crosses month and year boundaries and the UK clock change correctly', () => {
    expect(lastNDays('2027-01-02', 3)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
    // 25 Oct 2026 is the UK clocks-go-back day — no duplicated or skipped date.
    expect(lastNDays('2026-10-26', 3)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });
});

describe('summariseWeek', () => {
  const days = ['2026-10-03', '2026-10-04', '2026-10-05'];

  it('counts done/total per day and shows empty days as 0/0', () => {
    const schedules = [
      { schedule_id: 's1', schedule_date: '2026-10-03' },
      { schedule_id: 's3', schedule_date: '2026-10-05' },
    ];
    const sets = [
      { schedule_id: 's1', status: 'APPROVED' },
      { schedule_id: 's1', status: 'LOCKED' },
      { schedule_id: 's1', status: 'SKIPPED' },
      { schedule_id: 's3', status: 'AWAITING_APPROVAL' },
    ];
    expect(summariseWeek(days, schedules, sets)).toEqual([
      { date: '2026-10-03', total: 3, done: 2 },
      { date: '2026-10-04', total: 0, done: 0 },
      { date: '2026-10-05', total: 1, done: 0 },
    ]);
  });

  it('ignores activities from schedules outside the window', () => {
    const schedules = [{ schedule_id: 'old', schedule_date: '2026-09-01' }];
    const sets = [{ schedule_id: 'old', status: 'APPROVED' }];
    expect(summariseWeek(days, schedules, sets).every((d) => d.total === 0)).toBe(true);
  });
});

describe('joinCareLinks', () => {
  it('pairs each shared child with this account’s role, sorted by name, with safe defaults', () => {
    const members = [
      { child_id: 'b', role: 'approver' },
      { child_id: 'a', role: 'view_only' },
    ];
    const children = [
      {
        profile_id: 'b',
        child_name: 'Zara',
        avatar_emoji: '🦊',
        total_stars: 40,
        current_streak: 3,
      },
      {
        profile_id: 'a',
        child_name: 'Adam',
        avatar_emoji: null,
        total_stars: null,
        current_streak: null,
      },
    ];
    expect(joinCareLinks(members, children)).toEqual([
      {
        childId: 'a',
        childName: 'Adam',
        avatarEmoji: '🙂',
        totalStars: 0,
        currentStreak: 0,
        role: 'view_only',
      },
      {
        childId: 'b',
        childName: 'Zara',
        avatarEmoji: '🦊',
        totalStars: 40,
        currentStreak: 3,
        role: 'approver',
      },
    ]);
  });

  it('drops children that have no membership row', () => {
    const children = [
      { profile_id: 'x', child_name: 'X', avatar_emoji: null, total_stars: 0, current_streak: 0 },
    ];
    expect(joinCareLinks([], children)).toEqual([]);
  });
});

describe('labels', () => {
  it('names the two care-team roles the way the invite email does', () => {
    expect(careRoleLabel('approver')).toBe('Approver');
    expect(careRoleLabel('view_only')).toBe('Viewer');
  });

  it('shortens database times to HH:MM', () => {
    expect(shortTime('07:30:00')).toBe('07:30');
  });
});

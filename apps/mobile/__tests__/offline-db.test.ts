/**
 * Tests for offline-db SQLite helpers — Sprint 4.3 / 4.4
 *
 * Uses jest-expo's mocking. expo-sqlite is mocked via jest setup.
 */

// Mock expo-sqlite before importing offline-db
jest.mock('expo-sqlite', () => {
  const rows: Record<string, unknown[]> = {};
  const db = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockImplementation(async (sql: string, params: unknown[]) => {
      // Simulate INSERT INTO pending_completions
      if (sql.includes('INSERT INTO pending_completions')) {
        if (!rows['pending_completions']) rows['pending_completions'] = [];
        rows['pending_completions'].push({
          id: rows['pending_completions'].length + 1,
          scheduled_set_id: params[0],
          child_id: params[1],
          stars_earned: params[2],
          completed_at: params[3],
          requires_approval: params[4],
          set_name: params[5],
          child_name: params[6],
          step_completions: params[7],
          created_at: new Date().toISOString(),
        });
      }
      // Simulate INSERT/UPDATE for cached_schedules
      if (sql.includes('INSERT INTO cached_schedules')) {
        if (!rows['cached_schedules']) rows['cached_schedules'] = [];
        const existing = (rows['cached_schedules'] as { child_id: string; schedule_date: string }[])
          .findIndex((r) => r.child_id === params[0] && r.schedule_date === params[1]);
        if (existing >= 0) {
          (rows['cached_schedules'][existing] as Record<string, unknown>)['data'] = params[2];
        } else {
          rows['cached_schedules'].push({
            child_id: params[0],
            schedule_date: params[1],
            data: params[2],
            cached_at: new Date().toISOString(),
          });
        }
      }
      // Simulate DELETE
      if (sql.includes('DELETE FROM pending_completions')) {
        rows['pending_completions'] = (rows['pending_completions'] ?? []).filter(
          (r) => (r as { id: number }).id !== params[0],
        );
      }
    }),
    getFirstAsync: jest.fn().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT data FROM cached_schedules')) {
        const found = (rows['cached_schedules'] ?? []).find(
          (r) =>
            (r as { child_id: string }).child_id === params[0] &&
            (r as { schedule_date: string }).schedule_date === params[1],
        );
        return found ? { data: (found as { data: string }).data } : null;
      }
      if (sql.includes('COUNT(*) as count')) {
        return { count: (rows['pending_completions'] ?? []).length };
      }
      return null;
    }),
    getAllAsync: jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM pending_completions')) {
        return (rows['pending_completions'] ?? []).map((r) => ({
          ...(r as object),
          requires_approval: (r as { requires_approval: number }).requires_approval,
          step_completions: JSON.stringify(
            (r as { step_completions: unknown }).step_completions ?? [],
          ),
        }));
      }
      return [];
    }),
  };
  return {
    openDatabaseAsync: jest.fn().mockResolvedValue(db),
  };
});

import {
  saveScheduleCache,
  loadScheduleCache,
  enqueuePendingCompletion,
  getPendingCompletions,
  deletePendingCompletion,
  pendingCompletionCount,
} from '../src/lib/offline-db';

// Reset module between tests to get fresh DB singleton
beforeEach(() => {
  jest.resetModules();
});

describe('schedule cache', () => {
  it('returns null when no cache exists', async () => {
    const result = await loadScheduleCache('child-1', '2026-01-01');
    expect(result).toBeNull();
  });

  it('saves and retrieves schedule data', async () => {
    const data = { schedule_id: 'sched-1', scheduledSets: [] };
    await saveScheduleCache('child-1', '2026-01-01', data);
    const retrieved = await loadScheduleCache('child-1', '2026-01-01');
    // Data is stored as JSON string — compare serialised form
    expect(JSON.stringify(retrieved)).toBe(JSON.stringify(data));
  });
});

describe('pending completions queue', () => {
  const sampleCompletion = {
    scheduledSetId: 'ss-1',
    childId: 'child-1',
    starsEarned: 5,
    completedAt: '2026-01-01T09:00:00Z',
    requiresApproval: false,
    setName: 'Morning Routine',
    childName: 'Jamie',
    stepCompletions: [{ step_id: 'step-1', time_taken_seconds: 30 }],
  };

  it('starts with 0 pending completions', async () => {
    const count = await pendingCompletionCount();
    expect(count).toBe(0);
  });

  it('enqueues a completion and increments count', async () => {
    await enqueuePendingCompletion(sampleCompletion);
    const count = await pendingCompletionCount();
    expect(count).toBe(1);
  });

  it('retrieves queued completion with correct fields', async () => {
    await enqueuePendingCompletion(sampleCompletion);
    const pending = await getPendingCompletions();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    const item = pending[0]!;
    expect(item.scheduled_set_id).toBe('ss-1');
    expect(item.stars_earned).toBe(5);
    expect(item.requires_approval).toBe(false);
    expect(item.set_name).toBe('Morning Routine');
  });

  it('deletes a completion by id', async () => {
    await enqueuePendingCompletion(sampleCompletion);
    const before = await getPendingCompletions();
    await deletePendingCompletion(before[0]!.id);
    const after = await getPendingCompletions();
    expect(after.length).toBe(before.length - 1);
  });
});

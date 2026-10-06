/**
 * Tests for the shared approvals module (parent app + care-team Approvers):
 * the queue join, the single review_completion call and its error wording,
 * and the redo broadcast that must never hang the review screen.
 */

// Mock supabase so the module can be imported without .env vars in CI.
// jest.mock is hoisted above the imports below by the Jest transformer.
/* eslint-disable import/first */
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

import { supabase } from '../src/lib/supabase';
import {
  broadcastRedo,
  friendlyReviewError,
  joinPendingApprovals,
  reviewCompletion,
  runRewardEngine,
} from '../src/lib/approvals';

const rpc = supabase.rpc as jest.Mock;

describe('joinPendingApprovals', () => {
  const children = [
    { id: 'c1', name: 'Maya' },
    { id: 'c2', name: 'Leo' },
  ];

  it('keeps only completions whose activity is still waiting, with names filled in', () => {
    const completions = [
      {
        completion_id: 'k1',
        scheduled_set_id: 'ss1',
        child_id: 'c1',
        stars_earned: 4,
        completed_at: '2026-10-05T08:00:00Z',
      },
      // already approved elsewhere → its set is no longer AWAITING_APPROVAL
      {
        completion_id: 'k2',
        scheduled_set_id: 'ss2',
        child_id: 'c2',
        stars_earned: 2,
        completed_at: '2026-10-05T07:00:00Z',
      },
    ];
    const waiting = [{ scheduled_set_id: 'ss1', set_id: 'set-a' }];
    const names = [{ set_id: 'set-a', set_name: 'Brushing Teeth', icon_emoji: '🦷' }];
    expect(joinPendingApprovals(completions, waiting, names, children)).toEqual([
      {
        completionId: 'k1',
        scheduledSetId: 'ss1',
        childId: 'c1',
        childName: 'Maya',
        setName: 'Brushing Teeth',
        iconEmoji: '🦷',
        starsEarned: 4,
        completedAt: '2026-10-05T08:00:00Z',
      },
    ]);
  });

  it('leaves out an activity the reviewer cannot read the set of', () => {
    const completions = [
      {
        completion_id: 'k1',
        scheduled_set_id: 'ss1',
        child_id: 'c1',
        stars_earned: 1,
        completed_at: '2026-10-05T08:00:00Z',
      },
    ];
    expect(
      joinPendingApprovals(completions, [{ scheduled_set_id: 'ss1', set_id: 'x' }], [], children),
    ).toEqual([]);
  });
});

describe('reviewCompletion', () => {
  beforeEach(() => rpc.mockReset());

  it('approves (with gold star) in ONE review_completion call', async () => {
    rpc.mockResolvedValue({
      data: { decision: 'approved', child_id: 'c1', stars_awarded: 9 },
      error: null,
    });
    await expect(reviewCompletion('k1', true, true)).resolves.toEqual({
      decision: 'approved',
      childId: 'c1',
      starsAwarded: 9,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('review_completion', {
      p_completion_id: 'k1',
      p_approve: true,
      p_gold_star: true,
    });
  });

  it('asks for a redo without a gold star by default', async () => {
    rpc.mockResolvedValue({
      data: { decision: 'redo', child_id: 'c1', stars_awarded: 0 },
      error: null,
    });
    await reviewCompletion('k1', false);
    expect(rpc).toHaveBeenCalledWith('review_completion', {
      p_completion_id: 'k1',
      p_approve: false,
      p_gold_star: false,
    });
  });

  it('throws a readable message instead of silently "succeeding"', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'already reviewed' } });
    await expect(reviewCompletion('k1', true)).rejects.toThrow(
      'This activity has already been reviewed.',
    );
  });
});

describe('friendlyReviewError', () => {
  it('explains each refusal the server can give', () => {
    expect(friendlyReviewError('not authorised')).toMatch(/can’t review/);
    expect(friendlyReviewError('too many approvals — please wait a minute')).toMatch(
      /wait a minute/,
    );
    expect(friendlyReviewError('completion not found')).toMatch(/no longer exists/);
    expect(friendlyReviewError('connection reset')).toMatch(/try again/);
  });
});

describe('broadcastRedo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (supabase.channel as jest.Mock).mockReset();
    (supabase.removeChannel as jest.Mock).mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('sends the redo event to the child’s approval channel once subscribed', async () => {
    const send = jest.fn().mockResolvedValue('ok');
    const channel = {
      subscribe: (cb: (s: string) => void) => {
        cb('SUBSCRIBED');
        return channel;
      },
      send,
    };
    (supabase.channel as jest.Mock).mockReturnValue(channel);
    await broadcastRedo('k1');
    expect(supabase.channel).toHaveBeenCalledWith('approval-k1');
    expect(send).toHaveBeenCalledWith({ type: 'broadcast', event: 'redo', payload: {} });
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('gives up after 5 s if the socket never connects (the screen must not hang)', async () => {
    const channel = { subscribe: () => channel, send: jest.fn() };
    (supabase.channel as jest.Mock).mockReturnValue(channel);
    const done = broadcastRedo('k1');
    jest.advanceTimersByTime(5000);
    await expect(done).resolves.toBeUndefined();
    expect(channel.send).not.toHaveBeenCalled();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});

describe('runRewardEngine', () => {
  it('invokes the reward engine for that child + completion (it adds bonus stars itself)', () => {
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({ data: {}, error: null });
    runRewardEngine('c1', 'k1');
    expect(invoke).toHaveBeenCalledWith('reward-engine', {
      body: { child_id: 'c1', completion_id: 'k1' },
    });
    expect(rpc).not.toHaveBeenCalledWith('increment_child_stars', expect.anything());
  });
});

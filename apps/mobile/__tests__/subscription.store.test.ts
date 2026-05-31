/**
 * Tests for subscription store plan-gating helpers — Sprint 4.4
 */

// Mock supabase so the store can be imported without .env vars in CI
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() })),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

import {
  getPlanKey,
  canAddChild,
  canAddCustomSet,
  canExportReports,
  canShareCareTeam,
  isPlanActive,
} from '../src/stores/subscription.store';
import type { SubscriptionRow } from '../src/types/database';

function makeSubscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    subscription_id: 'sub-1',
    user_id: 'user-1',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    plan: 'STARTER',
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('getPlanKey', () => {
  it('returns FREE for null subscription', () => {
    expect(getPlanKey(null)).toBe('FREE');
  });

  it('returns FREE for canceled subscription', () => {
    expect(getPlanKey(makeSubscription({ status: 'canceled' }))).toBe('FREE');
  });

  it('returns FREE for past_due subscription', () => {
    expect(getPlanKey(makeSubscription({ status: 'past_due' }))).toBe('FREE');
  });

  it('returns plan key for active subscription', () => {
    expect(getPlanKey(makeSubscription({ plan: 'FAMILY', status: 'active' }))).toBe('FAMILY');
  });

  it('returns plan key for trialing subscription', () => {
    expect(getPlanKey(makeSubscription({ plan: 'SCHOOL', status: 'trialing' }))).toBe('SCHOOL');
  });
});

describe('canAddChild', () => {
  it('Free plan: allows first child (count 0)', () => {
    expect(canAddChild(null, 0)).toBe(true);
  });

  it('Free plan: blocks second child (count 1)', () => {
    expect(canAddChild(null, 1)).toBe(false);
  });

  it('Starter plan: allows up to 3 children', () => {
    const sub = makeSubscription({ plan: 'STARTER' });
    expect(canAddChild(sub, 0)).toBe(true);
    expect(canAddChild(sub, 2)).toBe(true);
    expect(canAddChild(sub, 3)).toBe(false);
  });

  it('Family plan: allows unlimited children', () => {
    const sub = makeSubscription({ plan: 'FAMILY' });
    expect(canAddChild(sub, 99)).toBe(true);
  });

  it('School plan: allows up to 30 children', () => {
    const sub = makeSubscription({ plan: 'SCHOOL' });
    expect(canAddChild(sub, 29)).toBe(true);
    expect(canAddChild(sub, 30)).toBe(false);
  });
});

describe('canAddCustomSet', () => {
  it('blocks Free plan', () => {
    expect(canAddCustomSet(null)).toBe(false);
  });

  it('allows Starter plan', () => {
    expect(canAddCustomSet(makeSubscription({ plan: 'STARTER' }))).toBe(true);
  });

  it('allows Family plan', () => {
    expect(canAddCustomSet(makeSubscription({ plan: 'FAMILY' }))).toBe(true);
  });

  it('allows School plan', () => {
    expect(canAddCustomSet(makeSubscription({ plan: 'SCHOOL' }))).toBe(true);
  });
});

describe('canExportReports', () => {
  it('blocks Free plan', () => {
    expect(canExportReports(null)).toBe(false);
  });

  it('allows paid plans', () => {
    expect(canExportReports(makeSubscription({ plan: 'STARTER' }))).toBe(true);
    expect(canExportReports(makeSubscription({ plan: 'FAMILY' }))).toBe(true);
    expect(canExportReports(makeSubscription({ plan: 'SCHOOL' }))).toBe(true);
  });
});

describe('canShareCareTeam', () => {
  it('blocks Free and Starter plans', () => {
    expect(canShareCareTeam(null)).toBe(false);
    expect(canShareCareTeam(makeSubscription({ plan: 'STARTER' }))).toBe(false);
  });

  it('allows Family plan', () => {
    expect(canShareCareTeam(makeSubscription({ plan: 'FAMILY' }))).toBe(true);
  });

  it('allows School plan', () => {
    expect(canShareCareTeam(makeSubscription({ plan: 'SCHOOL' }))).toBe(true);
  });
});

describe('isPlanActive', () => {
  it('returns false for null', () => {
    expect(isPlanActive(null)).toBe(false);
  });

  it('returns true for active status', () => {
    expect(isPlanActive(makeSubscription({ status: 'active' }))).toBe(true);
  });

  it('returns true for trialing status', () => {
    expect(isPlanActive(makeSubscription({ status: 'trialing' }))).toBe(true);
  });

  it('returns false for past_due', () => {
    expect(isPlanActive(makeSubscription({ status: 'past_due' }))).toBe(false);
  });

  it('returns false for canceled', () => {
    expect(isPlanActive(makeSubscription({ status: 'canceled' }))).toBe(false);
  });
});

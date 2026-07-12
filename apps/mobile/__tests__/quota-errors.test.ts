/**
 * Tests for quota-error mapping — turns the server-side plan-limit trigger
 * rejections (migration 035) into parent-facing paywall messages.
 */
import { quotaMessageFor } from '../src/lib/quota-errors';

describe('quotaMessageFor', () => {
  it('maps the child-limit trigger error to a child-limit message', () => {
    const msg = quotaMessageFor(new Error('child_limit_reached: your plan allows 1 child'));
    expect(msg?.title).toMatch(/child limit/i);
    expect(msg?.body).toMatch(/upgrade/i);
  });

  it('maps the custom-set trigger error to an upgrade message', () => {
    const msg = quotaMessageFor(
      new Error('custom_sets_not_in_plan: upgrade to create custom sets'),
    );
    expect(msg?.title).toMatch(/custom sets/i);
  });

  it('matches on a raw string message too (not only Error objects)', () => {
    expect(quotaMessageFor('child_limit_reached')).not.toBeNull();
  });

  it('returns null for an unrelated error (caller falls back to generic handling)', () => {
    expect(quotaMessageFor(new Error('network request failed'))).toBeNull();
    expect(quotaMessageFor(null)).toBeNull();
    expect(quotaMessageFor(undefined)).toBeNull();
  });
});

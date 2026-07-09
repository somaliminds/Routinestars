/**
 * quota-errors.ts — friendly messages for the server-side plan limits
 * enforced by migration 035 (audit H1).
 *
 * The DB triggers RAISE distinct message prefixes; PostgREST surfaces them in
 * the error message. We translate them into parent-facing upgrade prompts so a
 * blocked insert reads as a paywall, not a generic failure.
 */

export interface QuotaMessage {
  title: string;
  body: string;
}

/**
 * If the error is a known plan-quota rejection, return a friendly message;
 * otherwise null (caller falls back to its generic error handling).
 */
export function quotaMessageFor(err: unknown): QuotaMessage | null {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (msg.includes('child_limit_reached')) {
    return {
      title: 'Child limit reached',
      body: "You've reached the number of child profiles your plan allows. Upgrade your plan to add more children.",
    };
  }
  if (msg.includes('custom_sets_not_in_plan')) {
    return {
      title: 'Upgrade to add custom sets',
      body: 'Creating your own activity sets is available on Starter and above. Upgrade to unlock custom sets.',
    };
  }
  return null;
}

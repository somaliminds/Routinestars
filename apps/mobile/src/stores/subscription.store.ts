/**
 * Subscription store — Sprint 4.1 + Phase 1 pricing reshape.
 *
 * Fetches and caches the current user's subscription from Supabase.
 * Provides plan-gating helpers used throughout the parent app.
 *
 * Gating is centralised here so screens never branch on the raw plan key.
 * The capability flags themselves are defined per-tier in src/lib/stripe.ts.
 */
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { STRIPE_PLANS, type PlanKey } from '@/lib/stripe';
import type { SubscriptionRow } from '@/types/database';

interface SubscriptionState {
  subscription: SubscriptionRow | null;
  isLoading: boolean;
  fetch: (userId: string) => Promise<void>;
  clear: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscription: null,
  isLoading: false,

  fetch: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      set({ subscription: data ?? null });
    } finally {
      set({ isLoading: false });
    }
  },

  clear: () => set({ subscription: null }),
}));

// ── Plan resolution ───────────────────────────────────────────────────────────

export function getPlanKey(subscription: SubscriptionRow | null): PlanKey {
  if (!subscription || subscription.status === 'canceled') return 'FREE';
  if (subscription.status === 'past_due') return 'FREE'; // lock on failed payment
  return (subscription.plan as PlanKey) ?? 'FREE';
}

function plan(subscription: SubscriptionRow | null) {
  return STRIPE_PLANS[getPlanKey(subscription)];
}

// ── Capability-based gates ────────────────────────────────────────────────────
// Each gate reads a flag from STRIPE_PLANS so prices and features stay in
// sync. Adding a new gate means: (a) add the flag to every tier in
// stripe.ts, (b) add the helper here, (c) use the helper at the gate site.

export function canAddChild(
  subscription: SubscriptionRow | null,
  currentChildCount: number,
): boolean {
  // `as number` widens past the `as const`-narrowed literal type so the
  // sentinel -1 ("unlimited") comparison stays valid even if no current
  // tier uses it.
  const max = plan(subscription).maxChildren as number;
  if (max === -1) return true;
  return currentChildCount < max;
}

export function canAddCustomSet(subscription: SubscriptionRow | null): boolean {
  return plan(subscription).canAddCustomSet;
}

/** Basic + advanced reports access. Free is locked out entirely. */
export function canAccessReports(subscription: SubscriptionRow | null): boolean {
  return plan(subscription).canAccessReports;
}

export function canExportReports(subscription: SubscriptionRow | null): boolean {
  return plan(subscription).canExportReports;
}

export function canShareCareTeam(subscription: SubscriptionRow | null): boolean {
  return plan(subscription).canShareCareTeam;
}

/** AI routine generation — Family+ only. */
export function canUseAI(subscription: SubscriptionRow | null): boolean {
  return plan(subscription).canUseAI;
}

/** EHCP outcomes manager + evidence-pack PDF export — Family+ only. */
export function canUseEHCP(subscription: SubscriptionRow | null): boolean {
  return plan(subscription).canUseEHCP;
}

export function isPlanActive(subscription: SubscriptionRow | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Friendly upgrade-required label — what tier unlocks the gated feature.
 * Used in paywall callouts so the message tells the user WHICH plan to
 * pick, not just "upgrade required".
 */
export function requiredTierFor(
  capability:
    | 'canUseAI'
    | 'canAccessReports'
    | 'canExportReports'
    | 'canShareCareTeam'
    | 'canUseEHCP'
    | 'canAddCustomSet',
): { tier: PlanKey; tierName: string; priceDisplay: string } {
  const tiers: PlanKey[] = ['STARTER', 'FAMILY', 'SCHOOL'];
  for (const t of tiers) {
    if (STRIPE_PLANS[t][capability]) {
      return {
        tier: t,
        tierName: STRIPE_PLANS[t].name,
        priceDisplay: STRIPE_PLANS[t].priceDisplay,
      };
    }
  }
  // Defensive — every capability should be unlockable somewhere
  return {
    tier: 'FAMILY',
    tierName: STRIPE_PLANS.FAMILY.name,
    priceDisplay: STRIPE_PLANS.FAMILY.priceDisplay,
  };
}

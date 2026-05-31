/**
 * Subscription store — Sprint 4.1
 *
 * Fetches and caches the current user's subscription from Supabase.
 * Provides plan-gating helpers used throughout the parent app.
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

// ── Plan gating helpers ───────────────────────────────────────────────────────

export function getPlanKey(subscription: SubscriptionRow | null): PlanKey {
  if (!subscription || subscription.status === 'canceled') return 'FREE';
  if (subscription.status === 'past_due') return 'FREE'; // lock on failed payment
  return (subscription.plan as PlanKey) ?? 'FREE';
}

export function canAddChild(
  subscription: SubscriptionRow | null,
  currentChildCount: number,
): boolean {
  const plan = STRIPE_PLANS[getPlanKey(subscription)];
  if (plan.maxChildren === -1) return true;
  return currentChildCount < plan.maxChildren;
}

export function canAddCustomSet(subscription: SubscriptionRow | null): boolean {
  const key = getPlanKey(subscription);
  return key !== 'FREE';
}

export function canAccessReports(subscription: SubscriptionRow | null): boolean {
  return true; // Basic reports on all plans; full reports gated below
}

export function canExportReports(subscription: SubscriptionRow | null): boolean {
  const key = getPlanKey(subscription);
  return key !== 'FREE';
}

export function canShareCareTeam(subscription: SubscriptionRow | null): boolean {
  const key = getPlanKey(subscription);
  return key === 'FAMILY' || key === 'SCHOOL';
}

export function isPlanActive(subscription: SubscriptionRow | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}

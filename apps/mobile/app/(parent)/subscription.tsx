/**
 * Subscription — Sprint 4.1 + Phase 1 pricing reshape.
 *
 * Paywall / plan management screen:
 *  - Monthly / Annual cycle toggle (annual saves ~17% across the board)
 *  - Plan cards: Free / Starter / Family / Enterprise
 *  - Family marked Most Popular — the revenue pillar
 *  - Subscribe button opens Stripe Checkout via in-app browser
 *  - Manage billing button opens Stripe Customer Portal
 *
 * Spec: Section 8 — SaaS Pricing (updated 2026-06)
 */
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { STRIPE_PLANS, type PlanKey, type BillingCycle } from '@/lib/stripe';
import { getPlanKey } from '@/stores/subscription.store';
import type { SubscriptionRow } from '@/types/database';

// ── Data ─────────────────────────────────────────────────────────────────────
async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

// ── Cycle toggle ──────────────────────────────────────────────────────────────
function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  return (
    <View className="bg-white rounded-2xl p-1 flex-row mb-4 shadow-sm self-center">
      <TouchableOpacity
        onPress={() => onChange('monthly')}
        className={`px-5 py-2 rounded-xl ${cycle === 'monthly' ? 'bg-brand-primary' : ''}`}
        accessibilityRole="button"
        accessibilityState={{ selected: cycle === 'monthly' }}
      >
        <Text
          className={`font-inter font-semibold text-sm ${
            cycle === 'monthly' ? 'text-white' : 'text-neutral-500'
          }`}
        >
          Monthly
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange('annual')}
        className={`px-5 py-2 rounded-xl flex-row items-center gap-2 ${
          cycle === 'annual' ? 'bg-brand-primary' : ''
        }`}
        accessibilityRole="button"
        accessibilityState={{ selected: cycle === 'annual' }}
      >
        <Text
          className={`font-inter font-semibold text-sm ${
            cycle === 'annual' ? 'text-white' : 'text-neutral-500'
          }`}
        >
          Annual
        </Text>
        <View
          className={`rounded-full px-2 py-0.5 ${
            cycle === 'annual' ? 'bg-white/25' : 'bg-accent-success/15'
          }`}
        >
          <Text
            className={`font-inter font-bold text-[10px] ${
              cycle === 'annual' ? 'text-white' : 'text-accent-success'
            }`}
          >
            SAVE 17%
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  planKey,
  cycle,
  isCurrent,
  isPopular,
  onSelect,
  loading,
}: {
  planKey: PlanKey;
  cycle: BillingCycle;
  isCurrent: boolean;
  isPopular: boolean;
  onSelect: () => void;
  loading: boolean;
}) {
  const plan = STRIPE_PLANS[planKey];
  const isFree = planKey === 'FREE';

  // Free has no annual variant — always show Free.
  // Annual cycle uses plan.annual.* fields; falls back to monthly for tiers
  // without an annual price (none currently, but defensive).
  const showAnnual = cycle === 'annual' && plan.annual !== null;
  const priceDisplay = showAnnual ? plan.annual!.priceDisplay : plan.priceDisplay;
  const savingsBadge = showAnnual ? plan.annual!.savingsDisplay : null;
  const monthlyEquivalent =
    showAnnual && plan.annual
      ? `£${(plan.annual.price / 100 / 12).toFixed(2)}/mo billed annually`
      : null;

  return (
    <View
      className={`rounded-2xl p-5 mb-3 ${
        isCurrent
          ? 'bg-brand-primary'
          : isPopular
            ? 'bg-white border-2 border-brand-primary'
            : 'bg-white'
      } shadow-sm`}
    >
      {isPopular && !isCurrent && (
        <View className="bg-brand-primary rounded-full px-3 py-0.5 self-start mb-2">
          <Text className="font-inter font-semibold text-white text-xs">Most Popular</Text>
        </View>
      )}

      <View className="flex-row items-baseline justify-between mb-1">
        <Text
          className={`font-inter font-bold text-lg ${isCurrent ? 'text-white' : 'text-neutral-900'}`}
        >
          {plan.name}
        </Text>
        <View className="items-end">
          <Text
            className={`font-inter font-bold text-2xl ${isCurrent ? 'text-white' : 'text-neutral-900'}`}
          >
            {priceDisplay}
          </Text>
          {monthlyEquivalent && (
            <Text
              className={`font-inter text-[11px] ${isCurrent ? 'text-white/80' : 'text-neutral-400'}`}
            >
              {monthlyEquivalent}
            </Text>
          )}
        </View>
      </View>

      {savingsBadge && !isCurrent && (
        <View className="bg-accent-success/15 rounded-full px-2 py-0.5 self-start mb-1">
          <Text className="font-inter font-bold text-accent-success text-[10px]">
            {savingsBadge}
          </Text>
        </View>
      )}

      {plan.features.map((f) => (
        <View key={f} className="flex-row items-center mt-1.5">
          <Text className={`mr-2 ${isCurrent ? 'text-white' : 'text-accent-success'}`}>✓</Text>
          <Text
            className={`font-inter text-sm ${isCurrent ? 'text-white opacity-90' : 'text-neutral-600'}`}
          >
            {f}
          </Text>
        </View>
      ))}

      {!isFree && (
        <TouchableOpacity
          onPress={onSelect}
          disabled={isCurrent || loading}
          className={`mt-4 rounded-xl py-3 items-center ${
            isCurrent ? 'bg-white opacity-30' : 'bg-brand-primary'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`font-inter font-semibold text-sm ${
                isCurrent ? 'text-brand-primary' : 'text-white'
              }`}
            >
              {isCurrent ? 'Current Plan' : `Choose ${plan.name}`}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? '';
  const [checkoutLoading, setCheckoutLoading] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>('annual'); // default annual — nudge toward higher LTV

  const { data: subscription, refetch } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => fetchSubscription(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const currentPlan = getPlanKey(subscription ?? null);

  const handleUpgrade = async (planKey: PlanKey) => {
    const plan = STRIPE_PLANS[planKey];
    // Pick monthly or annual price ID based on selected cycle.
    const priceId =
      cycle === 'annual' && plan.annual?.stripePriceId
        ? plan.annual.stripePriceId
        : plan.stripePriceId;

    if (!priceId) {
      Alert.alert(
        'Configuration error',
        `Stripe price ID not configured for ${plan.name} (${cycle}). Add the env var and redeploy.`,
      );
      return;
    }

    setCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          userId,
          priceId,
          // Let the server use its HTTPS → deep-link bridge defaults.
        },
      });

      if (error || !(data as { url?: string })?.url) {
        Alert.alert('Error', 'Could not create checkout session. Please try again.');
        return;
      }

      await Linking.openURL((data as { url: string }).url);
      setTimeout(() => {
        void refetch();
      }, 3000);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { userId },
      });

      // On non-2xx responses, supabase-js 2.45+ puts the body in
      // error.context, not data. Try both so the user sees Stripe's real
      // reason (e.g. "portal not activated in dashboard") instead of a
      // generic "could not open" message.
      let payload = data as { url?: string; error?: string } | null;
      if (error && 'context' in error) {
        try {
          const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
          if (ctx?.json) payload = (await ctx.json()) as typeof payload;
        } catch {
          /* fall through to generic message */
        }
      }

      if (error || !payload?.url) {
        const reason =
          payload?.error ??
          (error instanceof Error ? error.message : null) ??
          'Could not open billing portal. Please try again.';
        Alert.alert('Billing portal unavailable', reason);
        return;
      }

      await Linking.openURL(payload.url);
      setTimeout(() => {
        void refetch();
      }, 3000);
    } finally {
      setPortalLoading(false);
    }
  };

  const statusLabel = subscription
    ? subscription.status === 'trialing'
      ? 'Free trial'
      : subscription.status === 'past_due'
        ? 'Payment failed — please update billing'
        : subscription.status === 'canceled'
          ? 'Canceled'
          : 'Active'
    : 'Free plan';

  const statusColor =
    subscription?.status === 'past_due'
      ? 'text-accent-danger'
      : subscription?.status === 'active' || subscription?.status === 'trialing'
        ? 'text-accent-success'
        : 'text-neutral-500';

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
      <View className="px-5 pt-6 pb-4">
        <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
          Subscription
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          <Text className="font-inter text-neutral-500 text-sm">
            Current plan:{' '}
            <Text className="font-semibold text-neutral-900">{STRIPE_PLANS[currentPlan].name}</Text>
          </Text>
          <Text className={`font-inter text-xs font-semibold ${statusColor}`}>· {statusLabel}</Text>
        </View>
        {subscription?.current_period_end && subscription.status === 'active' && (
          <Text className="font-inter text-neutral-400 text-xs mt-0.5">
            Renews{' '}
            {new Date(subscription.current_period_end).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {subscription.cancel_at_period_end ? ' (cancels then)' : ''}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 }}>
        <CycleToggle cycle={cycle} onChange={setCycle} />

        {(['FREE', 'STARTER', 'FAMILY', 'SCHOOL'] as PlanKey[]).map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            cycle={cycle}
            isCurrent={currentPlan === key}
            isPopular={key === 'FAMILY'}
            onSelect={() => {
              void handleUpgrade(key);
            }}
            loading={checkoutLoading === key}
          />
        ))}

        {/* Manage billing — visible whenever a Stripe customer exists,
            including canceled/past_due. Those are the states where the
            user most needs the portal (update payment, reactivate,
            download final invoices). Hidden only for users who never
            ran a checkout (no subscriptions row). */}
        {subscription?.stripe_customer_id && (
          <TouchableOpacity
            onPress={() => {
              void handleManageBilling();
            }}
            disabled={portalLoading}
            className="bg-white rounded-2xl py-4 items-center shadow-sm mt-2"
          >
            {portalLoading ? (
              <ActivityIndicator color="#7C3AED" />
            ) : (
              <Text className="font-inter font-semibold text-brand-primary text-sm">
                Manage Billing &amp; Invoices
              </Text>
            )}
          </TouchableOpacity>
        )}

        <Text className="font-inter text-neutral-400 text-xs text-center mt-4 px-4">
          {cycle === 'annual'
            ? 'Annual subscriptions are billed once per year. Cancel anytime from the billing portal.'
            : 'Monthly subscriptions are billed each month. Switch to annual to save 17%.'}{' '}
          Prices in GBP and include VAT where applicable.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

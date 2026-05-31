/**
 * Subscription — Sprint 4.1
 *
 * Paywall / plan management screen:
 *  - Shows current plan + status
 *  - Plan cards: Free / Starter / Family / School
 *  - Subscribe button opens Stripe Checkout via in-app browser
 *  - Manage billing button opens Stripe Customer Portal
 *
 * Spec: Section 8 — SaaS Pricing
 */
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { STRIPE_PLANS, type PlanKey } from '@/lib/stripe';
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

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  planKey,
  isCurrent,
  isPopular,
  onSelect,
  loading,
}: {
  planKey: PlanKey;
  isCurrent: boolean;
  isPopular: boolean;
  onSelect: () => void;
  loading: boolean;
}) {
  const plan = STRIPE_PLANS[planKey];
  const isFree = planKey === 'FREE';

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
        <Text
          className={`font-inter font-bold text-2xl ${isCurrent ? 'text-white' : 'text-neutral-900'}`}
        >
          {'priceDisplay' in plan ? plan.priceDisplay : 'Free'}
        </Text>
      </View>

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
              {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
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

  const { data: subscription, refetch } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => fetchSubscription(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const currentPlan = getPlanKey(subscription ?? null);

  const handleUpgrade = async (planKey: PlanKey) => {
    const plan = STRIPE_PLANS[planKey];
    if (!('stripePriceId' in plan) || !plan.stripePriceId) {
      Alert.alert('Configuration error', 'Price ID not configured for this plan.');
      return;
    }

    setCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          userId,
          priceId: plan.stripePriceId,
          successUrl: 'routinestars://subscription/success',
          cancelUrl: 'routinestars://subscription/cancel',
        },
      });

      if (error || !(data as { url?: string })?.url) {
        Alert.alert('Error', 'Could not create checkout session. Please try again.');
        return;
      }

      await Linking.openURL((data as { url: string }).url);
      // Refetch after returning from checkout (deep link will re-focus app)
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

      if (error || !(data as { url?: string })?.url) {
        Alert.alert('Error', 'Could not open billing portal. Please try again.');
        return;
      }

      await Linking.openURL((data as { url: string }).url);
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
    <SafeAreaView className="flex-1 bg-[#F5F0FF]">
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
        {(['FREE', 'STARTER', 'FAMILY', 'SCHOOL'] as PlanKey[]).map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            isCurrent={currentPlan === key}
            isPopular={key === 'FAMILY'}
            onSelect={() => {
              void handleUpgrade(key);
            }}
            loading={checkoutLoading === key}
          />
        ))}

        {/* Manage billing — only shown if on a paid plan */}
        {subscription && currentPlan !== 'FREE' && (
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
          Subscriptions are billed monthly. Cancel anytime from the billing portal. Prices in GBP
          and include VAT where applicable.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

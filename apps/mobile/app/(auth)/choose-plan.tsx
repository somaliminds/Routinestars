/**
 * choose-plan — Sprint 4.2 Onboarding
 *
 * Shown after first child profile is created.
 * Let the parent pick a paid plan or continue on Free.
 * Paid plan → opens Stripe Checkout via Linking, then goes to schedule wizard.
 * Free → goes straight to schedule wizard.
 */
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { STRIPE_PLANS, type PlanKey } from '@/lib/stripe';

const PLAN_ORDER: PlanKey[] = ['FREE', 'STARTER', 'FAMILY', 'SCHOOL'];

function PlanCard({
  planKey,
  isSelected,
  isPopular,
  onSelect,
}: {
  planKey: PlanKey;
  isSelected: boolean;
  isPopular: boolean;
  onSelect: () => void;
}) {
  const plan = STRIPE_PLANS[planKey];
  const isFree = planKey === 'FREE';

  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`rounded-2xl p-5 mb-3 shadow-sm ${
        isSelected
          ? 'bg-brand-primary'
          : isPopular
            ? 'bg-white border-2 border-brand-primary'
            : 'bg-white'
      }`}
      accessibilityLabel={`Select ${plan.name} plan`}
      accessibilityState={{ selected: isSelected }}
    >
      {isPopular && !isSelected && (
        <View className="bg-brand-primary rounded-full px-3 py-0.5 self-start mb-2">
          <Text className="font-inter font-semibold text-white text-xs">Most Popular</Text>
        </View>
      )}

      <View className="flex-row items-baseline justify-between mb-1">
        <Text
          className={`font-inter font-bold text-lg ${isSelected ? 'text-white' : 'text-neutral-900'}`}
        >
          {plan.name}
        </Text>
        <Text
          className={`font-inter font-bold text-2xl ${isSelected ? 'text-white' : 'text-neutral-900'}`}
        >
          {'priceDisplay' in plan ? plan.priceDisplay : 'Free'}
        </Text>
      </View>

      {plan.features.map((f) => (
        <View key={f} className="flex-row items-center mt-1.5">
          <Text className={`mr-2 ${isSelected ? 'text-white' : 'text-accent-success'}`}>✓</Text>
          <Text
            className={`font-inter text-sm ${isSelected ? 'text-white opacity-90' : 'text-neutral-600'}`}
          >
            {f}
          </Text>
        </View>
      ))}

      {isFree && (
        <Text
          className={`font-inter text-xs mt-2 ${isSelected ? 'text-white opacity-70' : 'text-neutral-400'}`}
        >
          No credit card required
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ChoosePlanScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? '';
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('FAMILY');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (selectedPlan === 'FREE') {
      router.replace('/(auth)/schedule-wizard');
      return;
    }

    const plan = STRIPE_PLANS[selectedPlan];
    if (!('stripePriceId' in plan) || !plan.stripePriceId) {
      Alert.alert('Configuration error', 'Price ID not configured for this plan.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          userId,
          priceId: plan.stripePriceId,
          successUrl: 'routinestars://onboarding/success',
          cancelUrl: 'routinestars://auth/choose-plan',
        },
      });

      if (error || !(data as { url?: string })?.url) {
        Alert.alert('Error', 'Could not start checkout. Please try again.');
        return;
      }

      await Linking.openURL((data as { url: string }).url);
      // After returning from Stripe, proceed to schedule wizard
      setTimeout(() => {
        router.replace('/(auth)/schedule-wizard');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-100">
      <View className="px-5 pt-6 pb-3">
        <View className="flex-row items-center mb-1">
          <View className="flex-row gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${i === 2 ? 'w-6 bg-brand-primary' : 'w-3 bg-neutral-300'}`}
              />
            ))}
          </View>
        </View>
        <Text className="font-inter font-bold text-neutral-900 mt-3" style={{ fontSize: 24 }}>
          Choose your plan
        </Text>
        <Text className="font-inter text-neutral-500 text-sm mt-1">
          Start free, upgrade anytime. Cancel whenever you like.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {PLAN_ORDER.map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            isSelected={selectedPlan === key}
            isPopular={key === 'FAMILY'}
            onSelect={() => setSelectedPlan(key)}
          />
        ))}

        <TouchableOpacity
          onPress={() => void handleContinue()}
          disabled={loading}
          className="bg-brand-primary rounded-2xl py-4 items-center min-h-[60px] justify-center mt-2 shadow-sm"
          accessibilityLabel="Continue with selected plan"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-inter font-semibold text-white text-base">
              {selectedPlan === 'FREE' ? 'Continue for free' : `Start ${STRIPE_PLANS[selectedPlan].name}`}
            </Text>
          )}
        </TouchableOpacity>

        <Text className="font-inter text-neutral-400 text-xs text-center mt-3 px-4">
          Paid plans billed monthly. Cancel anytime from the billing portal. Prices in GBP.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  StyleSheet,
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
  const priceDisplay = 'priceDisplay' in plan ? plan.priceDisplay : 'Free';

  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[
        styles.planCard,
        isSelected && styles.planCardSelected,
        !isSelected && isPopular && styles.planCardPopular,
      ]}
      activeOpacity={0.85}
      accessibilityLabel={`Select ${plan.name} plan`}
      accessibilityState={{ selected: isSelected }}
    >
      {isPopular && !isSelected && (
        <View style={styles.popularPill}>
          <Text style={styles.popularPillText}>Most Popular</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={[styles.planName, isSelected && styles.planNameSelected]}>{plan.name}</Text>
        <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{priceDisplay}</Text>
      </View>

      {plan.features.map((f) => (
        <View key={f} style={styles.featureRow}>
          <Text style={[styles.featureTick, isSelected && styles.featureTickSelected]}>✓</Text>
          <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>{f}</Text>
        </View>
      ))}

      {isFree && (
        <Text style={[styles.noCard, isSelected && styles.noCardSelected]}>
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
        body: { userId, priceId: plan.stripePriceId },
      });

      if (error || !(data as { url?: string })?.url) {
        Alert.alert('Error', 'Could not start checkout. Please try again.');
        return;
      }
      await Linking.openURL((data as { url: string }).url);
      setTimeout(() => router.replace('/(auth)/schedule-wizard'), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.progressDot, i === 2 && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.subtitle}>Start free, upgrade anytime. Cancel whenever you like.</Text>
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
          style={styles.continueBtn}
          accessibilityLabel="Continue with selected plan"
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueBtnText}>
              {selectedPlan === 'FREE'
                ? 'Continue for free'
                : `Start ${STRIPE_PLANS[selectedPlan].name}`}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Paid plans billed monthly. Cancel anytime from the billing portal. Prices in GBP.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  progressDot: { width: 12, height: 6, borderRadius: 4, backgroundColor: 'rgba(124,58,237,0.25)' },
  progressDotActive: { width: 26, backgroundColor: '#7C3AED' },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    color: '#5B21B6',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },

  planCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  planCardSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#5B21B6',
    shadowOpacity: 0.3,
  },
  planCardPopular: { borderColor: '#7C3AED', borderWidth: 2 },

  popularPill: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  popularPillText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 11 },

  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  planName: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#111827' },
  planNameSelected: { color: '#FFFFFF' },
  planPrice: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: '#111827' },
  planPriceSelected: { color: '#FFFFFF' },

  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  featureTick: { color: '#10B981', marginRight: 8, fontSize: 14, fontWeight: '700' },
  featureTickSelected: { color: '#FFFFFF' },
  featureText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#374151', flex: 1 },
  featureTextSelected: { color: 'rgba(255,255,255,0.92)' },

  noCard: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 8 },
  noCardSelected: { color: 'rgba(255,255,255,0.75)' },

  continueBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 16,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  continueBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },

  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
});

/**
 * Deep-link landing page for routinestars://subscription/success.
 * After Stripe Checkout success, the subscription-redirect Edge Function
 * 302s to routinestars://subscription/success. This file accepts that and
 * routes the user back into the parent app's subscription screen, where
 * the just-fired webhook will have already updated the plan.
 */
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const fetchSubscription = useSubscriptionStore((s) => s.fetch);

  useEffect(() => {
    // Refresh subscription state, then bounce to the plan screen.
    void (async () => {
      if (userId) {
        await fetchSubscription(userId);
        void queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      }
      // Give Stripe's webhook a beat to land
      setTimeout(() => router.replace('/(parent)/subscription'), 600);
    })();
  }, [userId, fetchSubscription, queryClient, router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F5F0FF',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
      <Text
        style={{
          fontFamily: 'Nunito_700Bold',
          fontSize: 22,
          color: '#111827',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Subscription activated!
      </Text>
      <Text
        style={{
          fontFamily: 'Nunito_400Regular',
          fontSize: 16,
          color: '#6B7280',
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        Updating your account…
      </Text>
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );
}

/**
 * Deep-link landing page for routinestars://subscription/cancel.
 * Just bounces back to the parent subscription screen.
 */
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function SubscriptionCancelScreen() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => router.replace('/(parent)/subscription'), 400);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 18, color: '#6B7280' }}>
        Returning…
      </Text>
      <ActivityIndicator color="#7C3AED" style={{ marginTop: 12 }} />
    </View>
  );
}

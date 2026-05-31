/**
 * Email Verification Screen — Sprint 1.4
 * Shown after signup. User must verify before proceeding.
 */
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailScreen() {
  const router = useRouter();

  async function handleResend() {
    // Re-send is handled by Supabase; email is stored in current session metadata
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
    }
  }

  return (
    <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
      <Text className="text-[52px] mb-4">📬</Text>
      <Text className="text-heading font-nunito-bold text-neutral-900 text-center mb-2">
        Check your email
      </Text>
      <Text className="text-body font-nunito text-neutral-500 text-center mb-8">
        We've sent a verification link to your email address. Tap the link to confirm your account,
        then come back here to continue.
      </Text>

      <TouchableOpacity
        className="bg-brand-primary rounded-2xl py-4 px-8 min-h-[60px] justify-center items-center w-full mb-4"
        onPress={() => router.replace('/(auth)/login')}
        accessibilityLabel="I've verified my email"
        accessibilityRole="button"
      >
        <Text className="text-subhead font-nunito-bold text-white">I've verified — Sign in</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="py-3 min-h-[44px] justify-center"
        onPress={handleResend}
        accessibilityLabel="Resend verification email"
      >
        <Text className="text-parent-body font-inter text-brand-primary">
          Resend verification email
        </Text>
      </TouchableOpacity>
    </View>
  );
}

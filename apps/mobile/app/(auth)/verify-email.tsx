/**
 * Email Verification Screen — Sprint 1.4
 * Shown after signup. User must verify before proceeding.
 */
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AuthLayout, PrimaryButton, TextLink } from '@/components/ui/AuthLayout';

export default function VerifyEmailScreen() {
  const router = useRouter();

  async function handleResend() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
    }
  }

  return (
    <AuthLayout
      centered
      emoji="📬"
      title="Check your email"
      subtitle="We've sent a verification link to your inbox. Tap the link to confirm your account, then come back here to sign in."
    >
      <PrimaryButton
        label="I've verified — Sign in"
        onPress={() => router.replace('/(auth)/login')}
      />
      <TextLink label="Resend verification email" onPress={handleResend} />
    </AuthLayout>
  );
}

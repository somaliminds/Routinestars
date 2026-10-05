/**
 * Email Verification Screen — Sprint 1.4
 * Shown after signup. User must verify before proceeding.
 */
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { authCallbackUrl } from '@/lib/oauth';
import { notify } from '@/lib/ui-dialogs';
import { AuthLayout, PrimaryButton, TextLink } from '@/components/ui/AuthLayout';

export default function VerifyEmailScreen() {
  const router = useRouter();
  // Passed from signup: an unconfirmed account has no session yet, so
  // getUser() alone can't supply the address (resend used to do nothing).
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [sending, setSending] = useState(false);

  async function handleResend() {
    let email = typeof emailParam === 'string' && emailParam ? emailParam : undefined;
    if (!email) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      email = user?.email ?? undefined;
    }
    if (!email) {
      notify('Can’t resend', 'Go back and sign up again, or sign in if you’ve already verified.');
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    });
    setSending(false);
    if (error) notify('Couldn’t resend', error.message);
    else notify('Email sent', `We’ve sent a new verification link to ${email}.`);
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
      <TextLink
        label={sending ? 'Sending…' : 'Resend verification email'}
        onPress={() => void handleResend()}
      />
    </AuthLayout>
  );
}

/**
 * Forgot PIN Screen
 *
 * Sends a PIN reset email with a deep-link token via the request-pin-reset
 * edge function. Used from the child→parent PIN gate ("Forgot PIN?") and
 * the login screen ("Forgot password?").
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AuthLayout, AuthInput, PrimaryButton, TextLink } from '@/components/ui/AuthLayout';

export default function ForgotPinScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('request-pin-reset', {
        body: { email: trimmed },
      });
      if (error) {
        Alert.alert('Error', 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        centered
        emoji="📧"
        title="Check your email"
        subtitle={`If an account exists for ${email}, we've sent a PIN reset link. The link expires in 1 hour — tap it on your phone to reset.`}
      >
        <PrimaryButton
          label="Done"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      emoji="🔐"
      title="Forgot your PIN?"
      subtitle="Enter your email address and we'll send you a link to reset your 4-digit parent PIN."
    >
      <AuthInput
        label="Email address"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />

      <PrimaryButton label="Send Reset Link" onPress={handleSend} isLoading={isLoading} />
      <TextLink label="Cancel" onPress={() => router.back()} />
    </AuthLayout>
  );
}

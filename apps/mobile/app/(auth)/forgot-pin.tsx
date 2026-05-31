/**
 * Forgot PIN Screen
 *
 * Sends a PIN reset email with a deep-link token via the request-pin-reset
 * edge function. Used from the child->parent PIN gate ("Forgot PIN?") and
 * the login screen ("Forgot password?").
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

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
      <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
        <Text className="text-[52px] mb-4">📧</Text>
        <Text className="text-heading font-nunito-bold text-neutral-900 text-center mb-2">
          Check your email
        </Text>
        <Text className="text-body font-nunito text-neutral-500 text-center mb-2">
          If an account exists for {email}, we've sent a PIN reset link.
        </Text>
        <Text className="text-caption font-nunito text-neutral-400 text-center mb-8">
          The link expires in 1 hour. Tap it on your device to open the app.
        </Text>
        <TouchableOpacity
          className="bg-brand-primary rounded-2xl py-4 px-8 min-h-[60px] justify-center"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
          accessibilityRole="button"
        >
          <Text className="text-subhead font-nunito-bold text-white">Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 justify-center px-6">
      <Text className="text-[48px] mb-2 text-center">🔐</Text>
      <Text className="text-heading font-nunito-bold text-neutral-900 mb-2">Forgot your PIN?</Text>
      <Text className="text-body font-nunito text-neutral-500 mb-8">
        Enter your email address and we'll send you a link to reset your 4-digit parent PIN.
      </Text>

      <View className="mb-6">
        <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">
          Email address
        </Text>
        <TextInput
          className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email address"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
      </View>

      <TouchableOpacity
        className="bg-brand-primary rounded-2xl py-4 items-center min-h-[60px] justify-center mb-4"
        onPress={handleSend}
        disabled={isLoading}
        accessibilityLabel="Send PIN reset link"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-subhead font-nunito-bold text-white">Send Reset Link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="items-center py-3 min-h-[44px] justify-center"
        onPress={() => router.back()}
        accessibilityLabel="Cancel"
        accessibilityRole="button"
      >
        <Text className="text-parent-body font-inter text-brand-primary">Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

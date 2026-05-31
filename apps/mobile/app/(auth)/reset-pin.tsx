/**
 * Reset PIN Screen
 *
 * Opened via deep link: routinestars://reset-pin?token=<token>
 * Lets the parent set a new 4-digit PIN after requesting a reset by email.
 * Calls the reset-pin edge function which validates the token and stores the
 * new bcrypt hash. Token is single-use and expires after 1 hour.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const PIN_LENGTH = 4;

export default function ResetPinScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [isLoading, setIsLoading] = useState(false);

  const currentPin = step === 'create' ? pin : confirmPin;
  const setCurrentPin = step === 'create' ? setPin : setConfirmPin;

  // No token in URL — link is broken
  if (!token) {
    return (
      <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
        <Text className="text-[52px] mb-4">⚠️</Text>
        <Text className="text-heading font-nunito-bold text-neutral-900 text-center mb-2">
          Invalid link
        </Text>
        <Text className="text-body font-nunito text-neutral-500 text-center mb-8">
          This reset link is invalid or has already been used.
        </Text>
        <TouchableOpacity
          className="bg-brand-primary rounded-2xl py-4 px-8 min-h-[60px] justify-center"
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text className="text-subhead font-nunito-bold text-white">Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleDigit = (digit: string) => {
    if (digit === '⌫') {
      setCurrentPin((p) => p.slice(0, -1));
      return;
    }
    if (currentPin.length >= PIN_LENGTH) return;
    const next = currentPin + digit;
    setCurrentPin(next);

    if (next.length === PIN_LENGTH) {
      if (step === 'create') {
        setTimeout(() => setStep('confirm'), 300);
      } else {
        if (pin !== next) {
          Alert.alert('PINs do not match', 'Please try again.');
          setPin('');
          setConfirmPin('');
          setStep('create');
        } else {
          void handleSavePin(next);
        }
      }
    }
  };

  const handleSavePin = async (confirmedPin: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-pin', {
        body: { token, newPin: confirmedPin },
      });

      if (error || !(data as { success?: boolean } | null)?.success) {
        const msg = (data as { error?: string } | null)?.error
          ?? 'Could not reset your PIN. The link may have expired.';
        Alert.alert('Error', msg, [
          {
            text: 'Request new link',
            onPress: () => router.replace('/(auth)/forgot-pin'),
          },
          { text: 'Cancel', style: 'cancel' },
        ]);
        setPin('');
        setConfirmPin('');
        setStep('create');
        return;
      }

      // Success — navigate to login so session is fresh before entering the app
      Alert.alert('PIN updated!', 'Your new PIN has been saved. Please sign in.', [
        {
          text: 'Sign In',
          onPress: () => router.replace('/(auth)/login'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
      <Text className="text-[48px] mb-2">🔐</Text>
      <Text className="text-heading font-nunito-bold text-neutral-900 mb-2 text-center">
        {step === 'create' ? 'New PIN' : 'Confirm PIN'}
      </Text>
      <Text className="text-body font-nunito text-neutral-500 mb-10 text-center">
        {step === 'create'
          ? 'Choose a new 4-digit PIN'
          : 'Enter your new PIN again to confirm'}
      </Text>

      {/* PIN dots */}
      <View className="flex-row gap-3 mb-12">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            className={`w-5 h-5 rounded-full ${
              i < currentPin.length
                ? 'bg-brand-primary'
                : 'bg-neutral-200 border-2 border-neutral-400'
            }`}
          />
        ))}
      </View>

      {/* Numpad */}
      <View className="w-full max-w-xs">
        {[0, 1, 2, 3].map((row) => (
          <View key={row} className="flex-row justify-between mb-3">
            {digits.slice(row * 3, row * 3 + 3).map((digit, i) => (
              <TouchableOpacity
                key={i}
                className={`w-[80px] h-[80px] rounded-2xl items-center justify-center ${
                  digit === '' ? 'opacity-0' : 'bg-white shadow-sm'
                }`}
                onPress={() => handleDigit(digit)}
                disabled={digit === '' || isLoading}
                accessibilityLabel={digit === '⌫' ? 'Delete' : `Digit ${digit}`}
                accessibilityRole="button"
              >
                {isLoading && digit === '0' ? (
                  <ActivityIndicator color="#7C3AED" />
                ) : (
                  <Text className="text-heading font-nunito-bold text-neutral-900">{digit}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

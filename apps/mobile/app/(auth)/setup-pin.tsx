import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const PIN_LENGTH = 4;

/**
 * PIN Setup Screen — Sprint 1.4
 * Parent sets a 4-digit PIN stored as bcrypt hash (cost 12).
 * PIN is hashed server-side via the hash-pin Edge Function — never sent in plaintext.
 * Quality Rule 7: PIN never appears in logs.
 */
export default function SetupPinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [isLoading, setIsLoading] = useState(false);

  const currentPin = step === 'create' ? pin : confirmPin;
  const setCurrentPin = step === 'create' ? setPin : setConfirmPin;

  const handleDigit = (digit: string) => {
    if (currentPin.length >= PIN_LENGTH) return;
    const next = currentPin + digit;
    setCurrentPin(next);

    if (next.length === PIN_LENGTH) {
      if (step === 'create') {
        // Move to confirm step
        setTimeout(() => setStep('confirm'), 300);
      } else {
        // Confirm step — verify match
        if (pin !== next) {
          Alert.alert('PINs do not match', 'Please try again.');
          setPin('');
          setConfirmPin('');
          setStep('create');
        } else {
          handleSavePin(next);
        }
      }
    }
  };

  const handleDelete = () => {
    if (currentPin.length === 0) return;
    setCurrentPin(currentPin.slice(0, -1));
  };

  const handleSavePin = async (confirmedPin: string) => {
    setIsLoading(true);
    try {
      // Refresh session before calling edge function — prevents 401 on first-time setup
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        Alert.alert('Session expired', 'Please sign in again.');
        router.replace('/(auth)/login');
        return;
      }

      // Hash PIN via Supabase Edge Function (bcrypt cost 12)
      const { data, error } = await supabase.functions.invoke('hash-pin', {
        body: { pin: confirmedPin },
      });

      if (error) {
        const is401 = (error as { status?: number }).status === 401
          || String(error).includes('401');
        const msg = is401
          ? 'Your session has expired. Please sign in again.'
          : 'Could not save your PIN. Please try again.';
        Alert.alert('Error', msg);
        if (is401) {
          router.replace('/(auth)/login');
          return;
        }
        setPin('');
        setConfirmPin('');
        setStep('create');
        return;
      }

      if (!(data as { success?: boolean } | null)?.success) {
        Alert.alert('Error', 'Could not save your PIN. Please try again.');
        setPin('');
        setConfirmPin('');
        setStep('create');
        return;
      }

      router.replace('/(auth)/create-child-profile');
    } finally {
      setIsLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
      <Text className="text-heading font-nunito-bold text-neutral-900 mb-2 text-center">
        {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
      </Text>
      <Text className="text-body font-nunito text-neutral-500 mb-10 text-center">
        {step === 'create'
          ? 'Choose a 4-digit PIN to protect your parent settings'
          : 'Enter your PIN again to confirm'}
      </Text>

      {/* PIN dots */}
      <View className="flex-row gap-3 mb-12">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            className={`w-5 h-5 rounded-full ${
              i < currentPin.length
                ? 'bg-brand-primary'
                : 'bg-neutral-100 border-2 border-neutral-500'
            }`}
          />
        ))}
      </View>

      {/* Numpad — min 80x80px touch targets */}
      <View className="w-full max-w-xs">
        {[0, 1, 2, 3].map((row) => (
          <View key={row} className="flex-row justify-between mb-3">
            {digits.slice(row * 3, row * 3 + 3).map((digit, i) => (
              <TouchableOpacity
                key={i}
                className={`w-[80px] h-[80px] rounded-2xl items-center justify-center ${
                  digit === '' ? 'opacity-0' : 'bg-white'
                }`}
                onPress={() => {
                  if (digit === '⌫') handleDelete();
                  else if (digit !== '') handleDigit(digit);
                }}
                disabled={digit === '' || isLoading}
                accessibilityLabel={digit === '⌫' ? 'Delete' : `Digit ${digit}`}
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

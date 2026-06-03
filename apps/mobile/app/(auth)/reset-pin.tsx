/**
 * Reset PIN Screen
 *
 * Opened via deep link: routinestars://reset-pin?token=<token>
 * Lets the parent set a new 4-digit PIN after requesting a reset by email.
 * Calls the reset-pin edge function which validates the token and stores the
 * new bcrypt hash. Token is single-use and expires after 1 hour.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  if (!token) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.invalid}>
          <Text style={styles.invalidEmoji}>⚠️</Text>
          <Text style={styles.title}>Invalid link</Text>
          <Text style={styles.subtitle}>This reset link is invalid or has already been used.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.primaryBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
        const msg =
          (data as { error?: string } | null)?.error ??
          'Could not reset your PIN. The link may have expired.';
        Alert.alert('Error', msg, [
          { text: 'Request new link', onPress: () => router.replace('/(auth)/forgot-pin') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        setPin('');
        setConfirmPin('');
        setStep('create');
        return;
      }

      Alert.alert('PIN updated!', 'Your new PIN has been saved. Please sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>{step === 'create' ? 'New PIN' : 'Confirm PIN'}</Text>
        <Text style={styles.subtitle}>
          {step === 'create' ? 'Choose a new 4-digit PIN' : 'Enter your new PIN again to confirm'}
        </Text>

        <View style={styles.dots}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < currentPin.length ? styles.dotFilled : styles.dotEmpty]}
            />
          ))}
        </View>

        <View style={styles.pad}>
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.padRow}>
              {digits.slice(row * 3, row * 3 + 3).map((digit, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.key, digit === '' && { opacity: 0 }]}
                  onPress={() => digit !== '' && handleDigit(digit)}
                  disabled={digit === '' || isLoading}
                  accessibilityLabel={digit === '⌫' ? 'Delete' : `Digit ${digit}`}
                  activeOpacity={0.7}
                >
                  {isLoading && digit === '0' ? (
                    <ActivityIndicator color="#7C3AED" />
                  ) : (
                    <Text style={styles.keyText}>{digit}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    color: '#5B21B6',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 36,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  dots: { flexDirection: 'row', gap: 14, marginBottom: 40 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  dotFilled: { backgroundColor: '#7C3AED' },
  dotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  pad: { width: '100%', maxWidth: 300 },
  padRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  key: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  keyText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 28, color: '#111827' },
  invalid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  invalidEmoji: { fontSize: 52, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  primaryBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 17, color: '#FFFFFF' },
});

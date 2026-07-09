import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        setTimeout(() => setStep('confirm'), 300);
      } else {
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        Alert.alert('Session expired', 'Please sign in again.');
        router.replace('/(auth)/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('hash-pin', {
        body: { pin: confirmedPin },
      });

      if (error) {
        const is401 =
          (error as { status?: number }).status === 401 || String(error).includes('401');
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
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔒</Text>
        <Text style={styles.title}>
          {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'create'
            ? 'Choose a 4-digit PIN to protect your parent settings'
            : 'Enter your PIN again to confirm'}
        </Text>

        {/* PIN dots */}
        <View style={styles.dots}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < currentPin.length ? styles.dotFilled : styles.dotEmpty]}
            />
          ))}
        </View>

        {/* Numpad */}
        <View style={styles.pad}>
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.padRow}>
              {digits.slice(row * 3, row * 3 + 3).map((digit, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.key, digit === '' && { opacity: 0 }]}
                  onPress={() => {
                    if (digit === '⌫') handleDelete();
                    else if (digit !== '') handleDigit(digit);
                  }}
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
});

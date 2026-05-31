import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

const PIN_LENGTH = 6;

interface PINPadProps {
  title?: string;
  subtitle?: string;
  onComplete: (pin: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * PINPad — 6-digit PIN entry for parent authentication.
 * Min touch target: 80x80px per digit button (Child UI Rules apply).
 * PIN is passed to onComplete; bcrypt comparison happens server-side.
 * Quality Rule 7: PIN never logged or stored in state after submission.
 */
export function PINPad({
  title = 'Enter your PIN',
  subtitle = 'Enter your 6-digit parent PIN',
  onComplete,
  isLoading = false,
  error,
}: PINPadProps) {
  const [pin, setPin] = useState('');

  const handleDigit = async (digit: string) => {
    if (pin.length >= PIN_LENGTH || isLoading) return;

    const next = pin + digit;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      await onComplete(next);
      // Clear PIN from state after submission
      setPin('');
    }
  };

  const handleDelete = () => {
    if (pin.length === 0 || isLoading) return;
    setPin(pin.slice(0, -1));
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View className="items-center px-6">
      <Text className="text-heading font-nunito-bold text-neutral-900 mb-2 text-center">
        {title}
      </Text>
      <Text className="text-body font-nunito text-neutral-500 mb-8 text-center">{subtitle}</Text>

      {/* PIN dots */}
      <View className="flex-row gap-4 mb-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            className={`w-5 h-5 rounded-full ${
              i < pin.length ? 'bg-brand-primary' : 'bg-neutral-100 border-2 border-neutral-500'
            }`}
          />
        ))}
      </View>

      {/* Error message */}
      {error && (
        <Text className="text-caption font-inter text-accent-danger mb-4 text-center">{error}</Text>
      )}

      {/* Numpad */}
      <View className="w-full max-w-xs">
        {[0, 1, 2, 3].map((row) => (
          <View key={row} className="flex-row justify-between mb-3">
            {digits.slice(row * 3, row * 3 + 3).map((digit, i) => (
              <TouchableOpacity
                key={i}
                className={`w-[80px] h-[80px] rounded-2xl items-center justify-center ${
                  digit === '' ? 'opacity-0 pointer-events-none' : 'bg-white'
                }`}
                onPress={() => {
                  if (digit === '⌫') handleDelete();
                  else if (digit !== '') handleDigit(digit);
                }}
                disabled={digit === '' || isLoading}
                accessibilityLabel={digit === '⌫' ? 'Delete last digit' : `Digit ${digit}`}
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

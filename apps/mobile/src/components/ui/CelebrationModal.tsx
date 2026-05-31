import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

interface CelebrationModalProps {
  visible: boolean;
  childName: string;
  setName: string;
  starsEarned: number;
  badgesEarned?: string[];
  onDismiss: () => void;
}

/**
 * CelebrationModal — confetti + stars + trophy animation on set completion.
 * Shown after parent approves OR when set doesn't require approval.
 * TODO Sprint 2.3: Wire up Lottie animation for confetti.
 * Spec: Section 5 (State Machine APPROVED → LOCKED).
 */
const AUTO_DISMISS_SECONDS = 8;

export function CelebrationModal({
  visible,
  childName,
  setName,
  starsEarned,
  badgesEarned = [],
  onDismiss,
}: CelebrationModalProps) {
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SECONDS);
  // Ref so the interval callback always calls the latest onDismiss without re-creating the interval
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Reset and start countdown whenever modal becomes visible
  useEffect(() => {
    if (!visible) {
      setCountdown(AUTO_DISMISS_SECONDS);
      return;
    }
    setCountdown(AUTO_DISMISS_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // Trigger dismiss separately — never call onDismiss inside a setState updater
  useEffect(() => {
    if (visible && countdown === 0) {
      onDismissRef.current();
    }
  }, [visible, countdown]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white rounded-3xl p-8 w-full max-w-sm items-center">
          {/* TODO: Replace with Lottie animation in Sprint 2.3 */}
          <Text className="text-[80px] mb-2">🏆</Text>
          <Text className="text-[48px]">🎉✨⭐</Text>

          <Text
            className="font-nunito-extrabold text-neutral-900 text-center mt-4 mb-2"
            style={{ fontSize: 28, lineHeight: 36 }}
          >
            Well done, {childName}!
          </Text>

          <Text
            className="font-nunito text-neutral-500 text-center mb-6"
            style={{ fontSize: 18, lineHeight: 26 }}
          >
            You completed {setName}!
          </Text>

          {/* Stars earned */}
          <View className="bg-accent-star/10 rounded-2xl px-6 py-3 mb-4 flex-row items-center gap-2">
            <Text className="text-[28px]">⭐</Text>
            <Text className="font-nunito-extrabold text-accent-star" style={{ fontSize: 24 }}>
              +{starsEarned} stars!
            </Text>
          </View>

          {/* New badges */}
          {badgesEarned.length > 0 && (
            <View className="mb-4">
              <Text className="text-body font-nunito-bold text-neutral-900 text-center mb-2">
                New badge{badgesEarned.length > 1 ? 's' : ''} earned!
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {badgesEarned.map((badge, i) => (
                  <View key={i} className="bg-accent-star/10 rounded-xl px-3 py-1">
                    <Text className="text-caption font-nunito-bold text-accent-star">{badge}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Dismiss button — min 80px, auto-dismisses after countdown */}
          <TouchableOpacity
            className="bg-brand-primary rounded-2xl py-4 px-8 items-center justify-center mt-2"
            style={{ minHeight: 80, width: '100%' }}
            onPress={onDismiss}
            accessibilityLabel={`Continue, going home in ${countdown} seconds`}
            accessibilityRole="button"
          >
            <Text className="text-subhead font-nunito-bold text-white">🏠 Go Home!</Text>
            <Text className="font-nunito text-white/80 mt-1" style={{ fontSize: 14 }}>
              Going home in {countdown}s…
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

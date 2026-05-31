import { Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface StarCounterProps {
  count: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * StarCounter — displays a star count with pop animation on increment.
 * Sizes: sm (compact badge), md (step reward), lg (day total).
 */
export function StarCounter({ count, label, size = 'md' }: StarCounterProps) {
  const scale = useSharedValue(1);
  const prevCount = useSharedValue(count);

  useEffect(() => {
    if (count > prevCount.value) {
      scale.value = withSequence(
        withSpring(1.4, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
    }
    prevCount.value = count;
  }, [count, scale, prevCount]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const textSizes = {
    sm: { star: 16, count: 14, label: 12 },
    md: { star: 24, count: 20, label: 14 },
    lg: { star: 36, count: 32, label: 16 },
  };

  const sizes = textSizes[size];

  return (
    <Animated.View
      style={animatedStyle}
      className="flex-row items-center gap-1"
      accessibilityLabel={`${count} stars${label ? `, ${label}` : ''}`}
    >
      <Text style={{ fontSize: sizes.star }}>⭐</Text>
      <Text className="font-nunito-extrabold text-accent-star" style={{ fontSize: sizes.count }}>
        {count.toLocaleString()}
      </Text>
      {label && (
        <Text className="font-nunito text-neutral-500" style={{ fontSize: sizes.label }}>
          {label}
        </Text>
      )}
    </Animated.View>
  );
}

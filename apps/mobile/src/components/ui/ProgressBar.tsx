import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';

type ProgressVariant = 'step' | 'set' | 'day' | 'week' | 'timer';

interface ProgressBarProps {
  /** 0 to 1 */
  progress: number;
  variant: ProgressVariant;
  label?: string;
  showLabel?: boolean;
}

/** Returns colour class based on progress — green → amber → red */
function getColour(progress: number, variant: ProgressVariant): string {
  if (variant === 'timer') {
    if (progress >= 1) return 'bg-accent-danger';
    if (progress >= 0.75) return 'bg-accent-warning';
    return 'bg-accent-success';
  }
  if (progress >= 1) return 'bg-accent-success';
  if (progress >= 0.5) return 'bg-brand-primary';
  return 'bg-child-sky';
}

const HEIGHT_BY_VARIANT: Record<ProgressVariant, number> = {
  timer: 8,
  step: 6,
  set: 10,
  day: 12,
  week: 10,
};

/**
 * ProgressBar — animated progress bar.
 * Supports: step/set/day/week/timer variants.
 * Colour changes based on progress percentage.
 * Respects reduced-motion: animation can be disabled via props in future.
 */
export function ProgressBar({ progress, variant, label, showLabel = true }: ProgressBarProps) {
  const animatedWidth = useSharedValue(0);
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const height = HEIGHT_BY_VARIANT[variant];
  const colour = getColour(clampedProgress, variant);

  useEffect(() => {
    animatedWidth.value = withSpring(clampedProgress, { damping: 20, stiffness: 90 });
  }, [clampedProgress, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  return (
    <View>
      {showLabel && label && (
        <View className="flex-row justify-between mb-1">
          <Text className="text-caption font-nunito text-neutral-500">{label}</Text>
          <Text className="text-caption font-nunito-bold text-neutral-900">
            {Math.round(clampedProgress * 100)}%
          </Text>
        </View>
      )}
      <View
        className="w-full bg-neutral-100 rounded-full overflow-hidden"
        style={{ height }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress * 100) }}
      >
        <Animated.View className={`${colour} rounded-full h-full`} style={animatedStyle} />
      </View>
    </View>
  );
}

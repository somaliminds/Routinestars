/**
 * GlassCard — the foundational MY24 surface.
 *
 * Renders a frosted-glass panel using expo-blur when the native module
 * is available, otherwise falls back to a translucent white View (still
 * looks acceptable, just without backdrop blur). This means the component
 * is safe to use right now and automatically upgrades to true glass once
 * the next EAS build ships with expo-blur compiled in.
 *
 * Variants:
 *   - "light"  (default): white frosted glass on lavender bg
 *   - "soft":   lower opacity, for layered cards-within-cards
 *   - "dark":   smoky glass for use over dark backgrounds (modals / rewards)
 */
import type { ReactNode } from 'react';
import { View, NativeModules, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

// Dynamic require so missing native module doesn't crash JS bundling.
type BlurViewType = typeof import('expo-blur').BlurView;
let BlurView: BlurViewType | null = null;
const blurAvailable = !!NativeModules.ExpoBlurView || !!(NativeModules as Record<string, unknown>).ExpoBlur;
if (blurAvailable) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BlurView = require('expo-blur').BlurView as BlurViewType;
  } catch {
    BlurView = null;
  }
}

export type GlassVariant = 'light' | 'soft' | 'dark';

interface GlassCardProps {
  children: ReactNode;
  variant?: GlassVariant;
  style?: StyleProp<ViewStyle>;
  /** Border radius — default 24 (MY24 standard) */
  radius?: number;
  /** Padding inside the card — default 20 */
  padding?: number;
}

export function GlassCard({
  children,
  variant = 'light',
  style,
  radius = 24,
  padding = 20,
}: GlassCardProps) {
  const tint = variant === 'dark' ? 'dark' : 'light';
  const intensity = variant === 'soft' ? 50 : variant === 'dark' ? 60 : 75;

  const fallbackBg =
    variant === 'dark'
      ? 'rgba(26,26,46,0.85)'
      : variant === 'soft'
        ? 'rgba(255,255,255,0.70)'
        : 'rgba(255,255,255,0.85)';

  const borderColor =
    variant === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)';

  const containerStyle: StyleProp<ViewStyle> = [
    {
      borderRadius: radius,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor,
      shadowColor: variant === 'dark' ? '#000000' : '#7C3AED',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: variant === 'dark' ? 0.35 : 0.15,
      shadowRadius: 18,
      elevation: 6,
    },
    style,
  ];

  if (BlurView) {
    return (
      <View style={containerStyle}>
        <BlurView intensity={intensity} tint={tint} style={[StyleSheet.absoluteFill]} />
        <View style={{ padding }}>{children}</View>
      </View>
    );
  }

  // Fallback — translucent white View
  return (
    <View style={[containerStyle, { backgroundColor: fallbackBg, padding }]}>
      {children}
    </View>
  );
}

/**
 * Design tokens — single source of truth for the MY24 visual system.
 *
 * Use these everywhere instead of magic numbers. Drift between screens
 * (one card using paddingHorizontal:16, another using 20, a third using 22)
 * is the #1 cause of "looks unpolished" in mobile UI.
 *
 * The 4dp grid is non-negotiable. Apple HIG, Material 3, and Tailwind all
 * align to multiples of 4 — picking values outside this scale creates
 * sub-pixel rendering artefacts on low-DPI Android devices.
 *
 * Usage:
 *   import { T } from '@/lib/tokens';
 *   const styles = StyleSheet.create({
 *     card: { ...T.card, padding: T.s4 },
 *     title: T.h1,
 *   });
 */
import type { TextStyle, ViewStyle } from 'react-native';

// ── Colour palette ────────────────────────────────────────────────────────────
const COLOR = {
  // Surface
  bg:        '#F5F0FF',
  bgSoft:    '#FAF7FF',
  card:      'rgba(255,255,255,0.85)',
  cardSoft:  'rgba(255,255,255,0.70)',
  cardBorder:'rgba(255,255,255,0.55)',

  // Brand
  brand:     '#7C3AED',
  brandDark: '#5B21B6',
  brandSoft: 'rgba(124,58,237,0.10)',
  brandRing: 'rgba(124,58,237,0.30)',

  // Ink (text)
  ink:       '#111827',
  inkSoft:   '#374151',
  inkMute:   '#6B7280',
  inkFaint:  '#9CA3AF',

  // Status
  success:   '#10B981',
  warning:   '#D97706', // amber, NOT red — autism-friendly
  danger:    '#EF4444',
  star:      '#F59E0B',
} as const;

// ── 4dp spacing scale ─────────────────────────────────────────────────────────
// s1=4  s2=8  s3=12  s4=16  s5=20  s6=24  s7=32  s8=40  s9=48
const SPACE = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s7: 32,
  s8: 40,
  s9: 48,
} as const;

// ── Border radii ──────────────────────────────────────────────────────────────
const RADIUS = {
  rSm:  12,
  rMd:  18,
  rLg:  24,
  rXl:  28,
  pill: 999,
} as const;

// ── Touch target minimums (Apple HIG 44pt, Material 48dp, WCAG 2.5.5) ─────────
const TAP = {
  min: 44,     // hard floor on iOS
  comfy: 48,   // Material recommendation
  big: 60,     // primary buttons
} as const;

// ── Typography presets (only use these — never invent inline sizes) ───────────
const TYPE = {
  display: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.4,
  } as TextStyle,
  h1: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
  } as TextStyle,
  h2: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    lineHeight: 26,
  } as TextStyle,
  h3: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    lineHeight: 22,
  } as TextStyle,
  bodyLg: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 17,
    lineHeight: 26,
  } as TextStyle,
  bodyMd: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,
  bodySm: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  caption: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  } as TextStyle,
  capUpper: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;

// ── Card presets ──────────────────────────────────────────────────────────────
const CARD: ViewStyle = {
  backgroundColor: COLOR.card,
  borderRadius: RADIUS.rLg,
  borderWidth: 1,
  borderColor: COLOR.cardBorder,
  shadowColor: COLOR.brandDark,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.15,
  shadowRadius: 18,
  elevation: 6,
};

const CARD_SOFT: ViewStyle = {
  ...CARD,
  backgroundColor: COLOR.cardSoft,
  shadowOpacity: 0.10,
};

// ── Primary CTA preset ────────────────────────────────────────────────────────
const BTN_PRIMARY: ViewStyle = {
  backgroundColor: COLOR.brand,
  borderRadius: RADIUS.rMd,
  paddingVertical: SPACE.s4,
  minHeight: TAP.big,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: COLOR.brandDark,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.22,
  shadowRadius: 12,
  elevation: 4,
};

// ── Flat export — short, ergonomic ────────────────────────────────────────────
export const T = {
  ...COLOR,
  ...SPACE,
  ...RADIUS,
  ...TYPE,
  tap: TAP,
  card: CARD,
  cardSoft: CARD_SOFT,
  btnPrimary: BTN_PRIMARY,
} as const;

export type Tokens = typeof T;

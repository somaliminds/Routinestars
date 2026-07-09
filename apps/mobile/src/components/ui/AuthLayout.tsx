/**
 * AuthLayout — shared MY24 wrapper for every auth/onboarding screen.
 * Provides:
 *   - Soft lavender background (#F5F0FF)
 *   - SafeArea + keyboard avoidance
 *   - Optional brand mark at top (🌟 RoutineStars)
 *   - Glass card containing the form/content
 *   - Footer slot for tertiary links
 *
 * All form fields, buttons, and headings use the same tokens, so the
 * entire onboarding flow feels like one design.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  /** Optional emoji shown above the title (e.g. 📬, 🔐) */
  emoji?: string;
  /** Show the small "RoutineStars" brand mark above the card */
  brand?: boolean;
  /** Form content placed inside the glass card */
  children: ReactNode;
  /** Optional fixed footer below the card (e.g. "Already have an account?" link) */
  footer?: ReactNode;
  /** When true, content centred vertically (for short screens like verify-email) */
  centered?: boolean;
}

export function AuthLayout({
  title,
  subtitle,
  emoji,
  brand = false,
  children,
  footer,
  centered = false,
}: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, centered && styles.scrollCentered]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {brand && (
            <View style={styles.brand}>
              <Image
                source={require('../../../assets/icon.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityLabel="RoutineStars logo"
              />
              <Text style={styles.brandName}>RoutineStars</Text>
            </View>
          )}

          <View style={styles.card}>
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

            <View style={styles.body}>{children}</View>
          </View>

          {footer && <View style={styles.footer}>{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared form atoms — keep all screens visually consistent ──────────────────

export function AuthInput({
  label,
  error,
  ...rest
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.field}
        placeholderTextColor="#9CA3AF"
        accessibilityLabel={label}
        {...rest}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, isLoading, disabled }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, (disabled || isLoading) && styles.primaryBtnDisabled]}
      onPress={onPress}
      disabled={disabled || isLoading}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.secondaryBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="link" style={styles.textLink}>
      <Text style={styles.textLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Brand-styled "Continue with Google" button + optional inline divider. */
export function GoogleButton({
  onPress,
  isLoading,
  label = 'Continue with Google',
}: {
  onPress: () => void;
  isLoading?: boolean;
  label?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      style={styles.googleBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isLoading ? (
        <ActivityIndicator color="#5B21B6" />
      ) : (
        <>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function OrDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingVertical: 24, flexGrow: 1 },
  scrollCentered: { justifyContent: 'center' },

  brand: { alignItems: 'center', marginBottom: 16 },
  brandLogo: { width: 80, height: 80 },
  brandName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#5B21B6',
    marginTop: 4,
    letterSpacing: -0.3,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: 4 },
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
    lineHeight: 22,
  },
  body: { marginTop: 22 },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#5B21B6',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  field: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    minHeight: 50,
  },
  fieldError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },

  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    marginTop: 6,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },

  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  secondaryBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#5B21B6',
  },

  textLink: { alignItems: 'center', paddingVertical: 10 },
  textLinkText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#7C3AED',
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    paddingVertical: 14,
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    gap: 10,
  },
  googleIcon: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: '#4285F4',
    lineHeight: 22,
  },
  googleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#1F2937',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(124,58,237,0.18)' },
  dividerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  footer: { marginTop: 18, alignItems: 'center' },
});

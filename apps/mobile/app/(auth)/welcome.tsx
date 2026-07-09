import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

/**
 * Welcome / splash screen — entry point for unauthenticated users.
 * MY24 aesthetic: soft lavender bg, glass card, brand-dark heading.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand mark — real logo, not the system emoji */}
        <View style={styles.brand}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoMark}
            resizeMode="contain"
            accessibilityLabel="RoutineStars logo"
          />
          <Text style={styles.brandName}>RoutineStars</Text>
          <Text style={styles.tagline}>Building independence, one star at a time</Text>
        </View>

        {/* Feature glass card */}
        <View style={styles.card}>
          {[
            { icon: '📅', text: 'Visual step-by-step routines' },
            { icon: '⭐', text: 'Stars, badges & streak rewards' },
            { icon: '✅', text: 'Gentle parent approvals' },
            { icon: '📊', text: 'Progress reports & insights' },
          ].map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA buttons — own SafeArea so bottom inset is respected after ScrollView */}
      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            style={styles.primaryBtn}
            accessibilityLabel="Get started — create a new account"
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Get Started — It's Free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            style={styles.secondaryBtn}
            accessibilityLabel="Sign in to your existing account"
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/privacy-policy')}
            accessibilityRole="link"
            accessibilityLabel="View Privacy Policy"
            style={styles.privacyLink}
          >
            <Text style={styles.privacyLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F0FF',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32, // guarantees space between feature card and CTA footer
  },
  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoMark: {
    width: 140,
    height: 140,
  },
  brandName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 36,
    color: '#5B21B6',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280, // optimal reading line length 45-75 chars
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 24,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  featureText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  footerSafe: {
    // Visual separator from scrollable content above so the CTA never feels
    // glued to the feature card on shorter devices.
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.08)',
    backgroundColor: '#F5F0FF',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  secondaryBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 17,
    color: '#5B21B6',
  },
  privacyLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 4,
  },
  privacyLinkText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
  },
});

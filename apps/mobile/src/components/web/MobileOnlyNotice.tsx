/**
 * MobileOnlyNotice — shown on the WEB build for the child/parent/TA apps.
 *
 * Only the professional portal is supported on web (Option A). The child,
 * parent and TA experiences rely on native features (camera, audio, offline,
 * push) and stay mobile-only, so on web those route groups render this notice
 * with a sign-out escape hatch instead of a half-working mobile UI.
 */
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.routinestars.app';

export function MobileOnlyNotice() {
  const signOut = useAuthStore((s) => s.signOut);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.title}>RoutineStars works on your phone or tablet</Text>
        <Text style={styles.body}>
          The parent and child experience is designed for a mobile device — with audio, photos and
          offline support. Please open RoutineStars on your phone or tablet.
        </Text>
        <Text style={styles.hint}>
          Are you a support professional (SENCo, therapist)? The professional portal works here on
          the web — sign in with your professional account.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void Linking.openURL(PLAY_URL)}>
          <Text style={styles.primaryBtnText}>Get the app on Google Play</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void signOut()} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 32,
    maxWidth: 440,
    alignItems: 'center',
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#101B2D',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#5A6B80',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#94A2B4',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  signOut: { marginTop: 16, paddingVertical: 8 },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#7C3AED' },
});

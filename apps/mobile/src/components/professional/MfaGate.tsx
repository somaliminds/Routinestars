/**
 * MfaGate — enforces TOTP MFA for professional accounts before any child
 * data is reachable (DPIA §7). Wraps the professional route stack:
 *   - no verified factor  → enrolment (QR + secret + verify)
 *   - factor but aal1      → login challenge (enter code)
 *   - aal2                 → render children
 *
 * Data-table RLS does not itself require aal2, so this UI gate is the
 * enforcement point — a professional cannot reach any child screen without
 * passing it.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { loadMfaState, enrollTotp, verifyCode, type EnrolResult } from '@/lib/mfa';

type Mode = 'loading' | 'enrol' | 'challenge' | 'ok' | 'error';

export function MfaGate({ children }: { children: React.ReactNode }) {
  const signOut = useAuthStore((s) => s.signOut);
  const [mode, setMode] = useState<Mode>('loading');
  const [enrol, setEnrol] = useState<EnrolResult | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errText, setErrText] = useState('');

  const init = useCallback(async () => {
    setMode('loading');
    setErrText('');
    try {
      const state = await loadMfaState();
      if (state.needsEnrol) {
        const e = await enrollTotp();
        setEnrol(e);
        setFactorId(e.factorId);
        setMode('enrol');
      } else if (state.needsChallenge) {
        setFactorId(state.factorId);
        setMode('challenge');
      } else {
        setMode('ok');
      }
    } catch (err) {
      setErrText(err instanceof Error ? err.message : 'Could not load security settings.');
      setMode('error');
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  const submit = async () => {
    if (!factorId) return;
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Enter the 6-digit code', 'Check your authenticator app and try again.');
      return;
    }
    setBusy(true);
    try {
      await verifyCode(factorId, code);
      setCode('');
      // Re-evaluate — should now be aal2.
      const state = await loadMfaState();
      setMode(state.needsEnrol || state.needsChallenge ? 'challenge' : 'ok');
    } catch {
      Alert.alert('Incorrect code', 'That code was not valid. Codes refresh every 30 seconds.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'ok') return <>{children}</>;

  if (mode === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </SafeAreaView>
    );
  }

  if (mode === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={styles.errTitle}>Security check failed</Text>
        <Text style={styles.body}>{errText}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void init()}>
          <Text style={styles.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void signOut()} style={{ marginTop: 14 }}>
          <Text style={styles.link}>Sign out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // enrol or challenge
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>
          {mode === 'enrol' ? 'Set up two-factor security' : 'Verify it’s you'}
        </Text>
        <Text style={styles.body}>
          {mode === 'enrol'
            ? 'Professional accounts must use an authenticator app. Scan this QR code (or enter the key) in Google Authenticator, Authy, or similar, then enter the 6-digit code.'
            : 'Enter the current 6-digit code from your authenticator app to continue.'}
        </Text>

        {mode === 'enrol' && enrol && (
          <View style={styles.qrBox}>
            {enrol.qrSvg.trim().startsWith('<') ? (
              <SvgXml xml={enrol.qrSvg} width={180} height={180} />
            ) : (
              <Text style={styles.body}>Use the setup key below.</Text>
            )}
            <Text style={styles.secretLabel}>Setup key</Text>
            <Text selectable style={styles.secret}>
              {enrol.secret}
            </Text>
          </View>
        )}

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor="#C4B5FD"
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
          onPress={() => void submit()}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? 'Verifying…' : mode === 'enrol' ? 'Verify & finish' : 'Verify'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => void signOut()} style={{ marginTop: 18 }}>
          <Text style={styles.link}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  center: {
    flex: 1,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 48, marginTop: 20 },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#5B21B6',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: '#111827',
    marginTop: 10,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    maxWidth: 340,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    alignItems: 'center',
    marginBottom: 18,
  },
  secretLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  secret: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#5B21B6',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  codeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 14,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    letterSpacing: 8,
    color: '#111827',
    paddingVertical: 12,
    width: 200,
    marginBottom: 18,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 13,
  },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#7C3AED' },
});

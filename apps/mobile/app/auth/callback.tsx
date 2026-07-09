/**
 * OAuth callback route — handles `routinestars://auth/callback`.
 *
 * `openAuthSessionAsync` is supposed to intercept the provider redirect and
 * hand the URL back to JS, but on Android the OS sometimes routes the deep
 * link to the app instead. This route is the safety net: it parses the URL,
 * exchanges/sets the Supabase session, then lets AuthGuard route the user
 * onward (dashboard, setup-pin, or back to welcome on failure).
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

/** Pull access_token / refresh_token / code out of either #fragment or ?query. */
function extractAuthParams(url: string) {
  const hashPart = url.includes('#') ? url.split('#')[1]! : '';
  const queryPart = url.includes('?') ? (url.split('?')[1]?.split('#')[0] ?? '') : '';
  const params = new URLSearchParams(hashPart || queryPart);
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    code: params.get('code') ?? undefined,
    error: params.get('error_description') ?? params.get('error') ?? undefined,
  };
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const finish = () => router.replace('/');

    const processUrl = async (url: string) => {
      const { accessToken, refreshToken, code } = extractAuthParams(url);
      try {
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } finally {
        finish();
      }
    };

    void (async () => {
      // Cold-launched by deep link: URL is in getInitialURL.
      const initial = await Linking.getInitialURL();
      if (initial && (initial.includes('access_token') || initial.includes('code'))) {
        await processUrl(initial);
        return;
      }
      // Warm-launched (app already running): wait briefly for url event.
      const sub = Linking.addEventListener('url', ({ url }) => {
        void processUrl(url);
        sub.remove();
      });
      // If nothing arrives within 2s, fall through so we don't hang forever.
      setTimeout(() => {
        sub.remove();
        finish();
      }, 2000);
    })();
  }, [router]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color="#7C3AED" />
      <Text style={styles.label}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
    gap: 16,
  },
  label: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: '#5B21B6',
  },
});

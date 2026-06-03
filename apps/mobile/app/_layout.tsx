import '../global.css';

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useSyncPending } from '@/hooks/useSyncPending';
import { supabase } from '@/lib/supabase';
import { initSentry, setSentryUser, Sentry } from '@/lib/sentry';

// Initialise Sentry as early as possible — before any user code runs.
initSentry();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, isLoading } = useAuthStore();
  const [role, setRole] = useState<'parent' | 'child' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      setRole(null);
      return;
    }
    setRoleLoading(true);
    void (async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        setRole((data?.role as 'parent' | 'child') ?? 'parent');
      } catch {
        setRole('parent');
      } finally {
        setRoleLoading(false);
      }
    })();
  }, [session?.user.id]);

  useEffect(() => {
    if (isLoading || roleLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inParentGroup = segments[0] === '(parent)';

    // These (auth) routes must remain reachable WHILE signed in:
    //   - forgot-pin/reset-pin → PIN is a separate credential from auth session
    //   - setup-pin → first-time PIN creation right after signup
    //   - create-child-profile → first-time child onboarding
    //   - choose-plan → first-time plan picker (Stripe redirect lands back here)
    //   - schedule-wizard → first-time schedule creation
    // Without these in the whitelist, AuthGuard bumps new signups
    // straight to /(parent)/dashboard, skipping the entire onboarding.
    const AUTH_GROUP_WHITELIST = new Set([
      'forgot-pin',
      'reset-pin',
      'setup-pin',
      'create-child-profile',
      'choose-plan',
      'schedule-wizard',
    ]);
    const onWhitelistedAuthRoute =
      inAuthGroup && AUTH_GROUP_WHITELIST.has(segments[1] as string);

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/welcome');
      return;
    }

    if (inAuthGroup && !onWhitelistedAuthRoute) {
      if (role === 'parent') router.replace('/(parent)/dashboard');
      else router.replace('/(child)/select-profile');
      return;
    }

    // Children cannot access the parent section
    if (role === 'child' && inParentGroup) router.replace('/(child)/select-profile');
  }, [session, isLoading, role, roleLoading, segments, router]);

  return null;
}

function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrateVoice = useVoiceStore((s) => s.hydrate);
  const session = useAuthStore((s) => s.session);
  useSyncPending(!!session);

  useEffect(() => {
    void hydrateVoice();
  }, [hydrateVoice]);

  // Tag Sentry events with the current user (so we know WHO hit each crash)
  useEffect(() => {
    setSentryUser(session?.user.id ?? null, session?.user.email);
  }, [session?.user.id, session?.user.email]);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void initialize().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [initialize]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(child)" />
          <Stack.Screen name="(parent)" />
          <Stack.Screen name="subscription/success" />
          <Stack.Screen name="subscription/cancel" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap() catches uncaught React render errors and reports them
// to Sentry automatically. Default export must be the wrapped component
// for Expo Router to mount it as the root.
export default Sentry.wrap(RootLayout);

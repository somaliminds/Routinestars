import '../global.css';

import { useCallback, useEffect, useState } from 'react';
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
  /** True when this parent has the placeholder PIN and must complete setup-pin */
  const [needsPinSetup, setNeedsPinSetup] = useState<boolean | null>(null);

  // Read pin_hash for a parent and decide if real PIN exists yet.
  const checkPinStatus = useCallback(async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('parent_profiles')
      .select('pin_hash')
      .eq('user_id', userId)
      .maybeSingle();
    const hash = data?.pin_hash ?? '';
    // Trigger sets a known placeholder string at signup.
    return !hash || hash.includes('placeholder');
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      setNeedsPinSetup(null);
      return;
    }
    setRoleLoading(true);
    void (async () => {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        const resolvedRole = (userRow?.role as 'parent' | 'child') ?? 'parent';
        setRole(resolvedRole);

        // First-time PIN gate flag.
        if (resolvedRole === 'parent') {
          setNeedsPinSetup(await checkPinStatus(session.user.id));
        } else {
          setNeedsPinSetup(false);
        }
      } catch {
        setRole('parent');
        setNeedsPinSetup(false);
      } finally {
        setRoleLoading(false);
      }
    })();
  }, [session?.user.id, checkPinStatus]);

  // Re-check PIN status whenever the user navigates back into the parent
  // app or out of setup-pin — so the stale needsPinSetup=true flag from
  // initial mount gets cleared right after the user completes setup-pin.
  useEffect(() => {
    if (
      session &&
      role === 'parent' &&
      needsPinSetup === true &&
      (segments[0] === '(parent)' || segments[1] === 'create-child-profile')
    ) {
      void (async () => {
        const stillNeeds = await checkPinStatus(session.user.id);
        if (!stillNeeds) setNeedsPinSetup(false);
      })();
    }
  }, [segments[0], segments[1], session?.user.id, role, needsPinSetup, checkPinStatus]);

  useEffect(() => {
    if (isLoading || roleLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inParentGroup = segments[0] === '(parent)';
    const currentRoute = segments[1] as string | undefined;

    // Routes the guard must NOT touch:
    //  - public legal pages reachable signed-in OR signed-out
    //  - auth/callback: handles the Supabase OAuth handshake itself, the
    //    guard would race it and bounce the user to welcome before tokens land
    const PUBLIC_ROUTES = new Set(['privacy-policy', 'terms', 'auth']);
    if (PUBLIC_ROUTES.has(segments[0] as string)) return;

    // These (auth) routes must remain reachable WHILE signed in.
    const AUTH_GROUP_WHITELIST = new Set([
      'forgot-pin',
      'reset-pin',
      'setup-pin',
      'create-child-profile',
      'choose-plan',
      'schedule-wizard',
    ]);
    const onWhitelistedAuthRoute =
      inAuthGroup && AUTH_GROUP_WHITELIST.has(currentRoute ?? '');

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/welcome');
      return;
    }

    // First-time PIN gate: a parent who hasn't completed setup-pin must
    // be there before anything else. Routes them out of the parent app or
    // any non-PIN auth route until the real PIN is saved.
    if (
      role === 'parent' &&
      needsPinSetup === true &&
      currentRoute !== 'setup-pin' &&
      currentRoute !== 'reset-pin' &&
      currentRoute !== 'forgot-pin'
    ) {
      router.replace('/(auth)/setup-pin');
      return;
    }

    if (inAuthGroup && !onWhitelistedAuthRoute) {
      if (role === 'parent') router.replace('/(parent)/dashboard');
      else router.replace('/(child)/select-profile');
      return;
    }

    // Children cannot access the parent section
    if (role === 'child' && inParentGroup) router.replace('/(child)/select-profile');
  }, [session, isLoading, role, roleLoading, needsPinSetup, segments, router]);

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

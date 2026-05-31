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

    // PIN reset routes must remain reachable even when signed in —
    // the email/password session is separate from the parent PIN.
    const PIN_RESET_ROUTES = new Set(['forgot-pin', 'reset-pin']);
    const onPinResetRoute = inAuthGroup && PIN_RESET_ROUTES.has(segments[1] as string);

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/welcome');
      return;
    }

    if (inAuthGroup && !onPinResetRoute) {
      if (role === 'parent') router.replace('/(parent)/dashboard');
      else router.replace('/(child)/select-profile');
      return;
    }

    // Children cannot access the parent section
    if (role === 'child' && inParentGroup) router.replace('/(child)/select-profile');
  }, [session, isLoading, role, roleLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrateVoice = useVoiceStore((s) => s.hydrate);
  const session = useAuthStore((s) => s.session);
  useSyncPending(!!session);

  useEffect(() => {
    void hydrateVoice();
  }, [hydrateVoice]);

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
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

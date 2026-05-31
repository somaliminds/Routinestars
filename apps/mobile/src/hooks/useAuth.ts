import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

/**
 * Guards routes based on auth state.
 * - Unauthenticated → (auth)/welcome
 * - Authenticated parent → (parent)/dashboard
 * - Authenticated child → (child)/home
 *
 * Call this hook once from the root _layout.tsx to enable global auth guarding.
 */
export function useAuth() {
  const { session, isLoading, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    initialize().then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
    };
  }, [initialize]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      // TODO Sprint 1.4: check user role and route to (child) or (parent)
      router.replace('/(parent)/dashboard');
    }
  }, [session, isLoading, segments, router]);
}

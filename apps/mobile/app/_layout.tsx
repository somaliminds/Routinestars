import '../global.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
import { usePinGate } from '@/stores/pinGate.store';
import { supabase } from '@/lib/supabase';
import { initSentry, setSentryUser, Sentry } from '@/lib/sentry';
import { deriveRoleFromBoot, type BootContext, type ResolvedRole } from '@/lib/boot-role';

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
  const [role, setRole] = useState<'parent' | 'child' | 'ta' | 'professional' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  /** True when this parent has the placeholder PIN and must complete setup-pin */
  const [needsPinSetup, setNeedsPinSetup] = useState<boolean | null>(null);
  // Sprint 5.3: kick the parent out of parent area after app-backgrounding.
  const requireOnResume = usePinGate((s) => s.requireOnResume);
  const clearRequireOnResume = usePinGate((s) => s.clearRequireOnResume);

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

  /**
   * Decide between 'parent' and 'ta' for a user whose users.role is 'parent'.
   *
   * Rule: if the user has any school_ta invitations matching their email AND
   * no child_profiles of their own, treat them as a TA. Auto-accept any pending
   * invites so their first sign-in flips accepted_at without an extra UI step.
   *
   * Users with BOTH (parent + active TA assignments) default to 'parent' for
   * the MVP. A context-switcher inside the parent app is Sprint 4.5 work.
   */
  const detectTaRole = useCallback(
    async (userId: string, email: string | undefined): Promise<'parent' | 'ta'> => {
      if (!email) return 'parent';

      // Mark any pending invites for this email as accepted (idempotent).
      // Uses the SECURITY DEFINER RPC because the direct UPDATE is blocked
      // by the parent-only RLS policy from migration 006.
      await supabase.rpc('accept_my_care_team_invitations');

      const [{ count: ownChildren }, { count: taInvites }] = await Promise.all([
        supabase
          .from('child_profiles')
          .select('profile_id', { count: 'exact', head: true })
          .eq('parent_id', userId),
        supabase
          .from('care_team_members')
          .select('member_id', { count: 'exact', head: true })
          .eq('email', email)
          .eq('role', 'school_ta')
          .not('accepted_at', 'is', null),
      ]);

      if ((taInvites ?? 0) > 0 && (ownChildren ?? 0) === 0) return 'ta';
      return 'parent';
    },
    [],
  );

  /**
   * Decide between 'parent' and 'professional'. A user who has been granted
   * active consent to a child's data (via the consent ledger) AND has no
   * child_profiles of their own is a support professional — route them to
   * the professional portal. Users who are also parents default to 'parent'.
   *
   * Claims any pending consents (fills professional_id) on first sign-in.
   * Wrapped in try/catch so a DB without the Phase-B tables (pre-migration)
   * never blocks auth — it just resolves 'parent'.
   */
  const detectProfessionalRole = useCallback(
    async (userId: string, email: string | undefined): Promise<'parent' | 'professional'> => {
      if (!email) return 'parent';
      try {
        // Link this account to any consents addressed to its email (idempotent).
        await supabase.rpc('accept_professional_consents');

        const today = new Date().toISOString().slice(0, 10);
        const [{ count: ownChildren }, { data: consents }] = await Promise.all([
          supabase
            .from('child_profiles')
            .select('profile_id', { count: 'exact', head: true })
            .eq('parent_id', userId),
          supabase
            .from('consent_records')
            .select('withdrawn_at, expiry_date')
            .eq('professional_id', userId),
        ]);

        const hasActive = (consents ?? []).some(
          (c) => !c.withdrawn_at && (c.expiry_date ?? '') >= today,
        );
        if (hasActive && (ownChildren ?? 0) === 0) return 'professional';
        return 'parent';
      } catch {
        return 'parent';
      }
    },
    [],
  );

  /**
   * Resolve role + PIN state. Fast path: one get_boot_context() round-trip
   * (migration 031). If that RPC is unavailable (pre-migration DB) or errors,
   * fall back to the proven multi-query detection so auth never breaks.
   * The role/PIN decision itself lives in the pure, unit-tested
   * deriveRoleFromBoot (src/lib/boot-role).
   */
  const resolveRoleAndPin = useCallback(
    async (userId: string, email: string | undefined): Promise<ResolvedRole> => {
      try {
        const { data, error } = await supabase.rpc('get_boot_context');
        if (!error && data) {
          return deriveRoleFromBoot(data as BootContext);
        }
      } catch {
        // fall through to the legacy sequential path
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', userId)
        .single();
      const baseRole = (userRow?.role as 'parent' | 'child') ?? 'parent';
      if (baseRole !== 'parent') return { role: 'child', needsPinSetup: false };

      const taResolved = await detectTaRole(userId, email);
      if (taResolved === 'ta') return { role: 'ta', needsPinSetup: false };

      const profResolved = await detectProfessionalRole(userId, email);
      return {
        role: profResolved,
        needsPinSetup: profResolved === 'parent' ? await checkPinStatus(userId) : false,
      };
    },
    [detectTaRole, detectProfessionalRole, checkPinStatus],
  );

  useEffect(() => {
    if (!session) {
      setRole(null);
      setNeedsPinSetup(null);
      return;
    }
    setRoleLoading(true);
    void (async () => {
      try {
        const resolved = await resolveRoleAndPin(session.user.id, session.user.email);
        setRole(resolved.role);
        setNeedsPinSetup(resolved.needsPinSetup);
      } catch {
        setRole('parent');
        setNeedsPinSetup(false);
      } finally {
        setRoleLoading(false);
      }
    })();
    // Intentionally keyed on the stable id/email, not the whole session object,
    // to avoid re-running role detection on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, session?.user.email, resolveRoleAndPin]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Sprint 5.3: PIN re-auth on app resume. If the parent backgrounded
    // the app while in parent area and just came back, route them out
    // to the child profile picker — they have to tap "← Parent" and
    // re-enter the PIN to get back. This prevents a child grabbing the
    // tablet during a brief parent-app break from seeing or doing
    // anything parent-only. TAs and children don't have a PIN, so we
    // just clear the flag for them without rerouting.
    if (requireOnResume) {
      if (role === 'parent' && inParentGroup) {
        clearRequireOnResume();
        router.replace('/(child)/select-profile');
        return;
      }
      // Either not in parent area or wrong role for re-auth — just clear.
      clearRequireOnResume();
    }

    // These (auth) routes must remain reachable WHILE signed in.
    const AUTH_GROUP_WHITELIST = new Set([
      'forgot-pin',
      'reset-pin',
      'setup-pin',
      'create-child-profile',
      'choose-plan',
      'schedule-wizard',
    ]);
    const onWhitelistedAuthRoute = inAuthGroup && AUTH_GROUP_WHITELIST.has(currentRoute ?? '');

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

    // Professional portal home — not yet in the typed-routes generated types.
    const professionalHome = '/(professional)/children' as never;
    const group0 = segments[0] as string | undefined;

    if (inAuthGroup && !onWhitelistedAuthRoute) {
      if (role === 'parent') router.replace('/(parent)/dashboard');
      else if (role === 'ta') router.replace('/(ta)/today');
      else if (role === 'professional') router.replace(professionalHome);
      else router.replace('/(child)/select-profile');
      return;
    }

    // Cross-role guards: keep each role in its own group.
    const inProfessionalGroup = group0 === '(professional)';
    if (role === 'child' && inParentGroup) router.replace('/(child)/select-profile');
    if (role === 'ta' && inParentGroup) router.replace('/(ta)/today');
    if (role === 'ta' && group0 === '(child)') router.replace('/(ta)/today');
    if (role === 'parent' && group0 === '(ta)') router.replace('/(parent)/dashboard');
    // Professionals stay in their own group; everyone else is kept out of it.
    if (role === 'professional' && (inParentGroup || group0 === '(child)' || group0 === '(ta)'))
      router.replace(professionalHome);
    if (role !== 'professional' && inProfessionalGroup) {
      if (role === 'parent') router.replace('/(parent)/dashboard');
      else if (role === 'ta') router.replace('/(ta)/today');
      else router.replace('/(child)/select-profile');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    isLoading,
    role,
    roleLoading,
    needsPinSetup,
    segments,
    router,
    requireOnResume,
    clearRequireOnResume,
  ]);

  return null;
}

function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrateVoice = useVoiceStore((s) => s.hydrate);
  const session = useAuthStore((s) => s.session);
  const markRequireOnResume = usePinGate((s) => s.markRequireOnResume);
  useSyncPending(!!session);

  useEffect(() => {
    void hydrateVoice();
  }, [hydrateVoice]);

  // Sprint 5.3: when the app is backgrounded (any reason — notification
  // tray pull-down, app-switcher pop, screen-off), mark the PIN gate as
  // require-on-resume. The next time something calls usePinGate.open(),
  // it'll show the modal even if the parent had just authenticated. We
  // do this unconditionally rather than only-in-child-mode because we
  // don't want the gate to be soft-bypassable by tabbing away from the
  // parent app and back.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      // Only flip the require flag on the active -> background transition.
      // Coming back to active uses the flag, doesn't set it.
      if (prev === 'active' && next !== 'active') {
        markRequireOnResume();
      }
    });
    return () => sub.remove();
  }, [markRequireOnResume]);

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
          <Stack.Screen name="(ta)" />
          <Stack.Screen name="(professional)" />
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

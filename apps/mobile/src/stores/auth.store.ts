import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<() => void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,

  setSession: (session) => set({ session, user: session?.user ?? null, isLoading: false }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },

  initialize: async () => {
    // On a fresh install / upgrade, supabase-js may try to refresh a token
    // that no longer exists in SecureStore. That throws "Invalid Refresh
    // Token" — expected, not a real error. We catch it, clear the bad
    // session, and let the AuthGuard route the user to /(auth)/welcome.
    let session = null;
    try {
      const result = await supabase.auth.getSession();
      session = result.data.session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Refresh Token')) {
        // Clean up any leftover state so the user lands on the login screen
        try {
          await supabase.auth.signOut();
        } catch {
          // already signed out — fine
        }
      } else {
        // Different error — surface it but don't crash the app
        console.warn('[auth] getSession error:', err);
      }
    }

    set({ session, user: session?.user ?? null, isLoading: false });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });

    return () => subscription.unsubscribe();
  },
}));

/**
 * OAuth helpers — opens an in-app browser to a Supabase provider login
 * page, captures the redirect back to routinestars://, and turns the
 * returned tokens into a real session via supabase.auth.setSession.
 *
 * Currently wires up Google; the same pattern works for Apple/Facebook
 * once those providers are enabled in the Supabase dashboard.
 */
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

const REDIRECT_TO = 'routinestars://auth/callback';

export type OAuthProvider = 'google';

interface OAuthResult {
  ok: boolean;
  error?: string;
}

export async function signInWithProvider(provider: OAuthProvider): Promise<OAuthResult> {
  try {
    // 1. Ask Supabase for the provider's OAuth URL but don't open it ourselves.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: REDIRECT_TO,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { ok: false, error: error.message };
    if (!data.url) return { ok: false, error: 'No OAuth URL returned' };

    // 2. Open the URL in an in-app browser and wait for the redirect.
    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);

    if (result.type !== 'success' || !result.url) {
      return { ok: false, error: 'OAuth cancelled' };
    }

    // 3. Supabase returns the tokens as a URL fragment (#access_token=…&refresh_token=…).
    const parsed = parseSupabaseRedirect(result.url);
    if (!parsed.accessToken || !parsed.refreshToken) {
      return { ok: false, error: 'No tokens in redirect' };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (sessionError) return { ok: false, error: sessionError.message };

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth error';
    return { ok: false, error: msg };
  }
}

/** Pull access_token + refresh_token out of the redirect URL fragment. */
function parseSupabaseRedirect(url: string): {
  accessToken?: string;
  refreshToken?: string;
} {
  // Supabase puts tokens after `#` (URL fragment), not `?` (query string).
  const hash = url.includes('#') ? url.split('#')[1]! : '';
  const search = url.includes('?') ? (url.split('?')[1]?.split('#')[0] ?? '') : '';
  const params = new URLSearchParams(hash || search);
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
  };
}

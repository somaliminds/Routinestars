/**
 * Sentry — TEMPORARILY DISABLED for closed alpha.
 *
 * Why this is a stub right now: removing the @sentry/react-native Expo
 * config plugin from app.json (needed to bypass a broken EU-region
 * source-map upload during EAS builds) left the runtime Sentry import
 * in a state that crashed the app at boot. The Sentry native module
 * couldn't initialise without the build-time config the plugin sets up,
 * and `Sentry.init()` blew up before any error boundary could catch it.
 *
 * To re-enable post-alpha:
 *   1. Restore the original imports: `import * as Sentry from '@sentry/react-native'`
 *   2. Put `"@sentry/react-native"` back in app.json plugins array
 *   3. Resolve the EU-region source-map upload issue (likely needs a
 *      Sentry organization-token instead of a user auth token, configured
 *      with `SENTRY_URL=https://de.sentry.io/`)
 *   4. Re-set SENTRY_AUTH_TOKEN in apps/mobile/.env and EAS env vars
 *
 * Until then: crashes are NOT reported anywhere. Watch the Play Store
 * Vitals dashboard or ask testers to send screenshots.
 */

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  initialised = true;
  // Intentionally a no-op for the closed alpha. See file header.
}

export function setSentryUser(_userId: string | null, _email?: string | null): void {
  // Intentionally a no-op for the closed alpha.
}

export function reportError(err: unknown, context?: Record<string, unknown>): void {
  // Fall back to console — at least the error reaches local logs.
  console.error('[reportError]', err, context);
}

/**
 * Stubbed Sentry surface so existing callers (e.g. `Sentry.wrap(...)` in
 * app/_layout.tsx) still compile and behave as identity passthroughs.
 * No imports from @sentry/react-native — that's the whole point.
 */
export const Sentry = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrap: <T>(Component: T): T => Component,
  captureException: (err: unknown) => {
    console.error('[Sentry stub] captureException:', err);
  },
  setUser: (_user: unknown) => {
    // no-op
  },
};

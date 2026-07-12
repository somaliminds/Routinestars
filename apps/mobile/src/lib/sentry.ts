/**
 * Sentry — crash and error reporting.
 *
 * Initialised once at app start (called from app/_layout.tsx).
 *
 * Behaviour:
 *   - No-op if EXPO_PUBLIC_SENTRY_DSN is not set (dev convenience / alpha)
 *   - Tags every event with environment and the current Supabase user id
 *   - Drops pure noise, but keeps a small SAMPLE of network failures so a
 *     real backend outage is still visible (audit P1-5)
 *
 * Crash-proofing: the whole SDK surface is guarded. Re-enabling Sentry once
 * crashed the app at boot because the native module couldn't initialise after
 * the config plugin was removed. init() (and every wrapper) now swallow any
 * SDK/native error and fall back to console — reporting must never take the
 * app down. Requires the "@sentry/react-native" plugin in app.json and the
 * DSN in EAS env for the native module to be present in a build.
 */
import * as Sentry from '@sentry/react-native';

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || dsn.includes('your_key') || dsn.includes('your_project')) {
    // DSN not configured — skip silently (dev / closed alpha).
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_ENV ?? process.env.APP_ENV ?? 'development',
      // Keep cost down on the free tier — sample a quarter of transactions.
      tracesSampleRate: 0.25,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      beforeSend(event, hint) {
        const err = hint?.originalException;
        const msg = (err instanceof Error ? err.message : typeof err === 'string' ? err : '') ?? '';

        // Pure noise — never actionable, always drop.
        const dropAlways = [
          'AbortError',
          "Cannot find native module 'ExpoSpeech'",
          "Cannot find native module 'ExpoLinearGradient'",
        ];
        if (dropAlways.some((d) => msg.includes(d))) return null;

        // Network failures are noisy per-user but a spike = a real outage.
        // Keep a 2% sample so the signal survives (audit P1-5).
        const network = ['Network request failed', 'Failed to fetch'];
        if (network.some((d) => msg.includes(d))) {
          return Math.random() < 0.02 ? event : null;
        }

        return event;
      },
    });
    initialised = true;
  } catch (e) {
    // Native module missing/broken — degrade to console, never crash boot.
    console.warn('[sentry] init failed, running without crash reporting:', e);
  }
}

/** Tag the current authenticated user on every subsequent event. */
export function setSentryUser(userId: string | null, email?: string | null): void {
  if (!initialised) return;
  try {
    Sentry.setUser(userId ? { id: userId, email: email ?? undefined } : null);
  } catch {
    /* ignore */
  }
}

/** Manually report a non-fatal error with extra context. */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialised) {
    console.error('[reportError]', err, context);
    return;
  }
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    console.error('[reportError]', err, context);
  }
}

/**
 * Guarded SDK surface so callers (e.g. `Sentry.wrap(...)` in app/_layout.tsx)
 * work whether or not init succeeded. `wrap` returns the component unchanged
 * when the SDK isn't active, so the app always mounts.
 */
export const guardedSentry = {
  wrap: <T>(Component: T): T => {
    if (!initialised) return Component;
    try {
      return Sentry.wrap(Component as never) as T;
    } catch {
      return Component;
    }
  },
  captureException: (err: unknown) => reportError(err),
};

export { guardedSentry as Sentry };

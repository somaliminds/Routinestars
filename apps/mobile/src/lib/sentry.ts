/**
 * Sentry — crash and error reporting.
 *
 * Initialised once at app start (called from app/_layout.tsx).
 *
 * Behaviour:
 *   - No-op if EXPO_PUBLIC_SENTRY_DSN is not set (dev convenience)
 *   - Tags every event with environment (development / production)
 *   - Tags the current Supabase user id when available, so we know WHO
 *     hit each crash
 *   - Drops noise: network failures, AbortError, ExpoSpeech missing in
 *     dev builds — these are expected and not actionable
 */
import * as Sentry from '@sentry/react-native';

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || dsn.includes('your_key') || dsn.includes('your_project')) {
    // DSN not configured — skip silently
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? 'development',
    // Keep cost down on free tier — only sample 25% of transactions
    tracesSampleRate: 0.25,
    // Send breadcrumbs (taps, navigation, fetch) for context on crashes
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    // Filter out known-noisy errors that aren't actionable
    beforeSend(event, hint) {
      const err = hint?.originalException;
      const msg =
        (err instanceof Error ? err.message : typeof err === 'string' ? err : '') ?? '';
      const drop = [
        'Network request failed',
        'AbortError',
        "Cannot find native module 'ExpoSpeech'",
        "Cannot find native module 'ExpoLinearGradient'",
        'Failed to fetch',
      ];
      if (drop.some((d) => msg.includes(d))) return null;
      return event;
    },
  });

  initialised = true;
}

/** Tag the current authenticated user on every subsequent event. */
export function setSentryUser(userId: string | null, email?: string | null): void {
  if (!initialised) return;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: userId, email: email ?? undefined });
}

/** Manually report a non-fatal error with extra context. */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialised) {
    console.error('[reportError]', err, context);
    return;
  }
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/** Re-export the SDK so callers can use Sentry.wrap, etc. */
export { Sentry };

import { Stack } from 'expo-router';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';

/**
 * TA (School / Care Team) app layout.
 *
 * Intentionally minimal — TAs see a single Today screen and a per-activity
 * detail screen. No tab bar, no settings, no schedule builder, no AI, no
 * EHCP. Purpose-built for a TA with ~1 minute between activities, not for
 * an admin with hours.
 *
 * Wrapped in an error boundary (audit M2) so a crash is contained to the TA
 * group instead of taking down the whole app.
 */
export default function TaLayout() {
  return (
    <RouteErrorBoundary tone="adult">
      <Stack screenOptions={{ headerShown: false }} />
    </RouteErrorBoundary>
  );
}

import { Stack } from 'expo-router';
import { MfaGate } from '@/components/professional/MfaGate';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';

/**
 * Professional portal route group. A separate stack for support
 * professionals (SENCo, therapists, etc.) who have been granted scoped,
 * consent-based access to a child's data. Role routing into this group is
 * handled by the AuthGuard in app/_layout.tsx.
 *
 * Wrapped in MfaGate: TOTP two-factor is mandatory (DPIA §7) — no child
 * screen renders until the professional has enrolled and passed a challenge.
 */
export default function ProfessionalLayout() {
  return (
    <RouteErrorBoundary tone="adult">
      <MfaGate>
        <Stack screenOptions={{ headerShown: false }} />
      </MfaGate>
    </RouteErrorBoundary>
  );
}

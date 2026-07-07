import { Stack } from 'expo-router';
import { MfaGate } from '@/components/professional/MfaGate';

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
    <MfaGate>
      <Stack screenOptions={{ headerShown: false }} />
    </MfaGate>
  );
}

import { Stack } from 'expo-router';

/**
 * Professional portal route group. A separate stack for support
 * professionals (SENCo, therapists, etc.) who have been granted scoped,
 * consent-based access to a child's data. Role routing into this group is
 * handled by the AuthGuard in app/_layout.tsx.
 */
export default function ProfessionalLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Platform, View, StyleSheet } from 'react-native';
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
 *
 * Web (Option A): the portal is the one experience supported on web. On a wide
 * browser it renders as a centered, max-width column over a slate page so it
 * reads as a focused clinical app pane rather than stretching edge-to-edge.
 */
export default function ProfessionalLayout() {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={isWeb ? styles.webPage : styles.fill}>
      <View style={isWeb ? styles.webColumn : styles.fill}>
        <RouteErrorBoundary tone="adult">
          <MfaGate>
            <Stack screenOptions={{ headerShown: false }} />
          </MfaGate>
        </RouteErrorBoundary>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  webPage: {
    flex: 1,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
  },
  webColumn: {
    flex: 1,
    width: '100%',
    maxWidth: 860,
    backgroundColor: '#F6F8FB',
    // A subtle framing so the column reads as a distinct pane on desktop.
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E3E9F0',
  },
});

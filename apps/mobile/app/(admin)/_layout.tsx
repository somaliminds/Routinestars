import { Platform, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { MfaGate } from '@/components/professional/MfaGate';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';

/**
 * Admin panel route group — internal RoutineStars Ltd staff only.
 *
 * Reached only when the AuthGuard resolves role === 'admin' (admin_users
 * membership). Wrapped in MfaGate: TOTP is mandatory, and is_admin() in RLS
 * additionally requires aal2, so no operational data loads until MFA passes —
 * the gate is enforced in the database, not just here.
 *
 * Privacy: admins manage the business (users, subscriptions, content, metrics,
 * oversight). No screen here can read an individual child's special-category
 * data — RLS grants admins no row access to those tables.
 *
 * Desktop-first: on web it renders as a centered wide column (admins work at a
 * desk); it still functions on a phone.
 */
export default function AdminLayout() {
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
  webPage: { flex: 1, backgroundColor: '#EEF2F7', alignItems: 'center' },
  webColumn: {
    flex: 1,
    width: '100%',
    maxWidth: 1100,
    backgroundColor: '#F6F8FB',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E3E9F0',
  },
});

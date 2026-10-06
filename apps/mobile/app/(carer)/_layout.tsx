import { Platform, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useNotifications } from '@/hooks/useNotifications';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';

/**
 * Care-team app layout — for the Viewers and Approvers a parent invites from
 * Settings → Care Team (grandparents, carers, therapists). Role routing into
 * this group is handled by the AuthGuard in app/_layout.tsx (role 'carer').
 *
 * Registers the device for push so Approvers hear when an activity needs
 * approval (notify-parent also messages accepted Approvers). Works on web too:
 * a laptop is how many carers will use it, so on a wide browser it renders as a
 * centred column, like the professional portal.
 */
export default function CarerLayout() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  useNotifications(userId);

  const isWeb = Platform.OS === 'web';
  return (
    <View style={isWeb ? styles.webPage : styles.fill}>
      <View style={isWeb ? styles.webColumn : styles.fill}>
        <RouteErrorBoundary tone="adult">
          <Stack screenOptions={{ headerShown: false }} />
        </RouteErrorBoundary>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  webPage: { flex: 1, backgroundColor: '#EEF0F7', alignItems: 'center' },
  webColumn: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    backgroundColor: '#F7F8FC',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E4E7F0',
  },
});

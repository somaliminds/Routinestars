import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';
import { MobileOnlyNotice } from '@/components/web/MobileOnlyNotice';

/**
 * Child app layout — Sprint 2.5
 *
 * (tabs)/ — home + rewards tab bar (nested Tabs navigator)
 * step-sequencer — full-screen stack push over the tabs
 * select-profile  — full-screen profile picker
 *
 * Wrapped in a child-tone error boundary (audit M2) so a render crash keeps a
 * gentle "try again" on screen instead of blanking the whole app mid-routine.
 */
export default function ChildLayout() {
  if (Platform.OS === 'web') return <MobileOnlyNotice />;
  return (
    <RouteErrorBoundary tone="child">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="step-sequencer" />
        <Stack.Screen name="select-profile" />
      </Stack>
    </RouteErrorBoundary>
  );
}

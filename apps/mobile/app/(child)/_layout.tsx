import { Stack } from 'expo-router';

/**
 * Child app layout — Sprint 2.5
 *
 * (tabs)/ — home + rewards tab bar (nested Tabs navigator)
 * step-sequencer — full-screen stack push over the tabs
 * select-profile  — full-screen profile picker
 */
export default function ChildLayout() {
  return (
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
  );
}

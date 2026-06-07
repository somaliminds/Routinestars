import { Stack } from 'expo-router';

/**
 * TA (School / Care Team) app layout.
 *
 * Intentionally minimal — TAs see a single Today screen and a per-activity
 * detail screen. No tab bar, no settings, no schedule builder, no AI, no
 * EHCP. Purpose-built for a TA with ~1 minute between activities, not for
 * an admin with hours.
 */
export default function TaLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Redirect } from 'expo-router';

/**
 * Root index — redirects to auth flow on first load.
 * The auth store will redirect to (child) or (parent) once a session exists.
 */
export default function Index() {
  return <Redirect href="/(auth)/welcome" />;
}

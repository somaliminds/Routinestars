import { Stack, Redirect } from 'expo-router';

export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Dev',
        headerStyle: { backgroundColor: '#7C3AED' },
        headerTintColor: '#fff',
      }}
    />
  );
}

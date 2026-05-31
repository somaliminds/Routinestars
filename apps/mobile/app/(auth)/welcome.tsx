import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

/**
 * Welcome / splash screen — entry point for unauthenticated users.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-brand-primary">
      <View className="flex-1 items-center justify-center px-8">
        {/* Hero */}
        <Text className="text-white font-nunito-extrabold" style={{ fontSize: 48 }}>
          🌟
        </Text>
        <Text className="text-white font-nunito-extrabold text-heading mt-3 text-center">
          RoutineStars
        </Text>
        <Text className="text-white/80 font-nunito text-body mt-2 text-center">
          Building independence, one star at a time
        </Text>

        {/* Feature bullets */}
        <View className="mt-10 w-full gap-3">
          {[
            '✓  Visual step-by-step daily routines',
            '✓  Stars, badges & streak rewards',
            '✓  Parent approvals & progress reports',
          ].map((line) => (
            <Text key={line} className="text-white/90 font-nunito text-parent-body text-center">
              {line}
            </Text>
          ))}
        </View>
      </View>

      {/* CTA buttons */}
      <View className="px-8 pb-10 gap-4">
        <TouchableOpacity
          onPress={() => router.push('/(auth)/signup')}
          className="bg-white rounded-2xl py-4 items-center min-h-[60px] justify-center"
          accessibilityLabel="Get started — create a new account"
          accessibilityRole="button"
        >
          <Text className="font-nunito-bold text-brand-primary" style={{ fontSize: 18 }}>
            Get Started — It's Free
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          className="border-2 border-white/60 rounded-2xl py-4 items-center min-h-[60px] justify-center"
          accessibilityLabel="Sign in to your existing account"
          accessibilityRole="button"
        >
          <Text className="font-nunito-semibold text-white" style={{ fontSize: 18 }}>
            Sign In
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View className="pb-6 items-center">
        <TouchableOpacity
          onPress={() => router.push('/privacy-policy')}
          accessibilityRole="link"
          accessibilityLabel="View Privacy Policy"
        >
          <Text className="text-white/50 font-inter text-xs">Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

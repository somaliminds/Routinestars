import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// Quality Rule 5: Zod validation before submission
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Quality Rule 7: Never show raw error details to user
        Alert.alert('Sign In Failed', 'Please check your email and password and try again.');
      }
      // Auth state change handled by useAuthStore listener → redirects automatically
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-neutral-100"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <Text className="text-heading font-nunito-bold text-neutral-900 mb-2">Welcome back</Text>
        <Text className="text-body font-nunito text-neutral-500 mb-8">
          Sign in to your RoutineStars account
        </Text>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">
            Email address
          </Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                accessibilityLabel="Email address"
              />
            )}
          />
          {errors.email && (
            <Text className="text-caption font-inter text-accent-danger mt-1">
              {errors.email.message}
            </Text>
          )}
        </View>

        {/* Password */}
        <View className="mb-6">
          <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
                placeholder="••••••••"
                secureTextEntry
                autoComplete="password"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                accessibilityLabel="Password"
              />
            )}
          />
          {errors.password && (
            <Text className="text-caption font-inter text-accent-danger mt-1">
              {errors.password.message}
            </Text>
          )}
        </View>

        {/* Sign In Button — min 60x60px touch target */}
        <TouchableOpacity
          className="bg-brand-primary rounded-2xl py-4 items-center min-h-[60px] justify-center"
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          accessibilityLabel="Sign in"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-subhead font-nunito-bold text-white">Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Links */}
        <TouchableOpacity
          className="mt-4 items-center py-3 min-h-[44px] justify-center"
          onPress={() => router.push('/(auth)/forgot-pin')}
          accessibilityLabel="Forgot PIN or password"
        >
          <Text className="text-parent-body font-inter text-brand-primary">Forgot password?</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4">
          <Text className="text-parent-body font-inter text-neutral-500">
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text className="text-parent-body font-inter-semibold text-brand-primary">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

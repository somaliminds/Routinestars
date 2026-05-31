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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// Quality Rule 5: Zod schema validation
const signupSchema = z
  .object({
    name: z.string().min(2, 'Please enter your name'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name, role: 'parent' },
          emailRedirectTo: 'routinestars://auth/verify',
        },
      });

      if (error) {
        Alert.alert('Sign Up Failed', 'Please check your details and try again.');
        return;
      }

      // Navigate to email verification screen
      router.push('/(auth)/verify-email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-neutral-100"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-heading font-nunito-bold text-neutral-900 mb-2">
          Create your account
        </Text>
        <Text className="text-body font-nunito text-neutral-500 mb-8">
          Set up RoutineStars for your family
        </Text>

        {/* Name */}
        <View className="mb-4">
          <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">
            Your name
          </Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
                placeholder="e.g. Sarah"
                autoCapitalize="words"
                autoComplete="name"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                accessibilityLabel="Your name"
              />
            )}
          />
          {errors.name && (
            <Text className="text-caption font-inter text-accent-danger mt-1">
              {errors.name.message}
            </Text>
          )}
        </View>

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
        <View className="mb-4">
          <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                secureTextEntry
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

        {/* Confirm Password */}
        <View className="mb-6">
          <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">
            Confirm password
          </Text>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
                placeholder="••••••••"
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                accessibilityLabel="Confirm password"
              />
            )}
          />
          {errors.confirmPassword && (
            <Text className="text-caption font-inter text-accent-danger mt-1">
              {errors.confirmPassword.message}
            </Text>
          )}
        </View>

        {/* Create Account Button */}
        <TouchableOpacity
          className="bg-brand-primary rounded-2xl py-4 items-center min-h-[60px] justify-center"
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          accessibilityLabel="Create account"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-subhead font-nunito-bold text-white">Create Account</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4">
          <Text className="text-parent-body font-inter text-neutral-500">
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-parent-body font-inter-semibold text-brand-primary">Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

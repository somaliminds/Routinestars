import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { signInWithProvider } from '@/lib/oauth';
import {
  AuthLayout,
  AuthInput,
  PrimaryButton,
  TextLink,
  GoogleButton,
  OrDivider,
} from '@/components/ui/AuthLayout';

// Quality Rule 5: Zod validation before submission
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleGoogle() {
    setIsGoogleLoading(true);
    const result = await signInWithProvider('google');
    setIsGoogleLoading(false);
    if (!result.ok && result.error !== 'OAuth cancelled') {
      Alert.alert('Google sign-in failed', 'Please try again or use email instead.');
    }
  }

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
        Alert.alert('Sign In Failed', 'Please check your email and password and try again.');
      }
      // AuthGuard handles redirect on success
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout brand title="Welcome back" subtitle="Sign in to your RoutineStars account">
      <GoogleButton onPress={handleGoogle} isLoading={isGoogleLoading} />
      <OrDivider />
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput
            label="Email address"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.email?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.password?.message}
          />
        )}
      />

      <PrimaryButton label="Sign In" onPress={handleSubmit(onSubmit)} isLoading={isLoading} />

      <TextLink label="Forgot password?" onPress={() => router.push('/(auth)/forgot-pin')} />

      <View style={{ marginTop: 4, alignItems: 'center' }}>
        <TextLink
          label="Don't have an account? Sign up"
          onPress={() => router.push('/(auth)/signup')}
        />
      </View>
    </AuthLayout>
  );
}

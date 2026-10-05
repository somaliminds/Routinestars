import { useState } from 'react';
import { Alert, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { signInWithProvider, authCallbackUrl } from '@/lib/oauth';
import {
  AuthLayout,
  AuthInput,
  PrimaryButton,
  TextLink,
  GoogleButton,
  OrDivider,
} from '@/components/ui/AuthLayout';

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Honour the admin `signups_enabled` flag (read pre-auth via an anon RPC).
  // Fail-OPEN: a flag-read error must never block legitimate sign-ups.
  const { data: signupsOn = true } = useQuery({
    queryKey: ['signupsEnabled'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('signups_enabled');
      if (error) return true;
      return data ?? true;
    },
    staleTime: 60_000,
  });

  async function handleGoogle() {
    if (!signupsOn) return;
    setIsGoogleLoading(true);
    const result = await signInWithProvider('google');
    setIsGoogleLoading(false);
    if (!result.ok && result.error !== 'OAuth cancelled') {
      Alert.alert('Google sign-up failed', 'Please try again or use email instead.');
    }
  }

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    if (!signupsOn) return;
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name, role: 'parent' },
          // Confirmation link returns to /auth/callback (web) or the app's deep
          // link (native); there is no /auth/verify route.
          emailRedirectTo: authCallbackUrl(),
        },
      });

      // Supabase quirk: when the email is already registered (e.g. via Google),
      // signUp returns success with no error but identities is empty and no
      // verification email is sent. We must surface this ourselves or the user
      // will sit on verify-email waiting for a code that never arrives.
      const alreadyRegistered =
        !error && result.user && (result.user.identities?.length ?? 0) === 0;

      if (alreadyRegistered) {
        Alert.alert(
          'Account already exists',
          'This email is already registered. Please sign in instead — if you signed up with Google, use the Google button on the sign-in screen.',
          [{ text: 'Go to sign in', onPress: () => router.replace('/(auth)/login') }],
        );
        return;
      }

      if (error) {
        // Some Supabase versions raise an explicit error instead of the
        // empty-identities pattern above. Catch the common variants.
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists')) {
          Alert.alert('Account already exists', 'Please sign in instead.', [
            { text: 'Go to sign in', onPress: () => router.replace('/(auth)/login') },
          ]);
          return;
        }
        Alert.alert('Sign Up Failed', 'Please check your details and try again.');
        return;
      }
      // Pass the address along: there's no session until it's confirmed, so the
      // verify screen can't look it up to resend the link.
      router.push({ pathname: '/(auth)/verify-email', params: { email: data.email } });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout brand title="Create your account" subtitle="Set up RoutineStars for your family">
      {!signupsOn ? (
        <>
          <Text style={styles.pausedText}>
            New sign-ups are temporarily paused. Please check back soon.
          </Text>
          <PrimaryButton label="Go to sign in" onPress={() => router.replace('/(auth)/login')} />
        </>
      ) : (
        <>
          <GoogleButton
            onPress={handleGoogle}
            isLoading={isGoogleLoading}
            label="Sign up with Google"
          />
          <OrDivider />
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <AuthInput
                label="Your name"
                placeholder="e.g. Sarah"
                autoCapitalize="words"
                autoComplete="name"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.name?.message}
              />
            )}
          />

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
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <AuthInput
                label="Confirm password"
                placeholder="••••••••"
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <PrimaryButton
            label="Create Account"
            onPress={handleSubmit(onSubmit)}
            isLoading={isLoading}
          />

          <TextLink
            label="Already have an account? Sign in"
            onPress={() => router.push('/(auth)/login')}
          />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  pausedText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
});

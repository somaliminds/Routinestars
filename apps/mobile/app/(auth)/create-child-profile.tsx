import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { AuthLayout, AuthInput, PrimaryButton } from '@/components/ui/AuthLayout';

const AVATAR_EMOJIS = ['🌟', '🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦋', '🐸', '🦄'];

const childProfileSchema = z.object({
  childName: z.string().min(2, "Please enter your child's name").max(80, 'Name is too long'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please use format YYYY-MM-DD')
    .refine((dob) => {
      const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return age >= 3 && age <= 16;
    }, 'Child must be between 3 and 16 years old'),
});

type ChildProfileForm = z.infer<typeof childProfileSchema>;

export default function CreateChildProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedEmoji, setSelectedEmoji] = useState<string>(AVATAR_EMOJIS[0]!);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChildProfileForm>({ resolver: zodResolver(childProfileSchema) });

  const onSubmit = async (data: ChildProfileForm) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('child_profiles').insert({
        parent_id: user.id,
        child_name: data.childName,
        date_of_birth: data.dateOfBirth,
        avatar_emoji: selectedEmoji,
      });
      if (error) {
        Alert.alert('Error', 'Could not create child profile. Please try again.');
        return;
      }
      router.replace('/(auth)/choose-plan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      emoji="👶"
      title="Add your child"
      subtitle="Set up your child's profile to get started"
    >
      <Text style={styles.sectionLabel}>Choose an avatar</Text>
      <View style={styles.avatars}>
        {AVATAR_EMOJIS.map((emoji) => {
          const selected = selectedEmoji === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.avatar, selected && styles.avatarSelected]}
              onPress={() => setSelectedEmoji(emoji)}
              accessibilityLabel={`Avatar ${emoji}`}
              accessibilityState={{ selected }}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Controller
        control={control}
        name="childName"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput
            label="Child's name"
            placeholder="e.g. Jamie"
            autoCapitalize="words"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.childName?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.dateOfBirth?.message}
          />
        )}
      />

      <PrimaryButton label="Continue" onPress={handleSubmit(onSubmit)} isLoading={isLoading} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#5B21B6',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  avatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
  },
  avatarSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#5B21B6',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarEmoji: { fontSize: 28 },
});

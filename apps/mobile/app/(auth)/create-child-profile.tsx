import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

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
  const [selectedEmoji, setSelectedEmoji] = useState(AVATAR_EMOJIS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChildProfileForm>({
    resolver: zodResolver(childProfileSchema),
  });

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

      // Profile created — route to plan picker
      router.replace('/(auth)/choose-plan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-neutral-100"
      contentContainerClassName="px-6 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-heading font-nunito-bold text-neutral-900 mb-2">Add your child</Text>
      <Text className="text-body font-nunito text-neutral-500 mb-8">
        Set up your child's profile to get started
      </Text>

      {/* Avatar emoji picker */}
      <Text className="text-parent-body font-inter-medium text-neutral-900 mb-3">
        Choose an avatar
      </Text>
      <View className="flex-row flex-wrap gap-3 mb-6">
        {AVATAR_EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            className={`w-[60px] h-[60px] rounded-2xl items-center justify-center ${
              selectedEmoji === emoji ? 'bg-brand-primary' : 'bg-white'
            }`}
            onPress={() => setSelectedEmoji(emoji)}
            accessibilityLabel={`Avatar ${emoji}`}
            accessibilityState={{ selected: selectedEmoji === emoji }}
          >
            <Text className="text-[28px]">{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Child's name */}
      <View className="mb-4">
        <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">
          Child's name
        </Text>
        <Controller
          control={control}
          name="childName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
              placeholder="e.g. Jamie"
              autoCapitalize="words"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              accessibilityLabel="Child's name"
            />
          )}
        />
        {errors.childName && (
          <Text className="text-caption font-inter text-accent-danger mt-1">
            {errors.childName.message}
          </Text>
        )}
      </View>

      {/* Date of birth */}
      <View className="mb-8">
        <Text className="text-parent-body font-inter-medium text-neutral-900 mb-1">
          Date of birth
        </Text>
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="bg-white border border-neutral-100 rounded-xl px-4 py-3 text-neutral-900 font-inter text-parent-body"
              placeholder="YYYY-MM-DD (e.g. 2018-05-23)"
              keyboardType="numeric"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              accessibilityLabel="Date of birth"
            />
          )}
        />
        {errors.dateOfBirth && (
          <Text className="text-caption font-inter text-accent-danger mt-1">
            {errors.dateOfBirth.message}
          </Text>
        )}
      </View>

      {/* Continue button */}
      <TouchableOpacity
        className="bg-brand-primary rounded-2xl py-4 items-center min-h-[60px] justify-center"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
        accessibilityLabel="Create child profile and continue"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-subhead font-nunito-bold text-white">Continue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

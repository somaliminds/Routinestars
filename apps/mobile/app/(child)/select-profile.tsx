/**
 * Child Profile Selector — Sprint 2.1
 * Parent selects which child's app to open after login.
 * Large touch targets (min 100px) with avatar emoji + name.
 * Only shows profiles belonging to the currently logged-in parent.
 */
import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useChildStore } from '@/stores/child.store';
import type { ChildProfileRow } from '@/types/database';

function useChildProfiles(parentId: string | null) {
  return useQuery({
    queryKey: ['child-profiles', parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('parent_id', parentId!)
        .order('child_name');
      if (error) throw error;
      return (data ?? []) as ChildProfileRow[];
    },
    enabled: !!parentId,
  });
}

export default function SelectProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setSelectedChild = useChildStore((s) => s.setSelectedChild);

  const { data: profiles, isLoading, isError } = useChildProfiles(user?.id ?? null);

  // If only one child, auto-select and redirect
  useEffect(() => {
    if (profiles && profiles.length === 1) {
      setSelectedChild(profiles[0]);
      router.replace('/(child)/(tabs)/home');
    }
  }, [profiles, setSelectedChild, router]);

  function handleSelect(profile: ChildProfileRow) {
    setSelectedChild(profile);
    router.replace('/(child)/(tabs)/home');
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-100 items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (isError || !profiles) {
    return (
      <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
        <Text className="text-subhead font-nunito-bold text-neutral-900 text-center mb-2">
          Something went wrong
        </Text>
        <Text className="text-body font-nunito text-neutral-500 text-center">
          We couldn't load the child profiles. Please try again.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-brand-light"
      contentContainerClassName="items-center justify-center px-6 py-16 gap-4"
    >
      <Text className="text-heading font-nunito-bold text-neutral-900 mb-2 text-center">
        Who's doing routines today?
      </Text>
      <Text className="text-body font-nunito text-neutral-500 mb-8 text-center">
        Tap your name to start
      </Text>

      {profiles.map((profile) => (
        <TouchableOpacity
          key={profile.profile_id}
          className="w-full bg-white rounded-3xl py-6 px-8 items-center min-h-[120px] justify-center shadow-sm"
          onPress={() => handleSelect(profile)}
          accessibilityLabel={`Select ${profile.child_name}`}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 52 }} className="mb-3">
            {profile.avatar_emoji}
          </Text>
          <Text className="text-subhead font-nunito-bold text-neutral-900">
            {profile.child_name}
          </Text>
          <Text className="text-caption font-nunito text-accent-star mt-1">
            ⭐ {profile.total_stars.toLocaleString()} stars
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/**
 * Child Profile Selector — Sprint 2.1
 * Parent selects which child's app to open after login.
 * MY24 aesthetic: lavender bg, glass cards, brand-dark headings.
 * Includes Sign Out + Switch to Parent App escape hatches so the
 * screen never becomes a dead end when there are no profiles.
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useChildStore } from '@/stores/child.store';
import { useBlockBackButton } from '@/hooks/useBlockBackButton';
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
  useBlockBackButton();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setSelectedChild = useChildStore((s) => s.setSelectedChild);

  const { data: profiles, isLoading, isError } = useChildProfiles(user?.id ?? null);

  // If only one child, auto-select and redirect
  useEffect(() => {
    if (profiles && profiles.length === 1) {
      setSelectedChild(profiles[0]!);
      router.replace('/(child)/(tabs)/home');
    }
  }, [profiles, setSelectedChild, router]);

  function handleSelect(profile: ChildProfileRow) {
    setSelectedChild(profile);
    router.replace('/(child)/(tabs)/home');
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const profileCount = profiles?.length ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Who's doing routines today?</Text>
        <Text style={styles.subtitle}>
          {profileCount > 0 ? 'Tap your name to start' : 'No child profiles yet'}
        </Text>

        {/* Error state */}
        {isError && (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Something went wrong loading profiles. Pull down to retry or sign out below.
            </Text>
          </View>
        )}

        {/* Empty state — guide them to create one */}
        {!isError && profileCount === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyEmoji}>👶</Text>
            <Text style={styles.cardHeading}>Add your first child</Text>
            <Text style={styles.cardText}>
              Create a child profile to start building routines together.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/(auth)/create-child-profile')}
              accessibilityLabel="Add a child profile"
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Add Child Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile cards */}
        {profiles?.map((profile) => (
          <TouchableOpacity
            key={profile.profile_id}
            style={styles.profileCard}
            onPress={() => handleSelect(profile)}
            accessibilityLabel={`Select ${profile.child_name}`}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            <Text style={styles.profileEmoji}>{profile.avatar_emoji}</Text>
            <Text style={styles.profileName}>{profile.child_name}</Text>
            <Text style={styles.profileStars}>
              ⭐ {profile.total_stars.toLocaleString()} stars
            </Text>
          </TouchableOpacity>
        ))}

        {/* ── Escape hatches: parent app + sign out ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(parent)/dashboard')}
            accessibilityLabel="Open parent app"
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Open Parent App →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOut}
            onPress={() => void signOut()}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  loading: {
    flex: 1,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 32,
    gap: 14,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: '#5B21B6',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 18,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 8 },
  cardHeading: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: '#5B21B6',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },

  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  profileEmoji: { fontSize: 52, marginBottom: 8 },
  profileName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#111827',
  },
  profileStars: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 4,
  },

  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  footer: {
    marginTop: 22,
    gap: 10,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#7C3AED',
  },
  signOut: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#9CA3AF',
  },
});

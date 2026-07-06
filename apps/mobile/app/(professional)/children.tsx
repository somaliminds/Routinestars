/**
 * Professional portal — children list.
 *
 * Lists every child the signed-in professional currently has active,
 * non-expired, non-withdrawn consent to access. Data visibility is
 * enforced server-side by RLS (has_active_consent); this screen only shows
 * what the parent has granted.
 */
import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import {
  fetchMyConsents,
  isConsentActive,
  ROLE_LABEL,
  type ProfessionalRole,
  type DataCategory,
} from '@/lib/professional-access';

interface ChildCard {
  child_id: string;
  child_name: string;
  avatar_emoji: string;
  role: ProfessionalRole;
  categories: DataCategory[];
  expiry: string;
}

async function loadAccessibleChildren(): Promise<ChildCard[]> {
  const consents = (await fetchMyConsents()).filter((c) => isConsentActive(c));
  if (consents.length === 0) return [];

  // One card per child (dedupe if multiple consents somehow exist).
  const byChild = new Map<string, ChildCard>();
  const childIds = Array.from(new Set(consents.map((c) => c.child_id)));

  // Names come from child_profiles — RLS PROFILE_BASICS grants read.
  const { data: profiles } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name, avatar_emoji')
    .in('profile_id', childIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [
      p.profile_id as string,
      { name: p.child_name as string, emoji: (p.avatar_emoji as string) ?? '🌟' },
    ]),
  );

  for (const c of consents) {
    if (byChild.has(c.child_id)) continue;
    const prof = nameById.get(c.child_id);
    byChild.set(c.child_id, {
      child_id: c.child_id,
      child_name: prof?.name ?? 'A child',
      avatar_emoji: prof?.emoji ?? '🌟',
      role: c.professional_role as ProfessionalRole,
      categories: c.data_categories as DataCategory[],
      expiry: c.expiry_date,
    });
  }
  return Array.from(byChild.values());
}

export default function ProfessionalChildrenScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['professionalChildren', session?.user.id],
    queryFn: loadAccessibleChildren,
    enabled: !!session,
  });

  const onSignOut = useCallback(() => void signOut(), [signOut]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Support Portal</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {session?.user.email ?? ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onSignOut} accessibilityRole="button">
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={styles.intro}>
          Children whose parents have granted you access. You can only see the data each parent has
          shared, and access can be withdrawn at any time. Everything you view is recorded.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 30 }} />
        ) : children.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <Text style={styles.emptyTitle}>No access yet</Text>
            <Text style={styles.emptyText}>
              When a parent grants you access to their child in RoutineStars — using the email{' '}
              {session?.user.email ? `${session.user.email}` : 'you signed up with'} — the child
              will appear here.
            </Text>
          </View>
        ) : (
          children.map((c) => (
            <TouchableOpacity
              key={c.child_id}
              style={styles.card}
              onPress={() => router.push(`/(professional)/child/${c.child_id}` as never)}
              accessibilityRole="button"
            >
              <Text style={styles.cardEmoji}>{c.avatar_emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{c.child_name}</Text>
                <Text style={styles.cardRole}>Your role: {ROLE_LABEL[c.role] ?? c.role}</Text>
                <Text style={styles.cardMeta}>
                  {c.categories.length} data area{c.categories.length === 1 ? '' : 's'} · access
                  until {c.expiry}
                </Text>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: '#5B21B6' },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', marginTop: 2 },
  signOut: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#7C3AED' },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 18,
  },
  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: '#111827',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  cardEmoji: { fontSize: 34 },
  cardName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#111827' },
  cardRole: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#5B21B6', marginTop: 2 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  cardArrow: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: '#7C3AED' },
});

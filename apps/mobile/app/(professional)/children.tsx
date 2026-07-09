/**
 * Professional portal — children list.
 *
 * Lists every child the signed-in professional currently has active,
 * non-expired, non-withdrawn consent to access. Data visibility is
 * enforced server-side by RLS (has_active_consent); this screen only shows
 * what the parent has granted.
 *
 * Clinical treatment (2026-07): slate canvas, trust-teal accent, Inter
 * throughout, monogram avatars — a surface a SENCo/clinician can trust.
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
  role: ProfessionalRole;
  categories: DataCategory[];
  expiry: string;
}

/** First letters of the first two names — a neutral, professional avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
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
    .select('profile_id, child_name')
    .in('profile_id', childIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.profile_id as string, p.child_name as string]),
  );

  for (const c of consents) {
    if (byChild.has(c.child_id)) continue;
    byChild.set(c.child_id, {
      child_id: c.child_id,
      child_name: nameById.get(c.child_id) ?? 'A child',
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
          <ActivityIndicator color="#0F766E" style={{ marginTop: 30 }} />
        ) : children.length === 0 ? (
          <View style={styles.empty}>
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(c.child_name)}</Text>
              </View>
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
  screen: { flex: 1, backgroundColor: '#F6F8FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#101B2D',
    letterSpacing: -0.2,
  },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5A6B80', marginTop: 2 },
  signOut: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0F766E' },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#5A6B80',
    lineHeight: 18,
    marginBottom: 18,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
    marginHorizontal: 4,
    paddingVertical: 28,
    paddingHorizontal: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E9F0',
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#101B2D',
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#5A6B80',
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
    borderColor: '#E3E9F0',
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cardName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#101B2D',
    letterSpacing: -0.1,
  },
  cardRole: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0F766E', marginTop: 2 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A2B4', marginTop: 3 },
  cardArrow: { fontFamily: 'Inter_600SemiBold', fontSize: 22, color: '#94A2B4' },
});

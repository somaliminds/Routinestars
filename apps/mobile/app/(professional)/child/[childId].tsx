/**
 * Professional portal — role-scoped child detail.
 *
 * Shows ONLY the data categories the parent granted in the consent record.
 * Server-side RLS (has_active_consent) is the real gate; this screen mirrors
 * the granted scope in the UI and writes a VIEW entry to the access audit
 * log on load (the parent sees every access — ICO Children's Code #11).
 *
 * Read-only. Professional contributions (advice/targets) are Phase B4.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { differenceInYears, format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import {
  fetchMyConsents,
  isConsentActive,
  logAccess,
  ROLE_LABEL,
  type ConsentRow,
  type DataCategory,
  type ProfessionalRole,
} from '@/lib/professional-access';

interface ScopedData {
  consent: ConsentRow | null;
  categories: DataCategory[];
  child: { name: string; dob: string | null; emoji: string } | null;
  outcomes: { outcome_id: string; outcome_text: string; category: string; status: string }[];
  apdr: {
    cycle_number: number;
    status: string;
    window_from: string | null;
    window_to: string | null;
  }[];
  completions30d: number;
  zones7d: { zone: string; occurred_at: string }[];
}

async function loadScopedData(childId: string): Promise<ScopedData> {
  const consent =
    (await fetchMyConsents()).find((c) => c.child_id === childId && isConsentActive(c)) ?? null;
  const categories = (consent?.data_categories as DataCategory[]) ?? [];
  const has = (c: DataCategory) => categories.includes(c);

  const out: ScopedData = {
    consent,
    categories,
    child: null,
    outcomes: [],
    apdr: [],
    completions30d: 0,
    zones7d: [],
  };
  if (!consent) return out;

  // Fetch each permitted category in parallel. RLS returns nothing for any
  // category we're not entitled to, so this is safe even if gating slipped.
  const tasks: Promise<void>[] = [];

  if (has('PROFILE_BASICS')) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('child_profiles')
          .select('child_name, date_of_birth, avatar_emoji')
          .eq('profile_id', childId)
          .maybeSingle();
        if (data)
          out.child = {
            name: data.child_name as string,
            dob: (data.date_of_birth as string | null) ?? null,
            emoji: (data.avatar_emoji as string) ?? '🌟',
          };
      })(),
    );
  }

  if (has('OUTCOMES')) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('ehcp_outcomes')
          .select('outcome_id, outcome_text, category, status')
          .eq('child_id', childId)
          .order('status');
        out.outcomes = (data ?? []) as ScopedData['outcomes'];
      })(),
    );
  }

  if (has('APDR')) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('apdr_cycles')
          .select('cycle_number, status, window_from, window_to')
          .eq('child_id', childId)
          .order('cycle_number', { ascending: false });
        out.apdr = (data ?? []) as ScopedData['apdr'];
      })(),
    );
  }

  if (has('COMPLETIONS')) {
    tasks.push(
      (async () => {
        const from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        const { count } = await supabase
          .from('completions')
          .select('completion_id', { count: 'exact', head: true })
          .eq('child_id', childId)
          .gte('completed_at', `${from}T00:00:00`);
        out.completions30d = count ?? 0;
      })(),
    );
  }

  if (has('EMOTIONAL_CHECKINS')) {
    tasks.push(
      (async () => {
        const from = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        const { data } = await supabase
          .from('emotional_checkins')
          .select('zone, occurred_at')
          .eq('child_id', childId)
          .gte('occurred_at', `${from}T00:00:00`)
          .order('occurred_at', { ascending: false });
        out.zones7d = (data ?? []) as ScopedData['zones7d'];
      })(),
    );
  }

  await Promise.all(tasks);
  return out;
}

export default function ProfessionalChildDetail() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [logged, setLogged] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['professionalChildDetail', childId],
    queryFn: () => loadScopedData(childId!),
    enabled: !!childId,
  });

  // Write a single VIEW audit entry once the scope is known.
  useEffect(() => {
    if (!logged && data?.consent && session) {
      setLogged(true);
      void logAccess({
        actor_id: session.user.id,
        actor_role: data.consent.professional_role,
        child_id: childId!,
        data_categories: data.categories,
        action: 'VIEW',
        purpose: data.consent.purpose,
        lawful_basis: 'CONSENT',
        consent_id: data.consent.consent_id,
      });
    }
  }, [logged, data, session, childId]);

  const age = useMemo(
    () => (data?.child?.dob ? differenceInYears(new Date(), new Date(data.child.dob)) : null),
    [data?.child?.dob],
  );

  const has = (c: DataCategory) => data?.categories.includes(c) ?? false;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Children</Text>
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} size="large" />
      ) : !data?.consent ? (
        <View style={styles.denied}>
          <Text style={{ fontSize: 40 }}>🔒</Text>
          <Text style={styles.deniedText}>
            You no longer have access to this child. The parent may have withdrawn consent or it has
            expired.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.deniedBtn}>
            <Text style={styles.deniedBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          {/* Identity */}
          <View style={styles.identity}>
            <Text style={styles.identityEmoji}>{data.child?.emoji ?? '🌟'}</Text>
            <View>
              <Text style={styles.identityName}>{data.child?.name ?? 'Child'}</Text>
              <Text style={styles.identityMeta}>
                {age != null ? `${age} years` : ''}
                {'  ·  '}You: {ROLE_LABEL[data.consent.professional_role as ProfessionalRole]}
              </Text>
            </View>
          </View>

          <Text style={styles.scopeNote}>
            You can see the areas below because the parent shared them. This view is logged.
          </Text>

          {/* EHCP outcomes */}
          {has('OUTCOMES') && (
            <Section title="EHCP outcomes">
              {data.outcomes.length === 0 ? (
                <Empty>No outcomes recorded.</Empty>
              ) : (
                data.outcomes.map((o) => (
                  <View key={o.outcome_id} style={styles.rowCard}>
                    <Text style={styles.rowTag}>
                      {o.category} · {o.status}
                    </Text>
                    <Text style={styles.rowText}>{o.outcome_text}</Text>
                  </View>
                ))
              )}
            </Section>
          )}

          {/* APDR cycles */}
          {has('APDR') && (
            <Section title="APDR cycles">
              {data.apdr.length === 0 ? (
                <Empty>No cycles recorded.</Empty>
              ) : (
                data.apdr.map((c, i) => (
                  <View key={i} style={styles.rowCard}>
                    <Text style={styles.rowText}>
                      Cycle {c.cycle_number} · {c.status}
                      {c.window_from && c.window_to ? `\n${c.window_from} → ${c.window_to}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </Section>
          )}

          {/* Routine progress */}
          {has('COMPLETIONS') && (
            <Section title="Routine progress (last 30 days)">
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{data.completions30d}</Text>
                <Text style={styles.statLabel}>routine completions recorded</Text>
              </View>
            </Section>
          )}

          {/* Emotional check-ins */}
          {has('EMOTIONAL_CHECKINS') && (
            <Section title="Emotional check-ins (last 7 days)">
              {data.zones7d.length === 0 ? (
                <Empty>No check-ins recorded this week.</Empty>
              ) : (
                data.zones7d.slice(0, 10).map((z, i) => (
                  <View key={i} style={styles.zoneRow}>
                    <Text style={styles.zoneName}>{z.zone}</Text>
                    <Text style={styles.zoneTime}>
                      {format(new Date(z.occurred_at), 'd MMM, HH:mm')}
                    </Text>
                  </View>
                ))
              )}
            </Section>
          )}

          {has('DOCUMENTS') && (
            <Section title="Shared documents">
              <Empty>
                The parent can share the Annual Review Pack and One Page Profile with you directly
                as a PDF.
              </Empty>
            </Section>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  back: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  deniedText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 12,
  },
  deniedBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginTop: 18,
  },
  deniedBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  identityEmoji: { fontSize: 40 },
  identityName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 20, color: '#111827' },
  identityMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', marginTop: 3 },
  scopeNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 15,
  },
  sectionTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: '#5B21B6',
    marginBottom: 10,
  },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 8,
  },
  rowTag: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    color: '#5B21B6',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  rowText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#111827', lineHeight: 18 },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  statNumber: { fontFamily: 'Nunito_800ExtraBold', fontSize: 34, color: '#7C3AED' },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', marginTop: 2 },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 10,
    marginBottom: 6,
  },
  zoneName: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#374151' },
  zoneTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF' },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#9CA3AF', lineHeight: 17 },
});

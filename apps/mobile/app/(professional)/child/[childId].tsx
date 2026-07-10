/**
 * Professional portal — role-scoped child detail.
 *
 * Shows ONLY the data categories the parent granted in the consent record.
 * Server-side RLS (has_active_consent) is the real gate; this screen mirrors
 * the granted scope in the UI and writes a VIEW entry to the access audit
 * log on load (the parent sees every access — ICO Children's Code #11).
 *
 * Read-only for the child's core records. The professional CAN add their own
 * contributions (advice / suggested targets / notes) — parents read them all.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInYears, format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import {
  fetchMyConsents,
  isConsentActive,
  logAccess,
  addContribution,
  listContributions,
  deleteContribution,
  CONTRIBUTION_KIND_LABEL,
  ROLE_LABEL,
  type ConsentRow,
  type ContributionRow,
  type ContributionKind,
  type DataCategory,
  type ProfessionalRole,
} from '@/lib/professional-access';

/** First letters of the first two names — a neutral, professional avatar. */
function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
}

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
  rate30d: { day: string; scheduled: number; completed: number }[];
  zones7d: { zone: string; occurred_at: string }[];
}

// EHCP outcome status → clinical pill (semantic colour, kept off the teal accent).
const OUTCOME_STATUS_META: Record<string, { label: string; bg: string; ink: string }> = {
  ACTIVE: { label: 'Active', bg: '#E4EEF6', ink: '#0369A1' },
  ACHIEVED: { label: 'Achieved', bg: '#E7F4EC', ink: '#15803D' },
  DISCONTINUED: { label: 'Discontinued', bg: '#EEF2F7', ink: '#5A6B80' },
};

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
    rate30d: [],
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
        // 30-day scheduled-vs-completed series for the sparkline (RLS-scoped).
        const { data: rate } = await supabase.rpc('get_completion_rate_30d', {
          p_child_id: childId,
        });
        out.rate30d = (rate ?? []) as ScopedData['rate30d'];
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

  // Contributions (this professional's own input for this child).
  const qc = useQueryClient();
  const { data: contributions = [] } = useQuery({
    queryKey: ['contributions', childId],
    queryFn: () => listContributions(childId!),
    enabled: !!childId,
  });
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<ContributionKind>('ADVICE');
  const [content, setContent] = useState('');
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitContribution = async () => {
    if (!session || !data?.consent || content.trim().length < 3) {
      Alert.alert('Add some detail', 'Please write your input before saving.');
      return;
    }
    setSubmitting(true);
    try {
      await addContribution({
        child_id: childId!,
        outcome_id: outcomeId,
        author_id: session.user.id,
        author_role: data.consent.professional_role,
        author_email: session.user.email ?? null,
        kind,
        content: content.trim(),
      });
      setContent('');
      setOutcomeId(null);
      setKind('ADVICE');
      setShowForm(false);
      void qc.invalidateQueries({ queryKey: ['contributions', childId] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert(
        'Could not save',
        msg.includes('professional_contributions') || msg.includes('does not exist')
          ? 'Contribution storage is not set up yet. The parent’s app needs database migration 030.'
          : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const removeContribution = (id: string) => {
    Alert.alert('Delete', 'Delete this contribution?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteContribution(id);
              void qc.invalidateQueries({ queryKey: ['contributions', childId] });
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Children</Text>
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#0F766E" style={{ marginTop: 40 }} size="large" />
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
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(data.child?.name ?? '')}</Text>
            </View>
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
                data.outcomes.map((o) => {
                  const meta = OUTCOME_STATUS_META[o.status] ?? OUTCOME_STATUS_META.ACTIVE;
                  return (
                    <View key={o.outcome_id} style={styles.rowCard}>
                      <View style={styles.rowHead}>
                        <Text style={styles.rowTag}>{o.category}</Text>
                        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.statusPillText, { color: meta.ink }]}>
                            {meta.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rowText}>{o.outcome_text}</Text>
                    </View>
                  );
                })
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
              <View style={styles.rowCard}>
                {(() => {
                  const sched = data.rate30d.reduce((s, r) => s + r.scheduled, 0);
                  const done = data.rate30d.reduce((s, r) => s + r.completed, 0);
                  const daysWithData = data.rate30d.filter((r) => r.scheduled > 0).length;
                  const pct = sched > 0 ? Math.round((done / sched) * 100) : null;
                  return (
                    <>
                      <View style={styles.metricHead}>
                        <Text style={styles.metricBig}>{pct != null ? `${pct}%` : '—'}</Text>
                        <Text style={styles.metricCap}>
                          {data.completions30d} completion{data.completions30d === 1 ? '' : 's'}
                          {daysWithData > 0
                            ? ` · ${daysWithData} active day${daysWithData === 1 ? '' : 's'}`
                            : ''}
                        </Text>
                      </View>
                      <Sparkline data={data.rate30d} />
                    </>
                  );
                })()}
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

          {/* Your input — advice / targets the parent will see */}
          <Section title="Your input">
            {contributions.length === 0 && !showForm && (
              <Empty>Add advice or a suggested target. The parent sees everything you add.</Empty>
            )}
            {contributions.map((c: ContributionRow) => (
              <View key={c.contribution_id} style={styles.contribCard}>
                <View style={styles.contribTop}>
                  <Text style={styles.contribKind}>{CONTRIBUTION_KIND_LABEL[c.kind]}</Text>
                  <TouchableOpacity onPress={() => removeContribution(c.contribution_id)}>
                    <Text style={styles.contribDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.contribText}>{c.content}</Text>
                <Text style={styles.contribTime}>
                  {format(new Date(c.created_at), 'd MMM yyyy')}
                </Text>
              </View>
            ))}

            {showForm ? (
              <View style={styles.formCard}>
                <View style={styles.kindRow}>
                  {(['ADVICE', 'TARGET', 'NOTE'] as ContributionKind[]).map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={[styles.kindChip, kind === k && styles.kindChipOn]}
                      onPress={() => setKind(k)}
                    >
                      <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>
                        {CONTRIBUTION_KIND_LABEL[k]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {has('OUTCOMES') && data.outcomes.length > 0 && (
                  <>
                    <Text style={styles.tagLabel}>Tag to an outcome (optional)</Text>
                    <View style={styles.kindRow}>
                      <TouchableOpacity
                        style={[styles.kindChip, outcomeId === null && styles.kindChipOn]}
                        onPress={() => setOutcomeId(null)}
                      >
                        <Text style={[styles.kindText, outcomeId === null && styles.kindTextOn]}>
                          General
                        </Text>
                      </TouchableOpacity>
                      {data.outcomes.map((o) => (
                        <TouchableOpacity
                          key={o.outcome_id}
                          style={[styles.kindChip, outcomeId === o.outcome_id && styles.kindChipOn]}
                          onPress={() => setOutcomeId(o.outcome_id)}
                        >
                          <Text
                            style={[
                              styles.kindText,
                              outcomeId === o.outcome_id && styles.kindTextOn,
                            ]}
                            numberOfLines={1}
                          >
                            {o.category}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <TextInput
                  style={styles.contentInput}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Write your advice, target or note…"
                  placeholderTextColor="#94A2B4"
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.formActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      setContent('');
                    }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void submitContribution()}
                    style={styles.saveBtn}
                    disabled={submitting}
                  >
                    <Text style={styles.saveText}>{submitting ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
                <Text style={styles.addBtnText}>+ Add input</Text>
              </TouchableOpacity>
            )}
          </Section>
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

/** Daily completion-rate sparkline (0–100% per day) with an emphasised endpoint.
 *  Measured width (not stretched) so the stroke and endpoint stay undistorted. */
function Sparkline({ data }: { data: { scheduled: number; completed: number }[] }) {
  const [w, setW] = useState(0);
  const pts = data.map((r) => (r.scheduled > 0 ? r.completed / r.scheduled : 0));
  const H = 44;
  const pad = 3;
  const W = w || 280;
  if (pts.length < 2) {
    return <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)} />;
  }
  const x = (i: number) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (v: number) => H - pad - v * (H - pad * 2);
  let line = '';
  let area = `M ${x(0).toFixed(1)} ${H} `;
  pts.forEach((v, i) => {
    const seg = `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    line += seg;
    area += `L ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
  });
  area += `L ${x(pts.length - 1).toFixed(1)} ${H} Z`;
  const last = pts[pts.length - 1];
  return (
    <View style={{ marginTop: 10 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={W} height={H}>
          <Path d={area} fill="#0F766E" fillOpacity={0.1} />
          <Path
            d={line}
            fill="none"
            stroke="#0F766E"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={x(pts.length - 1)} cy={y(last)} r={3.2} fill="#0F766E" />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  back: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0F766E' },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  deniedText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#5A6B80',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 12,
  },
  deniedBtn: {
    backgroundColor: '#0F766E',
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
    borderColor: '#E3E9F0',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 19,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  identityName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#101B2D',
    letterSpacing: -0.2,
  },
  identityMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5A6B80', marginTop: 3 },
  scopeNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#94A2B4',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 15,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 12,
    marginBottom: 8,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  rowTag: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  rowText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#101B2D', lineHeight: 18 },
  metricHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  metricBig: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 30,
    color: '#101B2D',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  metricCap: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#5A6B80',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 10,
    marginBottom: 6,
  },
  zoneName: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#5A6B80' },
  zoneTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A2B4' },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#94A2B4', lineHeight: 17 },

  // Contributions
  contribCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 12,
    marginBottom: 8,
  },
  contribTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contribKind: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contribDelete: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#B91C1C' },
  contribText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#101B2D', lineHeight: 18 },
  contribTime: { fontFamily: 'Inter_400Regular', fontSize: 10.5, color: '#94A2B4', marginTop: 6 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 12,
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kindChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    maxWidth: 160,
  },
  kindChipOn: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  kindText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0F766E' },
  kindTextOn: { color: '#FFFFFF' },
  tagLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#94A2B4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#E3E9F0',
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: '#101B2D',
    backgroundColor: '#F6F8FB',
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#5A6B80' },
  saveBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: '#0F766E',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: '#0F766E' },
});

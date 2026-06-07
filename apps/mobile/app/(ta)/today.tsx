/**
 * TA Today's Session — Phase 5 Sprint 4.3.
 *
 * The TA-facing entry point. Shows today's scheduled activities for every
 * child the TA is linked to via care_team_members. Tap an activity to mark
 * its steps done + leave an optional carer note. Completions write
 * environment=SCHOOL and carer_user_id=this TA's user_id so the parent's
 * reports show "marked done at school by [TA name]".
 *
 * Constraints honoured by RLS (migration 024):
 *  - TA reads schedules + scheduled_sets + activity_sets + steps for any
 *    linked child.
 *  - TA inserts completions and step_completions for linked children.
 *  - TA updates scheduled_sets.status to AWAITING_APPROVAL when done.
 *  - Cannot read or write anything else.
 */
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

interface ChildLink {
  profile_id: string;
  child_name: string;
  avatar_emoji: string;
}

interface TodayActivity {
  scheduled_set_id: string;
  child_id: string;
  start_time: string;
  status: string;
  set_id: string;
  set_name: string;
  icon_emoji: string;
  step_count: number;
}

interface StepRow {
  step_id: string;
  order_index: number;
  title: string;
  instruction_text: string;
  duration_seconds: number;
  reward_stars: number;
}

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

async function fetchLinkedChildren(taEmail: string): Promise<ChildLink[]> {
  const { data: ctm } = await supabase
    .from('care_team_members')
    .select('child_id')
    .eq('email', taEmail)
    .eq('role', 'school_ta')
    .not('accepted_at', 'is', null);
  const childIds = (ctm ?? []).map((r) => r.child_id);
  if (childIds.length === 0) return [];
  const { data: children } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name, avatar_emoji')
    .in('profile_id', childIds);
  return (children ?? []) as ChildLink[];
}

async function fetchTodayActivities(childIds: string[]): Promise<TodayActivity[]> {
  if (childIds.length === 0) return [];
  const today = todayIso();
  const { data: schedules } = await supabase
    .from('day_schedules')
    .select('schedule_id, child_id')
    .in('child_id', childIds)
    .eq('schedule_date', today)
    .eq('is_published', true);
  const scheduleIds = (schedules ?? []).map((s) => s.schedule_id);
  if (scheduleIds.length === 0) return [];

  const childIdByScheduleId: Record<string, string> = {};
  for (const s of schedules ?? []) childIdByScheduleId[s.schedule_id] = s.child_id;

  const { data: sets } = await supabase
    .from('scheduled_sets')
    .select('scheduled_set_id, schedule_id, set_id, start_time, status')
    .in('schedule_id', scheduleIds)
    .order('start_time');

  const setIds = (sets ?? []).map((s) => s.set_id);
  const safeIds = setIds.length > 0 ? setIds : ['__none__'];
  const [{ data: activitySets }, { data: stepCounts }] = await Promise.all([
    supabase.from('activity_sets').select('set_id, set_name, icon_emoji').in('set_id', safeIds),
    supabase.from('steps').select('set_id').in('set_id', safeIds),
  ]);
  const setNameById: Record<string, { set_name: string; icon_emoji: string }> = {};
  for (const a of activitySets ?? []) setNameById[a.set_id] = a;
  const countBySetId: Record<string, number> = {};
  for (const s of stepCounts ?? []) {
    countBySetId[s.set_id] = (countBySetId[s.set_id] ?? 0) + 1;
  }

  return (sets ?? []).map((s) => ({
    scheduled_set_id: s.scheduled_set_id,
    child_id: childIdByScheduleId[s.schedule_id],
    start_time: s.start_time,
    status: s.status,
    set_id: s.set_id,
    set_name: setNameById[s.set_id]?.set_name ?? 'Activity',
    icon_emoji: setNameById[s.set_id]?.icon_emoji ?? '📋',
    step_count: countBySetId[s.set_id] ?? 0,
  }));
}

async function fetchStepsForSet(setId: string): Promise<StepRow[]> {
  const { data } = await supabase
    .from('steps')
    .select('step_id, order_index, title, instruction_text, duration_seconds, reward_stars')
    .eq('set_id', setId)
    .order('order_index');
  return (data ?? []) as StepRow[];
}

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  PENDING:           { label: 'Pending', bg: '#EDE9FE', text: '#5B21B6' },
  IN_PROGRESS:       { label: 'In progress', bg: '#7C3AED', text: '#FFFFFF' },
  PAUSED:            { label: 'Paused', bg: '#FED7AA', text: '#9A3412' },
  AWAITING_APPROVAL: { label: 'Awaiting approval', bg: '#FEF3C7', text: '#854D0E' },
  APPROVED:          { label: 'Approved', bg: '#BBF7D0', text: '#14532D' },
  LOCKED:            { label: '✓ Done', bg: '#BBF7D0', text: '#14532D' },
  SKIPPED:           { label: 'Skipped', bg: '#F3F4F6', text: '#6B7280' },
};

export default function TaTodayScreen() {
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const taUserId = session?.user.id ?? '';
  const taEmail = session?.user.email ?? '';
  const qc = useQueryClient();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState<TodayActivity | null>(null);
  const [carerNote, setCarerNote] = useState('');

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ['ta-children', taEmail],
    queryFn: () => fetchLinkedChildren(taEmail),
    enabled: !!taEmail,
  });

  const childIds = useMemo(() => children.map((c) => c.profile_id), [children]);

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['ta-today', childIds, todayIso()],
    queryFn: () => fetchTodayActivities(childIds),
    enabled: childIds.length > 0,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['ta-steps', openActivity?.set_id ?? null],
    queryFn: () => fetchStepsForSet(openActivity!.set_id),
    enabled: !!openActivity?.set_id,
  });

  const activeChildId = selectedChildId ?? children[0]?.profile_id ?? null;
  const visible = activities.filter((a) => a.child_id === activeChildId);

  const markDoneMutation = useMutation({
    mutationFn: async (activity: TodayActivity) => {
      // 1. Insert completion row tagged with environment=SCHOOL + this TA.
      const now = new Date().toISOString();
      const totalStars = steps.reduce((sum, s) => sum + s.reward_stars, 0);
      const { data: comp, error: cerr } = await supabase
        .from('completions')
        .insert({
          scheduled_set_id: activity.scheduled_set_id,
          child_id: activity.child_id,
          started_at: now,
          completed_at: now,
          stars_earned: totalStars,
          environment: 'SCHOOL',
          carer_user_id: taUserId,
          carer_note: carerNote.trim() || null,
        })
        .select('completion_id')
        .single();
      if (cerr || !comp) throw cerr ?? new Error('Insert failed');

      // 2. Step completions, all marked at the same instant.
      if (steps.length > 0) {
        await supabase.from('step_completions').insert(
          steps.map((s) => ({
            completion_id: comp.completion_id,
            step_id: s.step_id,
            completed_at: now,
            time_taken_seconds: s.duration_seconds,
          })),
        );
      }

      // 3. Flip the scheduled_set to AWAITING_APPROVAL so the parent gets
      //    a push (existing notify-parent path).
      await supabase
        .from('scheduled_sets')
        .update({ status: 'AWAITING_APPROVAL' })
        .eq('scheduled_set_id', activity.scheduled_set_id);
    },
    onSuccess: () => {
      setOpenActivity(null);
      setCarerNote('');
      void qc.invalidateQueries({ queryKey: ['ta-today'] });
    },
    onError: (err) => {
      Alert.alert('Could not mark done', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need your email and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Today's Session</Text>
            <Text style={styles.sub}>{format(new Date(), 'EEEE, d MMMM')}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {childrenLoading || activitiesLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 48 }} />
        ) : children.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No children assigned yet</Text>
            <Text style={styles.emptySub}>
              When a parent invites you as a School TA, the child will appear here.
            </Text>
          </View>
        ) : (
          <>
            {/* Child switcher — horizontal scroller of avatars */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
            >
              {children.map((c) => {
                const isActive = c.profile_id === activeChildId;
                return (
                  <TouchableOpacity
                    key={c.profile_id}
                    style={[styles.childChip, isActive && styles.childChipActive]}
                    onPress={() => setSelectedChildId(c.profile_id)}
                  >
                    <Text style={{ fontSize: 22 }}>{c.avatar_emoji}</Text>
                    <Text
                      style={[styles.childChipText, isActive && styles.childChipTextActive]}
                    >
                      {c.child_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
              {visible.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📅</Text>
                  <Text style={styles.emptyTitle}>Nothing on the schedule today</Text>
                  <Text style={styles.emptySub}>
                    The parent hasn't set anything for today, or all activities are done.
                  </Text>
                </View>
              ) : (
                visible.map((a) => {
                  const meta = STATUS_LABEL[a.status] ?? STATUS_LABEL.PENDING;
                  const isFinal =
                    a.status === 'APPROVED' || a.status === 'LOCKED' || a.status === 'SKIPPED';
                  return (
                    <TouchableOpacity
                      key={a.scheduled_set_id}
                      style={[styles.card, isFinal && { opacity: 0.55 }]}
                      onPress={() => !isFinal && setOpenActivity(a)}
                      disabled={isFinal}
                    >
                      <Text style={styles.cardEmoji}>{a.icon_emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {a.set_name}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {a.start_time.slice(0, 5)} · {a.step_count} steps
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.text }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </>
        )}

        {/* Activity detail modal */}
        <Modal
          visible={openActivity !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setOpenActivity(null)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0FF' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setOpenActivity(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{openActivity?.set_name ?? ''}</Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.modalSection}>Steps in this activity</Text>
              {steps.map((s) => (
                <View key={s.step_id} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{s.order_index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepMeta}>
                      {s.duration_seconds}s · {s.reward_stars}⭐
                    </Text>
                  </View>
                </View>
              ))}

              <Text style={styles.modalSection}>Carer note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={carerNote}
                onChangeText={setCarerNote}
                multiline
                maxLength={280}
                placeholder="E.g. 'Calm session, no prompts needed' or 'Noise from playground next door'"
              />
              <Text style={styles.counter}>{carerNote.length} / 280</Text>

              <TouchableOpacity
                style={styles.markDoneBtn}
                disabled={markDoneMutation.isPending}
                onPress={() => openActivity && markDoneMutation.mutate(openActivity)}
              >
                {markDoneMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.markDoneBtnText}>✓ Mark this activity done</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.helper}>
                Parent will be notified for approval. They can re-do or approve.
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: '#111827' },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  signOut: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
  },
  signOutText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#7C3AED' },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  childChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  childChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#374151' },
  childChipTextActive: { color: '#FFFFFF' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardEmoji: { fontSize: 30 },
  cardTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#111827' },
  cardMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 17,
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.08)',
  },
  modalCancel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' },
  modalTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#111827' },
  modalSection: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#5B21B6',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  stepRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EDE9FE',
    color: '#5B21B6',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  stepTitle: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#111827' },
  stepMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  markDoneBtn: {
    backgroundColor: '#10B981',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 7,
  },
  markDoneBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },
  helper: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

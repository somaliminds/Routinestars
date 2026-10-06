/**
 * Care-team home — "Shared with you".
 *
 * For the Viewers and Approvers a parent invites from Settings → Care Team:
 * the children shared with this account, today's progress for each, and — for
 * Approvers — the activities waiting for their approval. Everything is read
 * under RLS (migration 053); approvals go through review_completion (054).
 */
import { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { fetchCareLinks, fetchTodayCounts, careRoleLabel, type CareLink } from '@/lib/care-team';
import { fetchPendingApprovals } from '@/lib/approvals';
import { confirmAction } from '@/lib/ui-dialogs';

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export default function CarerHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const email = useAuthStore((s) => s.session?.user.email ?? '');
  const signOut = useAuthStore((s) => s.signOut);
  const today = todayIso();

  const links = useQuery({
    queryKey: ['carer', 'links', email],
    queryFn: () => fetchCareLinks(email),
    enabled: !!email,
  });
  const childIds = useMemo(() => (links.data ?? []).map((l) => l.childId), [links.data]);
  const approverChildren = useMemo(
    () =>
      (links.data ?? [])
        .filter((l) => l.role === 'approver')
        .map((l) => ({ id: l.childId, name: l.childName })),
    [links.data],
  );

  const counts = useQuery({
    queryKey: ['carer', 'today', childIds, today],
    queryFn: () => fetchTodayCounts(childIds, today),
    enabled: childIds.length > 0,
  });
  const approvals = useQuery({
    queryKey: ['carer', 'approvals', approverChildren.map((c) => c.id)],
    queryFn: () => fetchPendingApprovals(approverChildren),
    enabled: approverChildren.length > 0,
    refetchInterval: 30_000, // fallback if the realtime socket drops
  });

  // Realtime: refresh as soon as a shared child's activities change (RLS
  // limits the events to the children shared with this account).
  useEffect(() => {
    if (!userId || childIds.length === 0) return;
    const refresh = () => void qc.invalidateQueries({ queryKey: ['carer'] });
    const channel = supabase
      .channel(`carer-home-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_sets' }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, childIds.length, qc]);

  const refreshAll = useCallback(() => void qc.invalidateQueries({ queryKey: ['carer'] }), [qc]);

  const handleSignOut = useCallback(async () => {
    const ok = await confirmAction({
      title: t('carer.signOutTitle', 'Sign out?'),
      message: t('carer.signOutBody', 'You will need your email and password to sign in again.'),
      confirmLabel: t('carer.signOut', 'Sign out'),
      destructive: true,
    });
    if (ok) void signOut();
  }, [signOut, t]);

  const pending = approvals.data ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('carer.home.title', 'Shared with you')}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {email}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void handleSignOut()}
          style={styles.signOutBtn}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>{t('carer.signOut', 'Sign out')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={links.isRefetching}
            onRefresh={refreshAll}
            tintColor="#7C3AED"
          />
        }
      >
        {links.isLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />
        ) : links.isError ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              {t('carer.home.loadError', 'Couldn’t load the children shared with you.')}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void links.refetch()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{t('common.retry', 'Try again')}</Text>
            </TouchableOpacity>
          </View>
        ) : (links.data ?? []).length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyTitle}>
              {t('carer.home.emptyTitle', 'Nothing shared with you yet')}
            </Text>
            <Text style={styles.stateText}>
              {t(
                'carer.home.emptyBody',
                'Ask the child’s parent to invite {{email}} from Settings → Care Team in their RoutineStars app. Pull down to refresh once they have.',
                { email },
              )}
            </Text>
          </View>
        ) : (
          <>
            {approverChildren.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>
                    {t('carer.home.waiting', 'Waiting for your approval')}
                  </Text>
                  {pending.length > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{pending.length}</Text>
                    </View>
                  )}
                </View>
                {approvals.isLoading ? (
                  <ActivityIndicator color="#7C3AED" style={{ marginVertical: 12 }} />
                ) : approvals.isError ? (
                  <Text style={styles.muted}>
                    {t(
                      'carer.home.approvalsError',
                      'Couldn’t load approvals — pull down to retry.',
                    )}
                  </Text>
                ) : pending.length === 0 ? (
                  <Text style={styles.muted}>
                    {t('carer.home.nothingWaiting', 'Nothing waiting right now.')}
                  </Text>
                ) : (
                  pending.map((a) => (
                    <TouchableOpacity
                      key={a.completionId}
                      style={styles.approvalRow}
                      onPress={() => router.push(`/(carer)/approve/${a.completionId}` as never)}
                      accessibilityRole="button"
                      accessibilityLabel={`Review ${a.setName} by ${a.childName}`}
                    >
                      <Text style={styles.rowEmoji}>{a.iconEmoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{a.setName}</Text>
                        <Text style={styles.rowMeta}>
                          {a.childName} ·{' '}
                          {formatDistanceToNow(new Date(a.completedAt), { addSuffix: true })} · ⭐{' '}
                          {a.starsEarned}
                        </Text>
                      </View>
                      <View style={styles.reviewPill}>
                        <Text style={styles.reviewPillText}>{t('carer.review', 'Review')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <Text style={styles.section}>{t('carer.home.children', 'Children')}</Text>
            {(links.data ?? []).map((link) => (
              <ChildCard
                key={link.childId}
                link={link}
                today={counts.data?.[link.childId]}
                todayLoading={counts.isLoading}
                onPress={() => router.push(`/(carer)/child/${link.childId}` as never)}
              />
            ))}

            <Text style={styles.footnote}>
              {t(
                'carer.home.footnote',
                'Viewers can see routines and progress. Approvers can also approve finished activities. The child’s parent can change this in Settings → Care Team.',
              )}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChildCard({
  link,
  today,
  todayLoading,
  onPress,
}: {
  link: CareLink;
  today: { total: number; done: number } | undefined;
  todayLoading: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const pct = today && today.total > 0 ? Math.round((today.done / today.total) * 100) : 0;
  return (
    <TouchableOpacity
      style={styles.childCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${link.childName}, ${careRoleLabel(link.role)}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>{link.avatarEmoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.childName}>{link.childName}</Text>
          <View style={[styles.rolePill, link.role === 'approver' && styles.rolePillApprover]}>
            <Text
              style={[styles.rolePillText, link.role === 'approver' && styles.rolePillTextApprover]}
            >
              {careRoleLabel(link.role)}
            </Text>
          </View>
        </View>
        <Text style={styles.childMeta}>
          ⭐ {link.totalStars} · 🔥 {link.currentStreak}
          {t('carer.dayStreak', '-day streak')}
        </Text>
        <Text style={styles.todayLine}>
          {todayLoading
            ? t('common.loading', 'Loading…')
            : !today || today.total === 0
              ? t('carer.nothingToday', 'Nothing scheduled today')
              : t('carer.todayProgress', 'Today: {{done}} of {{total}} done', {
                  done: today.done,
                  total: today.total,
                })}
        </Text>
        {!!today && today.total > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7F0',
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 22, color: '#111827' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  signOutBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7F0',
  },
  signOutText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#4B5563' },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  stateBox: { alignItems: 'center', marginTop: 48, paddingHorizontal: 16, gap: 14 },
  stateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#111827' },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7F0',
    padding: 16,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#111827', flex: 1 },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280' },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F2F6',
  },
  rowEmoji: { fontSize: 28 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#111827' },
  rowMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  reviewPill: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reviewPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  section: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7F0',
    padding: 16,
    minHeight: 88,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  childName: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#111827' },
  rolePill: {
    backgroundColor: '#F1F2F6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  rolePillApprover: { backgroundColor: '#EDE9FE' },
  rolePillText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#4B5563' },
  rolePillTextApprover: { color: '#5B21B6' },
  childMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', marginTop: 4 },
  todayLine: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#374151', marginTop: 6 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEF0F5',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  chevron: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: '#9CA3AF' },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 8,
  },
});

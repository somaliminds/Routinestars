/**
 * Care-team child view — one shared child's day, week and badges.
 *
 * Read-only for Viewers; Approvers also get a Review button on any activity
 * waiting for approval. Data is RLS-scoped to children shared with this
 * account (migration 053), so an id that isn't shared simply shows nothing.
 */
import { useCallback, useMemo } from 'react';
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
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import {
  careRoleLabel,
  fetchCareLinks,
  fetchChildBadges,
  fetchChildDay,
  fetchChildWeek,
  shortTime,
  statusInfo,
  type StatusTone,
} from '@/lib/care-team';
import { fetchPendingApprovals } from '@/lib/approvals';

const TONE: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: '#F1F2F6', fg: '#4B5563' },
  active: { bg: '#EDE9FE', fg: '#5B21B6' },
  warning: { bg: '#FFEDD5', fg: '#9A3412' },
  waiting: { bg: '#FEF3C7', fg: '#92400E' },
  done: { bg: '#D1FAE5', fg: '#065F46' },
  muted: { bg: '#F3F4F6', fg: '#6B7280' },
};

export default function CarerChildScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { childId = '' } = useLocalSearchParams<{ childId: string }>();
  const email = useAuthStore((s) => s.session?.user.email ?? '');
  const today = format(new Date(), 'yyyy-MM-dd');

  const links = useQuery({
    queryKey: ['carer', 'links', email],
    queryFn: () => fetchCareLinks(email),
    enabled: !!email,
  });
  const link = links.data?.find((l) => l.childId === childId);
  const isApprover = link?.role === 'approver';

  const day = useQuery({
    queryKey: ['carer', 'day', childId, today],
    queryFn: () => fetchChildDay(childId, today),
    enabled: !!link,
  });
  const week = useQuery({
    queryKey: ['carer', 'week', childId, today],
    queryFn: () => fetchChildWeek(childId, today),
    enabled: !!link,
  });
  const badges = useQuery({
    queryKey: ['carer', 'badges', childId],
    queryFn: () => fetchChildBadges(childId),
    enabled: !!link,
  });
  const approvals = useQuery({
    queryKey: ['carer', 'approvals', [childId]],
    queryFn: () => fetchPendingApprovals([{ id: childId, name: link?.childName ?? '' }]),
    enabled: isApprover,
  });
  const completionByScheduledSet = useMemo(
    () => new Map((approvals.data ?? []).map((a) => [a.scheduledSetId, a.completionId])),
    [approvals.data],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(carer)/home' as never);
  }, [router]);

  const maxTotal = Math.max(1, ...(week.data ?? []).map((d) => d.total));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {link?.childName ?? t('carer.child.title', 'Child')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {links.isLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />
        ) : links.isError ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              {t('carer.child.loadError', 'Couldn’t load this child’s details.')}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void links.refetch()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{t('common.retry', 'Try again')}</Text>
            </TouchableOpacity>
          </View>
        ) : !link ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              {t(
                'carer.child.notShared',
                'This child isn’t shared with you (any more). Ask their parent if you think that’s a mistake.',
              )}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goBack} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>{t('common.back', 'Back')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Who */}
            <View style={styles.heroCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{link.avatarEmoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.heroName}>{link.childName}</Text>
                <Text style={styles.heroMeta}>
                  ⭐ {link.totalStars} {t('carer.stars', 'stars')} · 🔥 {link.currentStreak}
                  {t('carer.dayStreak', '-day streak')}
                </Text>
                <View style={[styles.rolePill, isApprover && styles.rolePillApprover]}>
                  <Text style={[styles.rolePillText, isApprover && styles.rolePillTextApprover]}>
                    {t('carer.youAre', 'You are a')} {careRoleLabel(link.role).toLowerCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Today */}
            <Text style={styles.section}>
              {t('carer.child.today', 'Today')} · {format(new Date(), 'EEEE d MMMM')}
            </Text>
            <View style={styles.card}>
              {day.isLoading ? (
                <ActivityIndicator color="#7C3AED" style={{ marginVertical: 12 }} />
              ) : day.isError ? (
                <Text style={styles.muted}>
                  {t('carer.child.dayError', 'Couldn’t load today’s routine.')}
                </Text>
              ) : (day.data ?? []).length === 0 ? (
                <Text style={styles.muted}>
                  {t('carer.nothingToday', 'Nothing scheduled today')}
                </Text>
              ) : (
                (day.data ?? []).map((a, i) => {
                  const s = statusInfo(a.status);
                  const tone = TONE[s.tone];
                  const reviewId = isApprover
                    ? completionByScheduledSet.get(a.scheduledSetId)
                    : undefined;
                  return (
                    <View
                      key={a.scheduledSetId}
                      style={[styles.activityRow, i > 0 && styles.rowBorder]}
                    >
                      <Text style={styles.time}>{shortTime(a.startTime)}</Text>
                      <Text style={styles.activityEmoji}>{a.iconEmoji}</Text>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.activityName}>{a.setName}</Text>
                        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.statusText, { color: tone.fg }]}>{s.label}</Text>
                        </View>
                      </View>
                      {reviewId && (
                        <TouchableOpacity
                          style={styles.reviewBtn}
                          onPress={() => router.push(`/(carer)/approve/${reviewId}` as never)}
                          accessibilityRole="button"
                          accessibilityLabel={`Review ${a.setName}`}
                        >
                          <Text style={styles.reviewBtnText}>{t('carer.review', 'Review')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* This week */}
            <Text style={styles.section}>{t('carer.child.week', 'Last 7 days')}</Text>
            <View style={styles.card}>
              {week.isLoading ? (
                <ActivityIndicator color="#7C3AED" style={{ marginVertical: 12 }} />
              ) : week.isError ? (
                <Text style={styles.muted}>
                  {t('carer.child.weekError', 'Couldn’t load the week.')}
                </Text>
              ) : (
                <View
                  style={styles.weekRow}
                  accessibilityLabel={(week.data ?? [])
                    .map((d) => `${format(parseISO(d.date), 'EEEE')}: ${d.done} of ${d.total}`)
                    .join(', ')}
                >
                  {(week.data ?? []).map((d) => (
                    <View key={d.date} style={styles.weekCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[styles.barTotal, { height: `${(d.total / maxTotal) * 100}%` }]}
                        >
                          <View
                            style={[
                              styles.barDone,
                              { height: d.total > 0 ? `${(d.done / d.total) * 100}%` : '0%' },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.weekCount}>
                        {d.total > 0 ? `${d.done}/${d.total}` : '–'}
                      </Text>
                      <Text style={[styles.weekDay, d.date === today && styles.weekDayToday]}>
                        {format(parseISO(d.date), 'EEEEE')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Badges */}
            <Text style={styles.section}>{t('carer.child.badges', 'Badges')}</Text>
            <View style={styles.card}>
              {badges.isLoading ? (
                <ActivityIndicator color="#7C3AED" style={{ marginVertical: 12 }} />
              ) : badges.isError ? (
                <Text style={styles.muted}>
                  {t('carer.child.badgesError', 'Couldn’t load badges.')}
                </Text>
              ) : (badges.data ?? []).length === 0 ? (
                <Text style={styles.muted}>
                  {t('carer.child.noBadges', 'No badges yet — they’re on their way!')}
                </Text>
              ) : (
                <View style={styles.badgeWrap}>
                  {(badges.data ?? []).map((b) => (
                    <View key={b.rewardId} style={styles.badgeChip}>
                      <Text style={styles.badgeText}>🏅 {b.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7F0',
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#7C3AED' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#111827',
  },
  content: { padding: 20, paddingBottom: 48, gap: 10 },
  stateBox: { alignItems: 'center', marginTop: 48, paddingHorizontal: 16, gap: 14 },
  stateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7F0',
    padding: 18,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 38 },
  heroName: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#111827' },
  heroMeta: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#4B5563' },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F2F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rolePillApprover: { backgroundColor: '#EDE9FE' },
  rolePillText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#4B5563' },
  rolePillTextApprover: { color: '#5B21B6' },
  section: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E7F0',
    padding: 16,
  },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F1F2F6' },
  time: {
    width: 44,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  activityEmoji: { fontSize: 26 },
  activityName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#111827' },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  statusText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  reviewBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  reviewBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { height: 84, width: '100%', maxWidth: 34, justifyContent: 'flex-end' },
  barTotal: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#EEF0F5',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    minHeight: 4,
  },
  barDone: { width: '100%', backgroundColor: '#10B981' },
  weekCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#4B5563',
    fontVariant: ['tabular-nums'],
  },
  weekDay: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#9CA3AF' },
  weekDayToday: { color: '#7C3AED' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeChip: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#92400E' },
});

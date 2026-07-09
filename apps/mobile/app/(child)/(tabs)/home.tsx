import { useCallback, useEffect, useState } from 'react';
import { LockDeviceModal } from '@/components/ui/LockDeviceModal';
import { useBlockBackButton } from '@/hooks/useBlockBackButton';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ActivityCard } from '@/components/ui/ActivityCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StarCounter } from '@/components/ui/StarCounter';
import { ZonesCheckInModal } from '@/components/ui/ZonesCheckInModal';
import { useChildStore } from '@/stores/child.store';
import {
  useChildSchedule,
  useTodayStars,
  type ScheduledSetWithDetails,
} from '@/hooks/useChildSchedule';
import type { ScheduledSetStatus, Zone } from '@/types/database';
import { usePinGate } from '@/stores/pinGate.store';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/supabase';

const TAPPABLE_STATUSES: ScheduledSetStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED'];

function computeDayProgress(sets: ScheduledSetWithDetails[]): number {
  if (sets.length === 0) return 0;
  const done = sets.filter((s) => s.status === 'APPROVED' || s.status === 'LOCKED').length;
  return done / sets.length;
}

interface FirstThenSlice {
  first: { set: ScheduledSetWithDetails; originalIndex: number } | null;
  then: { set: ScheduledSetWithDetails; originalIndex: number } | null;
}

/**
 * First-Then mode: pick the "right now" card and a preview of what's next.
 *  - first: the in-progress / paused set, or the earliest not-yet-done set
 *  - then:  the next not-yet-done set after first
 * Done sets (APPROVED / LOCKED / SKIPPED) are skipped over so the child
 * never sees finished items in the slice.
 */
function pickFirstThenSlice(sets: ScheduledSetWithDetails[]): FirstThenSlice {
  const indexed = sets.map((set, originalIndex) => ({ set, originalIndex }));
  const remaining = indexed.filter(
    ({ set }) => set.status !== 'APPROVED' && set.status !== 'LOCKED' && set.status !== 'SKIPPED',
  );
  if (remaining.length === 0) return { first: null, then: null };

  const inFlightIdx = remaining.findIndex(
    ({ set }) => set.status === 'IN_PROGRESS' || set.status === 'PAUSED',
  );
  const firstIdx = inFlightIdx >= 0 ? inFlightIdx : 0;
  return {
    first: remaining[firstIdx] ?? null,
    then: remaining[firstIdx + 1] ?? null,
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ChildHomeScreen() {
  useBlockBackButton();
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedChild = useChildStore((s) => s.selectedChild);

  const childId = selectedChild?.profile_id ?? null;
  const today = format(new Date(), 'EEEE, d MMMM');
  const openPinGate = usePinGate((s) => s.open);
  const r = useResponsive();

  const {
    data: schedule,
    isLoading: scheduleLoading,
    isError: scheduleError,
    refetch,
    isRefetching,
  } = useChildSchedule(childId);

  const { data: todayStars = 0 } = useTodayStars(childId);
  const dayProgress = computeDayProgress(schedule?.scheduledSets ?? []);
  const firstThenMode = selectedChild?.first_then_mode ?? false;
  const firstThenSlice = firstThenMode
    ? pickFirstThenSlice(schedule?.scheduledSets ?? [])
    : { first: null, then: null };

  // ── Zones of Regulation check-in ──
  // Prompt at the start of the day if the child hasn't logged a feeling
  // yet. Persist suppression in component state so a skip doesn't re-pop
  // on every render until the next app launch.
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const { data: hasCheckedInToday } = useQuery({
    queryKey: ['zones-checkin-today', childId, todayIso],
    queryFn: async () => {
      if (!childId) return false;
      const { count } = await supabase
        .from('emotional_checkins')
        .select('checkin_id', { count: 'exact', head: true })
        .eq('child_id', childId)
        .gte('occurred_at', `${todayIso}T00:00:00`)
        .lte('occurred_at', `${todayIso}T23:59:59`);
      return (count ?? 0) > 0;
    },
    enabled: !!childId,
    staleTime: 60_000,
  });
  const [zonesSuppressed, setZonesSuppressed] = useState(false);
  const [zonesVisible, setZonesVisible] = useState(false);
  useEffect(() => {
    if (childId && hasCheckedInToday === false && !zonesSuppressed) {
      setZonesVisible(true);
    }
  }, [childId, hasCheckedInToday, zonesSuppressed]);

  const handleZoneSelect = useCallback(
    async (zone: Zone, context: string) => {
      if (!childId) return;
      setZonesVisible(false);
      setZonesSuppressed(true);
      await supabase.from('emotional_checkins').insert({
        child_id: childId,
        zone,
        context,
      });
      void queryClient.invalidateQueries({
        queryKey: ['zones-checkin-today', childId, todayIso],
      });
    },
    [childId, queryClient, todayIso],
  );

  const handleZoneSkip = useCallback(() => {
    setZonesVisible(false);
    setZonesSuppressed(true);
  }, []);

  // ── Lock device modal ──
  const [lockVisible, setLockVisible] = useState(false);

  const handleCardPress = useCallback(
    (set: ScheduledSetWithDetails) => {
      if (!TAPPABLE_STATUSES.includes(set.status)) return;
      router.push({
        pathname: '/(child)/step-sequencer',
        params: { scheduledSetId: set.scheduled_set_id },
      });
    },
    [router],
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['child-schedule', childId] });
    void queryClient.invalidateQueries({ queryKey: ['today-stars', childId] });
    void refetch();
  }, [queryClient, childId, refetch]);

  if (!selectedChild) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.centred}>
          <Text style={styles.noProfileTitle}>No profile selected</Text>
          <TouchableOpacity
            style={styles.purpleBtn}
            onPress={() => router.replace('/(child)/select-profile')}
          >
            <Text style={styles.purpleBtnText}>Choose Profile</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: r.scrollClearance + 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={['#7C3AED']}
              tintColor="#7C3AED"
            />
          }
        >
          {/* ── Parent + Lock buttons (top row) ── */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => openPinGate()}
              style={styles.parentBtn}
              accessibilityLabel="Switch to parent app"
              accessibilityRole="button"
            >
              <Text style={styles.parentBtnText}>← Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLockVisible(true)}
              style={styles.lockBtn}
              accessibilityLabel="Lock the tablet to RoutineStars"
              accessibilityRole="button"
            >
              <Text style={styles.lockBtnText}>🔒 Lock tablet</Text>
            </TouchableOpacity>
          </View>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text
                style={styles.greeting}
                numberOfLines={2}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {getGreeting()},{'\n'}
                {selectedChild.avatar_emoji} {selectedChild.child_name}!
              </Text>
              <Text style={styles.date} numberOfLines={1}>
                {today}
              </Text>
            </View>
            <View style={styles.starsBadge}>
              <StarCounter count={todayStars} size="md" />
              <Text style={styles.starsBadgeLabel}>today</Text>
            </View>
          </View>

          {/* ── Day Progress Card ── */}
          <View style={styles.card}>
            <View style={styles.progressRow}>
              <Text style={styles.cardTitle}>Today's Progress</Text>
              <Text style={styles.progressCount}>
                {
                  (schedule?.scheduledSets ?? []).filter(
                    (s) => s.status === 'APPROVED' || s.status === 'LOCKED',
                  ).length
                }{' '}
                / {schedule?.scheduledSets.length ?? 0} done
              </Text>
            </View>
            <ProgressBar progress={dayProgress} variant="day" showLabel={false} />
          </View>

          {/* ── All-done banner ── */}
          {!scheduleLoading && dayProgress === 1 && (schedule?.scheduledSets.length ?? 0) > 0 && (
            <View style={styles.allDoneBanner}>
              <Text style={styles.allDoneEmoji}>🏆</Text>
              <Text style={styles.allDoneTitle}>All done today! Amazing! 🎉</Text>
              <Text style={styles.allDoneSub}>
                You finished every activity,{'\n'}
                {selectedChild.child_name}! You're a star! ⭐
              </Text>
            </View>
          )}

          {/* ── Activity Cards ── */}
          {scheduleLoading && (
            <>
              <Text style={styles.sectionLabel}>
                {firstThenMode ? 'Right Now' : 'Your Activities'}
              </Text>
              <ActivityCard
                title=""
                iconEmoji=""
                starValue={0}
                status="PENDING"
                startTime=""
                isLoading
              />
              <ActivityCard
                title=""
                iconEmoji=""
                starValue={0}
                status="PENDING"
                startTime=""
                isLoading
              />
            </>
          )}

          {scheduleError && (
            <View style={[styles.card, styles.centredCard]}>
              <Text style={styles.emptyIcon}>😟</Text>
              <Text style={styles.emptyTitle}>Couldn't load today's schedule</Text>
              <Text style={styles.emptySub}>
                Pull down to try again, or ask a grown-up for help.
              </Text>
            </View>
          )}

          {!scheduleLoading && !scheduleError && (!schedule || !schedule.is_published) && (
            <View style={[styles.card, styles.centredCard]}>
              <Text style={styles.emptyIcon}>🗓️</Text>
              <Text style={styles.emptyTitle}>No schedule yet</Text>
              <Text style={styles.emptySub}>Ask your parent to set up today's activities.</Text>
            </View>
          )}

          {/* First-Then mode: only the current card + a muted preview of the next */}
          {schedule?.is_published && firstThenMode && firstThenSlice.first && (
            <>
              <Text style={styles.sectionLabel}>First — Right Now</Text>
              <ActivityCard
                key={firstThenSlice.first.set.scheduled_set_id}
                title={firstThenSlice.first.set.setName}
                iconEmoji={firstThenSlice.first.set.iconEmoji}
                starValue={firstThenSlice.first.set.totalStars}
                status={firstThenSlice.first.set.status}
                startTime={firstThenSlice.first.set.start_time}
                colorIndex={firstThenSlice.first.originalIndex}
                onPress={() => handleCardPress(firstThenSlice.first!.set)}
              />
              {firstThenSlice.then && (
                <>
                  <Text style={[styles.sectionLabel, styles.thenLabel]}>Then…</Text>
                  <View style={styles.thenCardWrap}>
                    <ActivityCard
                      key={firstThenSlice.then.set.scheduled_set_id}
                      title={firstThenSlice.then.set.setName}
                      iconEmoji={firstThenSlice.then.set.iconEmoji}
                      starValue={firstThenSlice.then.set.totalStars}
                      status={firstThenSlice.then.set.status}
                      startTime={firstThenSlice.then.set.start_time}
                      colorIndex={firstThenSlice.then.originalIndex}
                    />
                  </View>
                </>
              )}
            </>
          )}

          {/* Default mode: full list of every activity in the day */}
          {schedule?.is_published && !firstThenMode && (
            <>
              <Text style={styles.sectionLabel}>Your Activities</Text>
              {schedule.scheduledSets.map((set, index) => (
                <ActivityCard
                  key={set.scheduled_set_id}
                  title={set.setName}
                  iconEmoji={set.iconEmoji}
                  starValue={set.totalStars}
                  status={set.status}
                  startTime={set.start_time}
                  colorIndex={index}
                  onPress={() => handleCardPress(set)}
                />
              ))}
            </>
          )}

          {/* ── All-time stars ── */}
          <View style={[styles.card, styles.starsRow]}>
            <Text style={styles.cardTitle}>All-time stars</Text>
            <StarCounter count={selectedChild.total_stars} size="md" />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Zones of Regulation check-in — shown at start of day if not done */}
      <ZonesCheckInModal
        visible={zonesVisible}
        childName={selectedChild.child_name}
        context="start_of_day"
        onSelect={handleZoneSelect}
        onSkip={handleZoneSkip}
      />

      {/* Lock device walk-through */}
      <LockDeviceModal visible={lockVisible} onClose={() => setLockVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Soft lavender background — replaces flat brand-light
  screen: {
    flex: 1,
    backgroundColor: '#F5F0FF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    // paddingBottom set inline via useResponsive (r.scrollClearance + 16) so it
    // adapts to Samsung software-nav insets that the static 128 didn't cover.
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centredCard: { alignItems: 'center' },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  parentBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  parentBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#7C3AED',
  },
  lockBtn: {
    backgroundColor: '#5B21B6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  lockBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start', // anchor badge to top of greeting, not centre
    gap: 12,
  },
  greeting: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24, // single H1 — was 26
    color: '#111827',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  date: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  starsBadge: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  starsBadgeLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18, // H2 level — was 17, now on 4dp grid
    lineHeight: 26,
    color: '#111827',
  },
  progressCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#6B7280',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabel: {
    // 3rd-level type: caption-style UPPERCASE divider, not another bold header.
    // Used by Apple Music, Spotify, Linear to separate sections without
    // competing with the page H1.
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: '#5B21B6',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  thenLabel: {
    // Quieter divider — the "Then…" preview is intentionally less prominent
    // than the current "First" card so the child's eye lands on the active
    // item first.
    color: '#9CA3AF',
    marginTop: 20,
  },
  thenCardWrap: {
    // Muted opacity on the preview card keeps it visible without competing
    // for attention with the active card. The child can see what's coming
    // but isn't pulled toward it.
    opacity: 0.6,
  },
  allDoneBanner: {
    backgroundColor: '#FFF0C0',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  allDoneEmoji: { fontSize: 48, marginBottom: 8 },
  allDoneTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  allDoneSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  emptyTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  noProfileTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  purpleBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  purpleBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});

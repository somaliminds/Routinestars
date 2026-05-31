import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ActivityCard } from '@/components/ui/ActivityCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StarCounter } from '@/components/ui/StarCounter';
import { useChildStore } from '@/stores/child.store';
import {
  useChildSchedule,
  useTodayStars,
  type ScheduledSetWithDetails,
} from '@/hooks/useChildSchedule';
import type { ScheduledSetStatus } from '@/types/database';
import { usePinGate } from '@/stores/pinGate.store';

const TAPPABLE_STATUSES: ScheduledSetStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED'];

function computeDayProgress(sets: ScheduledSetWithDetails[]): number {
  if (sets.length === 0) return 0;
  const done = sets.filter((s) => s.status === 'APPROVED' || s.status === 'LOCKED').length;
  return done / sets.length;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ChildHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedChild = useChildStore((s) => s.selectedChild);

  const childId = selectedChild?.profile_id ?? null;
  const today = format(new Date(), 'EEEE, d MMMM');
  const openPinGate = usePinGate((s) => s.open);

  const {
    data: schedule,
    isLoading: scheduleLoading,
    isError: scheduleError,
    refetch,
    isRefetching,
  } = useChildSchedule(childId);

  const { data: todayStars = 0 } = useTodayStars(childId);
  const dayProgress = computeDayProgress(schedule?.scheduledSets ?? []);

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
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={['#7C3AED']}
              tintColor="#7C3AED"
            />
          }
        >
          {/* ── Parent button (top row) ── */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => openPinGate()}
              style={styles.parentBtn}
              accessibilityLabel="Switch to parent app"
              accessibilityRole="button"
            >
              <Text style={styles.parentBtnText}>← Parent</Text>
            </TouchableOpacity>
          </View>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                {getGreeting()},{'\n'}
                {selectedChild.avatar_emoji} {selectedChild.child_name}!
              </Text>
              <Text style={styles.date}>{today}</Text>
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
          <Text style={styles.sectionLabel}>Your Activities</Text>

          {scheduleLoading && (
            <>
              <ActivityCard title="" iconEmoji="" starValue={0} status="PENDING" startTime="" isLoading />
              <ActivityCard title="" iconEmoji="" starValue={0} status="PENDING" startTime="" isLoading />
              <ActivityCard title="" iconEmoji="" starValue={0} status="PENDING" startTime="" isLoading />
            </>
          )}

          {scheduleError && (
            <View style={[styles.card, styles.centredCard]}>
              <Text style={styles.emptyIcon}>😟</Text>
              <Text style={styles.emptyTitle}>Couldn't load today's schedule</Text>
              <Text style={styles.emptySub}>Pull down to try again, or ask a grown-up for help.</Text>
            </View>
          )}

          {!scheduleLoading && !scheduleError && (!schedule || !schedule.is_published) && (
            <View style={[styles.card, styles.centredCard]}>
              <Text style={styles.emptyIcon}>🗓️</Text>
              <Text style={styles.emptyTitle}>No schedule yet</Text>
              <Text style={styles.emptySub}>Ask your parent to set up today's activities.</Text>
            </View>
          )}

          {schedule?.is_published &&
            schedule.scheduledSets.map((set, index) => (
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

          {/* ── All-time stars ── */}
          <View style={[styles.card, styles.starsRow]}>
            <Text style={styles.cardTitle}>All-time stars</Text>
            <StarCounter count={selectedChild.total_stars} size="md" />
          </View>
        </ScrollView>
      </SafeAreaView>
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
    paddingBottom: 128, // clears floating tab bar (72) + offset (24) + breathing room
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
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 26,
    color: '#111827',
    lineHeight: 34,
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
    fontSize: 17,
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
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: '#111827',
    marginBottom: 12,
    marginTop: 4,
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

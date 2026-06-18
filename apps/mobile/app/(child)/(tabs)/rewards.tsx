/**
 * Reward Collection Screen — Sprint 2.5
 *
 * Shows the child their full reward collection:
 *  - Animated star meter (total stars with fill bar)
 *  - Streak counter with flame emoji
 *  - Badge/trophy grid: earned (colour) + locked (greyed, 🔒, unlock hint)
 *
 * Spec: Section 9 — Gamification Engine
 * Child UI non-negotiables: min 80px touch targets, 22px+ text, no error messages shown.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChildStore } from '@/stores/child.store';
import { useChildRewards, type RewardItem } from '@/hooks/useChildRewards';
import { useBlockBackButton } from '@/hooks/useBlockBackButton';
import { BadgeDisplay } from '@/components/ui/BadgeDisplay';

// ── Star meter ──────────────────────────────────────────────────────────────
const STAR_MILESTONES = [50, 100, 200, 350, 500, 750, 1000];

function getNextMilestone(stars: number): number {
  return STAR_MILESTONES.find((m) => m > stars) ?? STAR_MILESTONES[STAR_MILESTONES.length - 1]!;
}

function StarMeter({ totalStars }: { totalStars: number }) {
  const next = getNextMilestone(totalStars);
  const prev = STAR_MILESTONES.findIndex((m) => m > totalStars);
  const prevMilestone = prev > 0 ? (STAR_MILESTONES[prev - 1] ?? 0) : 0;
  const progress = Math.min((totalStars - prevMilestone) / (next - prevMilestone), 1);

  return (
    <View style={rewardStyles.card}>
      <View className="flex-row items-center mb-3">
        <Text style={{ fontSize: 36 }} className="mr-3">
          ⭐
        </Text>
        <View className="flex-1">
          <Text className="font-nunito-extrabold text-neutral-900" style={{ fontSize: 32 }}>
            {totalStars.toLocaleString()}
          </Text>
          <Text className="font-nunito text-neutral-500" style={{ fontSize: 16 }}>
            Total Stars
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-nunito-bold text-accent-star" style={{ fontSize: 14 }}>
            Next: {next} ⭐
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="h-4 bg-neutral-100 rounded-full overflow-hidden">
        <View
          className="h-full bg-accent-star rounded-full"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
      <Text className="font-nunito text-neutral-400 text-xs mt-1 text-right">
        {next - totalStars} stars to next milestone
      </Text>
    </View>
  );
}

// ── Streak counter ───────────────────────────────────────────────────────────
function StreakCounter({ streak }: { streak: number }) {
  return (
    <View style={[rewardStyles.card, rewardStyles.row]}>
      <Text style={{ fontSize: 48 }} className="mr-4">
        {streak === 0 ? '💤' : streak >= 7 ? '🔥🔥' : '🔥'}
      </Text>
      <View className="flex-1">
        <Text className="font-nunito-extrabold text-neutral-900" style={{ fontSize: 32 }}>
          {streak} {streak === 1 ? 'Day' : 'Days'}
        </Text>
        <Text className="font-nunito text-neutral-500" style={{ fontSize: 16 }}>
          {streak === 0
            ? 'Start your streak today!'
            : streak >= 7
              ? 'Super streak! Keep going! 🏆'
              : `Keep it up! ${7 - streak} more for Super Streak`}
        </Text>
      </View>
    </View>
  );
}

// ── Badge detail modal ───────────────────────────────────────────────────────
function BadgeDetailModal({ badge, onClose }: { badge: RewardItem | null; onClose: () => void }) {
  if (!badge) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/50 items-center justify-center px-8"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="bg-white rounded-3xl p-8 w-full items-center">
          <Text style={{ fontSize: 72, opacity: badge.isEarned ? 1 : 0.3 }}>{badge.iconEmoji}</Text>

          <Text
            className="font-nunito-extrabold text-neutral-900 text-center mt-3"
            style={{ fontSize: 24 }}
          >
            {badge.name}
          </Text>

          {badge.isEarned ? (
            <>
              <View className="bg-accent-success/10 rounded-2xl px-4 py-2 mt-2 mb-3">
                <Text
                  className="font-nunito-bold text-accent-success text-center"
                  style={{ fontSize: 16 }}
                >
                  ✓ Earned!
                </Text>
              </View>
              {badge.earnedAt && (
                <Text className="font-nunito text-neutral-400 text-center" style={{ fontSize: 14 }}>
                  {new Date(badge.earnedAt).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              )}
            </>
          ) : (
            <>
              <View className="bg-neutral-100 rounded-2xl px-4 py-2 mt-2 mb-3">
                <Text
                  className="font-nunito-bold text-neutral-500 text-center"
                  style={{ fontSize: 14 }}
                >
                  🔒 Locked
                </Text>
              </View>
              <Text
                className="font-nunito text-neutral-600 text-center"
                style={{ fontSize: 18, lineHeight: 26 }}
              >
                {badge.description}
              </Text>
            </>
          )}

          <TouchableOpacity
            className="bg-brand-primary rounded-2xl mt-6 items-center justify-center"
            style={{ height: 64, width: '100%' }}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text className="font-nunito-bold text-white" style={{ fontSize: 20 }}>
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function RewardsScreen() {
  useBlockBackButton();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const childId = selectedChild?.profile_id ?? null;

  const { data, isLoading, error, refetch, isRefetching } = useChildRewards(childId);
  const [selectedBadge, setSelectedBadge] = useState<RewardItem | null>(null);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (!selectedChild) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F0FF' }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 22, color: '#111827', textAlign: 'center' }}>
            No profile selected
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F0FF' }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </SafeAreaView>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F0FF' }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>😟</Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 24, color: '#111827', textAlign: 'center' }}>
            We couldn't load your rewards
          </Text>
          <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 20, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
            Ask a grown-up for help!
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  const earnedCount = data.rewards.filter((r) => r.isEarned).length;

  // Map to BadgeDisplay-compatible shape
  const badgesForDisplay = data.rewards.map((r) => ({
    id: r.rewardId,
    name: r.name,
    description: r.description,
    iconEmoji: r.iconEmoji,
    isEarned: r.isEarned,
    earnedAt: r.earnedAt,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F0FF' }}>
      <SafeAreaView style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 32, color: '#111827' }}>
          My Rewards
        </Text>
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 18, color: '#6B7280', marginTop: 4 }}>
          {selectedChild.child_name} · {earnedCount} of {data.rewards.length} badges
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {/* Star meter */}
        <StarMeter totalStars={data.totalStars} />

        {/* Streak counter */}
        <StreakCounter streak={data.currentStreak} />

        {/* Badge grid header */}
        <Text className="font-nunito-bold text-neutral-700 mb-3" style={{ fontSize: 20 }}>
          Badges & Trophies
        </Text>

        <BadgeDisplay
          badges={badgesForDisplay}
          onBadgePress={(badge) => {
            const full = data.rewards.find((r) => r.rewardId === badge.id);
            if (full) setSelectedBadge(full);
          }}
        />
      </ScrollView>

      <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      </SafeAreaView>
    </View>
  );
}

const rewardStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

/**
 * Progress Reports — Sprint 3.4
 *
 * - 30-day completion rate bar chart (colour-coded green/amber/red)
 * - Weekly heatmap (4 weeks × 7 days)
 * - Badge timeline (chronological earned badges)
 * - Streak history (current + longest streak)
 *
 * Charts built with plain React Native Views (no chart library needed).
 *
 * Spec: Section 5.4 — Progress Reports
 */
import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek, addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useParentStore } from '@/stores/parent.store';
import {
  useSubscriptionStore,
  canAccessReports,
  requiredTierFor,
} from '@/stores/subscription.store';
import type { Zone } from '@/types/database';

// ── Types ────────────────────────────────────────────────────────────────────
interface DailyRate {
  date: string;
  scheduled: number;
  completed: number;
  pct: number;
}

interface BadgeEarned {
  rewardId: string;
  name: string;
  iconEmoji: string;
  description: string;
  earnedAt: string;
}

interface ReportsData {
  dailyRates: DailyRate[];
  earnedBadges: BadgeEarned[];
  currentStreak: number;
  longestStreak: number;
  totalStars: number;
  zones7d: { date: string; zone: Zone | null }[];
  envSplit7d: { HOME: number; SCHOOL: number; RESPITE: number };
}

const REWARD_EMOJI: Record<string, string> = {
  'Sparkling Teeth': '🦷',
  'Early Bird': '🌅',
  'School Ready Star': '🎒',
  'Homework Hero': '📚',
  'Sleepy Champion': '😴',
  'Park Explorer': '🌳',
  'Super Shopper': '🛒',
  'City Explorer': '🏙️',
  'Full Week Champion': '🏆',
  'Golden Month': '🌕',
  '3-Day Streak': '🔥',
  '7-Day Super Streak': '🔥🔥',
  'On-Time Bonus': '⚡',
  'Perfect Day': '⭐',
  'Weekend Adventurer': '🎡',
};

// ── Data Fetch ───────────────────────────────────────────────────────────────
async function fetchReports(childId: string): Promise<ReportsData> {
  // 1. 30-day daily rates — one aggregate RPC instead of up to 60 round-trips
  //    (audit M1). RLS still applies (SECURITY INVOKER function).
  const dailyRates: DailyRate[] = [];
  const { data: rateRows } = await supabase.rpc('get_completion_rate_30d', {
    p_child_id: childId,
  });
  for (const row of rateRows ?? []) {
    const scheduled = row.scheduled ?? 0;
    const completed = row.completed ?? 0;
    dailyRates.push({
      date: row.day,
      scheduled,
      completed,
      pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
    });
  }

  // 2. Earned badges
  const { data: childRewards } = await supabase
    .from('child_rewards')
    .select('reward_id, earned_at')
    .eq('child_id', childId)
    .order('earned_at', { ascending: false });

  const earnedBadges: BadgeEarned[] = [];
  for (const cr of childRewards ?? []) {
    const { data: reward } = await supabase
      .from('rewards')
      .select('name, description')
      .eq('reward_id', cr.reward_id)
      .single();
    if (reward) {
      earnedBadges.push({
        rewardId: cr.reward_id,
        name: reward.name,
        iconEmoji: REWARD_EMOJI[reward.name] ?? '🏅',
        description: reward.description,
        earnedAt: cr.earned_at as string,
      });
    }
  }

  // 3. Streak + total stars
  const { data: profile } = await supabase
    .from('child_profiles')
    .select('total_stars, current_streak')
    .eq('profile_id', childId)
    .single();

  // Simple longest streak calculation from daily rates
  let longest = 0;
  let running = 0;
  for (const day of dailyRates) {
    if (day.scheduled > 0 && day.pct === 100) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  // ── Zones of Regulation — last 7 days, child's most recent check-in per day
  const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const { data: zoneRows } = await supabase
    .from('emotional_checkins')
    .select('zone, occurred_at')
    .eq('child_id', childId)
    .gte('occurred_at', `${sevenDaysAgo}T00:00:00`)
    .order('occurred_at', { ascending: false });

  // Take the FIRST row seen per day (which is the most-recent because we
  // ordered DESC). Multiple check-ins per day are common; the latest one
  // reflects how the day ended up.
  const zoneByDate = new Map<string, Zone>();
  for (const r of zoneRows ?? []) {
    const day = (r.occurred_at as string).slice(0, 10);
    if (!zoneByDate.has(day)) zoneByDate.set(day, r.zone as Zone);
  }
  const zones7d = Array.from({ length: 7 }).map((_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    return { date, zone: zoneByDate.get(date) ?? null };
  });

  // ── Environment split (last 7 days, approved completions only) ──
  const { data: envRows } = await supabase
    .from('completions')
    .select('environment, completed_at, parent_approved')
    .eq('child_id', childId)
    .gte('completed_at', `${sevenDaysAgo}T00:00:00`);
  const envSplit7d = { HOME: 0, SCHOOL: 0, RESPITE: 0 } as Record<
    'HOME' | 'SCHOOL' | 'RESPITE',
    number
  >;
  for (const r of envRows ?? []) {
    // Count parent-approved or not-yet-approved (the parent hasn't decided yet) —
    // exclude only the explicitly-rejected ones (parent_approved=false after
    // approval ran). The current schema only sets parent_approved=true on
    // approve, so true+null both count.
    if (r.parent_approved === false) continue;
    const env = (r.environment as 'HOME' | 'SCHOOL' | 'RESPITE') ?? 'HOME';
    envSplit7d[env] = (envSplit7d[env] ?? 0) + 1;
  }

  return {
    dailyRates,
    earnedBadges,
    currentStreak: profile?.current_streak ?? 0,
    longestStreak: longest,
    totalStars: profile?.total_stars ?? 0,
    zones7d,
    envSplit7d,
  };
}

// ── Completion Bar Chart (30 days) ───────────────────────────────────────────
function CompletionChart({ days }: { days: DailyRate[] }) {
  // Show last 30 days as micro bars
  return (
    <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-1">
        30-Day Completion Rate
      </Text>
      <View className="flex-row justify-between items-end mt-3" style={{ height: 60 }}>
        {days.map((day) => {
          const barColor =
            day.scheduled === 0
              ? 'bg-[#F5F0FF]'
              : day.pct >= 80
                ? 'bg-accent-success'
                : day.pct >= 50
                  ? 'bg-accent-warning'
                  : 'bg-accent-danger';
          return (
            <View
              key={day.date}
              className="flex-1 bg-[#F5F0FF] rounded-t-sm overflow-hidden mx-px"
              style={{ height: 56 }}
            >
              <View
                className={`w-full rounded-t-sm ${barColor} absolute bottom-0`}
                style={{ height: `${Math.max(day.pct, day.scheduled === 0 ? 0 : 4)}%` }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="font-inter text-neutral-400" style={{ fontSize: 9 }}>
          30 days ago
        </Text>
        <Text className="font-inter text-neutral-400" style={{ fontSize: 9 }}>
          Today
        </Text>
      </View>
      {/* Legend */}
      <View className="flex-row gap-4 mt-3">
        {[
          { color: 'bg-accent-success', label: '≥80%' },
          { color: 'bg-accent-warning', label: '50–79%' },
          { color: 'bg-accent-danger', label: '<50%' },
        ].map(({ color, label }) => (
          <View key={label} className="flex-row items-center gap-1">
            <View className={`w-3 h-3 rounded-sm ${color}`} />
            <Text className="font-inter text-neutral-500" style={{ fontSize: 10 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 4-Week Heatmap ───────────────────────────────────────────────────────────
const HEATMAP_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeeklyHeatmap({ days }: { days: DailyRate[] }) {
  // Build 4 complete Mon–Sun weeks (most recent last)
  const today = new Date();
  const weeksData: DailyRate[][] = [];

  for (let w = 3; w >= 0; w--) {
    const weekStart = startOfWeek(subDays(today, w * 7), { weekStartsOn: 1 });
    const week: DailyRate[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = format(addDays(weekStart, d), 'yyyy-MM-dd');
      week.push(
        days.find((day) => day.date === dateStr) ?? {
          date: dateStr,
          scheduled: 0,
          completed: 0,
          pct: 0,
        },
      );
    }
    weeksData.push(week);
  }

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-4">
        Weekly Heatmap
      </Text>
      {/* Day headers */}
      <View className="flex-row mb-1">
        {HEATMAP_DAYS.map((d, i) => (
          <Text
            key={`hd-${i}`}
            className="flex-1 font-inter text-neutral-400 text-center"
            style={{ fontSize: 10 }}
          >
            {d}
          </Text>
        ))}
      </View>
      {weeksData.map((week, wi) => (
        <View key={`week-${wi}`} className="flex-row gap-1 mb-1">
          {week.map((day) => {
            const future = new Date(day.date) > today;
            const cellColor = future
              ? 'bg-neutral-50'
              : day.scheduled === 0
                ? 'bg-[#F5F0FF]'
                : day.pct >= 80
                  ? 'bg-accent-success'
                  : day.pct >= 50
                    ? 'bg-accent-warning'
                    : 'bg-accent-danger';
            return (
              <View
                key={day.date}
                className={`flex-1 rounded-sm ${cellColor}`}
                style={{ height: 24, opacity: future ? 0.3 : 1 }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Badge Timeline ───────────────────────────────────────────────────────────
function BadgeTimeline({ badges }: { badges: BadgeEarned[] }) {
  if (badges.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm items-center">
        <Text className="text-[40px] mb-2">🌟</Text>
        <Text className="font-inter font-semibold text-neutral-900 text-sm">No badges yet</Text>
        <Text className="font-inter text-neutral-500 text-xs mt-1 text-center">
          Keep completing routines to earn badges!
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-4">
        Badge Timeline
      </Text>
      {badges.map((badge, idx) => (
        <View
          key={badge.rewardId}
          className={`flex-row items-center py-3 ${idx < badges.length - 1 ? 'border-b border-neutral-100' : ''}`}
        >
          <Text style={{ fontSize: 28 }} className="mr-3">
            {badge.iconEmoji}
          </Text>
          <View className="flex-1">
            <Text className="font-inter font-semibold text-neutral-900 text-sm">{badge.name}</Text>
            <Text className="font-inter text-neutral-500 text-xs mt-0.5">{badge.description}</Text>
          </View>
          <Text className="font-inter text-neutral-400 text-xs ml-2">
            {format(new Date(badge.earnedAt), 'd MMM')}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const router = useRouter();
  const { activeChild } = useParentStore();
  const childId = activeChild?.profile_id ?? null;
  const subscription = useSubscriptionStore((s) => s.subscription);
  const reportsAllowed = canAccessReports(subscription);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['reports', childId],
    queryFn: () => fetchReports(childId!),
    enabled: !!childId && reportsAllowed, // don't fetch what we can't show
    staleTime: 5 * 60_000,
  });

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Hard paywall — Free tier is locked out of Reports entirely.
  // Comes before the activeChild + loading guards because the tier
  // decision is independent of whether a child is selected.
  if (!reportsAllowed) {
    const req = requiredTierFor('canAccessReports');
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF]">
        <View className="px-5 pt-6 pb-4">
          <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
            Reports
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 56 }}>📊</Text>
          <Text className="font-inter font-bold text-neutral-900 text-xl text-center mt-4">
            Progress reports
          </Text>
          <Text className="font-inter text-neutral-600 text-sm text-center mt-2">
            Completion rates, weekly heatmaps, badge timelines, and streak history. Available on{' '}
            {req.tierName} ({req.priceDisplay}).
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(parent)/subscription')}
            className="bg-brand-primary rounded-2xl px-6 py-3 mt-6"
            accessibilityRole="button"
          >
            <Text className="font-inter font-semibold text-white text-sm">
              See {req.tierName} plan
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF] items-center justify-center px-6">
        <Text className="font-inter text-neutral-500 text-center text-sm">
          Select a child profile from the Dashboard first.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF] items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF] items-center justify-center px-6">
        <Text className="font-inter text-neutral-500 text-center">
          Could not load reports. Pull to retry.
        </Text>
        <TouchableOpacity className="mt-4" onPress={() => void refetch()}>
          <Text className="font-inter text-brand-primary font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0FF]">
      <View className="px-5 pt-6 pb-4">
        <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
          Reports
        </Text>
        <Text className="font-inter text-neutral-500 text-sm mt-0.5">
          {activeChild.child_name} · Last 30 days
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {/* Summary stats row */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm items-center">
            <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 28 }}>
              {data.totalStars.toLocaleString()}
            </Text>
            <Text className="font-inter text-neutral-500 text-xs mt-0.5">Total ⭐</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm items-center">
            <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 28 }}>
              {data.currentStreak}
            </Text>
            <Text className="font-inter text-neutral-500 text-xs mt-0.5">Day Streak 🔥</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm items-center">
            <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 28 }}>
              {data.earnedBadges.length}
            </Text>
            <Text className="font-inter text-neutral-500 text-xs mt-0.5">Badges 🏅</Text>
          </View>
        </View>

        <ZonesStrip days={data.zones7d} />
        <EnvironmentSplit split={data.envSplit7d} />
        <CompletionChart days={data.dailyRates} />
        <WeeklyHeatmap days={data.dailyRates} />
        <BadgeTimeline badges={data.earnedBadges} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Zones of Regulation 7-day strip ──────────────────────────────────────────
const ZONE_BG: Record<Zone, string> = {
  BLUE: '#BFDBFE',
  GREEN: '#BBF7D0',
  YELLOW: '#FEF08A',
  RED: '#FECACA',
};
const ZONE_EMOJI: Record<Zone, string> = {
  BLUE: '😴',
  GREEN: '🙂',
  YELLOW: '😬',
  RED: '😡',
};

function EnvironmentSplit({ split }: { split: { HOME: number; SCHOOL: number; RESPITE: number } }) {
  const total = split.HOME + split.SCHOOL + split.RESPITE;
  const rows: { label: string; emoji: string; count: number; color: string }[] = [
    { label: 'Home', emoji: '🏠', count: split.HOME, color: '#7C3AED' },
    { label: 'School', emoji: '🏫', count: split.SCHOOL, color: '#0EA5E9' },
    { label: 'Respite', emoji: '🌿', count: split.RESPITE, color: '#10B981' },
  ];

  return (
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-900 text-base mb-1">
        Where activities got done (last 7 days)
      </Text>
      <Text className="font-inter text-neutral-500 text-xs mb-3">
        Cross-environment activity. Helps you see if school is keeping pace with home.
      </Text>
      {total === 0 ? (
        <Text className="font-inter text-neutral-400 text-xs text-center py-4">
          No activity recorded this week yet.
        </Text>
      ) : (
        rows.map((row) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <View key={row.label} className="mb-3">
              <View className="flex-row justify-between mb-1">
                <Text className="font-inter text-neutral-700 text-sm">
                  {row.emoji} {row.label}
                </Text>
                <Text className="font-inter text-neutral-500 text-xs">
                  {row.count} · {pct}%
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: '#F3F4F6',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: row.color,
                  }}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function ZonesStrip({ days }: { days: { date: string; zone: Zone | null }[] }) {
  const hasAny = days.some((d) => d.zone !== null);

  return (
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-900 text-base mb-1">
        Feelings (last 7 days)
      </Text>
      <Text className="font-inter text-neutral-500 text-xs mb-3">
        How they ended each day, based on their own check-in.
      </Text>
      {!hasAny ? (
        <Text className="font-inter text-neutral-400 text-xs text-center py-4">
          No check-ins yet this week.
        </Text>
      ) : (
        <View className="flex-row justify-between">
          {days.map((d) => (
            <View key={d.date} className="items-center" style={{ flex: 1 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: d.zone ? ZONE_BG[d.zone] : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 18 }}>{d.zone ? ZONE_EMOJI[d.zone] : ''}</Text>
              </View>
              <Text className="font-inter text-neutral-400 text-[10px] mt-1">
                {format(new Date(d.date), 'EEEEE')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

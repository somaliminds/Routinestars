/**
 * Parent Dashboard — Sprint 3.1
 *
 * - Child profile switcher
 * - Today's completion rate card with animated progress bar
 * - Pending approvals banner
 * - 7-day week progress bar chart
 * - Pending approvals list
 *
 * Font: Inter (professional, not Nunito)
 */
import { useCallback, useEffect } from 'react';
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
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/auth.store';
import { useParentStore } from '@/stores/parent.store';
import {
  useParentChildren,
  useParentDashboard,
  type DayProgress,
} from '@/hooks/useParentDashboard';
import { useApprovalQueue, type PendingApproval } from '@/hooks/useApprovalQueue';
import type { ChildProfileRow } from '@/types/database';

// ── Child Switcher ───────────────────────────────────────────────────────────
function ChildSwitcher({
  children,
  activeChild,
  onSelect,
}: {
  children: ChildProfileRow[];
  activeChild: ChildProfileRow | null;
  onSelect: (c: ChildProfileRow) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
      <View className="flex-row gap-3 px-5">
        {children.map((child) => {
          const active = child.profile_id === activeChild?.profile_id;
          return (
            <TouchableOpacity
              key={child.profile_id}
              className={`flex-row items-center rounded-2xl px-4 py-3 border-2 ${
                active ? 'bg-brand-primary border-brand-primary' : 'bg-white border-neutral-200'
              }`}
              style={{ minWidth: 120 }}
              onPress={() => onSelect(child)}
              accessibilityLabel={`View ${child.child_name}`}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 22 }} className="mr-2">
                {child.avatar_emoji ?? '👤'}
              </Text>
              <Text
                className={`font-inter font-semibold text-sm ${active ? 'text-white' : 'text-neutral-900'}`}
                numberOfLines={1}
              >
                {child.child_name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Completion Rate Card ─────────────────────────────────────────────────────
function CompletionRateCard({
  scheduled,
  completed,
  pct,
}: {
  scheduled: number;
  completed: number;
  pct: number;
}) {
  const barColor =
    pct >= 80 ? 'bg-accent-success' : pct >= 50 ? 'bg-accent-warning' : 'bg-accent-danger';
  const textColor =
    pct >= 80 ? 'text-accent-success' : pct >= 50 ? 'text-accent-warning' : 'text-accent-danger';

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-3">
        Today's Progress
      </Text>
      <View className="flex-row items-end justify-between mb-3">
        <Text className={`font-inter font-bold ${textColor}`} style={{ fontSize: 48 }}>
          {scheduled === 0 ? '—' : `${pct}%`}
        </Text>
        <Text className="font-inter text-neutral-500 text-sm mb-2">
          {completed}/{scheduled} sets done
        </Text>
      </View>
      <View className="h-3 bg-[#F5F0FF] rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.max(pct, scheduled === 0 ? 0 : 3)}%` }}
        />
      </View>
      {scheduled === 0 && (
        <Text className="font-inter text-neutral-400 text-xs mt-2">
          No activities scheduled for today
        </Text>
      )}
    </View>
  );
}

// ── Week Progress Chart ──────────────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeekProgressChart({ days }: { days: DayProgress[] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
      <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-4">
        This Week
      </Text>
      <View className="flex-row justify-between items-end" style={{ height: 80 }}>
        {days.map((day, idx) => {
          const isToday = day.date === todayStr;
          const barPct = day.scheduled === 0 ? 0 : day.pct;
          const barColor =
            day.scheduled === 0
              ? 'bg-[#F5F0FF]'
              : barPct >= 80
                ? 'bg-accent-success'
                : barPct >= 50
                  ? 'bg-accent-warning'
                  : 'bg-accent-danger';

          return (
            <View key={day.date} className="flex-1 items-center">
              {day.scheduled > 0 && (
                <Text className="font-inter text-neutral-400 mb-1" style={{ fontSize: 9 }}>
                  {barPct}%
                </Text>
              )}
              <View
                className="w-full bg-[#F5F0FF] rounded-t-sm overflow-hidden"
                style={{ height: 56 }}
              >
                <View
                  className={`w-full rounded-t-sm ${barColor} absolute bottom-0`}
                  style={{
                    height: `${Math.max(barPct, day.scheduled === 0 ? 0 : 4)}%`,
                  }}
                />
              </View>
              <Text
                className={`font-inter mt-1 ${isToday ? 'text-brand-primary font-semibold' : 'text-neutral-400'}`}
                style={{ fontSize: 11 }}
              >
                {DAY_LABELS[idx]}
              </Text>
              {isToday && <View className="w-1 h-1 rounded-full bg-brand-primary mt-0.5" />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Pending Approval Row ─────────────────────────────────────────────────────
function PendingApprovalRow({ item, onPress }: { item: PendingApproval; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
      onPress={onPress}
      accessibilityLabel={`Review ${item.childName} ${item.setName}`}
      accessibilityRole="button"
    >
      <Text style={{ fontSize: 30 }} className="mr-3">
        {item.iconEmoji}
      </Text>
      <View className="flex-1">
        <Text className="font-inter font-semibold text-neutral-900 text-sm" numberOfLines={1}>
          {item.setName}
        </Text>
        <Text className="font-inter text-neutral-500 text-xs mt-0.5">
          {item.childName} ·{' '}
          {new Date(item.completedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <View className="flex-row items-center bg-accent-star/10 rounded-xl px-3 py-1 mr-2">
        <Text className="text-xs mr-1">⭐</Text>
        <Text className="font-inter font-semibold text-neutral-900 text-xs">
          {item.starsEarned}
        </Text>
      </View>
      <View className="bg-accent-warning/10 rounded-lg px-2 py-1">
        <Text className="font-inter font-semibold text-accent-warning text-xs">Review</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;
  const { activeChild, setActiveChild } = useParentStore();

  const { data: children, isLoading: childrenLoading } = useParentChildren(userId);
  const {
    data: dashboard,
    isLoading: dashLoading,
    refetch,
    isRefetching,
  } = useParentDashboard(userId, activeChild?.profile_id ?? null);
  const { data: approvals, refetch: refetchApprovals } = useApprovalQueue(userId);

  // Auto-select first child on load
  useEffect(() => {
    if (!activeChild && children && children.length > 0) {
      setActiveChild(children[0]!);
    }
  }, [children, activeChild, setActiveChild]);

  const onRefresh = useCallback(() => {
    void refetch();
    void refetchApprovals();
  }, [refetch, refetchApprovals]);

  if (childrenLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF] items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  const pendingApprovals = approvals ?? [];

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0FF]">
      {/* Header */}
      <View className="px-5 pt-6 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
            Dashboard
          </Text>
          <Text className="font-inter text-neutral-500 text-sm mt-0.5">
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(child)/select-profile')}
          className="bg-brand-light border border-brand-primary/30 rounded-xl px-3 py-2 flex-row items-center"
          accessibilityLabel="Launch child app"
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 16 }} className="mr-1">👦</Text>
          <Text className="font-inter font-semibold text-brand-primary text-xs">Child App</Text>
        </TouchableOpacity>
      </View>

      {/* Child Switcher */}
      {children && children.length > 0 ? (
        <ChildSwitcher children={children} activeChild={activeChild} onSelect={setActiveChild} />
      ) : (
        <View className="mx-5 mb-4 bg-brand-light rounded-2xl p-4">
          <Text className="font-inter text-neutral-600 text-sm text-center">
            No child profiles yet — add one in Settings
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {/* Pending approvals banner */}
        {pendingApprovals.length > 0 && (
          <TouchableOpacity
            className="bg-accent-warning/10 border border-accent-warning/30 rounded-2xl p-4 mb-4 flex-row items-center"
            onPress={() => router.push(`/(parent)/approve/${pendingApprovals[0]!.completionId}`)}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 26 }} className="mr-3">
              🔔
            </Text>
            <View className="flex-1">
              <Text className="font-inter font-semibold text-neutral-900 text-sm">
                {pendingApprovals.length}{' '}
                {pendingApprovals.length === 1 ? 'activity needs' : 'activities need'} your approval
              </Text>
              <Text className="font-inter text-neutral-500 text-xs mt-0.5">Tap to review</Text>
            </View>
            <Text className="font-inter text-neutral-400 text-lg">›</Text>
          </TouchableOpacity>
        )}

        {/* Stats for active child */}
        {activeChild &&
          (dashLoading ? (
            <View className="bg-white rounded-2xl p-5 mb-4 items-center">
              <ActivityIndicator color="#7C3AED" />
            </View>
          ) : dashboard ? (
            <>
              <CompletionRateCard
                scheduled={dashboard.todayScheduled}
                completed={dashboard.todayCompleted}
                pct={dashboard.todayPct}
              />
              <WeekProgressChart days={dashboard.weekProgress} />
            </>
          ) : null)}

        {/* Pending approvals list */}
        {pendingApprovals.length > 0 && (
          <>
            <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-3">
              Needs Your Approval
            </Text>
            {pendingApprovals.map((item) => (
              <PendingApprovalRow
                key={item.completionId}
                item={item}
                onPress={() => router.push(`/(parent)/approve/${item.completionId}`)}
              />
            ))}
          </>
        )}

        {/* All caught up */}
        {pendingApprovals.length === 0 && !dashLoading && (
          <View className="items-center py-8">
            <Text className="text-[40px] mb-2">✅</Text>
            <Text className="font-inter font-semibold text-neutral-900 text-base text-center">
              All caught up!
            </Text>
            <Text className="font-inter text-neutral-500 text-sm text-center mt-1">
              No activities waiting for review.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

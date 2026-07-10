/**
 * Weekly Schedule Builder — Sprint 3.2
 *
 * Parent builds the child's week schedule:
 * - Week navigation (prev/next)
 * - 7-day tab selector (Mon–Sun) with dot indicators for days with items
 * - Day view: ordered list of scheduled sets with start time + duration
 * - Add Activity modal: browse activity palette, set start time, toggle approval
 * - Conflict detection: error if time overlaps existing set
 * - Remove sets with confirm dialog
 *
 * Spec: Section 5.2 — Weekly Schedule Builder
 */
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addWeeks, subWeeks, format } from 'date-fns';
import { useAuthStore } from '@/stores/auth.store';
import { useParentStore } from '@/stores/parent.store';
import {
  useWeekSchedule,
  useActivitySets,
  useScheduleMutations,
  getWeekStart,
  type ScheduledSetDetail,
} from '@/hooks/useWeekSchedule';
import type { ActivitySetRow } from '@/types/database';
import { useResponsive } from '@/hooks/useResponsive';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Time Picker ──────────────────────────────────────────────────────────────
// +/- stepper approach — no keyboard, no TextInput, works perfectly in Modals.
// Minute steps in 5-min increments to keep the UI clean.
const MINUTE_STEP = 5;

function TimePicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const parts = value.split(':');
  const [hour, setHour] = useState(parseInt(parts[0] ?? '8', 10));
  const [minute, setMinute] = useState(
    Math.round(parseInt(parts[1] ?? '0', 10) / MINUTE_STEP) * MINUTE_STEP,
  );

  const emit = (h: number, m: number) => {
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const changeHour = (delta: number) => {
    const next = (hour + delta + 24) % 24;
    setHour(next);
    emit(next, minute);
  };

  const changeMinute = (delta: number) => {
    const next = (minute + delta * MINUTE_STEP + 60) % 60;
    setMinute(next);
    emit(hour, next);
  };

  const StepButton = ({
    label,
    onPress,
    accessibilityLabel: al,
  }: {
    label: string;
    onPress: () => void;
    accessibilityLabel: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={al}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 20, color: '#7C3AED', fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {/* Hour column */}
      <View style={{ alignItems: 'center', gap: 6 }}>
        <StepButton label="▲" onPress={() => changeHour(1)} accessibilityLabel="Increase hour" />
        <View
          style={{
            width: 64,
            height: 48,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: '#7C3AED',
            backgroundColor: '#F5F3FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, color: '#111827', fontFamily: 'Inter_600SemiBold' }}>
            {String(hour).padStart(2, '0')}
          </Text>
        </View>
        <StepButton label="▼" onPress={() => changeHour(-1)} accessibilityLabel="Decrease hour" />
      </View>

      <Text
        style={{ fontSize: 24, color: '#111827', fontFamily: 'Inter_600SemiBold', marginBottom: 2 }}
      >
        :
      </Text>

      {/* Minute column */}
      <View style={{ alignItems: 'center', gap: 6 }}>
        <StepButton
          label="▲"
          onPress={() => changeMinute(1)}
          accessibilityLabel="Increase minute"
        />
        <View
          style={{
            width: 64,
            height: 48,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: '#7C3AED',
            backgroundColor: '#F5F3FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, color: '#111827', fontFamily: 'Inter_600SemiBold' }}>
            {String(minute).padStart(2, '0')}
          </Text>
        </View>
        <StepButton
          label="▼"
          onPress={() => changeMinute(-1)}
          accessibilityLabel="Decrease minute"
        />
      </View>

      {/* AM/PM display (informational) */}
      <View
        style={{
          backgroundColor: hour < 12 ? '#D1FAE5' : '#EDE9FE',
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginLeft: 4,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Inter_600SemiBold',
            color: hour < 12 ? '#065F46' : '#5B21B6',
          }}
        >
          {hour < 12 ? 'AM' : 'PM'}
        </Text>
      </View>
    </View>
  );
}

// ── Scheduled Set Row ────────────────────────────────────────────────────────
function ScheduledSetRow({ item, onRemove }: { item: ScheduledSetDetail; onRemove: () => void }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-2 flex-row items-center shadow-sm">
      <Text style={{ fontSize: 28 }} className="mr-3">
        {item.iconEmoji}
      </Text>
      <View className="flex-1">
        <Text className="font-inter font-semibold text-neutral-900 text-sm" numberOfLines={1}>
          {item.setName}
        </Text>
        <Text className="font-inter text-neutral-500 text-xs mt-0.5">
          {item.startTime} · {item.durationMins} min
          {item.requiresApproval ? ' · ✓ Approval' : ''}
        </Text>
      </View>
      <View
        className={`rounded-lg px-2 py-1 mr-2 ${
          item.status === 'PENDING' ? 'bg-[#F7F8FC]' : 'bg-accent-success/10'
        }`}
      >
        <Text
          className={`font-inter text-xs font-semibold ${
            item.status === 'PENDING' ? 'text-neutral-500' : 'text-accent-success'
          }`}
        >
          {item.status}
        </Text>
      </View>
      <TouchableOpacity
        className="w-8 h-8 bg-accent-danger/10 rounded-full items-center justify-center"
        onPress={onRemove}
        accessibilityLabel={`Remove ${item.setName}`}
        accessibilityRole="button"
      >
        <Text className="text-accent-danger font-inter font-bold">×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Add Activity Modal ───────────────────────────────────────────────────────
function AddActivityModal({
  visible,
  activitySets,
  existingSets,
  isAdding,
  onAdd,
  onClose,
}: {
  visible: boolean;
  activitySets: ActivitySetRow[];
  existingSets: ScheduledSetDetail[];
  isAdding: boolean;
  onAdd: (setId: string, startTime: string, requiresApproval: boolean) => void;
  onClose: () => void;
}) {
  const [selectedSet, setSelectedSet] = useState<ActivitySetRow | null>(null);
  const [startTime, setStartTime] = useState('08:00');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [conflictMsg, setConflictMsg] = useState('');

  const handleAdd = useCallback(() => {
    if (!selectedSet) return;

    const dur = selectedSet.total_duration_mins ?? 15;
    const parts = startTime.split(':');
    const sh = parseInt(parts[0] ?? '0', 10);
    const sm = parseInt(parts[1] ?? '0', 10);
    const startMin = sh * 60 + sm;
    const endMin = startMin + dur;

    const conflict = existingSets.find((s) => {
      const ep = s.startTime.split(':');
      const exStart = parseInt(ep[0] ?? '0', 10) * 60 + parseInt(ep[1] ?? '0', 10);
      const exEnd = exStart + s.durationMins;
      return startMin < exEnd && endMin > exStart;
    });

    if (conflict) {
      setConflictMsg(`Overlaps with "${conflict.setName}" at ${conflict.startTime}`);
      return;
    }

    setConflictMsg('');
    onAdd(selectedSet.set_id, startTime, requiresApproval || selectedSet.requires_approval);
    setSelectedSet(null);
    setStartTime('08:00');
    setRequiresApproval(false);
  }, [selectedSet, startTime, requiresApproval, existingSets, onAdd]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#F7F8FC]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200 bg-white">
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text className="font-inter text-neutral-500 text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="font-inter font-semibold text-neutral-900 text-base">Add Activity</Text>
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!selectedSet || isAdding}
            accessibilityRole="button"
          >
            <Text
              className={`font-inter font-semibold text-base ${
                selectedSet && !isAdding ? 'text-brand-primary' : 'text-neutral-300'
              }`}
            >
              {isAdding ? '...' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time + approval settings */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4 mb-4">
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-3">
            Start Time
          </Text>
          <TimePicker value={startTime} onChange={setStartTime} />

          <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-neutral-100">
            <Text className="font-inter text-neutral-700 text-sm">Requires Parent Approval</Text>
            <TouchableOpacity
              className={`rounded-full items-center justify-center ${
                requiresApproval ? 'bg-brand-primary' : 'bg-neutral-300'
              }`}
              style={{ width: 48, height: 28 }}
              onPress={() => setRequiresApproval((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: requiresApproval }}
            >
              <View
                className="w-5 h-5 rounded-full bg-white shadow-sm"
                style={{ marginLeft: requiresApproval ? 10 : -10 }}
              />
            </TouchableOpacity>
          </View>

          {conflictMsg ? (
            <View className="bg-accent-danger/10 rounded-xl px-3 py-2 mt-3">
              <Text className="font-inter text-accent-danger text-sm">⚠ {conflictMsg}</Text>
            </View>
          ) : null}
        </View>

        <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-2 px-4">
          Choose Activity
        </Text>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 128 }}>
          {activitySets.map((set) => {
            const active = selectedSet?.set_id === set.set_id;
            return (
              <TouchableOpacity
                key={set.set_id}
                className={`flex-row items-center rounded-2xl p-4 mb-2 border-2 ${
                  active ? 'bg-brand-light border-brand-primary' : 'bg-white border-neutral-200'
                }`}
                onPress={() => setSelectedSet(set)}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 28 }} className="mr-3">
                  {set.icon_emoji}
                </Text>
                <View className="flex-1">
                  <Text className="font-inter font-semibold text-neutral-900 text-sm">
                    {set.set_name}
                  </Text>
                  <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                    {set.total_duration_mins ?? 15} min
                    {set.requires_approval ? ' · Approval required' : ''}
                  </Text>
                </View>
                {active && (
                  <Text className="text-brand-primary font-inter font-bold text-lg">✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? '';
  const { activeChild } = useParentStore();
  const childId = activeChild?.profile_id ?? null;
  const r = useResponsive();

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [activeDayIdx, setActiveDayIdx] = useState(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  });
  const [addModalVisible, setAddModalVisible] = useState(false);

  const queryClient = useQueryClient();
  const { data: weekData, isLoading } = useWeekSchedule(childId, weekStart);
  const { data: activitySets } = useActivitySets(userId);
  const { addSet, removeSet } = useScheduleMutations(childId, weekStart);

  const activeDay = weekData?.days[activeDayIdx];

  const handleAddSet = useCallback(
    (setId: string, startTime: string, requiresApproval: boolean) => {
      if (!childId || !activeDay) return;
      addSet.mutate(
        {
          childId,
          parentId: userId,
          date: activeDay.date,
          setId,
          startTime,
          requiresApproval,
          existingSets: activeDay.sets,
        },
        {
          onError: (err) => {
            Alert.alert('Conflict Detected', err instanceof Error ? err.message : 'Time conflict');
          },
          onSuccess: () => {
            setAddModalVisible(false);
            // Invalidate child schedule cache so it appears immediately on child home
            void queryClient.invalidateQueries({ queryKey: ['child-schedule', childId] });
          },
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryClient is stable
    [childId, userId, activeDay, addSet],
  );

  const handleRemove = useCallback(
    (scheduledSetId: string, setName: string) => {
      Alert.alert('Remove Activity', `Remove "${setName}" from this day?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeSet.mutate(scheduledSetId),
        },
      ]);
    },
    [removeSet],
  );

  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F8FC] items-center justify-center px-6">
        <Text className="font-inter text-neutral-500 text-center text-sm">
          Select a child profile from the Dashboard first.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
      {/* Header */}
      <View className="px-5 pt-6 pb-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => setWeekStart((w) => subWeeks(w, 1))}
          className="w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <Text className="font-inter text-neutral-500 text-lg">‹</Text>
        </TouchableOpacity>

        <View className="items-center">
          <Text className="font-inter font-bold text-neutral-900 text-lg">
            {activeChild.child_name}
          </Text>
          <Text className="font-inter text-neutral-500 text-xs">
            {format(weekStart, 'd MMM')} – {format(addWeeks(weekStart, 1), 'd MMM yyyy')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setWeekStart((w) => addWeeks(w, 1))}
          className="w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Text className="font-inter text-neutral-500 text-lg">›</Text>
        </TouchableOpacity>
      </View>

      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row px-5 gap-2 pb-3">
          {DAY_LABELS.map((label, idx) => {
            const day = weekData?.days[idx];
            const active = idx === activeDayIdx;
            const hasItems = (day?.sets.length ?? 0) > 0;
            return (
              <TouchableOpacity
                key={`${label}-${idx}`}
                className={`rounded-2xl px-4 py-2 items-center border-2 ${
                  active ? 'bg-brand-primary border-brand-primary' : 'bg-white border-neutral-200'
                }`}
                style={{ minWidth: 56 }}
                onPress={() => setActiveDayIdx(idx)}
                accessibilityRole="tab"
              >
                <Text
                  className={`font-inter font-semibold text-sm ${
                    active ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  {label}
                </Text>
                {hasItems && (
                  <View
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      active ? 'bg-white/70' : 'bg-brand-primary'
                    }`}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Day content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: r.scrollClearance + 72 }}
        >
          {activeDay && activeDay.sets.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-[40px] mb-3">📅</Text>
              <Text className="font-inter font-semibold text-neutral-900 text-base text-center">
                Nothing scheduled
              </Text>
              <Text className="font-inter text-neutral-500 text-sm text-center mt-1">
                Tap + to add an activity for {activeDay.dayLabel}
              </Text>
            </View>
          ) : (
            activeDay?.sets.map((item) => (
              <ScheduledSetRow
                key={item.scheduledSetId}
                item={item}
                onRemove={() => handleRemove(item.scheduledSetId, item.setName)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Floating "Add Activity" CTA — sits ABOVE the floating tab bar */}
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: r.scrollClearance - 12,
          paddingTop: 8,
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={{
            height: 56,
            borderRadius: 18,
            backgroundColor: '#7C3AED',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#5B21B6',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.28,
            shadowRadius: 16,
            elevation: 8,
          }}
          onPress={() => setAddModalVisible(true)}
          accessibilityLabel="Add activity"
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 16 }}>
            + Add Activity
          </Text>
        </TouchableOpacity>
      </View>

      <AddActivityModal
        visible={addModalVisible}
        activitySets={activitySets ?? []}
        existingSets={activeDay?.sets ?? []}
        isAdding={addSet.isPending}
        onAdd={handleAddSet}
        onClose={() => setAddModalVisible(false)}
      />
    </SafeAreaView>
  );
}

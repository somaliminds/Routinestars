import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import type { ScheduledSetRow } from '@/types/database';

interface TimelineSet extends Pick<
  ScheduledSetRow,
  'scheduled_set_id' | 'status' | 'start_time' | 'end_time' | 'order_in_day'
> {
  setName: string;
  iconEmoji: string;
  colourTheme: string;
}

interface ScheduleTimelineProps {
  scheduledSets: TimelineSet[];
  onSetPress?: (scheduledSetId: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-neutral-100 border-2 border-neutral-500',
  IN_PROGRESS: 'bg-brand-primary',
  PAUSED: 'bg-accent-warning',
  AWAITING_APPROVAL: 'bg-accent-star',
  APPROVED: 'bg-accent-success',
  LOCKED: 'bg-accent-success',
  SKIPPED: 'bg-neutral-100',
};

/**
 * ScheduleTimeline — vertical timeline of today's activity sets.
 * Used on the child home screen.
 * Full drag-and-drop builder version built in Sprint 3.2.
 */
export function ScheduleTimeline({
  scheduledSets,
  onSetPress,
  isLoading = false,
  emptyMessage = 'No activities scheduled today',
}: ScheduleTimelineProps) {
  if (isLoading) {
    return (
      <View className="gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className="h-[80px] bg-neutral-200 rounded-2xl" />
        ))}
      </View>
    );
  }

  if (scheduledSets.length === 0) {
    return (
      <View className="py-10 items-center">
        <Text className="text-[48px] mb-3">📅</Text>
        <Text className="text-body font-nunito text-neutral-500 text-center">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {scheduledSets
        .sort((a, b) => a.order_in_day - b.order_in_day)
        .map((set, index) => {
          const isLocked = set.status === 'LOCKED';
          const isActive = set.status === 'IN_PROGRESS' || set.status === 'PENDING';

          return (
            <View key={set.scheduled_set_id} className="flex-row mb-3">
              {/* Timeline connector */}
              <View className="items-center mr-3 pt-3">
                <View
                  className={`w-4 h-4 rounded-full ${STATUS_DOT[set.status] ?? 'bg-neutral-100'}`}
                />
                {index < scheduledSets.length - 1 && (
                  <View className="w-0.5 flex-1 bg-neutral-100 mt-1" />
                )}
              </View>

              {/* Set card */}
              <TouchableOpacity
                className={`flex-1 flex-row items-center rounded-2xl px-4 py-3 min-h-[72px] ${
                  isLocked ? 'bg-accent-success/10' : 'bg-white'
                }`}
                onPress={() => isActive && onSetPress?.(set.scheduled_set_id)}
                disabled={!isActive}
                accessibilityLabel={`${set.setName}, ${set.status.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !isActive }}
              >
                <Text className="text-[32px] mr-3">{isLocked ? '✅' : set.iconEmoji}</Text>
                <View className="flex-1">
                  <Text
                    className={`font-nunito-bold ${isLocked ? 'text-accent-success' : 'text-neutral-900'}`}
                    style={{ fontSize: 18 }}
                  >
                    {set.setName}
                  </Text>
                  <Text className="text-caption font-nunito text-neutral-500">
                    {set.start_time}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
    </ScrollView>
  );
}

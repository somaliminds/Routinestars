/**
 * useWeekSchedule — Sprint 3.2
 *
 * Fetches and manages the weekly schedule for a child:
 * - The 7 day_schedule rows for Mon–Sun of the current week
 * - All scheduled_sets with their activity_set details per day
 * - All available activity_sets for the palette
 *
 * Provides mutations to add, move, and remove scheduled sets.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { ActivitySetRow } from '@/types/database';

export interface ScheduledSetDetail {
  scheduledSetId: string;
  scheduleId: string;
  setId: string;
  setName: string;
  iconEmoji: string;
  startTime: string; // HH:MM
  durationMins: number;
  requiresApproval: boolean;
  status: string;
  orderInDay: number;
}

export interface DayScheduleData {
  date: string; // yyyy-MM-dd
  dayLabel: string; // Mon, Tue…
  scheduleId: string | null;
  sets: ScheduledSetDetail[];
}

export interface WeekScheduleData {
  weekStart: string;
  days: DayScheduleData[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

async function fetchWeekSchedule(childId: string, weekStart: Date): Promise<WeekScheduleData> {
  const days: DayScheduleData[] = [];

  for (let i = 0; i < 7; i++) {
    const date = format(addDays(weekStart, i), 'yyyy-MM-dd');

    // Get or note missing day_schedule
    const { data: ds } = await supabase
      .from('day_schedules')
      .select('schedule_id')
      .eq('child_id', childId)
      .eq('schedule_date', date)
      .maybeSingle();

    if (!ds) {
      days.push({ date, dayLabel: DAY_LABELS[i]!, scheduleId: null, sets: [] });
      continue;
    }

    // Fetch scheduled_sets for this day
    const { data: scheduledSets } = await supabase
      .from('scheduled_sets')
      .select('scheduled_set_id, set_id, start_time, status, order_in_day')
      .eq('schedule_id', ds.schedule_id)
      .order('order_in_day');

    const sets: ScheduledSetDetail[] = [];

    for (const ss of scheduledSets ?? []) {
      const { data: actSet } = await supabase
        .from('activity_sets')
        .select('set_name, icon_emoji, total_duration_mins, requires_approval')
        .eq('set_id', ss.set_id)
        .single();

      if (actSet) {
        sets.push({
          scheduledSetId: ss.scheduled_set_id,
          scheduleId: ds.schedule_id,
          setId: ss.set_id,
          setName: actSet.set_name,
          iconEmoji: actSet.icon_emoji,
          startTime: (ss.start_time as string) ?? '08:00',
          durationMins: actSet.total_duration_mins ?? 15,
          requiresApproval: actSet.requires_approval,
          status: ss.status,
          orderInDay: ss.order_in_day,
        });
      }
    }

    days.push({ date, dayLabel: DAY_LABELS[i]!, scheduleId: ds.schedule_id, sets });
  }

  return {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    days,
  };
}

async function fetchActivitySets(parentId: string): Promise<ActivitySetRow[]> {
  const { data, error } = await supabase
    .from('activity_sets')
    .select('*')
    .or(`is_custom.eq.false,created_by_parent_id.eq.${parentId}`)
    .order('category')
    .order('set_name');
  if (error) throw error;
  return (data ?? []) as ActivitySetRow[];
}

interface AddSetParams {
  childId: string;
  parentId: string;
  date: string;
  setId: string;
  startTime: string;
  requiresApproval: boolean;
  existingSets: ScheduledSetDetail[];
}

async function addScheduledSet(params: AddSetParams): Promise<void> {
  const { childId, parentId, date, setId, startTime, requiresApproval, existingSets } = params;

  // Check for time conflict
  const { data: actSet } = await supabase
    .from('activity_sets')
    .select('total_duration_mins')
    .eq('set_id', setId)
    .single();

  const durationMins = actSet?.total_duration_mins ?? 15;
  const [startH, startM] = startTime.split(':').map(Number);
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = startMinutes + durationMins;

  for (const existing of existingSets) {
    const [exH, exM] = existing.startTime.split(':').map(Number);
    const exStart = (exH ?? 0) * 60 + (exM ?? 0);
    const exEnd = exStart + existing.durationMins;
    if (startMinutes < exEnd && endMinutes > exStart) {
      throw new Error(`Time conflict with "${existing.setName}"`);
    }
  }

  // Get or create day_schedule
  let scheduleId: string;
  const { data: existing } = await supabase
    .from('day_schedules')
    .select('schedule_id')
    .eq('child_id', childId)
    .eq('schedule_date', date)
    .maybeSingle();

  if (existing) {
    scheduleId = existing.schedule_id;
    // Ensure the schedule is published so the child can see it
    await supabase
      .from('day_schedules')
      .update({ is_published: true })
      .eq('schedule_id', scheduleId);
  } else {
    const dayOfWeek = new Date(date).getDay();
    const { data: newDs, error } = await supabase
      .from('day_schedules')
      .insert({
        child_id: childId,
        schedule_date: date,
        day_of_week: dayOfWeek,
        created_by: parentId,
        is_published: true,
      })
      .select('schedule_id')
      .single();
    if (error || !newDs) throw error ?? new Error('Could not create day schedule');
    scheduleId = newDs.schedule_id;
  }

  // Compute end_time from start + duration
  const endMinutesTotal = endMinutes;
  const endH = Math.floor(endMinutesTotal / 60)
    .toString()
    .padStart(2, '0');
  const endM = (endMinutesTotal % 60).toString().padStart(2, '0');
  const endTime = `${endH}:${endM}`;

  // Insert scheduled_set
  await supabase.from('scheduled_sets').insert({
    schedule_id: scheduleId,
    set_id: setId,
    start_time: startTime,
    end_time: endTime,
    status: 'PENDING',
    order_in_day: existingSets.length,
  });
  void requiresApproval; // stored on activity_sets, not scheduled_sets
}

async function removeScheduledSet(scheduledSetId: string): Promise<void> {
  await supabase.from('scheduled_sets').delete().eq('scheduled_set_id', scheduledSetId);
}

async function updateStartTime(scheduledSetId: string, startTime: string): Promise<void> {
  await supabase
    .from('scheduled_sets')
    .update({ start_time: startTime })
    .eq('scheduled_set_id', scheduledSetId);
}

export function useWeekSchedule(childId: string | null, weekStart: Date) {
  return useQuery({
    queryKey: ['weekSchedule', childId, format(weekStart, 'yyyy-MM-dd')],
    queryFn: () => fetchWeekSchedule(childId!, weekStart),
    enabled: !!childId,
  });
}

export function useActivitySets(parentId: string | null) {
  return useQuery({
    queryKey: ['activitySets', parentId],
    queryFn: () => fetchActivitySets(parentId!),
    enabled: !!parentId,
    staleTime: 5 * 60_000,
  });
}

export function useScheduleMutations(childId: string | null, weekStart: Date) {
  const queryClient = useQueryClient();
  const weekKey = format(weekStart, 'yyyy-MM-dd');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['weekSchedule', childId, weekKey] });

  const addSet = useMutation({
    mutationFn: addScheduledSet,
    onSuccess: invalidate,
  });

  const removeSet = useMutation({
    mutationFn: removeScheduledSet,
    onSuccess: invalidate,
  });

  const updateTime = useMutation({
    mutationFn: ({ id, time }: { id: string; time: string }) => updateStartTime(id, time),
    onSuccess: invalidate,
  });

  return { addSet, removeSet, updateTime };
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveScheduleCache, loadScheduleCache } from '@/lib/offline-db';
import type { ScheduledSetStatus } from '@/types/database';

export interface ScheduledSetWithDetails {
  scheduled_set_id: string;
  schedule_id: string;
  set_id: string;
  order_in_day: number;
  start_time: string;
  end_time: string;
  status: ScheduledSetStatus;
  updated_at: string;
  // Joined from activity_sets
  setName: string;
  iconEmoji: string;
  colourTheme: string;
  totalDurationMins: number;
  requiresApproval: boolean;
  // Computed: sum of reward_stars across all steps
  totalStars: number;
}

export interface TodaySchedule {
  schedule_id: string;
  child_id: string;
  schedule_date: string;
  is_published: boolean;
  scheduledSets: ScheduledSetWithDetails[];
}

async function fetchTodaySchedule(childId: string): Promise<TodaySchedule | null> {
  const today = format(new Date(), 'yyyy-MM-dd');

  try {
    // 1. Find today's schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('day_schedules')
      .select('schedule_id, child_id, schedule_date, is_published')
      .eq('child_id', childId)
      .eq('schedule_date', today)
      .maybeSingle();

    if (scheduleError) throw scheduleError;
    if (!schedule) {
      // No schedule today — cache null so offline also shows empty
      await saveScheduleCache(childId, today, null);
      return null;
    }

    // 2. Fetch scheduled_sets for this schedule
    const { data: sets, error: setsError } = await supabase
      .from('scheduled_sets')
      .select(
        'scheduled_set_id, schedule_id, set_id, order_in_day, start_time, end_time, status, updated_at',
      )
      .eq('schedule_id', schedule.schedule_id)
      .order('order_in_day');

    if (setsError) throw setsError;

    const rawSets = sets ?? [];
    const setIds = rawSets.map((s) => s.set_id);
    const safeSetIds = setIds.length > 0 ? setIds : ['__none__'];

    // 3. Fetch activity_sets details + star totals in parallel
    const [{ data: activitySets }, { data: starTotals }] = await Promise.all([
      supabase
        .from('activity_sets')
        .select(
          'set_id, set_name, icon_emoji, colour_theme, total_duration_mins, requires_approval',
        )
        .in('set_id', safeSetIds),
      supabase.from('steps').select('set_id, reward_stars').in('set_id', safeSetIds),
    ]);

    const actSetById: Record<
      string,
      {
        set_name: string;
        icon_emoji: string;
        colour_theme: string;
        total_duration_mins: number;
        requires_approval: boolean;
      }
    > = {};
    for (const a of activitySets ?? []) {
      actSetById[a.set_id] = a;
    }

    const starsBySetId: Record<string, number> = {};
    for (const step of starTotals ?? []) {
      starsBySetId[step.set_id] = (starsBySetId[step.set_id] ?? 0) + step.reward_stars;
    }

    const scheduledSets: ScheduledSetWithDetails[] = rawSets.map((s) => {
      const actSet = actSetById[s.set_id];
      return {
        scheduled_set_id: s.scheduled_set_id,
        schedule_id: s.schedule_id,
        set_id: s.set_id,
        order_in_day: s.order_in_day,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        updated_at: s.updated_at,
        setName: actSet?.set_name ?? 'Unknown Activity',
        iconEmoji: actSet?.icon_emoji ?? '📋',
        colourTheme: actSet?.colour_theme ?? 'brand.primary',
        totalDurationMins: actSet?.total_duration_mins ?? 0,
        requiresApproval: actSet?.requires_approval ?? false,
        totalStars: starsBySetId[s.set_id] ?? 0,
      };
    });

    const result: TodaySchedule = {
      schedule_id: schedule.schedule_id,
      child_id: schedule.child_id,
      schedule_date: schedule.schedule_date,
      is_published: schedule.is_published,
      scheduledSets,
    };

    // Save to offline cache on every successful fetch
    await saveScheduleCache(childId, today, result);
    return result;
  } catch {
    // Network or Supabase error — serve from cache
    const cached = await loadScheduleCache(childId, today);
    if (cached) return cached as TodaySchedule;
    return null;
  }
}

export function useChildSchedule(childId: string | null) {
  return useQuery({
    queryKey: ['child-schedule', childId, format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => fetchTodaySchedule(childId!),
    enabled: !!childId,
    staleTime: 30_000,
    // Return stale data while revalidating — improves offline UX
    placeholderData: (prev) => prev,
  });
}

/** Returns today's star total from completed + approved sets. */
export function useTodayStars(childId: string | null) {
  return useQuery({
    queryKey: ['today-stars', childId, format(new Date(), 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!childId) return 0;
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('completions')
        .select('stars_earned, started_at, parent_approved')
        .eq('child_id', childId)
        .gte('started_at', `${today}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`);

      if (error) throw error;
      return (data ?? []).reduce((sum, c) => sum + c.stars_earned, 0);
    },
    enabled: !!childId,
    staleTime: 30_000,
  });
}

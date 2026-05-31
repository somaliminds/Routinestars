/**
 * useParentDashboard — Sprint 3.1
 *
 * Fetches all data needed for the parent dashboard:
 *  1. All child profiles managed by this parent
 *  2. Today's completion rate for the active child
 *  3. 7-day week progress for the active child
 *  4. Pending approvals count
 */
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { ChildProfileRow } from '@/types/database';

export interface DayProgress {
  date: string; // yyyy-MM-dd
  scheduled: number;
  completed: number;
  pct: number;
}

export interface DashboardData {
  children: ChildProfileRow[];
  todayScheduled: number;
  todayCompleted: number;
  todayPct: number;
  weekProgress: DayProgress[];
  pendingApprovalsCount: number;
}

async function fetchChildren(parentId: string): Promise<ChildProfileRow[]> {
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('parent_id', parentId)
    .order('child_name');
  if (error) throw error;
  return (data ?? []) as ChildProfileRow[];
}

async function fetchDashboard(
  parentId: string,
  childId: string,
): Promise<Omit<DashboardData, 'children'>> {
  const today = format(new Date(), 'yyyy-MM-dd');

  // 1. Today's day_schedule
  const { data: todaySchedule } = await supabase
    .from('day_schedules')
    .select('schedule_id')
    .eq('child_id', childId)
    .eq('schedule_date', today)
    .maybeSingle();

  let todayScheduled = 0;
  let todayCompleted = 0;

  if (todaySchedule) {
    const { data: scheduledSets } = await supabase
      .from('scheduled_sets')
      .select('scheduled_set_id, status')
      .eq('schedule_id', todaySchedule.schedule_id);

    todayScheduled = scheduledSets?.length ?? 0;
    todayCompleted =
      scheduledSets?.filter((s) => s.status === 'APPROVED' || s.status === 'LOCKED').length ?? 0;
  }

  // 2. Week progress — last 7 days
  const weekProgress: DayProgress[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const { data: ds } = await supabase
      .from('day_schedules')
      .select('schedule_id')
      .eq('child_id', childId)
      .eq('schedule_date', date)
      .maybeSingle();

    if (ds) {
      const { data: sets } = await supabase
        .from('scheduled_sets')
        .select('status')
        .eq('schedule_id', ds.schedule_id);

      const scheduled = sets?.length ?? 0;
      const completed =
        sets?.filter((s) => s.status === 'APPROVED' || s.status === 'LOCKED').length ?? 0;
      weekProgress.push({
        date,
        scheduled,
        completed,
        pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
      });
    } else {
      weekProgress.push({ date, scheduled: 0, completed: 0, pct: 0 });
    }
  }

  // 3. Pending approvals count — all children for this parent
  const { data: allChildren } = await supabase
    .from('child_profiles')
    .select('profile_id')
    .eq('parent_id', parentId);

  const childIds = (allChildren ?? []).map((c) => c.profile_id);
  let pendingApprovalsCount = 0;

  if (childIds.length > 0) {
    const { count } = await supabase
      .from('completions')
      .select('*', { count: 'exact', head: true })
      .in('child_id', childIds)
      .eq('parent_approved', false)
      .not('completed_at', 'is', null);
    pendingApprovalsCount = count ?? 0;
  }

  return {
    todayScheduled,
    todayCompleted,
    todayPct: todayScheduled > 0 ? Math.round((todayCompleted / todayScheduled) * 100) : 0,
    weekProgress,
    pendingApprovalsCount,
  };
}

export function useParentChildren(parentId: string | null) {
  return useQuery({
    queryKey: ['parentChildren', parentId],
    queryFn: () => fetchChildren(parentId!),
    enabled: !!parentId,
    staleTime: 5 * 60_000,
  });
}

export function useParentDashboard(parentId: string | null, childId: string | null) {
  return useQuery({
    queryKey: ['parentDashboard', parentId, childId],
    queryFn: () => fetchDashboard(parentId!, childId!),
    enabled: !!parentId && !!childId,
    refetchInterval: 60_000,
  });
}

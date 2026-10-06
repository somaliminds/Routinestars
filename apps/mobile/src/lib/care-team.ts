/**
 * care-team.ts — data for the care-team app (Viewers and Approvers: the
 * grandparents, carers and therapists a parent invites from Settings).
 *
 * Everything is read under RLS (migration 053): an accepted Viewer/Approver can
 * read the linked child's profile, PUBLISHED schedules, scheduled activities
 * (+ set names), completions and badges — nothing of any other child. Every
 * fetch checks `.error` (postgrest returns errors instead of throwing).
 */
import { supabase } from './supabase';

export type CareRole = 'view_only' | 'approver';

export interface CareLink {
  childId: string;
  childName: string;
  avatarEmoji: string;
  totalStars: number;
  currentStreak: number;
  role: CareRole;
}

export interface DayActivity {
  scheduledSetId: string;
  setId: string;
  setName: string;
  iconEmoji: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface DaySummary {
  date: string; // YYYY-MM-DD
  total: number;
  done: number;
}

export interface EarnedBadge {
  rewardId: string;
  name: string;
  earnedAt: string;
}

// ── Pure helpers (unit-tested) ─────────────────────────────────────────────────

export function careRoleLabel(role: CareRole): string {
  return role === 'approver' ? 'Approver' : 'Viewer';
}

export type StatusTone = 'neutral' | 'active' | 'warning' | 'waiting' | 'done' | 'muted';

/** Plain-language label + colour tone for a scheduled activity's status. */
export function statusInfo(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case 'IN_PROGRESS':
      return { label: 'In progress', tone: 'active' };
    case 'PAUSED':
      return { label: 'Paused', tone: 'warning' };
    case 'AWAITING_APPROVAL':
      return { label: 'Waiting for approval', tone: 'waiting' };
    case 'APPROVED':
    case 'LOCKED':
      return { label: 'Done', tone: 'done' };
    case 'SKIPPED':
      return { label: 'Skipped', tone: 'muted' };
    default:
      return { label: 'Not started', tone: 'neutral' };
  }
}

export function isDone(status: string): boolean {
  return status === 'APPROVED' || status === 'LOCKED';
}

/** 'HH:MM:SS' → 'HH:MM'. */
export function shortTime(t: string): string {
  return t.slice(0, 5);
}

/** The n calendar days ending on `endDate` (YYYY-MM-DD), oldest first. */
export function lastNDays(endDate: string, n: number): string[] {
  const [y, m, d] = endDate.split('-').map(Number);
  const end = Date.UTC(y!, m! - 1, d!);
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

/** Done/total activities per day (days with nothing scheduled show 0/0). */
export function summariseWeek(
  days: string[],
  schedules: { schedule_id: string; schedule_date: string }[],
  sets: { schedule_id: string; status: string }[],
): DaySummary[] {
  const dateBySchedule = new Map(schedules.map((s) => [s.schedule_id, s.schedule_date]));
  const byDate = new Map(days.map((d) => [d, { date: d, total: 0, done: 0 }]));
  for (const s of sets) {
    const date = dateBySchedule.get(s.schedule_id);
    const row = date ? byDate.get(date) : undefined;
    if (!row) continue;
    row.total += 1;
    if (isDone(s.status)) row.done += 1;
  }
  return days.map((d) => byDate.get(d)!);
}

/** Join care-team memberships to the children they're for (pure). */
export function joinCareLinks(
  members: { child_id: string; role: string }[],
  children: {
    profile_id: string;
    child_name: string;
    avatar_emoji: string | null;
    total_stars: number | null;
    current_streak: number | null;
  }[],
): CareLink[] {
  const roleByChild = new Map(members.map((m) => [m.child_id, m.role]));
  return children
    .filter((c) => roleByChild.has(c.profile_id))
    .map(
      (c): CareLink => ({
        childId: c.profile_id,
        childName: c.child_name,
        avatarEmoji: c.avatar_emoji ?? '🙂',
        totalStars: c.total_stars ?? 0,
        currentStreak: c.current_streak ?? 0,
        role: roleByChild.get(c.profile_id) === 'approver' ? 'approver' : 'view_only',
      }),
    )
    .sort((a, b) => a.childName.localeCompare(b.childName));
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

/** The children shared with this email (accepted Viewer/Approver links). */
export async function fetchCareLinks(email: string): Promise<CareLink[]> {
  const { data: members, error } = await supabase
    .from('care_team_members')
    .select('child_id, role')
    .eq('email', email.trim().toLowerCase())
    .in('role', ['view_only', 'approver'])
    .not('accepted_at', 'is', null);
  if (error) throw error;
  if (!members || members.length === 0) return [];

  const { data: children, error: childErr } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name, avatar_emoji, total_stars, current_streak')
    .in(
      'profile_id',
      members.map((m) => m.child_id),
    );
  if (childErr) throw childErr;
  return joinCareLinks(members, children ?? []);
}

/** A child's published activities for one day, in time order. */
export async function fetchChildDay(childId: string, date: string): Promise<DayActivity[]> {
  const { data: schedules, error } = await supabase
    .from('day_schedules')
    .select('schedule_id')
    .eq('child_id', childId)
    .eq('schedule_date', date)
    .eq('is_published', true);
  if (error) throw error;
  if (!schedules || schedules.length === 0) return [];

  const { data: sets, error: setErr } = await supabase
    .from('scheduled_sets')
    .select('scheduled_set_id, set_id, start_time, end_time, status')
    .in(
      'schedule_id',
      schedules.map((s) => s.schedule_id),
    )
    .order('start_time');
  if (setErr) throw setErr;
  if (!sets || sets.length === 0) return [];

  const { data: acts, error: actErr } = await supabase
    .from('activity_sets')
    .select('set_id, set_name, icon_emoji')
    .in('set_id', [...new Set(sets.map((s) => s.set_id))]);
  if (actErr) throw actErr;
  const actById = new Map((acts ?? []).map((a) => [a.set_id, a]));

  return sets.map((s) => ({
    scheduledSetId: s.scheduled_set_id,
    setId: s.set_id,
    setName: actById.get(s.set_id)?.set_name ?? 'Activity',
    iconEmoji: actById.get(s.set_id)?.icon_emoji ?? '📋',
    startTime: s.start_time,
    endTime: s.end_time,
    status: s.status,
  }));
}

/** Done/total for each of the 7 days ending `endDate`. */
export async function fetchChildWeek(childId: string, endDate: string): Promise<DaySummary[]> {
  const days = lastNDays(endDate, 7);
  const { data: schedules, error } = await supabase
    .from('day_schedules')
    .select('schedule_id, schedule_date')
    .eq('child_id', childId)
    .eq('is_published', true)
    .gte('schedule_date', days[0]!)
    .lte('schedule_date', days[days.length - 1]!);
  if (error) throw error;
  if (!schedules || schedules.length === 0) return summariseWeek(days, [], []);

  const { data: sets, error: setErr } = await supabase
    .from('scheduled_sets')
    .select('schedule_id, status')
    .in(
      'schedule_id',
      schedules.map((s) => s.schedule_id),
    );
  if (setErr) throw setErr;
  return summariseWeek(days, schedules, sets ?? []);
}

/** Today's done/total for several children at once (home screen cards). */
export async function fetchTodayCounts(
  childIds: string[],
  date: string,
): Promise<Record<string, { total: number; done: number }>> {
  const out: Record<string, { total: number; done: number }> = {};
  for (const id of childIds) out[id] = { total: 0, done: 0 };
  if (childIds.length === 0) return out;

  const { data: schedules, error } = await supabase
    .from('day_schedules')
    .select('schedule_id, child_id')
    .in('child_id', childIds)
    .eq('schedule_date', date)
    .eq('is_published', true);
  if (error) throw error;
  if (!schedules || schedules.length === 0) return out;

  const { data: sets, error: setErr } = await supabase
    .from('scheduled_sets')
    .select('schedule_id, status')
    .in(
      'schedule_id',
      schedules.map((s) => s.schedule_id),
    );
  if (setErr) throw setErr;
  const childBySchedule = new Map(schedules.map((s) => [s.schedule_id, s.child_id]));
  for (const s of sets ?? []) {
    const childId = childBySchedule.get(s.schedule_id);
    const row = childId ? out[childId] : undefined;
    if (!row) continue;
    row.total += 1;
    if (isDone(s.status)) row.done += 1;
  }
  return out;
}

/** Badges the child has earned, newest first. */
export async function fetchChildBadges(childId: string): Promise<EarnedBadge[]> {
  const { data: earned, error } = await supabase
    .from('child_rewards')
    .select('reward_id, earned_at')
    .eq('child_id', childId)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  if (!earned || earned.length === 0) return [];

  const { data: rewards, error: rwErr } = await supabase
    .from('rewards')
    .select('reward_id, name')
    .in('reward_id', [...new Set(earned.map((e) => e.reward_id))]);
  if (rwErr) throw rwErr;
  const nameById = new Map((rewards ?? []).map((r) => [r.reward_id, r.name]));
  return earned.map((e) => ({
    rewardId: e.reward_id,
    name: nameById.get(e.reward_id) ?? 'Badge',
    earnedAt: e.earned_at,
  }));
}

/**
 * apdr.ts — Assess–Plan–Do–Review cycle persistence + live progress.
 *
 * The Graduated Approach (SEND Code 6.44–6.67; research §B) requires
 * schools to evidence APDR cycles. RoutineStars stores the narrative each
 * phase needs and auto-computes the quantitative "Do/Review" evidence —
 * completion % over the cycle's window — from live completion data, so the
 * "Do" and "Review" phases are backed by real, dated, quantified progress
 * (exactly the evidence LAs and the Tribunal rate as strong; §H1).
 */

import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type ApdrCycleRow = Database['public']['Tables']['apdr_cycles']['Row'];
export type ApdrCycleInsert = Database['public']['Tables']['apdr_cycles']['Insert'];
export type ApdrCycleUpdate = Database['public']['Tables']['apdr_cycles']['Update'];

export type ApdrDecision = 'CONTINUE' | 'MODIFY' | 'ESCALATE';
export type ApdrStatus = 'ASSESS' | 'PLAN' | 'DO' | 'REVIEW' | 'COMPLETE';

/** Live-computed progress for a cycle's Do window. */
export interface CycleProgress {
  scheduled: number;
  completed: number;
  completion_pct: number;
  has_window: boolean;
}

/** Fetch all cycles for an outcome, newest first. Resilient to the table
 *  not existing pre-migration (returns []). */
export async function fetchApdrCycles(outcomeId: string): Promise<ApdrCycleRow[]> {
  try {
    const { data, error } = await supabase
      .from('apdr_cycles')
      .select('*')
      .eq('outcome_id', outcomeId)
      .order('cycle_number', { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function createApdrCycle(input: ApdrCycleInsert): Promise<void> {
  const { error } = await supabase.from('apdr_cycles').insert(input);
  if (error) throw error;
}

export async function updateApdrCycle(cycleId: string, fields: ApdrCycleUpdate): Promise<void> {
  const { error } = await supabase.from('apdr_cycles').update(fields).eq('cycle_id', cycleId);
  if (error) throw error;
}

export async function deleteApdrCycle(cycleId: string): Promise<void> {
  const { error } = await supabase.from('apdr_cycles').delete().eq('cycle_id', cycleId);
  if (error) throw error;
}

/** Next cycle number for an outcome (1-based). */
export async function nextCycleNumber(outcomeId: string): Promise<number> {
  const cycles = await fetchApdrCycles(outcomeId);
  return cycles.reduce((max, c) => Math.max(max, c.cycle_number), 0) + 1;
}

/**
 * Compute live completion progress for a cycle's Do window, using the
 * activity sets tagged to the outcome. Mirrors the evidence-pack maths but
 * scoped to one outcome + one date window.
 */
export async function computeCycleProgress(
  outcomeId: string,
  childId: string,
  windowFrom: string | null,
  windowTo: string | null,
): Promise<CycleProgress> {
  const empty: CycleProgress = {
    scheduled: 0,
    completed: 0,
    completion_pct: 0,
    has_window: false,
  };
  if (!windowFrom || !windowTo) return empty;

  // Sets tagged to this outcome
  const { data: tags } = await supabase
    .from('activity_set_outcome_tags')
    .select('set_id')
    .eq('outcome_id', outcomeId);
  const setIds = (tags ?? []).map((t) => t.set_id as string);
  if (setIds.length === 0) return { ...empty, has_window: true };

  // Approved (or not-yet-decided) completions in the window
  const { data: completions } = await supabase
    .from('completions')
    .select('set_id, parent_approved')
    .eq('child_id', childId)
    .in('set_id', setIds)
    .gte('completed_at', `${windowFrom}T00:00:00`)
    .lte('completed_at', `${windowTo}T23:59:59`);
  const completed = (completions ?? []).filter((c) => c.parent_approved !== false).length;

  // Scheduled instances in the window
  const { data: scheduled } = await supabase
    .from('scheduled_sets')
    .select('set_id, day_schedules ( child_id, schedule_date )')
    .in('set_id', setIds);
  let scheduledCount = 0;
  for (const ss of scheduled ?? []) {
    const ds = (ss as { day_schedules: unknown }).day_schedules;
    const dsRow = Array.isArray(ds) ? ds[0] : ds;
    if (!dsRow) continue;
    const sd = dsRow as { child_id: string; schedule_date: string };
    if (sd.child_id !== childId) continue;
    if (sd.schedule_date < windowFrom || sd.schedule_date > windowTo) continue;
    scheduledCount++;
  }

  const completion_pct = scheduledCount > 0 ? Math.round((completed / scheduledCount) * 100) : 0;
  return { scheduled: scheduledCount, completed, completion_pct, has_window: true };
}

// ── Display helpers ──────────────────────────────────────────────────────────

export const APDR_PHASE_META: Record<ApdrStatus, { label: string; emoji: string; color: string }> =
  {
    ASSESS: { label: 'Assess', emoji: '🔍', color: '#0EA5E9' },
    PLAN: { label: 'Plan', emoji: '📝', color: '#7C3AED' },
    DO: { label: 'Do', emoji: '▶️', color: '#F59E0B' },
    REVIEW: { label: 'Review', emoji: '✅', color: '#10B981' },
    COMPLETE: { label: 'Complete', emoji: '🏁', color: '#6B7280' },
  };

export const APDR_DECISION_LABEL: Record<ApdrDecision, string> = {
  CONTINUE: 'Continue',
  MODIFY: 'Modify',
  ESCALATE: 'Escalate',
};

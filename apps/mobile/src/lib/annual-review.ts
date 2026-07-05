/**
 * annual-review.ts — persistence + helpers for the EHCP annual review.
 *
 * Stores the human-completed parts of the statutory annual review
 * (parent contribution, child's views, metadata, recommendation) so they
 * survive between sessions and flow into the generated Annual Review Pack.
 *
 * The auto-generated progress section still comes from live completion
 * data at export time (see ehcp-report.ts) — this module only handles the
 * parts a person types.
 *
 * Also computes the statutory "annual review due" date (12 months from the
 * last review, or from the EHCP issue date if no review yet) for the
 * timescale banner — CAFA 2014 s.44; SEND Regs 2014 reg.18.
 */

import { addMonths, differenceInCalendarDays, format } from 'date-fns';
import { supabase } from './supabase';
import type { Database } from '@/types/database';
import type { AnnualReviewInputs } from './ehcp-report';

export type AnnualReviewRow = Database['public']['Tables']['annual_reviews']['Row'];
export type AnnualReviewUpdate = Database['public']['Tables']['annual_reviews']['Update'];

/** Fetch the single review draft for a child (null if none yet). Resilient
 *  to the table not existing on older databases — returns null rather than
 *  throwing, so the UI degrades gracefully until migration 026 is applied. */
export async function fetchAnnualReview(childId: string): Promise<AnnualReviewRow | null> {
  try {
    const { data, error } = await supabase
      .from('annual_reviews')
      .select('*')
      .eq('child_id', childId)
      .maybeSingle();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

/** Upsert the review draft for a child (one row per child, child_id unique). */
export async function saveAnnualReview(childId: string, fields: AnnualReviewUpdate): Promise<void> {
  const { error } = await supabase
    .from('annual_reviews')
    .upsert({ child_id: childId, ...fields }, { onConflict: 'child_id' });
  if (error) throw error;
}

/** Map a stored row into the shape the PDF renderer expects. */
export function reviewRowToInputs(row: AnnualReviewRow | null): AnnualReviewInputs {
  if (!row) return {};
  return {
    ehcp_date_issued: row.ehcp_date_issued ?? undefined,
    review_date: row.review_date ?? undefined,
    review_chair: row.review_chair ?? undefined,
    attendees: row.attendees ? row.attendees.split(',').map((a) => a.trim()) : undefined,
    parent_contribution: {
      strengths_and_achievements: row.parent_strengths ?? undefined,
      progress_observed: row.parent_progress ?? undefined,
      concerns: row.parent_concerns ?? undefined,
      aspirations_next_year: row.parent_aspirations ?? undefined,
      requested_changes: row.parent_requested_changes ?? undefined,
    },
    child_views: {
      communication_method_used: row.child_communication_method ?? undefined,
      how_i_feel_about_my_support: row.child_how_i_feel ?? undefined,
      what_is_going_well: row.child_going_well ?? undefined,
      what_is_difficult: row.child_difficult ?? undefined,
      what_i_want_to_change: row.child_want_to_change ?? undefined,
      my_goals: row.child_goals ?? undefined,
    },
    recommendation: row.recommendation ?? undefined,
  };
}

// ── Statutory timescale (Phase A · §E timescale tracker) ─────────────────────

export interface ReviewDueStatus {
  /** The date the next annual review is due (ISO yyyy-MM-dd). */
  due_date: string;
  /** Days until due (negative if overdue). */
  days_until: number;
  /** Human label, e.g. "in 6 weeks" or "3 weeks overdue". */
  label: string;
  /** Traffic-light urgency for the banner. */
  urgency: 'ok' | 'soon' | 'due' | 'overdue';
  /** What the due date was anchored to. */
  anchored_to: 'last_review' | 'ehcp_issue';
}

/**
 * Compute when the next annual review is statutorily due: 12 months from the
 * last review meeting, or from the EHCP issue date if no review has happened.
 * Returns null if we have neither date to anchor to.
 */
export function computeReviewDue(row: AnnualReviewRow | null): ReviewDueStatus | null {
  const anchorDate = row?.review_date ?? row?.ehcp_date_issued ?? null;
  if (!anchorDate) return null;

  const due = addMonths(new Date(anchorDate), 12);
  const days = differenceInCalendarDays(due, new Date());
  const weeks = Math.round(Math.abs(days) / 7);

  let label: string;
  let urgency: ReviewDueStatus['urgency'];
  if (days < 0) {
    label = weeks <= 1 ? 'overdue' : `${weeks} weeks overdue`;
    urgency = 'overdue';
  } else if (days <= 42) {
    // Statutory prep window — reviews should be arranged ~6 weeks ahead.
    label = weeks <= 1 ? 'due within a week' : `due in ${weeks} weeks`;
    urgency = days <= 14 ? 'due' : 'soon';
  } else {
    const months = Math.round(days / 30);
    label = `due in ${months} month${months === 1 ? '' : 's'}`;
    urgency = 'ok';
  }

  return {
    due_date: format(due, 'yyyy-MM-dd'),
    days_until: days,
    label,
    urgency,
    anchored_to: row?.review_date ? 'last_review' : 'ehcp_issue',
  };
}

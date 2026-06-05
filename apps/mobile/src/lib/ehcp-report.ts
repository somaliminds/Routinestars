/**
 * ehcp-report.ts — builds the EHCP annual-review evidence pack.
 *
 * Fetches every outcome for the child, the linked activity sets, and
 * the completion data over the chosen date range. Aggregates into a
 * per-outcome summary (% completion, count of evidence points) and
 * emits a self-contained HTML string suitable for expo-print → PDF.
 *
 * The HTML is intentionally simple inline-styled so it renders
 * consistently on the iOS and Android print engines without external
 * fonts or stylesheets.
 */

import { format } from 'date-fns';
import { supabase } from './supabase';
import type { EhcpCategory, EhcpStatus, ChildProfileRow } from '@/types/database';

export interface OutcomeEvidence {
  outcome_id: string;
  outcome_text: string;
  category: EhcpCategory;
  target_date: string | null;
  status: EhcpStatus;
  notes: string | null;
  linked_sets: { set_id: string; set_name: string; icon_emoji: string }[];
  scheduled_count: number;
  completed_count: number;
  completion_pct: number;
  last_evidence: { date: string; set_name: string }[];
}

export interface EvidencePack {
  child: ChildProfileRow;
  date_from: string;
  date_to: string;
  generated_at: string;
  outcomes: OutcomeEvidence[];
}

const CATEGORY_LABELS: Record<EhcpCategory, string> = {
  COMMUNICATION: 'Communication',
  COGNITION: 'Cognition & Learning',
  SOCIAL_EMOTIONAL: 'Social, Emotional & Mental Health',
  SENSORY_PHYSICAL: 'Sensory & Physical',
  INDEPENDENCE: 'Independence',
  OTHER: 'Other',
};

export async function buildEvidencePack(
  childId: string,
  dateFrom: string,
  dateTo: string,
): Promise<EvidencePack | null> {
  const { data: child, error: childErr } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('profile_id', childId)
    .single();
  if (childErr || !child) return null;

  const { data: outcomes } = await supabase
    .from('ehcp_outcomes')
    .select('*')
    .eq('child_id', childId)
    .order('status')
    .order('category');

  const outcomeIds = (outcomes ?? []).map((o) => o.outcome_id);
  if (outcomeIds.length === 0) {
    return {
      child: child as ChildProfileRow,
      date_from: dateFrom,
      date_to: dateTo,
      generated_at: new Date().toISOString(),
      outcomes: [],
    };
  }

  // Tag rows for every outcome in scope
  const { data: tags } = await supabase
    .from('activity_set_outcome_tags')
    .select('outcome_id, set_id, activity_sets ( set_id, set_name, icon_emoji )')
    .in('outcome_id', outcomeIds);

  const setsByOutcome: Record<string, { set_id: string; set_name: string; icon_emoji: string }[]> =
    {};
  const allSetIds = new Set<string>();
  for (const t of tags ?? []) {
    const setsField = (t as { activity_sets: unknown }).activity_sets;
    const s = Array.isArray(setsField) ? setsField[0] : setsField;
    if (!s) continue;
    (setsByOutcome[t.outcome_id as string] ??= []).push({
      set_id: s.set_id as string,
      set_name: s.set_name as string,
      icon_emoji: s.icon_emoji as string,
    });
    allSetIds.add(s.set_id as string);
  }

  // Completions for this child against any tagged set in the date range
  const setIdsArr = Array.from(allSetIds);
  const safeSetIds = setIdsArr.length > 0 ? setIdsArr : ['__none__'];
  const { data: completions } = await supabase
    .from('completions')
    .select('set_id, completed_at, parent_approved')
    .eq('child_id', childId)
    .in('set_id', safeSetIds)
    .gte('completed_at', `${dateFrom}T00:00:00`)
    .lte('completed_at', `${dateTo}T23:59:59`)
    .order('completed_at', { ascending: false });

  // Scheduled instances (scheduled_sets) for this child against any tagged set in range
  const { data: scheduled } = await supabase
    .from('scheduled_sets')
    .select('set_id, status, day_schedules ( child_id, schedule_date )')
    .in('set_id', safeSetIds);

  const completedBySet: Record<string, number> = {};
  const recentBySet: Record<string, { date: string; set_name: string }[]> = {};
  const setNameById: Record<string, string> = {};
  for (const t of tags ?? []) {
    const setsField = (t as { activity_sets: unknown }).activity_sets;
    const s = Array.isArray(setsField) ? setsField[0] : setsField;
    if (s) setNameById[s.set_id as string] = s.set_name as string;
  }
  for (const c of completions ?? []) {
    const approved = c.parent_approved !== false; // null or true = counted
    if (!approved) continue;
    completedBySet[c.set_id as string] = (completedBySet[c.set_id as string] ?? 0) + 1;
    const arr = (recentBySet[c.set_id as string] ??= []);
    if (arr.length < 5) {
      arr.push({
        date: (c.completed_at as string).slice(0, 10),
        set_name: setNameById[c.set_id as string] ?? 'Activity',
      });
    }
  }

  const scheduledBySet: Record<string, number> = {};
  for (const ss of scheduled ?? []) {
    const ds = (ss as { day_schedules: unknown }).day_schedules;
    const dsRow = Array.isArray(ds) ? ds[0] : ds;
    if (!dsRow) continue;
    const sd = (dsRow as { child_id: string; schedule_date: string });
    if (sd.child_id !== childId) continue;
    if (sd.schedule_date < dateFrom || sd.schedule_date > dateTo) continue;
    scheduledBySet[ss.set_id as string] = (scheduledBySet[ss.set_id as string] ?? 0) + 1;
  }

  const outcomeEvidence: OutcomeEvidence[] = (outcomes ?? []).map((o) => {
    const linked = setsByOutcome[o.outcome_id as string] ?? [];
    let scheduled_count = 0;
    let completed_count = 0;
    const last_evidence: { date: string; set_name: string }[] = [];
    for (const s of linked) {
      scheduled_count += scheduledBySet[s.set_id] ?? 0;
      completed_count += completedBySet[s.set_id] ?? 0;
      for (const ev of recentBySet[s.set_id] ?? []) {
        if (last_evidence.length < 8) last_evidence.push(ev);
      }
    }
    last_evidence.sort((a, b) => (a.date < b.date ? 1 : -1));
    const completion_pct =
      scheduled_count > 0 ? Math.round((completed_count / scheduled_count) * 100) : 0;
    return {
      outcome_id: o.outcome_id as string,
      outcome_text: o.outcome_text as string,
      category: o.category as EhcpCategory,
      target_date: (o.target_date as string | null) ?? null,
      status: o.status as EhcpStatus,
      notes: (o.notes as string | null) ?? null,
      linked_sets: linked,
      scheduled_count,
      completed_count,
      completion_pct,
      last_evidence: last_evidence.slice(0, 5),
    };
  });

  return {
    child: child as ChildProfileRow,
    date_from: dateFrom,
    date_to: dateTo,
    generated_at: new Date().toISOString(),
    outcomes: outcomeEvidence,
  };
}

// ── HTML rendering ───────────────────────────────────────────────────────────

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(s: EhcpStatus): string {
  const c =
    s === 'ACTIVE' ? '#7C3AED' : s === 'ACHIEVED' ? '#10B981' : '#9CA3AF';
  return `<span style="background:${c}; color:#fff; padding:2px 8px; border-radius:999px; font-size:10px; letter-spacing:0.5px;">${s}</span>`;
}

export function renderEvidencePackHtml(pack: EvidencePack): string {
  const formattedFrom = format(new Date(pack.date_from), 'd MMM yyyy');
  const formattedTo = format(new Date(pack.date_to), 'd MMM yyyy');
  const generatedAt = format(new Date(pack.generated_at), 'd MMM yyyy, HH:mm');

  const outcomesHtml = pack.outcomes
    .map((o) => {
      const linkedSetsHtml = o.linked_sets
        .map(
          (s) =>
            `<span style="background:#EDE9FE; color:#5B21B6; padding:3px 10px; border-radius:999px; font-size:11px; margin-right:6px; display:inline-block; margin-bottom:4px;">${s.icon_emoji} ${escape(s.set_name)}</span>`,
        )
        .join('') || '<em style="color:#9CA3AF; font-size:11px;">No linked activity sets</em>';

      const evidenceHtml = o.last_evidence.length
        ? `<ul style="margin:8px 0 0; padding-left:18px; font-size:11px; color:#374151;">${o.last_evidence
            .map((e) => `<li>${e.date} — ${escape(e.set_name)}</li>`)
            .join('')}</ul>`
        : '<p style="color:#9CA3AF; font-size:11px; margin:8px 0 0;">No recorded completions in this period.</p>';

      const notesHtml = o.notes
        ? `<p style="background:#FEF3C7; color:#78350F; padding:8px 12px; border-radius:8px; font-size:11px; margin-top:8px;"><strong>Notes:</strong> ${escape(o.notes)}</p>`
        : '';

      return `
        <div style="border:1px solid #E5E7EB; border-radius:12px; padding:14px 16px; margin-bottom:14px; page-break-inside:avoid;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; color:#5B21B6; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${CATEGORY_LABELS[o.category]}</span>
            ${statusBadge(o.status)}
          </div>
          <p style="font-size:14px; color:#111827; margin:0 0 8px; line-height:1.45;"><strong>${escape(o.outcome_text)}</strong></p>
          ${o.target_date ? `<p style="font-size:11px; color:#6B7280; margin:0 0 8px;">Target review date: ${o.target_date}</p>` : ''}

          <div style="background:#F5F0FF; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
            <div style="font-size:11px; color:#5B21B6; font-weight:600; margin-bottom:6px;">PROGRESS IN PERIOD</div>
            <div style="display:flex; gap:18px; font-size:12px; color:#111827;">
              <div><strong>${o.completion_pct}%</strong> completion</div>
              <div><strong>${o.completed_count}</strong> of <strong>${o.scheduled_count}</strong> scheduled</div>
            </div>
          </div>

          <div style="font-size:11px; color:#6B7280; font-weight:600; margin-bottom:4px;">LINKED ACTIVITY SETS</div>
          <div>${linkedSetsHtml}</div>

          <div style="font-size:11px; color:#6B7280; font-weight:600; margin-top:10px;">RECENT EVIDENCE</div>
          ${evidenceHtml}
          ${notesHtml}
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>EHCP Evidence Pack — ${escape(pack.child.child_name)}</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; color:#111827; padding:24px; max-width:780px; margin:0 auto;">
  <header style="border-bottom:3px solid #7C3AED; padding-bottom:14px; margin-bottom:20px;">
    <h1 style="margin:0 0 4px; font-size:22px; color:#5B21B6;">EHCP Annual Review — Evidence Pack</h1>
    <p style="margin:0; font-size:13px; color:#374151;">
      <strong>${escape(pack.child.child_name)} ${pack.child.avatar_emoji}</strong>
      &nbsp;·&nbsp; DOB ${pack.child.date_of_birth}
    </p>
    <p style="margin:6px 0 0; font-size:11px; color:#6B7280;">
      Reporting period: ${formattedFrom} — ${formattedTo} &nbsp;·&nbsp;
      Generated ${generatedAt}
    </p>
  </header>

  <section style="background:#F5F0FF; border-left:4px solid #7C3AED; padding:12px 16px; margin-bottom:20px;">
    <p style="margin:0; font-size:11px; color:#5B21B6;">
      This evidence pack was generated automatically from completion data
      recorded in the RoutineStars app. It is intended to support — not
      replace — the statutory annual review of the child's EHCP. Outcomes
      are recorded verbatim from the parent's entries.
    </p>
  </section>

  ${pack.outcomes.length === 0
    ? '<p style="color:#9CA3AF; font-size:13px;">No EHCP outcomes have been recorded for this child yet.</p>'
    : outcomesHtml}

  <footer style="margin-top:32px; padding-top:14px; border-top:1px solid #E5E7EB; font-size:10px; color:#9CA3AF; text-align:center;">
    Generated by RoutineStars · routinestars.co.uk
  </footer>
</body></html>
`;
}

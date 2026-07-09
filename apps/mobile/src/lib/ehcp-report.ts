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

  // Completions for this child against any tagged set in the date range.
  // NOTE: completions has no set_id — it references scheduled_sets, which
  // carry the set_id. We resolve set_id per completion via the scheduled_sets
  // map built below (setIdByScheduledSetId).
  const setIdsArr = Array.from(allSetIds);
  const safeSetIds = setIdsArr.length > 0 ? setIdsArr : ['__none__'];
  const { data: completions } = await supabase
    .from('completions')
    .select('scheduled_set_id, completed_at, parent_approved')
    .eq('child_id', childId)
    .gte('completed_at', `${dateFrom}T00:00:00`)
    .lte('completed_at', `${dateTo}T23:59:59`)
    .order('completed_at', { ascending: false });

  // Scheduled instances (scheduled_sets) for this child against any tagged set
  // in range. Also gives us scheduled_set_id → set_id for the completions map.
  const { data: scheduled } = await supabase
    .from('scheduled_sets')
    .select('scheduled_set_id, set_id, status, day_schedules ( child_id, schedule_date )')
    .in('set_id', safeSetIds);

  // scheduled_set_id → set_id (only for tagged sets — untagged completions are
  // absent from this map and therefore excluded, matching the original intent).
  const setIdByScheduledSetId: Record<string, string> = {};
  for (const ss of scheduled ?? []) {
    setIdByScheduledSetId[ss.scheduled_set_id as string] = ss.set_id as string;
  }

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
    const setId = setIdByScheduledSetId[c.scheduled_set_id as string];
    if (!setId) continue; // completion for an untagged set — not relevant here
    completedBySet[setId] = (completedBySet[setId] ?? 0) + 1;
    const arr = (recentBySet[setId] ??= []);
    if (arr.length < 5 && c.completed_at) {
      arr.push({
        date: (c.completed_at as string).slice(0, 10),
        set_name: setNameById[setId] ?? 'Activity',
      });
    }
  }

  const scheduledBySet: Record<string, number> = {};
  for (const ss of scheduled ?? []) {
    const ds = (ss as { day_schedules: unknown }).day_schedules;
    const dsRow = Array.isArray(ds) ? ds[0] : ds;
    if (!dsRow) continue;
    const sd = dsRow as { child_id: string; schedule_date: string };
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
  const c = s === 'ACTIVE' ? '#7C3AED' : s === 'ACHIEVED' ? '#10B981' : '#9CA3AF';
  return `<span style="background:${c}; color:#fff; padding:2px 8px; border-radius:999px; font-size:10px; letter-spacing:0.5px;">${s}</span>`;
}

/**
 * Human-completed parts of the statutory Annual Review pack.
 *
 * The auto-generated progress data (School/Setting Progress Report) comes
 * from `EvidencePack`. These fields are the parts a person must supply:
 * review metadata, parent/carer contribution, the child's own views, and
 * the review recommendation. All optional — when absent, the pack prints
 * labelled fill-in spaces so it can be completed by hand. A later
 * checkpoint wires these to in-app input + persistence.
 *
 * Structure follows SEND Code of Practice Ch.11 / SEND Regs 2014 reg.18
 * (England annual review). See docs/research/send-framework §C5.
 */
export interface AnnualReviewInputs {
  ehcp_date_issued?: string;
  review_date?: string;
  review_chair?: string;
  attendees?: string[];
  parent_contribution?: {
    strengths_and_achievements?: string;
    progress_observed?: string;
    concerns?: string;
    aspirations_next_year?: string;
    requested_changes?: string;
  };
  child_views?: {
    how_i_feel_about_my_support?: string;
    what_is_going_well?: string;
    what_is_difficult?: string;
    what_i_want_to_change?: string;
    my_goals?: string;
    communication_method_used?: string;
  };
  recommendation?: 'MAINTAIN' | 'AMEND' | 'CEASE';
}

/** A labelled block: prints supplied text, or ruled fill-in lines if blank. */
function field(label: string, value: string | undefined, lines = 2): string {
  const filled = value && value.trim().length > 0;
  const body = filled
    ? `<p style="margin:4px 0 0; font-size:12px; color:#111827; line-height:1.5; white-space:pre-wrap;">${escape(value!.trim())}</p>`
    : Array.from({ length: lines })
        .map(
          () => '<div style="border-bottom:1px solid #D1D5DB; height:18px; margin-top:8px;"></div>',
        )
        .join('');
  return `
    <div style="margin-bottom:12px;">
      <div style="font-size:11px; color:#6B7280; font-weight:600;">${label}</div>
      ${body}
    </div>`;
}

/** Section wrapper with a numbered statutory heading. */
function reviewSection(index: number, title: string, inner: string): string {
  return `
    <section style="margin-bottom:22px; page-break-inside:avoid;">
      <h2 style="font-size:14px; color:#5B21B6; margin:0 0 4px; padding-bottom:6px; border-bottom:2px solid #EDE9FE;">
        ${index}. ${title}
      </h2>
      ${inner}
    </section>`;
}

function checkbox(label: string, checked: boolean): string {
  const box = checked
    ? '<span style="display:inline-block; width:14px; height:14px; border:2px solid #7C3AED; background:#7C3AED; color:#fff; text-align:center; line-height:12px; font-size:10px; border-radius:3px;">✓</span>'
    : '<span style="display:inline-block; width:14px; height:14px; border:2px solid #9CA3AF; border-radius:3px;"></span>';
  return `<span style="margin-right:18px; font-size:12px; color:#111827;">${box}&nbsp; ${label}</span>`;
}

export function renderEvidencePackHtml(
  pack: EvidencePack,
  inputs: AnnualReviewInputs = {},
): string {
  const formattedFrom = format(new Date(pack.date_from), 'd MMM yyyy');
  const formattedTo = format(new Date(pack.date_to), 'd MMM yyyy');
  const generatedAt = format(new Date(pack.generated_at), 'd MMM yyyy, HH:mm');

  // ── Section 1: School/Setting Progress Report (AUTO from RoutineStars data) ──
  const outcomesHtml = pack.outcomes
    .map((o) => {
      const linkedSetsHtml =
        o.linked_sets
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

  const progressSection = reviewSection(
    1,
    'Progress Report — measured outcomes',
    `<p style="font-size:11px; color:#6B7280; margin:0 0 12px;">
       Auto-generated from RoutineStars completion data for the reporting period.
       Quantified, dated, and triangulated with the linked activity sets below.
     </p>
     ${
       pack.outcomes.length === 0
         ? '<p style="color:#9CA3AF; font-size:12px;">No EHCP outcomes have been recorded for this child yet.</p>'
         : outcomesHtml
     }`,
  );

  // ── Section 2: Parent/Carer Contribution (human-completed) ──
  const pc = inputs.parent_contribution ?? {};
  const parentSection = reviewSection(
    2,
    'Parent / Carer contribution',
    field('Strengths and achievements this year', pc.strengths_and_achievements, 2) +
      field('Progress observed against the EHCP outcomes', pc.progress_observed, 3) +
      field('Concerns', pc.concerns, 2) +
      field('Aspirations for the next year', pc.aspirations_next_year, 2) +
      field('Any changes to the EHCP we would like to request', pc.requested_changes, 2),
  );

  // ── Section 3: Child / Young Person's Views (human-completed) ──
  const cv = inputs.child_views ?? {};
  const childSection = reviewSection(
    3,
    "Child / Young Person's views",
    field('Communication method used to gather these views', cv.communication_method_used, 1) +
      field('How I feel about my support', cv.how_i_feel_about_my_support, 2) +
      field('What is going well', cv.what_is_going_well, 2) +
      field('What is difficult', cv.what_is_difficult, 2) +
      field('What I want to change', cv.what_i_want_to_change, 2) +
      field('My goals', cv.my_goals, 2),
  );

  // ── Section 4: Professional advice (human-completed / attached) ──
  const professionalSection = reviewSection(
    4,
    'Professional advice',
    `<p style="font-size:11px; color:#6B7280; margin:0 0 8px;">
       Updated advice from professionals involved (e.g. SENCO, EP, SALT, OT,
       health, social care). Attach reports or summarise below.
     </p>` + field('Summary of professional advice', undefined, 4),
  );

  // ── Section 5: Review recommendation (human-completed) ──
  const rec = inputs.recommendation;
  const recommendationSection = reviewSection(
    5,
    'Review recommendation',
    `<div style="margin-bottom:10px;">
       ${checkbox('Maintain the EHCP unchanged', rec === 'MAINTAIN')}
       ${checkbox('Amend the EHCP', rec === 'AMEND')}
       ${checkbox('Cease to maintain the EHCP', rec === 'CEASE')}
     </div>` +
      field('Summary of the review meeting and agreed actions', undefined, 4) +
      `<p style="font-size:10px; color:#9CA3AF; margin-top:10px;">
         The local authority must notify its decision within <strong>4 weeks</strong>
         of the review meeting (SEND Regs 2014, reg.18).
       </p>`,
  );

  // ── Header + review metadata ──
  const metaRow = (label: string, value: string | undefined) =>
    `<div style="font-size:11px; color:#374151; margin-top:4px;">
       <span style="color:#6B7280;">${label}:</span>
       ${value && value.trim() ? escape(value) : '<span style="color:#9CA3AF;">__________________________</span>'}
     </div>`;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>EHCP Annual Review Pack — ${escape(pack.child.child_name)}</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; color:#111827; padding:24px; max-width:780px; margin:0 auto;">
  <header style="border-bottom:3px solid #7C3AED; padding-bottom:14px; margin-bottom:18px;">
    <h1 style="margin:0 0 4px; font-size:22px; color:#5B21B6;">EHCP Annual Review Pack</h1>
    <p style="margin:0; font-size:13px; color:#374151;">
      <strong>${escape(pack.child.child_name)} ${pack.child.avatar_emoji}</strong>
      &nbsp;·&nbsp; DOB ${pack.child.date_of_birth}
    </p>
    ${metaRow('EHCP first issued', inputs.ehcp_date_issued)}
    ${metaRow('Review meeting date', inputs.review_date)}
    ${metaRow('Review chair', inputs.review_chair)}
    ${metaRow('Attendees', inputs.attendees?.join(', '))}
    <p style="margin:8px 0 0; font-size:11px; color:#6B7280;">
      Reporting period: ${formattedFrom} — ${formattedTo} &nbsp;·&nbsp; Generated ${generatedAt}
    </p>
  </header>

  <section style="background:#F5F0FF; border-left:4px solid #7C3AED; padding:12px 16px; margin-bottom:22px;">
    <p style="margin:0; font-size:11px; color:#5B21B6; line-height:1.5;">
      This pack supports — it does not replace — the statutory annual review of the
      child's EHCP (Children and Families Act 2014 s.44; SEND Regs 2014 reg.18;
      SEND Code of Practice Ch.11). Section 1 (Progress Report) is generated
      automatically from RoutineStars completion data. Sections 2–5 are completed
      by the parent/carer, the child or young person, professionals, and the
      review meeting. Outcomes are recorded verbatim from the parent's entries.
    </p>
  </section>

  ${progressSection}
  ${parentSection}
  ${childSection}
  ${professionalSection}
  ${recommendationSection}

  <footer style="margin-top:28px; padding-top:14px; border-top:1px solid #E5E7EB; font-size:10px; color:#9CA3AF; text-align:center;">
    Generated by RoutineStars · routinestars.co.uk
  </footer>
</body></html>
`;
}

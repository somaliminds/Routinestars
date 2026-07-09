/**
 * one-page-profile.ts — builds a person-centred One Page Profile PDF.
 *
 * A One Page Profile is a national person-centred planning document used
 * across all four UK nations in SEND/ALN/ASN processes (SEND Code 9.62;
 * see docs/research/send-framework §C1). It captures, on a single page:
 *   1. What people like and admire about me
 *   2. What is important to me
 *   3. How best to support me
 *   4. (autism-friendly extension) What makes me happy / anxious / upset
 *
 * We auto-fill only the factual header (name, age, avatar) and gently
 * suggest "things I enjoy" from the child's most-engaged activity sets.
 * The person-centred sections are intentionally NOT auto-generated — a
 * One Page Profile must be the child's and family's own words, never an
 * app's inferred claims about a child. Supplied values render as text;
 * blanks render as ruled fill-in lines.
 *
 * HTML is inline-styled for consistent iOS/Android print-engine output.
 */

import { format, differenceInYears } from 'date-fns';
import { supabase } from './supabase';
import type { ChildProfileRow } from '@/types/database';

export interface OnePageProfileData {
  child: ChildProfileRow;
  age_years: number | null;
  /** Names of the activity sets the child completes most — a factual prompt. */
  top_activities: string[];
  generated_at: string;
}

/** Optional human-supplied person-centred content. Blank → fill-in lines. */
export interface OnePageProfileInputs {
  what_people_admire?: string;
  what_is_important_to_me?: string;
  how_to_support_me?: string;
  what_makes_me_happy?: string;
  what_makes_me_anxious?: string;
  how_i_communicate?: string;
}

export async function buildOnePageProfile(childId: string): Promise<OnePageProfileData | null> {
  const { data: child, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('profile_id', childId)
    .single();
  if (error || !child) return null;

  const childRow = child as ChildProfileRow;

  const age_years = childRow.date_of_birth
    ? differenceInYears(new Date(), new Date(childRow.date_of_birth))
    : null;

  // Factual prompt only: the sets this child actually completes most often.
  // Approved (or not-yet-decided) completions in the last 90 days.
  // completions references scheduled_sets (not activity sets directly), so we
  // resolve set names in two hops: scheduled_set_id → set_id → set_name.
  const since = format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd');
  const { data: completions } = await supabase
    .from('completions')
    .select('scheduled_set_id, parent_approved')
    .eq('child_id', childId)
    .gte('completed_at', `${since}T00:00:00`);

  const approved = (completions ?? []).filter((c) => c.parent_approved !== false);
  const scheduledSetIds = [...new Set(approved.map((c) => c.scheduled_set_id as string))];

  // scheduled_set_id → set_id, then set_id → set_name.
  const setNameByScheduledSetId: Record<string, string> = {};
  if (scheduledSetIds.length > 0) {
    const { data: ss } = await supabase
      .from('scheduled_sets')
      .select('scheduled_set_id, set_id')
      .in('scheduled_set_id', scheduledSetIds);
    const setIds = [...new Set((ss ?? []).map((s) => s.set_id as string))];
    const { data: sets } = await supabase
      .from('activity_sets')
      .select('set_id, set_name')
      .in('set_id', setIds.length > 0 ? setIds : ['__none__']);
    const nameBySetId: Record<string, string> = {};
    for (const s of sets ?? []) nameBySetId[s.set_id as string] = s.set_name as string;
    for (const row of ss ?? []) {
      const name = nameBySetId[row.set_id as string];
      if (name) setNameByScheduledSetId[row.scheduled_set_id as string] = name;
    }
  }

  const countByName: Record<string, number> = {};
  for (const c of approved) {
    const name = setNameByScheduledSetId[c.scheduled_set_id as string];
    if (!name) continue;
    countByName[name] = (countByName[name] ?? 0) + 1;
  }
  const top_activities = Object.entries(countByName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  return {
    child: childRow,
    age_years,
    top_activities,
    generated_at: new Date().toISOString(),
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

/** A person-centred card: supplied text, or ruled fill-in lines if blank. */
function card(
  emoji: string,
  title: string,
  value: string | undefined,
  hint: string,
  lines = 3,
): string {
  const filled = value && value.trim().length > 0;
  const body = filled
    ? `<p style="margin:6px 0 0; font-size:12.5px; color:#111827; line-height:1.55; white-space:pre-wrap;">${escape(value!.trim())}</p>`
    : `<p style="margin:4px 0 6px; font-size:10.5px; color:#9CA3AF; font-style:italic;">${hint}</p>` +
      Array.from({ length: lines })
        .map(
          () => '<div style="border-bottom:1px solid #D1D5DB; height:18px; margin-top:8px;"></div>',
        )
        .join('');
  return `
    <div style="border:1px solid #E5E7EB; border-radius:14px; padding:14px 16px; margin-bottom:12px; page-break-inside:avoid;">
      <div style="font-size:13px; color:#5B21B6; font-weight:700;">${emoji}&nbsp; ${title}</div>
      ${body}
    </div>`;
}

export function renderOnePageProfileHtml(
  data: OnePageProfileData,
  inputs: OnePageProfileInputs = {},
): string {
  const generatedAt = format(new Date(data.generated_at), 'd MMM yyyy');
  const ageStr = data.age_years != null ? `${data.age_years} years old` : '';

  const activitiesPrompt =
    data.top_activities.length > 0
      ? `Routines ${escape(data.child.child_name)} engages with most in RoutineStars: ${data.top_activities
          .map((a) => escape(a))
          .join(', ')}. Use these as a starting point.`
      : 'Add the things this child enjoys and is good at.';

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>One Page Profile — ${escape(data.child.child_name)}</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; color:#111827; padding:24px; max-width:780px; margin:0 auto;">
  <header style="text-align:center; border-bottom:3px solid #7C3AED; padding-bottom:16px; margin-bottom:18px;">
    <div style="font-size:52px; line-height:1;">${data.child.avatar_emoji || '🌟'}</div>
    <h1 style="margin:8px 0 2px; font-size:24px; color:#5B21B6;">${escape(data.child.child_name)}</h1>
    <p style="margin:0; font-size:12px; color:#6B7280;">
      One Page Profile${ageStr ? ` &nbsp;·&nbsp; ${ageStr}` : ''}
      &nbsp;·&nbsp; ${escape(data.child.date_of_birth ?? '')}
    </p>
  </header>

  <section style="background:#F5F0FF; border-left:4px solid #7C3AED; padding:10px 14px; margin-bottom:18px;">
    <p style="margin:0; font-size:10.5px; color:#5B21B6; line-height:1.5;">
      A person-centred summary to share with anyone who supports
      ${escape(data.child.child_name)} — school, therapists, family, carers.
      It should be written in the child's and family's own words. RoutineStars
      only fills in factual details; the rest is for you and your child to complete.
    </p>
  </section>

  ${card('💜', 'What people like and admire about me', inputs.what_people_admire, 'Strengths, positive qualities, what makes this child special.')}
  ${card('⭐', 'What is important to me', inputs.what_is_important_to_me, activitiesPrompt)}
  ${card('🤝', 'How best to support me', inputs.how_to_support_me, 'Strategies that work, routines, sensory needs, what helps me feel calm and ready.')}
  ${card('😊', 'What makes me happy', inputs.what_makes_me_happy, 'Activities, people, places, and things that bring joy.')}
  ${card('😟', 'What makes me anxious or upset — and what helps', inputs.what_makes_me_anxious, 'Triggers to avoid, early signs, and what to do to help me regulate.')}
  ${card('💬', 'How I communicate', inputs.how_i_communicate, 'Words, signs, symbols, AAC, gestures — and how I show how I feel.', 2)}

  <footer style="margin-top:22px; padding-top:12px; border-top:1px solid #E5E7EB; font-size:10px; color:#9CA3AF; text-align:center;">
    Generated ${generatedAt} · RoutineStars · routinestars.co.uk
  </footer>
</body></html>
`;
}

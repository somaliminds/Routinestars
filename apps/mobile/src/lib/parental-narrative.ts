/**
 * parental-narrative.ts — builds the "All About Me" parental narrative PDF.
 *
 * A reusable parent/carer narrative capturing a child's history and needs
 * in one document (SEND Code 9.62 person-centred planning; research §C2).
 * Strengthens EHC/IDP requests — "Tell Your Story Once" is one LA's name
 * for this national concept.
 *
 * Like the One Page Profile, we auto-fill only factual details (name, DOB)
 * and offer a respectful prompt listing which areas of need the child
 * already has recorded outcomes in. The narrative itself is the parent's
 * own words — rendered as labelled fill-in sections, or as supplied text.
 */

import { format } from 'date-fns';
import { supabase } from './supabase';
import type { ChildProfileRow, EhcpCategory } from '@/types/database';

const AREA_LABEL: Record<EhcpCategory, string> = {
  COMMUNICATION: 'Communication & Interaction',
  COGNITION: 'Cognition & Learning',
  SOCIAL_EMOTIONAL: 'Social, Emotional & Mental Health',
  SENSORY_PHYSICAL: 'Sensory & Physical',
  INDEPENDENCE: 'Independence',
  OTHER: 'Other',
};

export interface ParentalNarrativeData {
  child: ChildProfileRow;
  /** Areas of need the child already has EHCP outcomes recorded in. */
  recorded_areas: string[];
  generated_at: string;
}

/** Optional supplied narrative content. Blank → fill-in lines. */
export interface ParentalNarrativeInputs {
  completed_by?: string;
  about_my_child?: string;
  family_circumstances?: string;
  medical_history?: string;
  health_professionals?: string;
  developmental_history?: string;
  educational_history?: string;
  current_needs?: string;
  what_helps?: string;
  hopes_and_aspirations?: string;
  what_services_should_know?: string;
}

export async function buildParentalNarrative(
  childId: string,
): Promise<ParentalNarrativeData | null> {
  const { data: child, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('profile_id', childId)
    .single();
  if (error || !child) return null;

  // Factual prompt: which areas of need already have recorded outcomes.
  const { data: outcomes } = await supabase
    .from('ehcp_outcomes')
    .select('category')
    .eq('child_id', childId);
  const areas = new Set<string>();
  for (const o of outcomes ?? []) {
    const label = AREA_LABEL[o.category as EhcpCategory];
    if (label) areas.add(label);
  }

  return {
    child: child as ChildProfileRow,
    recorded_areas: Array.from(areas),
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

function section(
  index: number,
  title: string,
  value: string | undefined,
  hint: string,
  lines = 3,
): string {
  const filled = value && value.trim().length > 0;
  const body = filled
    ? `<p style="margin:6px 0 0; font-size:12.5px; color:#111827; line-height:1.55; white-space:pre-wrap;">${escape(value!.trim())}</p>`
    : `<p style="margin:4px 0 8px; font-size:10.5px; color:#9CA3AF; font-style:italic;">${hint}</p>` +
      Array.from({ length: lines })
        .map(
          () => '<div style="border-bottom:1px solid #D1D5DB; height:18px; margin-top:8px;"></div>',
        )
        .join('');
  return `
    <section style="margin-bottom:16px; page-break-inside:avoid;">
      <h2 style="font-size:13.5px; color:#5B21B6; margin:0 0 2px;">${index}. ${title}</h2>
      ${body}
    </section>`;
}

export function renderParentalNarrativeHtml(
  data: ParentalNarrativeData,
  inputs: ParentalNarrativeInputs = {},
): string {
  const generatedAt = format(new Date(data.generated_at), 'd MMM yyyy');
  const areasPrompt =
    data.recorded_areas.length > 0
      ? `You have recorded EHCP outcomes in: ${data.recorded_areas.map((a) => escape(a)).join(', ')}. Describe the needs and challenges in these and any other areas.`
      : 'Describe current needs and challenges — communication, learning, behaviour, sensory, physical, independence.';

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>All About Me — ${escape(data.child.child_name)}</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; color:#111827; padding:24px; max-width:780px; margin:0 auto;">
  <header style="border-bottom:3px solid #7C3AED; padding-bottom:14px; margin-bottom:16px;">
    <h1 style="margin:0 0 4px; font-size:22px; color:#5B21B6;">All About Me</h1>
    <p style="margin:0; font-size:13px; color:#374151;">
      <strong>${escape(data.child.child_name)} ${data.child.avatar_emoji}</strong>
      &nbsp;·&nbsp; DOB ${escape(data.child.date_of_birth ?? '')}
    </p>
    <p style="margin:6px 0 0; font-size:11px; color:#6B7280;">
      Completed by: ${inputs.completed_by && inputs.completed_by.trim() ? escape(inputs.completed_by) : '<span style="color:#9CA3AF;">____________________</span>'}
      &nbsp;·&nbsp; ${generatedAt}
    </p>
  </header>

  <section style="background:#F5F0FF; border-left:4px solid #7C3AED; padding:10px 14px; margin-bottom:18px;">
    <p style="margin:0; font-size:10.5px; color:#5B21B6; line-height:1.5;">
      A reusable narrative telling your child's story once — history, needs,
      and what helps. Share it with school, health, and social care to save
      repeating yourself at every meeting, and to strengthen an EHC needs
      assessment request. Written in your own words.
    </p>
  </section>

  ${section(1, 'About my child', inputs.about_my_child, 'General description, personality, strengths, what makes them who they are.')}
  ${section(2, 'Family history and circumstances', inputs.family_circumstances, 'Who is at home, significant events, anything affecting your child.')}
  ${section(3, 'Medical history', inputs.medical_history, 'Diagnoses, conditions, treatments, medications.')}
  ${section(4, 'Health professionals involved', inputs.health_professionals, 'e.g. paediatrician, SALT, OT, CAMHS — names and roles.', 2)}
  ${section(5, 'Developmental history', inputs.developmental_history, 'Key milestones and how development has progressed.')}
  ${section(6, 'Educational history', inputs.educational_history, 'Settings attended, support tried, what worked and what did not.')}
  ${section(7, 'Current needs and challenges', inputs.current_needs, areasPrompt, 4)}
  ${section(8, 'What helps and what does not', inputs.what_helps, 'Strategies, routines, sensory supports; and things to avoid.')}
  ${section(9, 'Our hopes and aspirations', inputs.hopes_and_aspirations, 'The outcomes you want for your child, short and long term.')}
  ${section(10, 'What I want support services to know', inputs.what_services_should_know, 'Anything else that matters for people supporting your child.')}

  <footer style="margin-top:22px; padding-top:12px; border-top:1px solid #E5E7EB; font-size:10px; color:#9CA3AF; text-align:center;">
    Generated ${generatedAt} · RoutineStars · routinestars.co.uk
  </footer>
</body></html>
`;
}

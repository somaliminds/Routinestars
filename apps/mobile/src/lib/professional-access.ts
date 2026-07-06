/**
 * professional-access.ts — consent + audit enforcement for the portal.
 *
 * The single entry point for granting/withdrawing a professional's access
 * to a child's data and for writing the mandatory access audit trail.
 * Every later Phase B feature (auth, role-scoped views, contributions)
 * routes through here so the DPIA controls are enforced in one place.
 *
 * Legal basis: docs/compliance/DPIA_professional_portal.md;
 * roles/data-minimisation from docs/research/send-framework §F.
 */

import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type ConsentRow = Database['public']['Tables']['consent_records']['Row'];
export type ConsentInsert = Database['public']['Tables']['consent_records']['Insert'];
export type ConsentUpdate = Database['public']['Tables']['consent_records']['Update'];
export type AuditInsert = Database['public']['Tables']['access_audit_log']['Insert'];
export type AuditRow = Database['public']['Tables']['access_audit_log']['Row'];

// ── Controlled vocabularies (§F1 roles, scoped data categories) ──────────────

export type ProfessionalRole =
  | 'SENCO'
  | 'ALNCO'
  | 'EDUCATIONAL_PSYCHOLOGIST'
  | 'SPEECH_AND_LANGUAGE_THERAPIST'
  | 'OCCUPATIONAL_THERAPIST'
  | 'PHYSIOTHERAPIST'
  | 'PAEDIATRICIAN'
  | 'CAMHS_CLINICIAN'
  | 'SPECIALIST_TEACHER'
  | 'TEACHING_ASSISTANT'
  | 'LEARNING_SUPPORT_ASSISTANT'
  | 'SOCIAL_WORKER'
  | 'SCHOOL_NURSE'
  | 'PORTAGE_WORKER'
  | 'EARLY_YEARS_PRACTITIONER'
  | 'NAMED_PERSON_SCOTLAND';

export const ROLE_LABEL: Record<ProfessionalRole, string> = {
  SENCO: 'SENCo',
  ALNCO: 'ALNCo (Wales)',
  EDUCATIONAL_PSYCHOLOGIST: 'Educational Psychologist',
  SPEECH_AND_LANGUAGE_THERAPIST: 'Speech & Language Therapist',
  OCCUPATIONAL_THERAPIST: 'Occupational Therapist',
  PHYSIOTHERAPIST: 'Physiotherapist',
  PAEDIATRICIAN: 'Paediatrician',
  CAMHS_CLINICIAN: 'CAMHS Clinician',
  SPECIALIST_TEACHER: 'Specialist Teacher',
  TEACHING_ASSISTANT: 'Teaching Assistant',
  LEARNING_SUPPORT_ASSISTANT: 'Learning Support Assistant',
  SOCIAL_WORKER: 'Social Worker',
  SCHOOL_NURSE: 'School Nurse',
  PORTAGE_WORKER: 'Portage Worker',
  EARLY_YEARS_PRACTITIONER: 'Early Years Practitioner',
  NAMED_PERSON_SCOTLAND: 'Named Person (Scotland)',
};

export type DataCategory =
  | 'PROFILE_BASICS' // first name, age band, avatar
  | 'OUTCOMES' // EHCP outcomes
  | 'APDR' // Assess-Plan-Do-Review cycles
  | 'COMPLETIONS' // routine completion data / progress
  | 'EMOTIONAL_CHECKINS' // Zones of Regulation
  | 'ENVIRONMENT' // home / school / respite tags
  | 'DOCUMENTS'; // shared PDFs (review pack, profile)

export const CATEGORY_LABEL: Record<DataCategory, string> = {
  PROFILE_BASICS: 'Basic profile (name, age)',
  OUTCOMES: 'EHCP outcomes',
  APDR: 'APDR cycles',
  COMPLETIONS: 'Routine progress',
  EMOTIONAL_CHECKINS: 'Emotional check-ins',
  ENVIRONMENT: 'Home / school context',
  DOCUMENTS: 'Shared documents',
};

/**
 * Least-privilege default data categories per role (§F2). The parent may
 * widen or narrow these when granting consent — this is only the starting
 * point (high-privacy default; ICO Children's Code #7 + #8).
 */
export const ROLE_DEFAULT_CATEGORIES: Record<ProfessionalRole, DataCategory[]> = {
  SENCO: ['PROFILE_BASICS', 'OUTCOMES', 'APDR', 'COMPLETIONS', 'DOCUMENTS'],
  ALNCO: ['PROFILE_BASICS', 'OUTCOMES', 'APDR', 'COMPLETIONS', 'DOCUMENTS'],
  EDUCATIONAL_PSYCHOLOGIST: [
    'PROFILE_BASICS',
    'OUTCOMES',
    'APDR',
    'COMPLETIONS',
    'EMOTIONAL_CHECKINS',
    'DOCUMENTS',
  ],
  SPEECH_AND_LANGUAGE_THERAPIST: ['PROFILE_BASICS', 'OUTCOMES', 'COMPLETIONS', 'DOCUMENTS'],
  OCCUPATIONAL_THERAPIST: [
    'PROFILE_BASICS',
    'OUTCOMES',
    'COMPLETIONS',
    'EMOTIONAL_CHECKINS',
    'DOCUMENTS',
  ],
  PHYSIOTHERAPIST: ['PROFILE_BASICS', 'OUTCOMES', 'COMPLETIONS'],
  PAEDIATRICIAN: ['PROFILE_BASICS', 'OUTCOMES', 'EMOTIONAL_CHECKINS', 'DOCUMENTS'],
  CAMHS_CLINICIAN: ['PROFILE_BASICS', 'OUTCOMES', 'EMOTIONAL_CHECKINS', 'DOCUMENTS'],
  SPECIALIST_TEACHER: ['PROFILE_BASICS', 'OUTCOMES', 'APDR', 'COMPLETIONS', 'DOCUMENTS'],
  TEACHING_ASSISTANT: ['PROFILE_BASICS', 'OUTCOMES', 'COMPLETIONS'],
  LEARNING_SUPPORT_ASSISTANT: ['PROFILE_BASICS', 'OUTCOMES', 'COMPLETIONS'],
  SOCIAL_WORKER: ['PROFILE_BASICS', 'ENVIRONMENT', 'DOCUMENTS'],
  SCHOOL_NURSE: ['PROFILE_BASICS', 'OUTCOMES', 'DOCUMENTS'],
  PORTAGE_WORKER: ['PROFILE_BASICS', 'OUTCOMES', 'COMPLETIONS'],
  EARLY_YEARS_PRACTITIONER: ['PROFILE_BASICS', 'OUTCOMES', 'COMPLETIONS'],
  NAMED_PERSON_SCOTLAND: [
    'PROFILE_BASICS',
    'OUTCOMES',
    'APDR',
    'COMPLETIONS',
    'EMOTIONAL_CHECKINS',
    'DOCUMENTS',
  ],
};

// ── Consent operations (parent-side) ─────────────────────────────────────────

/** Grant a professional scoped, time-limited access to a child's data. */
export async function grantConsent(input: ConsentInsert): Promise<void> {
  const { error } = await supabase.from('consent_records').insert(input);
  if (error) throw error;
}

/** Consents naming the signed-in professional (RLS filters to their own). */
export async function fetchMyConsents(): Promise<ConsentRow[]> {
  try {
    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** All consents (active + historical) for a child, newest first. */
export async function listConsentsForChild(childId: string): Promise<ConsentRow[]> {
  try {
    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function updateConsent(consentId: string, fields: ConsentUpdate): Promise<void> {
  const { error } = await supabase
    .from('consent_records')
    .update(fields)
    .eq('consent_id', consentId);
  if (error) throw error;
}

/** Withdraw a consent immediately. Access checks fail from this point. */
export async function withdrawConsent(consentId: string, byUserId: string): Promise<void> {
  const { error } = await supabase
    .from('consent_records')
    .update({ withdrawn_at: new Date().toISOString(), withdrawn_by: byUserId })
    .eq('consent_id', consentId);
  if (error) throw error;
}

// ── Access-check + audit (enforcement) ───────────────────────────────────────

/** A consent is active if it exists, is not withdrawn, and has not expired. */
export function isConsentActive(c: ConsentRow, on: Date = new Date()): boolean {
  if (c.withdrawn_at) return false;
  const expiry = new Date(`${c.expiry_date}T23:59:59`);
  return expiry >= on;
}

/**
 * Find the active consent (if any) authorising a professional to access a
 * child's data. Matches by account id or email. Returns null if none —
 * callers MUST treat null as "access denied".
 */
export async function findActiveConsent(
  childId: string,
  professional: { id?: string | null; email?: string | null },
): Promise<ConsentRow | null> {
  const rows = await listConsentsForChild(childId);
  const email = professional.email?.toLowerCase() ?? null;
  const active = rows.filter(
    (c) =>
      isConsentActive(c) &&
      (c.professional_id === professional.id ||
        (email !== null && c.professional_email.toLowerCase() === email)),
  );
  return active[0] ?? null;
}

/** Write one append-only audit entry. Never throws to the caller's flow —
 *  a failed audit write is logged, not surfaced, so it can't block a
 *  legitimate action; but the row is best-effort persisted. */
export async function logAccess(entry: AuditInsert): Promise<void> {
  try {
    const { error } = await supabase.from('access_audit_log').insert(entry);
    if (error) console.warn('[audit] insert failed:', error.message);
  } catch (err) {
    console.warn('[audit] insert threw:', err);
  }
}

/** The access log for a child (parent transparency view). */
export async function listAuditForChild(childId: string): Promise<AuditRow[]> {
  try {
    const { data, error } = await supabase
      .from('access_audit_log')
      .select('*')
      .eq('child_id', childId)
      .order('occurred_at', { ascending: false })
      .limit(200);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * mfa.ts — TOTP multi-factor auth for professional accounts.
 *
 * Professional accounts MUST have MFA (DPIA §7 locked decision) before
 * accessing a child's special-category data. This wraps Supabase Auth's
 * built-in TOTP MFA:
 *   - enrol a TOTP factor (QR + secret)
 *   - verify enrolment / verify a login challenge
 *   - report whether the current session needs enrolment or a challenge
 *
 * Assurance levels: aal1 = password only; aal2 = password + a passed MFA
 * challenge. Data access requires aal2.
 */

import { supabase } from './supabase';

export interface MfaState {
  /** No verified TOTP factor exists — the professional must enrol. */
  needsEnrol: boolean;
  /** A verified factor exists but this session hasn't passed a challenge. */
  needsChallenge: boolean;
  /** The verified factor id to challenge against (if any). */
  factorId: string | null;
}

export interface EnrolResult {
  factorId: string;
  /** SVG string of the QR code to scan. */
  qrSvg: string;
  /** The raw TOTP secret to type in manually as a fallback. */
  secret: string;
  /** otpauth:// URI. */
  uri: string;
}

/** Decide whether the current session needs enrolment or a challenge. */
export async function loadMfaState(): Promise<MfaState> {
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const verified = factors?.totp ?? [];
  const currentLevel = aal?.currentLevel ?? 'aal1';
  const nextLevel = aal?.nextLevel ?? 'aal1';

  if (verified.length === 0) {
    return { needsEnrol: true, needsChallenge: false, factorId: null };
  }
  const needsChallenge = currentLevel === 'aal1' && nextLevel === 'aal2';
  return { needsEnrol: false, needsChallenge, factorId: verified[0]?.id ?? null };
}

/** Begin TOTP enrolment. Returns the QR + secret to display. */
export async function enrollTotp(friendlyName = 'RoutineStars'): Promise<EnrolResult> {
  // Clean up any half-finished unverified factor first, so re-enrolment works.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const unverified = (existing?.all ?? []).filter((f) => f.status !== 'verified');
  for (const f of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `${friendlyName}-${Date.now()}`,
  });
  if (error || !data) throw error ?? new Error('Could not start MFA enrolment');
  return {
    factorId: data.id,
    qrSvg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Verify a 6-digit code — used for both enrolment and login challenges. */
export async function verifyCode(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) throw error;
}

/** Remove all TOTP factors (e.g. reset). */
export async function unenrollAll(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
}

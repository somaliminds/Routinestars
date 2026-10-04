/**
 * admin.ts — client helpers for the internal admin panel.
 *
 * Privacy boundary: nothing here can read an individual child's
 * special-category data. Metrics come from the admin_overview_metrics RPC
 * (aggregate counts only); operational reads/writes go through RLS policies
 * gated by is_admin() (which requires aal2 / MFA). Every mutating action is
 * written to admin_audit_log.
 */
import { supabase } from './supabase';
import type { Database, Json } from '@/types/database';

export type AdminUserRow = Database['public']['Tables']['admin_users']['Row'];
export type AppConfigRow = Database['public']['Tables']['app_config']['Row'];

export interface OverviewMetrics {
  users_total: number;
  parents_total: number;
  children_total: number;
  signups_30d: number;
  subs_by_plan: Record<string, number>;
  subs_past_due: number;
  subs_canceled_30d: number;
  consents_active: number;
  activity_sets_builtin: number;
  activity_sets_custom: number;
  completions_7d: number;
}

/** Is the signed-in user an admin? (self-read policy; works pre-MFA.) */
export async function isAdminMember(): Promise<boolean> {
  const { data } = await supabase.from('admin_users').select('user_id').maybeSingle();
  return !!data;
}

/** Aggregate dashboard metrics (RPC enforces is_admin() + aal2). */
export async function fetchOverviewMetrics(): Promise<OverviewMetrics | null> {
  const { data, error } = await supabase.rpc('admin_overview_metrics');
  if (error || !data) return null;
  return data as unknown as OverviewMetrics;
}

/** Append an admin action to the audit trail (best-effort, never throws). */
export async function logAdminAction(
  adminId: string,
  action: string,
  target?: { type?: string; id?: string; detail?: Json },
): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      detail: target?.detail ?? null,
    });
  } catch (e) {
    console.warn('[admin] audit insert failed:', e);
  }
}

// ── Feature flags / config ───────────────────────────────────────────────────

export async function fetchConfig(): Promise<AppConfigRow[]> {
  const { data } = await supabase.from('app_config').select('*').order('key');
  return data ?? [];
}

/** Set a config flag + audit it. */
export async function setConfig(
  adminId: string,
  key: string,
  value: Json,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('app_config')
    .update({ value, updated_by: adminId, updated_at: new Date().toISOString() })
    .eq('key', key);
  if (error) return { error: error.message };
  await logAdminAction(adminId, 'SET_FLAG', { type: 'config', id: key, detail: value });
  return { error: null };
}

/** Read a single flag value with a typed fallback (used app-wide, not just admin). */
export async function getFlag<T extends Json>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
  return (data?.value as T | undefined) ?? fallback;
}

// ── Users & subscriptions (via the admin-users edge function) ────────────────

export interface AdminUserResult {
  found: boolean;
  user?: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    name: string | null;
    role: string | null;
  };
  subscription?: {
    plan: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
  } | null;
  children_count?: number;
}

async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) throw new Error(error.message);
  const res = data as T & { error?: string };
  if (res && typeof res === 'object' && 'error' in res && res.error) throw new Error(res.error);
  return res;
}

export function lookupUser(email: string): Promise<AdminUserResult> {
  return invokeAdminUsers<AdminUserResult>({ action: 'lookup', email });
}

export function setUserPlan(userId: string, plan: string, status = 'active'): Promise<void> {
  return invokeAdminUsers({ action: 'set_plan', user_id: userId, plan, status });
}

export function deleteUserAccount(userId: string): Promise<void> {
  return invokeAdminUsers({ action: 'delete_user', user_id: userId });
}

// ── Oversight (read-only; RLS-gated by is_admin) ─────────────────────────────

export interface ConsentOversightRow {
  consent_id: string;
  child_id: string;
  professional_email: string;
  professional_role: string;
  data_categories: string[];
  expiry_date: string;
  withdrawn_at: string | null;
  created_at: string;
}

export interface AccessAuditRow {
  event_id: string;
  occurred_at: string;
  actor_role: string | null;
  action: string;
  data_categories: string[];
  child_id: string;
}

export interface AiLogRow {
  log_id: string;
  feature: string;
  tool_called: string | null;
  passed_validation: boolean | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface AdminAuditRow {
  event_id: string;
  occurred_at: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
}

/** Active (non-withdrawn, non-expired) professional consents across the platform. */
export async function fetchActiveConsents(): Promise<ConsentOversightRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('consent_records')
    .select(
      'consent_id, child_id, professional_email, professional_role, data_categories, expiry_date, withdrawn_at, created_at',
    )
    .is('withdrawn_at', null)
    .gte('expiry_date', today)
    .order('created_at', { ascending: false })
    .limit(200);
  return (data ?? []) as ConsentOversightRow[];
}

/** Recent professional data-access events (child identified only by id — no child data). */
export async function fetchAccessAudit(): Promise<AccessAuditRow[]> {
  const { data } = await supabase
    .from('access_audit_log')
    .select('event_id, occurred_at, actor_role, action, data_categories, child_id')
    .order('occurred_at', { ascending: false })
    .limit(100);
  return (data ?? []) as AccessAuditRow[];
}

/** Recent AI generation attempts + their governance outcome. */
export async function fetchAiLog(): Promise<AiLogRow[]> {
  const { data } = await supabase
    .from('ai_generation_log')
    .select('log_id, feature, tool_called, passed_validation, rejection_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as AiLogRow[];
}

/** Recent admin actions (the admin's own audit trail). */
export async function fetchAdminAudit(): Promise<AdminAuditRow[]> {
  const { data } = await supabase
    .from('admin_audit_log')
    .select('event_id, occurred_at, admin_id, action, target_type, target_id')
    .order('occurred_at', { ascending: false })
    .limit(100);
  return (data ?? []) as AdminAuditRow[];
}

/**
 * boot-role.ts — the role/PIN routing decision from a get_boot_context()
 * payload (migration 031, extended by 053). Extracted from the AuthGuard so
 * this security-critical logic is pure and unit-tested.
 *
 * Rules (must match the legacy multi-query detection exactly):
 *   - admin membership wins over everything → admin panel (no PIN gate; MFA is
 *     enforced separately at the DB and by the admin MFA gate).
 *   - users.role = 'child' → child (no PIN gate).
 *   - Otherwise a 'parent' base role may resolve to:
 *       · 'ta'           — has an accepted school-TA assignment AND owns no
 *                          child profiles of their own. TA wins over pro.
 *       · 'professional' — has an active consent AND owns no children.
 *       · 'carer'        — an accepted care-team Viewer/Approver (053) who owns
 *                          no children: grandparents, carers, therapists.
 *       · 'parent'       — everyone else; PIN gate applies (needs_pin_setup).
 *   - Only real parents ever see the PIN setup gate.
 */

export type BootRole = 'parent' | 'child' | 'ta' | 'professional' | 'carer' | 'admin';

export interface BootContext {
  role: string;
  own_children: number;
  has_ta_assignment: boolean;
  has_active_consent: boolean;
  needs_pin_setup: boolean;
  is_admin_member?: boolean;
  /** Accepted view_only/approver care-team link (absent before migration 053). */
  has_care_assignment?: boolean;
}

export interface ResolvedRole {
  role: BootRole;
  needsPinSetup: boolean;
}

export function deriveRoleFromBoot(ctx: BootContext): ResolvedRole {
  // Admin membership takes precedence over every other role — an admin lands in
  // the panel. (Use a separate non-admin account to test the parent/child apps.)
  if (ctx.is_admin_member) return { role: 'admin', needsPinSetup: false };

  const baseRole = ctx.role === 'child' ? 'child' : 'parent';
  if (baseRole === 'parent') {
    if (ctx.has_ta_assignment && ctx.own_children === 0) {
      return { role: 'ta', needsPinSetup: false };
    }
    if (ctx.has_active_consent && ctx.own_children === 0) {
      return { role: 'professional', needsPinSetup: false };
    }
    if (ctx.has_care_assignment && ctx.own_children === 0) {
      return { role: 'carer', needsPinSetup: false };
    }
    return { role: 'parent', needsPinSetup: ctx.needs_pin_setup };
  }
  return { role: 'child', needsPinSetup: false };
}

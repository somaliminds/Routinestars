/**
 * Tests for deriveRoleFromBoot — the AuthGuard's routing decision (who lands
 * in the parent / child / TA / professional app). Security-critical: a wrong
 * answer here routes someone into the wrong data surface.
 */
import { deriveRoleFromBoot, type BootContext } from '../src/lib/boot-role';

function ctx(p: Partial<BootContext>): BootContext {
  return {
    role: 'parent',
    own_children: 0,
    has_ta_assignment: false,
    has_active_consent: false,
    needs_pin_setup: false,
    ...p,
  };
}

describe('deriveRoleFromBoot', () => {
  it('routes a child account to the child app with no PIN gate', () => {
    expect(deriveRoleFromBoot(ctx({ role: 'child', needs_pin_setup: true }))).toEqual({
      role: 'child',
      needsPinSetup: false,
    });
  });

  it('routes a plain parent to the parent app and carries the PIN-setup flag', () => {
    expect(deriveRoleFromBoot(ctx({ own_children: 2, needs_pin_setup: true }))).toEqual({
      role: 'parent',
      needsPinSetup: true,
    });
  });

  it('routes a TA (assignment, no own children) to the TA app, no PIN gate', () => {
    expect(deriveRoleFromBoot(ctx({ has_ta_assignment: true }))).toEqual({
      role: 'ta',
      needsPinSetup: false,
    });
  });

  it('routes a consented professional (no own children) to the portal, no PIN gate', () => {
    expect(deriveRoleFromBoot(ctx({ has_active_consent: true }))).toEqual({
      role: 'professional',
      needsPinSetup: false,
    });
  });

  it('TA assignment wins over a professional consent when both are present', () => {
    expect(
      deriveRoleFromBoot(ctx({ has_ta_assignment: true, has_active_consent: true })).role,
    ).toBe('ta');
  });

  it('a parent who ALSO has an assignment/consent but owns children stays a parent', () => {
    // Owning children is the guard that stops a real parent being demoted to a
    // TA/professional surface (they'd lose their own PIN gate + parent tools).
    expect(deriveRoleFromBoot(ctx({ own_children: 1, has_ta_assignment: true })).role).toBe(
      'parent',
    );
    expect(deriveRoleFromBoot(ctx({ own_children: 1, has_active_consent: true })).role).toBe(
      'parent',
    );
  });

  it('never puts a TA or professional behind the PIN gate', () => {
    expect(
      deriveRoleFromBoot(ctx({ has_ta_assignment: true, needs_pin_setup: true })).needsPinSetup,
    ).toBe(false);
    expect(
      deriveRoleFromBoot(ctx({ has_active_consent: true, needs_pin_setup: true })).needsPinSetup,
    ).toBe(false);
  });
});

/**
 * Tests for the professional-portal access predicates — the gate that decides
 * whether a professional may see a child's data. Pure-logic coverage of the
 * consent-active check and the least-privilege role defaults.
 */

// Mock supabase so professional-access can be imported without .env vars.
/* eslint-disable import/first */
jest.mock('../src/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), functions: { invoke: jest.fn() } },
}));

import {
  isConsentActive,
  ROLE_DEFAULT_CATEGORIES,
  CATEGORY_LABEL,
  ROLE_LABEL,
  type ConsentRow,
  type ProfessionalRole,
  type DataCategory,
} from '../src/lib/professional-access';

function consent(partial: Partial<ConsentRow>): ConsentRow {
  return {
    withdrawn_at: null,
    expiry_date: '2999-01-01',
    professional_id: 'p1',
    professional_email: 'x@y.com',
    ...partial,
  } as ConsentRow;
}

describe('isConsentActive', () => {
  const today = new Date('2026-07-13T12:00:00');

  it('is active when not withdrawn and not expired', () => {
    expect(isConsentActive(consent({ expiry_date: '2026-08-01' }), today)).toBe(true);
  });

  it('is INACTIVE the moment it is withdrawn, even if not expired', () => {
    expect(
      isConsentActive(
        consent({ expiry_date: '2026-08-01', withdrawn_at: '2026-07-10T00:00:00Z' }),
        today,
      ),
    ).toBe(false);
  });

  it('is inactive once the expiry date has passed', () => {
    expect(isConsentActive(consent({ expiry_date: '2026-07-12' }), today)).toBe(false);
  });

  it('stays active through the whole of the expiry day (grace to 23:59:59)', () => {
    expect(isConsentActive(consent({ expiry_date: '2026-07-13' }), today)).toBe(true);
    // …and is inactive at the very start of the next day
    expect(
      isConsentActive(consent({ expiry_date: '2026-07-13' }), new Date('2026-07-14T00:00:00')),
    ).toBe(false);
  });
});

describe('ROLE_DEFAULT_CATEGORIES — least privilege', () => {
  const roles = Object.keys(ROLE_DEFAULT_CATEGORIES) as ProfessionalRole[];

  it('covers every role with a labelled name', () => {
    for (const r of roles) expect(ROLE_LABEL[r]).toBeTruthy();
  });

  it('never grants an empty scope and always includes basic profile', () => {
    for (const r of roles) {
      const cats = ROLE_DEFAULT_CATEGORIES[r];
      expect(cats.length).toBeGreaterThan(0);
      expect(cats).toContain('PROFILE_BASICS');
    }
  });

  it('only ever defaults to valid, known data categories', () => {
    const valid = new Set(Object.keys(CATEGORY_LABEL) as DataCategory[]);
    for (const r of roles) {
      for (const c of ROLE_DEFAULT_CATEGORIES[r]) expect(valid.has(c)).toBe(true);
    }
  });

  it('keeps a social worker out of clinical/education data by default', () => {
    // A social worker's default is environment/documents — NOT EHCP outcomes
    // or routine completions (data minimisation, ICO Children's Code #8).
    expect(ROLE_DEFAULT_CATEGORIES.SOCIAL_WORKER).not.toContain('OUTCOMES');
    expect(ROLE_DEFAULT_CATEGORIES.SOCIAL_WORKER).not.toContain('COMPLETIONS');
  });
});

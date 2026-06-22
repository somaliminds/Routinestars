/**
 * Stripe billing setup — Sprint 4.1 + Phase 1 pricing reshape.
 *
 * Tier capabilities are encoded as boolean flags on each plan so gating
 * helpers in subscription.store and screen-level paywalls stay in sync
 * with whatever's actually being sold.
 *
 * Each paid plan has BOTH a monthly and annual Stripe price ID. The
 * webhook (supabase/functions/stripe-webhook) maps both back to the same
 * plan key — the user's plan is "FAMILY" regardless of billing cycle.
 *
 * NOTE: The DB plan column still uses `SCHOOL` for backwards compatibility
 * with the original schema. Display name is "Enterprise".
 */
export interface AnnualPrice {
  /** Price in pence/cents (e.g. 7900 = £79.00) */
  price: number;
  /** Human display, e.g. "£79/yr" */
  priceDisplay: string;
  /** "Save 17%" — shown next to the monthly price during cycle toggle */
  savingsDisplay: string;
  /** Stripe price ID for the annual recurrence */
  stripePriceId: string | undefined;
}

export const STRIPE_PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceDisplay: 'Free',
    stripePriceId: undefined as string | undefined,
    annual: null as AnnualPrice | null,
    maxChildren: 1,
    maxRoutines: 3,
    maxSets: 5,
    // Capability flags — drives gating across the app
    canUseAI: false,
    canAccessReports: false,
    canExportReports: false,
    canShareCareTeam: false,
    canUseEHCP: false,
    canAddCustomSet: false,
    features: [
      '1 child profile',
      'Up to 3 routines',
      '5 built-in activity sets',
      'Basic completion tracking',
    ],
  },
  STARTER: {
    name: 'Starter',
    price: 799,
    priceDisplay: '£7.99/mo',
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_STARTER,
    annual: {
      price: 7900,
      priceDisplay: '£79/yr',
      savingsDisplay: 'Save 17%',
      stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_STARTER_ANNUAL,
    } as AnnualPrice,
    maxChildren: 1,
    maxRoutines: -1, // unlimited
    maxSets: -1,
    canUseAI: false,
    canAccessReports: true, // basic reports only
    canExportReports: false,
    canShareCareTeam: false,
    canUseEHCP: false,
    canAddCustomSet: true,
    features: [
      '1 child profile',
      'Unlimited routines',
      'All 15 built-in activity sets',
      'Custom activity sets',
      'Basic reports',
      'Cloud sync',
    ],
  },
  FAMILY: {
    name: 'Family',
    price: 1999,
    priceDisplay: '£19.99/mo',
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_FAMILY,
    annual: {
      price: 19900,
      priceDisplay: '£199/yr',
      savingsDisplay: 'Save 17%',
      stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_FAMILY_ANNUAL,
    } as AnnualPrice,
    maxChildren: 5,
    maxRoutines: -1,
    maxSets: -1,
    canUseAI: true,
    canAccessReports: true,
    canExportReports: true,
    canShareCareTeam: true,
    canUseEHCP: true,
    canAddCustomSet: true,
    features: [
      'Everything in Starter',
      'Up to 5 children',
      'AI routine generation',
      'Advanced reports + PDF export',
      'EHCP outcomes + evidence packs',
      'Care team — TAs, therapists, grandparents',
      'Cross-environment continuity (home + school)',
    ],
  },
  SCHOOL: {
    name: 'Enterprise',
    price: 19900,
    priceDisplay: '£199/mo',
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_SCHOOL,
    annual: {
      price: 199900,
      priceDisplay: '£1,999/yr',
      savingsDisplay: 'Save 17%',
      stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_SCHOOL_ANNUAL,
    } as AnnualPrice,
    maxChildren: 30,
    maxRoutines: -1,
    maxSets: -1,
    canUseAI: true,
    canAccessReports: true,
    canExportReports: true,
    canShareCareTeam: true,
    canUseEHCP: true,
    canAddCustomSet: true,
    features: [
      'Everything in Family',
      'Up to 30 pupils',
      'Staff accounts (SENCOs, TAs)',
      'School dashboard (coming)',
      'Bulk pupil import (coming)',
      'Intervention + safeguarding logs (coming)',
    ],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;
export type BillingCycle = 'monthly' | 'annual';

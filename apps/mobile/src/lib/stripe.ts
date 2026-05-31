/**
 * Stripe billing setup.
 * Sprint 4.1: Subscription management (Free / Starter / Family / School).
 * Uses Stripe React Native SDK + server-side payment intent creation.
 */
export const STRIPE_PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    maxChildren: 1,
    maxSets: 5,
    features: ['1 child profile', '5 built-in sets', 'Basic reports'],
  },
  STARTER: {
    name: 'Starter',
    price: 799, // pence
    priceDisplay: '£7.99/mo',
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_STARTER,
    maxChildren: 3,
    maxSets: -1, // unlimited
    features: ['Up to 3 children', 'All 15 built-in sets', 'Full reports + export'],
  },
  FAMILY: {
    name: 'Family',
    price: 1499,
    priceDisplay: '£14.99/mo',
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_FAMILY,
    maxChildren: -1,
    maxSets: -1,
    features: ['Unlimited children', 'All sets + custom', 'Reports + care team sharing'],
  },
  SCHOOL: {
    name: 'School',
    price: 4900,
    priceDisplay: '£49/mo',
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_SCHOOL,
    maxChildren: 30,
    maxSets: -1,
    features: ['Up to 30 children', 'All sets + bulk import', 'Teacher portal + analytics'],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

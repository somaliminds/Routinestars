/**
 * create-checkout — Sprint 4.1
 *
 * Creates a Stripe Checkout Session for a subscription upgrade.
 * Called from the mobile app when user selects a paid plan.
 *
 * Body: { userId: string, priceId: string, successUrl: string, cancelUrl: string }
 * Returns: { url: string } — redirect to Stripe hosted checkout
 */
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { userId, priceId, successUrl, cancelUrl } = await req.json() as {
    userId?: string;
    priceId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!userId || !priceId) {
    return new Response(JSON.stringify({ error: 'userId and priceId required' }), { status: 400 });
  }

  // Get or create Stripe customer
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  let customerId = existingSub?.stripe_customer_id as string | undefined;

  if (!customerId) {
    // Look up user email
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: userId },
    success_url: successUrl ?? 'routinestars://subscription/success',
    cancel_url: cancelUrl ?? 'routinestars://subscription/cancel',
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url }), { status: 200 });
});

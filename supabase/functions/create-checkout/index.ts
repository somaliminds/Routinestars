/**
 * create-checkout — Sprint 4.1
 *
 * Creates a Stripe Checkout Session for a subscription upgrade.
 * Called from the mobile app when user selects a paid plan.
 *
 * Body: { userId: string, priceId: string, successUrl: string, cancelUrl: string }
 * Returns: { url: string } — redirect to Stripe hosted checkout
 */
import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) {
  console.error('FATAL: STRIPE_SECRET_KEY is not set in Edge Function secrets');
}
const stripe = new Stripe(stripeKey ?? 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const { userId, priceId, successUrl, cancelUrl } = await req.json() as {
    userId?: string;
    priceId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!userId || !priceId) {
    return new Response(JSON.stringify({ error: 'userId and priceId required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // Authorisation — verify the caller IS the user they claim to be.
  // The gateway already validated the JWT (verify_jwt = true), but that
  // only proves the caller has SOME valid project JWT. Without this
  // check, any authenticated user could pass another user's userId
  // and create a Stripe customer linked to that victim's email.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }
  const supabaseAsUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user: authUser }, error: authErr } = await supabaseAsUser.auth.getUser();
  if (authErr || !authUser) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }
  if (authUser.id !== userId) {
    console.warn('[create-checkout] userId mismatch', { auth: authUser.id, body: userId });
    return new Response(JSON.stringify({ error: 'forbidden: userId does not match authenticated user' }), {
      status: 403,
      headers: JSON_HEADERS,
    });
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

  // Stripe requires HTTPS success/cancel URLs. Use our subscription-redirect
  // edge function to bridge HTTPS → routinestars:// custom scheme on the device.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const defaultSuccess = `${supabaseUrl}/functions/v1/subscription-redirect?status=success`;
  const defaultCancel = `${supabaseUrl}/functions/v1/subscription-redirect?status=cancel`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: userId },
    success_url: successUrl ?? defaultSuccess,
    cancel_url: cancelUrl ?? defaultCancel,
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: JSON_HEADERS,
  });
});

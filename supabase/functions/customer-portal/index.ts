/**
 * customer-portal — Sprint 4.1
 *
 * Creates a Stripe Customer Portal session for self-serve billing management.
 * Body: { userId: string }
 * Returns: { url: string }
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

  const { userId } = await req.json() as { userId?: string };
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!sub?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id as string,
    return_url: 'routinestars://settings',
  });

  return new Response(JSON.stringify({ url: session.url }), { status: 200 });
});

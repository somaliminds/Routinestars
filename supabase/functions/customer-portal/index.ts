/**
 * customer-portal — Sprint 4.1
 *
 * Creates a Stripe Customer Portal session for self-serve billing management.
 * Body: { userId: string }
 * Returns: { url: string } on success, { error: string } on failure.
 *
 * The most common failure (silent until you actually call it) is the
 * Stripe Customer Portal not being activated in the Stripe Dashboard.
 * Operator fix: open https://dashboard.stripe.com/test/settings/billing/portal
 * (or /settings/billing/portal in live mode), confirm the defaults, click
 * Save. After that, this function works forever.
 */
import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Turn a raw Stripe error into something the parent can act on, without
 * leaking internals. Falls back to the raw message for unknown shapes.
 */
function explainStripeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // The single most common operator-side failure.
  if (
    message.includes('No configuration provided') ||
    message.includes('customer portal settings')
  ) {
    return (
      'Stripe Customer Portal is not yet activated for this account. ' +
      'An admin needs to open the Stripe Dashboard → Settings → Billing → ' +
      'Customer Portal, confirm the defaults and click Save. After that, ' +
      'this button will work.'
    );
  }
  if (message.includes('No such customer')) {
    return 'Your Stripe customer record could not be found. Please contact support.';
  }
  return `Could not open billing portal: ${message}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let userId: string | undefined;
  try {
    const body = (await req.json()) as { userId?: string };
    userId = body.userId;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // Authorisation — verify the caller IS the user they claim to be.
  // Without this check, any authenticated user could open the billing
  // portal for another user (view invoices, cancel subscription,
  // change payment method).
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
    console.warn('[customer-portal] userId mismatch', { auth: authUser.id, body: userId });
    return new Response(JSON.stringify({ error: 'forbidden: userId does not match authenticated user' }), {
      status: 403,
      headers: JSON_HEADERS,
    });
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return new Response(
      JSON.stringify({
        error:
          'No Stripe customer on file yet. Upgrade to a paid plan first — ' +
          'billing management appears here once a checkout has completed.',
      }),
      { status: 404, headers: JSON_HEADERS },
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      return_url: 'routinestars://settings',
    });
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('customer-portal: stripe.billingPortal.sessions.create failed', err);
    return new Response(JSON.stringify({ error: explainStripeError(err) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});

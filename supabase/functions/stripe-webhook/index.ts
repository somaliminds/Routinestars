/**
 * stripe-webhook — Sprint 4.1
 *
 * Receives Stripe webhook events and syncs subscription state
 * to the `subscriptions` table.
 *
 * Events handled:
 *  - checkout.session.completed
 *  - customer.subscription.updated
 *  - customer.subscription.deleted
 *  - invoice.payment_failed
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

// Map Stripe price IDs → plan keys. Each plan has BOTH a monthly and
// annual Stripe price; the webhook treats them as the same plan key
// (Family monthly and Family annual are both "FAMILY" in the DB).
function priceIdToPlan(priceId: string | null | undefined): string {
  const map: Record<string, string> = {
    [Deno.env.get('STRIPE_PRICE_ID_STARTER') ?? '']: 'STARTER',
    [Deno.env.get('STRIPE_PRICE_ID_STARTER_ANNUAL') ?? '']: 'STARTER',
    [Deno.env.get('STRIPE_PRICE_ID_FAMILY') ?? '']: 'FAMILY',
    [Deno.env.get('STRIPE_PRICE_ID_FAMILY_ANNUAL') ?? '']: 'FAMILY',
    [Deno.env.get('STRIPE_PRICE_ID_SCHOOL') ?? '']: 'SCHOOL',
    [Deno.env.get('STRIPE_PRICE_ID_SCHOOL_ANNUAL') ?? '']: 'SCHOOL',
  };
  // Defensive — empty-string env vars would collide on map key ''
  delete map[''];
  return map[priceId ?? ''] ?? 'FREE';
}

async function upsertSubscription(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}) {
  console.log('[stripe-webhook] upserting subscription:', JSON.stringify(params));
  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      plan: params.plan,
      status: params.status,
      current_period_end: params.currentPeriodEnd
        ? new Date(params.currentPeriodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.error('[stripe-webhook] upsert failed:', error.message, error.details);
    throw error;
  }
  console.log('[stripe-webhook] upsert OK');
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    console.error('[stripe-webhook] missing signature or secret');
    return new Response(JSON.stringify({ error: 'Missing signature' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (sigErr) {
    console.error('[stripe-webhook] signature verification failed:', sigErr);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  console.log('[stripe-webhook] received event:', event.type, 'id:', event.id);

  // Idempotency (audit H2) — Stripe retries deliver duplicates. Claim the
  // event id first; a unique violation means we've already handled it, so ack
  // with 200 to stop the retries. If claiming fails for any other reason, we
  // still process (never drop a real event) but skip the rollback.
  let claimed = false;
  const { error: claimErr } = await supabase
    .from('processed_stripe_events')
    .insert({ event_id: event.id, event_type: event.type });
  if (claimErr) {
    if (claimErr.code === '23505') {
      console.log('[stripe-webhook] duplicate event, skipping:', event.id);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }
    console.error('[stripe-webhook] idempotency claim error (processing anyway):', claimErr.message);
  } else {
    claimed = true;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[stripe-webhook] checkout session:', session.id, 'mode:', session.mode);
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.user_id;
        if (!userId) {
          console.error('[stripe-webhook] no user_id in metadata');
          break;
        }

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price.id;
        console.log('[stripe-webhook] mapping priceId:', priceId, '→', priceIdToPlan(priceId));

        await upsertSubscription({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          plan: priceIdToPlan(priceId),
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;

        // Look up user_id from existing row
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (existing) {
          await upsertSubscription({
            userId: existing.user_id as string,
            stripeCustomerId: sub.customer as string,
            stripeSubscriptionId: sub.id,
            plan: priceIdToPlan(priceId),
            status: sub.status,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from('subscriptions')
          .update({ plan: 'FREE', status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription as string);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[stripe-webhook] handler error:', msg);
    if (stack) console.error(stack);
    // Processing failed — release our idempotency claim so Stripe's retry
    // reprocesses this event instead of being skipped as a duplicate.
    if (claimed) {
      await supabase.from('processed_stripe_events').delete().eq('event_id', event.id);
    }
    return new Response(JSON.stringify({ error: 'Handler failed', detail: msg }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});

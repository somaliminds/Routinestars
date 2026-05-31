/**
 * subscription-redirect — Supabase Edge Function
 *
 * Stripe Checkout success/cancel URLs must be HTTPS. Browsers can't redirect
 * from HTTP straight to a routinestars:// custom scheme reliably (404). So
 * Stripe redirects here over HTTPS, and this function 302-redirects to the
 * app's deep link, which the OS then hands off to RoutineStars.
 *
 * Query params:
 *   ?status=success  →  routinestars://subscription/success
 *   ?status=cancel   →  routinestars://subscription/cancel
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve((req: Request) => {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const safeStatus = status === 'success' || status === 'cancel' ? status : 'cancel';
  const deepLink = `routinestars://subscription/${safeStatus}`;

  const headers = new Headers();
  headers.set('Location', deepLink);
  headers.set('Cache-Control', 'no-store');

  return new Response(null, { status: 302, headers });
});

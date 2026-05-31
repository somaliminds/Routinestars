/**
 * reset-redirect — Supabase Edge Function
 *
 * Returns a 302 redirect to the routinestars:// deep link.
 * Browsers follow the redirect and the OS hands off to the RoutineStars app.
 *
 * Email clients allow https:// links, so this bridges from email to the app.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve((req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  // Basic shape check — token is 64-char hex from request-pin-reset
  const safeToken = /^[a-f0-9]{16,128}$/i.test(token) ? token : '';
  const deepLink = `routinestars://reset-pin?token=${encodeURIComponent(safeToken)}`;

  const headers = new Headers();
  headers.set('Location', deepLink);
  headers.set('Cache-Control', 'no-store');

  return new Response(null, { status: 302, headers });
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const PIN_REGEX = /^\d{4}$/;

// Brute-force policy (audit C2): lock the account for LOCKOUT_MINUTES after
// MAX_ATTEMPTS consecutive failures. Only the signed-in owner can attempt, so
// this cannot be used to lock out a victim.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const user_id = body.user_id;
    const pin = body.pin;

    if (typeof user_id !== 'string' || !user_id) {
      return new Response(JSON.stringify({ valid: false, error: 'user_id required' }), {
        status: 400,
        headers: CORS,
      });
    }
    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'PIN must be exactly 4 digits (0-9)' }),
        { status: 400, headers: CORS },
      );
    }

    // Authorisation (audit C2) — only the account owner may test its own PIN.
    // The client always calls this with the signed-in parent's session, so the
    // JWT is present and its id equals user_id. Requiring it stops anonymous
    // brute-forcing AND stops a third party locking out someone else's PIN.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ valid: false, error: 'unauthorized' }), {
        status: 401,
        headers: CORS,
      });
    }
    const supabaseAsUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user: authUser },
      error: authErr,
    } = await supabaseAsUser.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ valid: false, error: 'unauthorized' }), {
        status: 401,
        headers: CORS,
      });
    }
    if (authUser.id !== user_id) {
      return new Response(JSON.stringify({ valid: false, error: 'forbidden' }), {
        status: 403,
        headers: CORS,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: profile, error } = await supabase
      .from('parent_profiles')
      .select('pin_hash, pin_attempt_count, pin_locked_until')
      .eq('user_id', user_id)
      .single();

    if (error) return new Response(JSON.stringify({ valid: false }), { headers: CORS });

    // Locked out? Reject without even checking the PIN.
    const lockedUntil = profile?.pin_locked_until
      ? new Date(profile.pin_locked_until as string)
      : null;
    if (lockedUntil && lockedUntil > new Date()) {
      const retryAfter = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ valid: false, locked: true, retry_after_seconds: retryAfter }),
        { status: 429, headers: CORS },
      );
    }

    // No PIN set yet — grant access so parent can set one in Settings.
    if (!profile?.pin_hash) return new Response(JSON.stringify({ valid: true }), { headers: CORS });

    const valid = bcrypt.compareSync(pin, profile.pin_hash as string);

    if (valid) {
      // Clear any accumulated failures / lock on success.
      if ((profile.pin_attempt_count ?? 0) > 0 || lockedUntil) {
        await supabase
          .from('parent_profiles')
          .update({ pin_attempt_count: 0, pin_locked_until: null })
          .eq('user_id', user_id);
      }
      return new Response(JSON.stringify({ valid: true }), { headers: CORS });
    }

    // Failure — increment; lock once the threshold is hit.
    const nextCount = (profile.pin_attempt_count ?? 0) + 1;
    if (nextCount >= MAX_ATTEMPTS) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
      await supabase
        .from('parent_profiles')
        .update({ pin_attempt_count: 0, pin_locked_until: until })
        .eq('user_id', user_id);
      return new Response(
        JSON.stringify({ valid: false, locked: true, retry_after_seconds: LOCKOUT_MINUTES * 60 }),
        { status: 429, headers: CORS },
      );
    }

    await supabase
      .from('parent_profiles')
      .update({ pin_attempt_count: nextCount })
      .eq('user_id', user_id);
    return new Response(
      JSON.stringify({ valid: false, attempts_remaining: MAX_ATTEMPTS - nextCount }),
      { headers: CORS },
    );
  } catch (err) {
    console.error('verify-pin error:', err);
    return new Response(JSON.stringify({ valid: false, error: 'Internal error' }), {
      status: 500,
      headers: CORS,
    });
  }
});

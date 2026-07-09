import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const PIN_REGEX = /^\d{4}$/;

// Reset tokens are stored HASHED at rest (audit M3) — a DB read never reveals
// a live token. The emailed link carries the raw token; we hash it here to
// look up the row.
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const token = body.token;
    const newPin = body.newPin;

    if (typeof token !== 'string' || !token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token required' }),
        { status: 400, headers: CORS },
      );
    }

    if (typeof newPin !== 'string' || !PIN_REGEX.test(newPin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN must be exactly 4 digits (0-9)' }),
        { status: 400, headers: CORS },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const tokenHash = await sha256Hex(token);
    const { data: profile, error: fetchError } = await supabase
      .from('parent_profiles')
      .select('user_id, pin_reset_expires_at')
      .eq('pin_reset_token', tokenHash)
      .single();

    if (fetchError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired reset link' }),
        { status: 400, headers: CORS },
      );
    }

    if (new Date(profile.pin_reset_expires_at as string) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Reset link has expired. Please request a new one.' }),
        { status: 400, headers: CORS },
      );
    }

    const newHash = bcrypt.hashSync(newPin, 12);

    const { error: updateError } = await supabase
      .from('parent_profiles')
      .update({
        pin_hash: newHash,
        pin_reset_token: null,
        pin_reset_expires_at: null,
        // A reset means they'd forgotten — clear any brute-force lock too (C2).
        pin_attempt_count: 0,
        pin_locked_until: null,
      })
      .eq('user_id', profile.user_id as string);

    if (updateError) {
      console.error('reset-pin update error:', updateError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not save new PIN' }),
        { status: 500, headers: CORS },
      );
    }

    return new Response(JSON.stringify({ success: true }), { headers: CORS });
  } catch (err) {
    console.error('reset-pin error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: CORS },
    );
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const PIN_REGEX = /^\d{4}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const user_id = body.user_id;
    const pin = body.pin;

    if (typeof user_id !== 'string' || !user_id) {
      return new Response(JSON.stringify({ valid: false, error: 'user_id required' }), { status: 400, headers: CORS });
    }
    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'PIN must be exactly 4 digits (0-9)' }),
        { status: 400, headers: CORS },
      );
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile, error } = await supabase
      .from('parent_profiles')
      .select('pin_hash')
      .eq('user_id', user_id)
      .single();

    if (error) return new Response(JSON.stringify({ valid: false }), { headers: CORS });

    // No PIN set yet — grant access so parent can set one in Settings
    if (!profile?.pin_hash) return new Response(JSON.stringify({ valid: true }), { headers: CORS });

    const valid = bcrypt.compareSync(pin, profile.pin_hash as string);
    return new Response(JSON.stringify({ valid }), { headers: CORS });
  } catch (err) {
    console.error('verify-pin error:', err);
    return new Response(JSON.stringify({ valid: false, error: 'Internal error' }), { status: 500, headers: CORS });
  }
});

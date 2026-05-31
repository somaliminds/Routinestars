import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const PIN_REGEX = /^\d{4}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pin = body.pin;

    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN must be exactly 4 digits (0-9)' }),
        { status: 400, headers: CORS },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const hash = bcrypt.hashSync(pin, 12);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: updateError } = await supabaseAdmin
      .from('parent_profiles')
      .update({ pin_hash: hash })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('hash-pin:', updateError.message);
      return new Response(JSON.stringify({ success: false, error: 'Could not save PIN' }), { status: 500, headers: CORS });
    }
    return new Response(JSON.stringify({ success: true }), { headers: CORS });
  } catch (err) {
    console.error('hash-pin error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), { status: 500, headers: CORS });
  }
});

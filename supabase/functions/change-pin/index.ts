import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const PIN_REGEX = /^\d{4}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const userId = body.userId;
    const currentPin = body.currentPin;
    const newPin = body.newPin;

    if (typeof userId !== 'string' || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId required' }),
        { status: 400, headers: CORS },
      );
    }

    if (typeof newPin !== 'string' || !PIN_REGEX.test(newPin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'New PIN must be exactly 4 digits (0-9)' }),
        { status: 400, headers: CORS },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile, error: fetchError } = await supabase
      .from('parent_profiles')
      .select('pin_hash')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 404, headers: CORS },
      );
    }

    if (profile?.pin_hash) {
      if (typeof currentPin !== 'string' || !PIN_REGEX.test(currentPin)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Current PIN must be exactly 4 digits (0-9)' }),
          { status: 400, headers: CORS },
        );
      }
      const currentValid = bcrypt.compareSync(currentPin, profile.pin_hash as string);
      if (!currentValid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Current PIN is incorrect' }),
          { status: 403, headers: CORS },
        );
      }
    }

    const newHash = bcrypt.hashSync(newPin, 12);

    const { error: updateError } = await supabase
      .from('parent_profiles')
      .update({ pin_hash: newHash })
      .eq('user_id', userId);

    if (updateError) {
      console.error('change-pin update error:', updateError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not update PIN' }),
        { status: 500, headers: CORS },
      );
    }

    return new Response(JSON.stringify({ success: true }), { headers: CORS });
  } catch (err) {
    console.error('change-pin error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: CORS },
    );
  }
});

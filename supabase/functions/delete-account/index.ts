import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

/**
 * delete-account — UK GDPR right-to-erasure (audit H3).
 *
 * Deletes the CALLER'S OWN account and all their data. There is no userId
 * parameter: the target is always auth.uid() from the verified JWT, so the
 * endpoint cannot be used to delete anyone else's account.
 *
 * Two steps, because public.users has no FK to auth.users:
 *   1. Delete the public.users row — cascades to child_profiles, subscriptions,
 *      parent_profiles, completions, schedules, etc. via ON DELETE CASCADE.
 *   2. Delete the auth identity via the admin API.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Verify the caller and resolve their own id (no body-supplied userId).
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
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
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: CORS,
      });
    }

    const uid = authUser.id;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Cascade-delete all public data owned by this user.
    const { error: delRowErr } = await admin.from('users').delete().eq('user_id', uid);
    if (delRowErr) {
      console.error('[delete-account] public.users delete failed:', delRowErr.message);
      return new Response(JSON.stringify({ success: false, error: 'delete_failed' }), {
        status: 500,
        headers: CORS,
      });
    }

    // 2. Remove the auth identity. If this fails after step 1, the account is
    //    already unusable (no public.users row) but retry is safe/idempotent.
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(uid);
    if (delAuthErr) {
      console.error('[delete-account] auth delete failed:', delAuthErr.message);
      return new Response(
        JSON.stringify({ success: false, error: 'auth_delete_failed', partial: true }),
        { status: 500, headers: CORS },
      );
    }

    return new Response(JSON.stringify({ success: true }), { headers: CORS });
  } catch (err) {
    console.error('[delete-account] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: CORS,
    });
  }
});

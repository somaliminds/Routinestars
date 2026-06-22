/**
 * notify-parent — Sprint 2.4
 * Supabase Edge Function (Deno runtime)
 *
 * Sends an Expo Push Notification to the parent when their child
 * completes an activity set that requires approval.
 *
 * Request body:
 *   { child_id: string, completion_id: string, set_name: string, child_name: string }
 *
 * Returns:
 *   { sent: boolean, ticket?: object, error?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface RequestBody {
  child_id: string;
  completion_id: string;
  set_name: string;
  child_name: string;
}

interface ExpoPushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: Record<string, string>;
  priority: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body = (await req.json()) as Partial<RequestBody>;
    const { child_id, completion_id, set_name, child_name } = body;

    if (!child_id || !completion_id || !set_name || !child_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: child_id, completion_id, set_name, child_name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Authorisation — verify the caller is the child or their parent.
    // Without this, any authenticated user could spam push notifications
    // to any victim parent (notification spam = potential app uninstall +
    // ICO complaint).
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', sent: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAsUser = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authErr } = await supabaseAsUser.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', sent: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const callerId = authData.user.id;

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find the parent linked to this child + verify caller is authorised
    const { data: childProfile, error: childErr } = await supabase
      .from('child_profiles')
      .select('parent_id, user_id')
      .eq('profile_id', child_id)
      .single();

    // Caller must be the child OR the child's parent
    if (childProfile && childProfile.parent_id !== callerId && childProfile.user_id !== callerId) {
      console.warn('[notify-parent] authorisation denied', { caller: callerId, child_id });
      return new Response(
        JSON.stringify({ error: 'forbidden: not authorised for this child', sent: false }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (childErr || !childProfile) {
      return new Response(
        JSON.stringify({ error: 'Child not found', sent: false }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 2. Get the parent's push token
    const { data: parentProfile, error: parentErr } = await supabase
      .from('parent_profiles')
      .select('expo_push_token')
      .eq('user_id', childProfile.parent_id)
      .single();

    if (parentErr || !parentProfile) {
      return new Response(
        JSON.stringify({ error: 'Parent profile not found', sent: false }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const pushToken = parentProfile.expo_push_token;

    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      // No token registered — not an error, parent just hasn't enabled notifications
      return new Response(
        JSON.stringify({ sent: false, reason: 'No push token registered for parent' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 3. Send via Expo Push API
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title: `⭐ ${child_name} needs your approval!`,
      body: `${child_name} finished "${set_name}" — tap to review and approve.`,
      data: {
        screen: 'approval',
        completion_id,
        child_id,
      },
      priority: 'high',
    };

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const ticket = await expoRes.json();

    return new Response(
      JSON.stringify({ sent: true, ticket }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, sent: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

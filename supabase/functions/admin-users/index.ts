import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

/**
 * admin-users — privileged admin operations that can't go through client RLS:
 *   - lookup   : find a user by email (email lives in auth.users) + their
 *                subscription and child COUNT (never child data).
 *   - set_plan : comp / override a subscription plan (upsert, service role).
 *   - delete_user : erase another user's account (public cascade + auth).
 *
 * Authorisation: the caller must be an MFA'd admin. We verify that by calling
 * the DB gate is_admin() AS THE CALLER (it requires admin_users membership AND
 * aal2), then use the service-role client only after that check passes. Every
 * action is written to admin_audit_log.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Caller-scoped client — is_admin() enforces admin membership + aal2.
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminErr } = await caller.rpc('is_admin');
    if (adminErr || isAdmin !== true) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
    }
    const {
      data: { user: callerUser },
    } = await caller.auth.getUser();
    const adminId = callerUser?.id;
    if (!adminId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
    }

    const admin = createClient(url, serviceKey);
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action;

    // ── lookup ───────────────────────────────────────────────
    if (action === 'lookup') {
      const email = String(body.email ?? '').toLowerCase().trim();
      if (!email.includes('@')) {
        return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers: CORS });
      }
      const listRes = await fetch(
        `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      const listJson = (await listRes.json()) as {
        users?: Array<{ id: string; email: string; created_at: string; last_sign_in_at: string | null }>;
      };
      const au = (listJson.users ?? []).find((u) => u.email?.toLowerCase() === email);
      if (!au) return new Response(JSON.stringify({ found: false }), { headers: CORS });

      const { data: pu } = await admin
        .from('users')
        .select('name, role, created_at')
        .eq('user_id', au.id)
        .maybeSingle();
      const { data: sub } = await admin
        .from('subscriptions')
        .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
        .eq('user_id', au.id)
        .maybeSingle();
      const { count: childCount } = await admin
        .from('child_profiles')
        .select('profile_id', { count: 'exact', head: true })
        .eq('parent_id', au.id);

      await admin.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'USER_LOOKUP',
        target_type: 'user',
        target_id: au.id,
      });

      return new Response(
        JSON.stringify({
          found: true,
          user: {
            id: au.id,
            email: au.email,
            created_at: au.created_at,
            last_sign_in_at: au.last_sign_in_at,
            name: pu?.name ?? null,
            role: pu?.role ?? null,
          },
          subscription: sub ?? null,
          children_count: childCount ?? 0,
        }),
        { headers: CORS },
      );
    }

    // ── set_plan (comp / override) ───────────────────────────
    if (action === 'set_plan') {
      const userId = String(body.user_id ?? '');
      const plan = String(body.plan ?? '');
      const status = String(body.status ?? 'active');
      if (!userId || !['FREE', 'STARTER', 'FAMILY', 'SCHOOL'].includes(plan)) {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: CORS });
      }
      const { error } = await admin
        .from('subscriptions')
        .upsert(
          { user_id: userId, plan, status, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
      }
      await admin.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'SET_PLAN',
        target_type: 'subscription',
        target_id: userId,
        detail: { plan, status },
      });
      return new Response(JSON.stringify({ success: true }), { headers: CORS });
    }

    // ── delete_user ──────────────────────────────────────────
    if (action === 'delete_user') {
      const userId = String(body.user_id ?? '');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: CORS });
      }
      if (userId === adminId) {
        return new Response(JSON.stringify({ error: 'cannot delete your own admin account here' }), {
          status: 400,
          headers: CORS,
        });
      }
      // Delete public data FIRST and ABORT if it fails. public.users has no FK
      // to auth.users, so if we deleted the auth identity first (or ignored this
      // error) a failed cascade — e.g. a NO ACTION FK from a cross-family
      // care-team reference (completions.approved_by, day_schedules.created_by,
      // lockout_events.unlocked_by), a deadlock, or a statement timeout on a
      // heavy account — would orphan the child-data subtree with no owning auth
      // user while we falsely reported success. Fail loudly instead.
      const { error: delRowErr } = await admin.from('users').delete().eq('user_id', userId);
      if (delRowErr) {
        return new Response(JSON.stringify({ error: 'delete_failed', detail: delRowErr.message }), {
          status: 500,
          headers: CORS,
        });
      }
      const { error: authErr } = await admin.auth.admin.deleteUser(userId);
      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message, partial: true }), {
          status: 500,
          headers: CORS,
        });
      }
      await admin.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'DELETE_USER',
        target_type: 'user',
        target_id: userId,
      });
      return new Response(JSON.stringify({ success: true }), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: CORS });
  } catch (err) {
    console.error('[admin-users] error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: CORS });
  }
});

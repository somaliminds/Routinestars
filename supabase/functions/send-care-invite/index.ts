/**
 * send-care-invite — Supabase Edge Function
 *
 * Emails the person a parent has just added to a child's care team.
 *
 * Body: { member_id } — the care_team_members row the parent just created.
 * The recipient, child's name, inviter's name and role all come from the
 * DATABASE, never from the request, and the caller must be the parent who owns
 * that row. (Until Oct 2026 the function trusted invitee_email / parent_name /
 * child_name from the body and put them in the HTML unescaped, so any signed-in
 * account could send branded RoutineStars email with any content to anyone.)
 *
 * Returns: { sent: true } | { sent: false, reason: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

/** Escape text for safe use inside the HTML email. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Role = 'view_only' | 'approver' | 'school_ta';

function roleCopy(role: Role, child: string): { label: string; description: string } {
  if (role === 'approver') {
    return {
      label: 'Approver',
      description: `You can see ${child}'s daily routine and progress, and approve activities when ${child} finishes them.`,
    };
  }
  if (role === 'school_ta') {
    return {
      label: 'School TA',
      description: `You can see ${child}'s routine for the school day and mark activities done at school.`,
    };
  }
  return {
    label: 'Viewer',
    description: `You can see ${child}'s daily routine, progress and badges.`,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // 1. Who is asking?
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ sent: false, reason: 'unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await asUser.auth.getUser();
    if (authErr || !authData?.user) return json({ sent: false, reason: 'unauthorized' }, 401);
    const callerId = authData.user.id;

    const { member_id } = (await req.json()) as { member_id?: string };
    if (!member_id) return json({ sent: false, reason: 'member_id is required' }, 400);

    // 2. The invite must exist and belong to the caller. Same answer for "no
    //    such invite" and "not yours", so the endpoint can't probe ids.
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: member } = await admin
      .from('care_team_members')
      .select('email, role, parent_id, child_id')
      .eq('member_id', member_id)
      .maybeSingle();
    if (!member || member.parent_id !== callerId) {
      return json({ sent: false, reason: 'not found' }, 404);
    }

    const [{ data: childRow }, { data: parentRow }] = await Promise.all([
      admin.from('child_profiles').select('child_name').eq('profile_id', member.child_id).maybeSingle(),
      admin.from('users').select('name').eq('user_id', callerId).maybeSingle(),
    ]);
    const child = (childRow?.child_name as string | undefined)?.trim() || 'their child';
    const parent = (parentRow?.name as string | undefined)?.trim() || 'A parent';
    const { label, description } = roleCopy(member.role as Role, child);

    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@routinestars.co.uk';
    if (!resendKey || resendKey.startsWith('re_your')) {
      console.error('[send-care-invite] RESEND_API_KEY not configured');
      return json({ sent: false, reason: 'Email service not configured' }, 500);
    }

    const html = buildInviteEmail({
      parent: esc(parent),
      child: esc(child),
      roleLabel: esc(label),
      roleDescription: esc(description),
      email: esc(member.email as string),
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `RoutineStars <${fromEmail}>`,
        to: member.email,
        subject: `${parent} has invited you to ${child}'s care team`,
        html,
      }),
    });

    if (!res.ok) {
      console.error('[send-care-invite] Resend error:', res.status, await res.text());
      return json({ sent: false, reason: `Resend ${res.status}` });
    }
    return json({ sent: true });
  } catch (err) {
    console.error('[send-care-invite] handler error:', err instanceof Error ? err.message : err);
    return json({ sent: false, reason: 'Internal error' }, 500);
  }
});

// ── Email template (every interpolated value is pre-escaped) ─────────────────
function buildInviteEmail(d: {
  parent: string;
  child: string;
  roleLabel: string;
  roleDescription: string;
  email: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>You're invited to a RoutineStars care team</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F5F0FF;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:520px;">

          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="font-size:48px;line-height:1;">🌟</div>
              <div style="font-size:22px;font-weight:800;color:#5B21B6;margin-top:8px;letter-spacing:-0.3px;">
                RoutineStars
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color:#FFFFFF;border-radius:24px;padding:36px 32px;box-shadow:0 4px 16px rgba(124,58,237,0.10);">

              <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
                You've been invited to ${d.child}'s care team 🎉
              </h1>

              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#374151;">
                <strong>${d.parent}</strong> has added you to ${d.child}'s care team on RoutineStars.
              </p>

              <div style="background-color:#F5F0FF;border-radius:16px;padding:16px 18px;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#7C3AED;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
                  Your role
                </div>
                <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">
                  ${d.roleLabel}
                </div>
                <div style="font-size:14px;line-height:1.5;color:#6B7280;">
                  ${d.roleDescription}
                </div>
              </div>

              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#374151;">
                <strong>What now?</strong> Get RoutineStars and sign up (or sign in) with <strong>${d.email}</strong> — the address this invitation was sent to. We'll link you to ${d.child}'s care team automatically.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <a href="https://routinestars.app"
                       style="display:inline-block;background-color:#7C3AED;color:#FFFFFF;text-decoration:none;padding:16px 36px;border-radius:16px;font-size:17px;font-weight:700;">
                      Get the App
                    </a>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#F3F4F6;margin:24px 0 16px 0;"></div>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#9CA3AF;">
                Didn't expect this invitation? You can safely ignore this email — your details are kept private.
              </p>

            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#5B21B6;">
                Building independence, one star at a time ⭐
              </p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                RoutineStars · SEN routine companion for autistic children
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

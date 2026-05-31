/**
 * send-care-invite — Supabase Edge Function
 *
 * Sends a branded invitation email via Resend when a parent adds a
 * teacher / therapist / family member to their care team.
 *
 * Body: { invitee_email, parent_name, child_name, role: 'view_only'|'approver' }
 * Returns: { sent: true } | { sent: false, reason: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

interface RequestBody {
  invitee_email?: string;
  parent_name?: string;
  child_name?: string;
  role?: 'view_only' | 'approver';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS,
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { invitee_email, parent_name, child_name, role } = body;

    if (!invitee_email || !invitee_email.includes('@')) {
      return new Response(JSON.stringify({ sent: false, reason: 'Invalid email' }), {
        status: 400,
        headers: CORS,
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

    if (!resendKey || resendKey.startsWith('re_your')) {
      console.error('[send-care-invite] RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ sent: false, reason: 'Email service not configured' }), {
        status: 500,
        headers: CORS,
      });
    }

    const parent = parent_name ?? 'A parent';
    const child = child_name ?? 'their child';
    const roleLabel = role === 'approver' ? 'Approver' : 'Viewer';
    const roleDescription =
      role === 'approver'
        ? `You can view ${child}'s progress AND approve their completed activities.`
        : `You can view ${child}'s progress and reports.`;

    const html = buildInviteEmail({ parent, child, roleLabel, roleDescription });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `RoutineStars <${fromEmail}>`,
        to: invitee_email,
        subject: `${parent} has invited you to ${child}'s care team`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[send-care-invite] Resend error:', res.status, errText);
      return new Response(JSON.stringify({ sent: false, reason: `Resend ${res.status}` }), {
        status: 200,
        headers: CORS,
      });
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200, headers: CORS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[send-care-invite] handler error:', msg);
    return new Response(JSON.stringify({ sent: false, reason: msg }), {
      status: 500,
      headers: CORS,
    });
  }
});

// ── Email template ────────────────────────────────────────────────────────────
function buildInviteEmail(d: {
  parent: string;
  child: string;
  roleLabel: string;
  roleDescription: string;
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
                <strong>What now?</strong> Download RoutineStars and sign up using this exact email address. We'll automatically link you to ${d.child}'s care team.
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

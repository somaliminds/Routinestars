/**
 * request-pin-reset — Supabase Edge Function
 *
 * Generates a secure 32-byte hex token, stores it in parent_profiles with a
 * 1-hour expiry, and sends the reset deep-link via Resend email.
 *
 * Always returns success=true to prevent email enumeration attacks.
 *
 * Input:  { email: string }
 * Output: { success: true }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const SUCCESS = new Response(JSON.stringify({ success: true }), { headers: CORS });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Read raw body first, parse manually — gives clearer errors than req.json()
    // and handles any odd whitespace / BOM from React Native fetch.
    const raw = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw.trim()) as Record<string, unknown>;
    } catch (parseErr) {
      console.error('request-pin-reset JSON parse failed. Raw body:', JSON.stringify(raw));
      console.error('Parse error:', parseErr);
      return SUCCESS;
    }
    const email = body.email;

    if (typeof email !== 'string' || !email.includes('@')) {
      console.log('request-pin-reset invalid email value:', JSON.stringify(email));
      return SUCCESS;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth check ─────────────────────────────────────────────────────────
    // If the request carries an authenticated user session, lock the reset
    // to THAT user's own email. Prevents a logged-in user from triggering
    // reset emails to other users' inboxes (harassment / spam vector).
    // If no auth header is present, allow the request (legit "forgot everything"
    // scenario from the login screen).
    const authHeader = req.headers.get('Authorization') ?? '';
    const userJwt = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    // Don't treat the anon-key as a logged-in user — it's just the public key
    // the SDK always attaches. Real user JWTs come from auth and are different.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const isLoggedInRequest = userJwt && userJwt !== anonKey;

    if (isLoggedInRequest) {
      try {
        const { data: userResult } = await supabase.auth.getUser(userJwt);
        const authedEmail = userResult?.user?.email?.toLowerCase().trim();
        const requestedEmail = email.toLowerCase().trim();
        if (authedEmail && authedEmail !== requestedEmail) {
          console.log(
            '[request-pin-reset] refusing: logged-in user',
            authedEmail,
            'tried to reset',
            requestedEmail,
          );
          // Silently succeed to avoid revealing whose accounts exist
          return SUCCESS;
        }
      } catch (jwtErr) {
        // If JWT is invalid, treat as anonymous request (no restriction)
        console.warn('[request-pin-reset] could not decode JWT, treating as anon:', jwtErr);
      }
    }

    // Look up user by email via direct auth admin API call.
    // (getUserByEmail SDK method was removed in newer supabase-js versions.)
    const normalisedEmail = email.toLowerCase().trim();
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(normalisedEmail)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!listRes.ok) {
      console.error('request-pin-reset admin lookup failed:', listRes.status, await listRes.text());
      return SUCCESS;
    }
    const listJson = (await listRes.json()) as { users?: Array<{ id: string; email: string }> };
    const user = (listJson.users ?? []).find((u) => u.email?.toLowerCase() === normalisedEmail);
    if (!user) {
      console.log('request-pin-reset no user for email:', normalisedEmail);
      return SUCCESS; // Don't reveal whether account exists
    }
    const userId = user.id;

    // Generate cryptographically secure 32-byte token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error: updateError } = await supabase
      .from('parent_profiles')
      .update({ pin_reset_token: token, pin_reset_expires_at: expiresAt })
      .eq('user_id', userId);

    if (updateError) {
      console.error('request-pin-reset update error:', updateError.message);
      return SUCCESS;
    }

    // HTTPS redirect URL — Gmail, Outlook etc. allow these.
    // The reset-redirect function then hands off to routinestars:// on the device.
    const resetLink = `${supabaseUrl}/functions/v1/reset-redirect?token=${token}`;

    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@routinestars.co.uk';

    if (resendKey && !resendKey.startsWith('re_your')) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `RoutineStars <${fromEmail}>`,
          to: email,
          subject: 'Reset your RoutineStars PIN',
          html: buildResetEmail(resetLink),
        }),
      });
      if (!res.ok) {
        console.error('request-pin-reset Resend error:', await res.text());
      }
    } else {
      // Resend not yet configured — log link for local dev/testing
      console.log('[request-pin-reset] PIN reset link:', resetLink);
    }

    return SUCCESS;
  } catch (err) {
    console.error('request-pin-reset error:', err);
    return SUCCESS; // Always succeed — prevent enumeration
  }
});

// ── Email template ────────────────────────────────────────────────────────────
// Email-safe HTML: table-based layout, inline styles, web-safe fonts.
// Matches the app's MY24 aesthetic: soft lavender background, neumorphic
// white card, brand purple accent, star branding.
function buildResetEmail(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Reset your RoutineStars PIN</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F5F0FF;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:520px;">

          <!-- Brand header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="font-size:48px;line-height:1;">🌟</div>
              <div style="font-size:22px;font-weight:800;color:#5B21B6;margin-top:8px;letter-spacing:-0.3px;">
                RoutineStars
              </div>
            </td>
          </tr>

          <!-- Neumorphic card -->
          <tr>
            <td style="background-color:#FFFFFF;border-radius:24px;padding:36px 32px;box-shadow:0 4px 16px rgba(124,58,237,0.10);">

              <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#111827;line-height:1.25;">
                Reset your parent PIN
              </h1>

              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#6B7280;">
                Hi there 👋 — you asked to reset your 4-digit parent PIN.
              </p>

              <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;color:#374151;">
                Tap the button below <strong>on the phone where RoutineStars is installed</strong> to choose a new PIN. This link expires in <strong>1 hour</strong> for your security.
              </p>

              <!-- CTA button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${resetLink}"
                       style="display:inline-block;background-color:#7C3AED;color:#FFFFFF;text-decoration:none;padding:16px 44px;border-radius:16px;font-size:17px;font-weight:700;letter-spacing:0.2px;">
                      Reset PIN
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#9CA3AF;">
                Button not working? Long-press to copy this link, then paste it into your phone's browser address bar:
              </p>
              <p style="margin:0 0 28px 0;font-size:13px;line-height:1.5;color:#7C3AED;word-break:break-all;">
                <a href="${resetLink}" style="color:#7C3AED;text-decoration:underline;">${resetLink}</a>
              </p>

              <!-- Soft divider -->
              <div style="height:1px;background-color:#F3F4F6;margin:0 0 20px 0;"></div>

              <!-- Reassurance -->
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">
                Didn't ask for this? You can safely ignore this email — your PIN stays the same.
              </p>

            </td>
          </tr>

          <!-- Footer -->
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

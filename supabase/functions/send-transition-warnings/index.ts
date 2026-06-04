/**
 * send-transition-warnings — Sprint 5.1 Feature 2.
 * Supabase Edge Function (Deno runtime).
 *
 * Invoked once per minute by pg_cron. Finds every scheduled_set whose
 * start_time is approaching one of the two warning windows ([-6 min,
 * -4 min] for the 5-minute warning, [0, +2 min] from now for the
 * 1-minute warning) and sends an Expo Push to the parent if:
 *
 *   1. The parent has notify_transition_warnings = TRUE
 *   2. The parent has a registered expo_push_token
 *   3. We have NOT already sent this warning for this scheduled_set
 *      (enforced by the unique constraint on transition_warning_log)
 *
 * The dedupe write happens BEFORE the push send so a retry cannot
 * fire a duplicate notification. If the push send itself fails, the
 * log row stays — better silence than a double-buzz to a SEN parent.
 *
 * No request body. Returns: { sent: number, scanned: number, errors: number }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type WarningType = 'FIVE_MIN' | 'ONE_MIN';

interface ScheduledRow {
  scheduled_set_id: string;
  schedule_id: string;
  set_id: string;
  start_time: string;
  schedule_date: string;
  child_name: string;
  parent_id: string;
  set_name: string;
  set_icon: string;
}

function buildWindowSql(warningType: WarningType): { fromMin: number; toMin: number } {
  // Cron runs every minute. We use a 2-minute window so a single missed
  // tick doesn't cause a missed warning. Slight overlap with the next tick
  // is fine because the unique log constraint dedupes anyway.
  if (warningType === 'FIVE_MIN') return { fromMin: 4, toMin: 6 };
  return { fromMin: 0, toMin: 2 };
}

async function fetchDueWarnings(
  supabase: ReturnType<typeof createClient>,
  warningType: WarningType,
): Promise<ScheduledRow[]> {
  const { fromMin, toMin } = buildWindowSql(warningType);

  // We compose start_time + schedule_date in JS rather than SQL to keep
  // the function portable across Postgres timestamp + time-zone configs.
  // start_time is TIME, schedule_date is DATE; combined they form a
  // timestamp we filter against now() ± window.
  const { data, error } = await supabase.rpc('due_transition_warnings', {
    p_from_min: fromMin,
    p_to_min: toMin,
  });
  if (error) throw error;
  return (data ?? []) as ScheduledRow[];
}

async function recordSent(
  supabase: ReturnType<typeof createClient>,
  scheduledSetId: string,
  warningType: WarningType,
): Promise<boolean> {
  // INSERT ... ON CONFLICT DO NOTHING returns 0 rows when the dedupe
  // hits — that's our signal to skip the push.
  const { data, error } = await supabase
    .from('transition_warning_log')
    .insert({ scheduled_set_id: scheduledSetId, warning_type: warningType })
    .select('warning_id');
  if (error) {
    // unique_violation = 23505. Treat as "already sent, skip".
    if ((error as { code?: string }).code === '23505') return false;
    throw error;
  }
  return (data ?? []).length > 0;
}

async function pushToParent(
  supabase: ReturnType<typeof createClient>,
  parentId: string,
  setName: string,
  setIcon: string,
  childName: string,
  warningType: WarningType,
): Promise<boolean> {
  const { data: parent, error } = await supabase
    .from('parent_profiles')
    .select('expo_push_token, notify_transition_warnings')
    .eq('user_id', parentId)
    .maybeSingle();
  if (error || !parent) return false;
  if (!parent.notify_transition_warnings) return false;
  const token = parent.expo_push_token;
  if (!token || !String(token).startsWith('ExponentPushToken[')) return false;

  const minutes = warningType === 'FIVE_MIN' ? 5 : 1;
  const message = {
    to: token,
    sound: 'default',
    title: `${setIcon} ${minutes} min until ${setName}`,
    body: `${childName} starts ${setName} in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    data: { warning_type: warningType, child_name: childName, set_name: setName },
    priority: 'high',
  };

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  return res.ok;
}

Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let sent = 0;
    let scanned = 0;
    let errors = 0;

    for (const warningType of ['FIVE_MIN', 'ONE_MIN'] as WarningType[]) {
      const rows = await fetchDueWarnings(supabase, warningType);
      scanned += rows.length;

      for (const row of rows) {
        try {
          const claimed = await recordSent(supabase, row.scheduled_set_id, warningType);
          if (!claimed) continue;
          const ok = await pushToParent(
            supabase,
            row.parent_id,
            row.set_name,
            row.set_icon,
            row.child_name,
            warningType,
          );
          if (ok) sent++;
        } catch {
          errors++;
        }
      }
    }

    return new Response(JSON.stringify({ sent, scanned, errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

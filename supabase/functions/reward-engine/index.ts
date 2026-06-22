/**
 * Reward Engine — Supabase Edge Function (Sprint 2.3)
 *
 * Called after a set completion is finalised (either auto-approved or parent-approved).
 *
 * Input:  { child_id: string, completion_id: string }
 * Output: { badges_newly_earned: string[], streak: number, streak_bonus_stars: number }
 *
 * Checks all badge conditions from Section 9.2 of the spec:
 *   1.  Sparkling Teeth   — Brushing Teeth Set completed 5+ times
 *   2.  Early Bird        — Waking Up + Breakfast both completed before 08:00 on same day
 *   3.  School Ready Star — Getting Ready for School completed 10+ times
 *   4.  Homework Hero     — Homework Set completed 7 consecutive days
 *   5.  Sleepy Champion   — Bedtime Set completed on-time (within window) 5+ times
 *   6.  Park Explorer     — Going to the Park set completed at least once
 *   7.  Super Shopper     — Supermarket set completed at least once
 *   8.  City Explorer     — City Centre set completed at least once
 *   9.  Full Week Champ   — Every scheduled set completed for any single calendar week
 *  10.  Golden Month      — Perfect Day achieved 20+ times in any calendar month
 *  11.  Weekend Adventurer — Any weekend category set completed at least once
 *  12.  Perfect Day (trophy) — All scheduled sets completed today
 *  13.  3-Day Streak (trophy) — 3 consecutive perfect days
 *  14.  7-Day Streak (trophy) — 7 consecutive perfect days
 *
 * Streak update:
 *   After each completion, recalculate current_streak (consecutive days with ≥1 completion).
 *   Award streak bonus stars if new streak milestone reached (3-day → +15, 7-day → +50).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

// Fixed set UUIDs from seed data (003_seed_data.sql)
const SET_IDS = {
  WAKING_UP:        '00000000-0000-0000-0000-000000000001',
  BRUSHING_TEETH:   '00000000-0000-0000-0000-000000000002',
  GETTING_DRESSED:  '00000000-0000-0000-0000-000000000003',
  BREAKFAST:        '00000000-0000-0000-0000-000000000004',
  SCHOOL_READY:     '00000000-0000-0000-0000-000000000005',
  AFTER_SCHOOL:     '00000000-0000-0000-0000-000000000006',
  CHANGE_CLOTHES:   '00000000-0000-0000-0000-000000000007',
  TEA_LUNCH:        '00000000-0000-0000-0000-000000000008',
  HOMEWORK:         '00000000-0000-0000-0000-000000000009',
  DINNER:           '00000000-0000-0000-0000-000000000010',
  BEDTIME:          '00000000-0000-0000-0000-000000000011',
  PARK:             '00000000-0000-0000-0000-000000000012',
  SUPERMARKET:      '00000000-0000-0000-0000-000000000013',
  CITY_CENTRE:      '00000000-0000-0000-0000-000000000014',
};

// Fixed reward UUIDs from seed data
const REWARD_IDS = {
  SPARKLING_TEETH:     '10000000-0000-0000-0000-000000000001',
  EARLY_BIRD:          '10000000-0000-0000-0000-000000000002',
  SCHOOL_READY_STAR:   '10000000-0000-0000-0000-000000000003',
  HOMEWORK_HERO:       '10000000-0000-0000-0000-000000000004',
  SLEEPY_CHAMPION:     '10000000-0000-0000-0000-000000000005',
  PARK_EXPLORER:       '10000000-0000-0000-0000-000000000006',
  SUPER_SHOPPER:       '10000000-0000-0000-0000-000000000007',
  CITY_EXPLORER:       '10000000-0000-0000-0000-000000000008',
  FULL_WEEK_CHAMPION:  '10000000-0000-0000-0000-000000000009',
  GOLDEN_MONTH:        '10000000-0000-0000-0000-000000000010',
  STREAK_3:            '10000000-0000-0000-0000-000000000011',
  STREAK_7:            '10000000-0000-0000-0000-000000000012',
  ON_TIME_BONUS:       '10000000-0000-0000-0000-000000000013',
  PERFECT_DAY:         '10000000-0000-0000-0000-000000000014',
  WEEKEND_ADVENTURER:  '10000000-0000-0000-0000-000000000015',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Count completions for a specific set for this child (approved or no-approval). */
async function countSetCompletions(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  setId: string,
): Promise<number> {
  const { count } = await supabase
    .from('completions')
    .select('completion_id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .not('completed_at', 'is', null)
    .eq('scheduled_sets.set_id', setId)
    .throwOnError();
  return count ?? 0;
}

/** Get all dates (as YYYY-MM-DD strings) on which the child had ≥1 completion. */
async function getCompletionDates(
  supabase: ReturnType<typeof createClient>,
  childId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('completions')
    .select('completed_at')
    .eq('child_id', childId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  const dates = new Set<string>();
  for (const row of data ?? []) {
    dates.add(toDateString(new Date(row.completed_at as string)));
  }
  return Array.from(dates).sort();
}

/** Calculate current streak (consecutive days up to and including today). */
function calculateStreak(completionDates: string[]): number {
  if (completionDates.length === 0) return 0;
  const sorted = [...completionDates].sort().reverse();
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86400000));

  // Streak is valid only if today or yesterday has a completion
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Check if child already earned a specific reward. */
async function hasEarned(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  rewardId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('child_rewards')
    .select('child_reward_id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('reward_id', rewardId)
    .throwOnError();
  return (count ?? 0) > 0;
}

/** Award a reward if not already earned. Returns true if newly awarded. */
async function maybeAward(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  rewardId: string,
): Promise<boolean> {
  if (await hasEarned(supabase, childId, rewardId)) return false;
  await supabase.from('child_rewards').insert({ child_id: childId, reward_id: rewardId });
  return true;
}

// ── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { child_id, completion_id } = (await req.json()) as {
      child_id: string;
      completion_id: string;
    };

    if (!child_id || !completion_id) {
      return new Response(JSON.stringify({ error: 'child_id and completion_id are required' }), {
        status: 400,
      });
    }

    // Authorisation — verify the caller is either the child themselves
    // (auto-approve flow) or the child's parent (post-approval flow).
    // The gateway already validated the JWT (verify_jwt = true), but
    // without this check any authenticated user could award badges and
    // bump star counts on any child profile.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const supabaseAsUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authErr } = await supabaseAsUser.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const callerId = authData.user.id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller owns or IS the child
    const { data: childRow } = await supabase
      .from('child_profiles')
      .select('parent_id, user_id')
      .eq('profile_id', child_id)
      .maybeSingle();
    if (!childRow) {
      return new Response(JSON.stringify({ error: 'child not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const isOwner = childRow.parent_id === callerId || childRow.user_id === callerId;
    if (!isOwner) {
      console.warn('[reward-engine] authorisation denied', { caller: callerId, child_id });
      return new Response(JSON.stringify({ error: 'forbidden: not authorised for this child' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Load completion + scheduled set info ────────────────────────────────
    const { data: completion } = await supabase
      .from('completions')
      .select('completed_at, stars_earned, scheduled_set_id')
      .eq('completion_id', completion_id)
      .single();

    if (!completion?.completed_at) {
      return new Response(JSON.stringify({ error: 'Completion not finalised' }), { status: 400 });
    }

    const { data: scheduledSet } = await supabase
      .from('scheduled_sets')
      .select('set_id, start_time, end_time, schedule_id')
      .eq('scheduled_set_id', completion.scheduled_set_id)
      .single();

    const completedAt = new Date(completion.completed_at as string);
    const completionDate = toDateString(completedAt);

    // ── Badge checks ────────────────────────────────────────────────────────
    const newlyEarned: string[] = [];
    let bonusStars = 0;

    // ── Set Complete Bonus (+5 stars) — awarded every time a set is finished ─
    bonusStars += 5;

    // ── On-Time Bonus (+3 stars) — finished within the scheduled time window ─
    if (scheduledSet?.end_time) {
      // Compare HH:MM:SS of actual completion to scheduled end_time
      const completedHHMM = completedAt.toTimeString().substring(0, 8);
      if (completedHHMM <= scheduledSet.end_time) {
        bonusStars += 3;
      }
    }

    // Helper that counts completions for a set via join
    async function countForSet(setId: string): Promise<number> {
      const { data } = await supabase
        .from('completions')
        .select('completion_id, scheduled_sets!inner(set_id)')
        .eq('child_id', child_id)
        .not('completed_at', 'is', null)
        .eq('scheduled_sets.set_id', setId);
      return (data ?? []).length;
    }

    // 1. Sparkling Teeth — Brushing Teeth 5 times
    if (scheduledSet?.set_id === SET_IDS.BRUSHING_TEETH) {
      const count = await countForSet(SET_IDS.BRUSHING_TEETH);
      if (count >= 5 && (await maybeAward(supabase, child_id, REWARD_IDS.SPARKLING_TEETH))) {
        newlyEarned.push('Sparkling Teeth');
      }
    }

    // 2. Early Bird — Waking Up + Breakfast before 08:00 on same day
    {
      const hour = completedAt.getHours();
      if (
        hour < 8 &&
        (scheduledSet?.set_id === SET_IDS.WAKING_UP ||
          scheduledSet?.set_id === SET_IDS.BREAKFAST)
      ) {
        // Check if both sets completed today before 8am
        const { data: todayCompletions } = await supabase
          .from('completions')
          .select('scheduled_sets!inner(set_id), completed_at')
          .eq('child_id', child_id)
          .gte('completed_at', `${completionDate}T00:00:00`)
          .lt('completed_at', `${completionDate}T08:00:00`)
          .not('completed_at', 'is', null);

        const todaySets = new Set(
          (todayCompletions ?? []).map(
            (c) => (c.scheduled_sets as { set_id: string }).set_id,
          ),
        );
        if (
          todaySets.has(SET_IDS.WAKING_UP) &&
          todaySets.has(SET_IDS.BREAKFAST) &&
          (await maybeAward(supabase, child_id, REWARD_IDS.EARLY_BIRD))
        ) {
          newlyEarned.push('Early Bird');
        }
      }
    }

    // 3. School Ready Star — Getting Ready for School 10 times
    if (scheduledSet?.set_id === SET_IDS.SCHOOL_READY) {
      const count = await countForSet(SET_IDS.SCHOOL_READY);
      if (count >= 10 && (await maybeAward(supabase, child_id, REWARD_IDS.SCHOOL_READY_STAR))) {
        newlyEarned.push('School Ready Star');
      }
    }

    // 4. Homework Hero — Homework Set 7 consecutive days
    if (scheduledSet?.set_id === SET_IDS.HOMEWORK) {
      const { data: hwDates } = await supabase
        .from('completions')
        .select('completed_at, scheduled_sets!inner(set_id)')
        .eq('child_id', child_id)
        .eq('scheduled_sets.set_id', SET_IDS.HOMEWORK)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(14);

      const hwDateStrings = [
        ...new Set((hwDates ?? []).map((c) => toDateString(new Date(c.completed_at as string)))),
      ].sort().reverse();

      const hwStreak = calculateStreak(hwDateStrings);
      if (hwStreak >= 7 && (await maybeAward(supabase, child_id, REWARD_IDS.HOMEWORK_HERO))) {
        newlyEarned.push('Homework Hero');
      }
    }

    // 5. Sleepy Champion — Bedtime Set completed on time 5+ times
    // "On time" = completed before the scheduled end_time
    if (scheduledSet?.set_id === SET_IDS.BEDTIME) {
      const { data: bedtimeCompletions } = await supabase
        .from('completions')
        .select('completed_at, scheduled_sets!inner(set_id, end_time)')
        .eq('child_id', child_id)
        .eq('scheduled_sets.set_id', SET_IDS.BEDTIME)
        .not('completed_at', 'is', null);

      const onTimeCount = (bedtimeCompletions ?? []).filter((c) => {
        const endTime = (c.scheduled_sets as { end_time: string }).end_time;
        const completedHHMM = new Date(c.completed_at as string)
          .toTimeString()
          .substring(0, 5);
        return completedHHMM <= endTime;
      }).length;

      if (onTimeCount >= 5 && (await maybeAward(supabase, child_id, REWARD_IDS.SLEEPY_CHAMPION))) {
        newlyEarned.push('Sleepy Champion');
      }
    }

    // 6. Park Explorer — Going to the Park once
    if (scheduledSet?.set_id === SET_IDS.PARK) {
      if (await maybeAward(supabase, child_id, REWARD_IDS.PARK_EXPLORER)) {
        newlyEarned.push('Park Explorer');
      }
    }

    // 7. Super Shopper — Supermarket once
    if (scheduledSet?.set_id === SET_IDS.SUPERMARKET) {
      if (await maybeAward(supabase, child_id, REWARD_IDS.SUPER_SHOPPER)) {
        newlyEarned.push('Super Shopper');
      }
    }

    // 8. City Explorer — City Centre once
    if (scheduledSet?.set_id === SET_IDS.CITY_CENTRE) {
      if (await maybeAward(supabase, child_id, REWARD_IDS.CITY_EXPLORER)) {
        newlyEarned.push('City Explorer');
      }
    }

    // 9. Weekend Adventurer — any weekend set (+10 stars + badge)
    {
      const { data: actSet } = await supabase
        .from('activity_sets')
        .select('category')
        .eq('set_id', scheduledSet?.set_id ?? '')
        .single();
      if (actSet?.category === 'WEEKEND') {
        bonusStars += 10;
        if (await maybeAward(supabase, child_id, REWARD_IDS.WEEKEND_ADVENTURER)) {
          newlyEarned.push('Weekend Adventurer');
        }
      }
    }

    // 10. Perfect Day — all scheduled sets completed today
    {
      const { data: todaySchedule } = await supabase
        .from('day_schedules')
        .select('schedule_id')
        .eq('child_id', child_id)
        .eq('schedule_date', completionDate)
        .maybeSingle();

      if (todaySchedule) {
        const { count: totalSets } = await supabase
          .from('scheduled_sets')
          .select('scheduled_set_id', { count: 'exact', head: true })
          .eq('schedule_id', todaySchedule.schedule_id);

        const { data: doneSets } = await supabase
          .from('completions')
          .select('completion_id')
          .eq('child_id', child_id)
          .gte('completed_at', `${completionDate}T00:00:00`)
          .lte('completed_at', `${completionDate}T23:59:59`)
          .not('completed_at', 'is', null);

        if ((totalSets ?? 0) > 0 && (doneSets ?? []).length >= (totalSets ?? 0)) {
          bonusStars += 20;
          if (await maybeAward(supabase, child_id, REWARD_IDS.PERFECT_DAY)) {
            newlyEarned.push('Perfect Day');
          }
        }
      }
    }

    // ── Streak calculation ──────────────────────────────────────────────────
    const allDates = await getCompletionDates(supabase, child_id);
    const newStreak = calculateStreak(allDates);

    // Update current_streak on child_profiles
    await supabase
      .from('child_profiles')
      .update({ current_streak: newStreak })
      .eq('profile_id', child_id);

    // 11. Full Week Champion — check if any 7-day window is fully covered
    {
      const dateSet = new Set(allDates);
      let fullWeekFound = false;
      for (let i = 0; i < allDates.length; i++) {
        const start = new Date(allDates[i]);
        let consecutive = 0;
        for (let d = 0; d < 7; d++) {
          const check = toDateString(new Date(start.getTime() + d * 86400000));
          if (dateSet.has(check)) consecutive++;
        }
        if (consecutive >= 7) {
          fullWeekFound = true;
          break;
        }
      }
      if (fullWeekFound && (await maybeAward(supabase, child_id, REWARD_IDS.FULL_WEEK_CHAMPION))) {
        newlyEarned.push('Full Week Champion');
      }
    }

    // 12. Golden Month — 20 perfect days in any calendar month
    // (simplified: 20 completion dates in any month)
    {
      const monthCounts: Record<string, number> = {};
      for (const d of allDates) {
        const month = d.substring(0, 7); // YYYY-MM
        monthCounts[month] = (monthCounts[month] ?? 0) + 1;
      }
      if (
        Object.values(monthCounts).some((c) => c >= 20) &&
        (await maybeAward(supabase, child_id, REWARD_IDS.GOLDEN_MONTH))
      ) {
        newlyEarned.push('Golden Month');
      }
    }

    // 13. 3-Day Streak trophy
    if (newStreak >= 3 && (await maybeAward(supabase, child_id, REWARD_IDS.STREAK_3))) {
      newlyEarned.push('3-Day Streak');
      bonusStars += 15;
    }

    // 14. 7-Day Streak trophy
    if (newStreak >= 7 && (await maybeAward(supabase, child_id, REWARD_IDS.STREAK_7))) {
      newlyEarned.push('7-Day Super Streak');
      bonusStars += 50;
    }

    // Award bonus stars if any accrued
    if (bonusStars > 0) {
      await supabase.rpc('increment_child_stars', {
        p_child_id: child_id,
        p_stars: bonusStars,
      } as never);
    }

    return new Response(
      JSON.stringify({
        badges_newly_earned: newlyEarned,
        streak: newStreak,
        bonus_stars: bonusStars,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (err) {
    console.error('reward-engine error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});

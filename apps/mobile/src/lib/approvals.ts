/**
 * approvals.ts — the approval queue and the approve/redo action, shared by the
 * parent app and the care-team (Approver) app.
 *
 * Reviews go through ONE server call, review_completion (migration 054), which
 * checks the caller is the child's parent or an accepted Approver, refuses
 * anything already reviewed, and writes the completion, scheduled set and
 * stars atomically. (The parent app used to do three unchecked client writes —
 * postgrest returns errors instead of throwing, so a failure looked like success.)
 */
import { supabase } from './supabase';

export interface PendingApproval {
  completionId: string;
  scheduledSetId: string;
  childId: string;
  childName: string;
  setName: string;
  iconEmoji: string;
  starsEarned: number;
  completedAt: string;
}

export interface ChildRef {
  id: string;
  name: string;
}

interface CompletionRow {
  completion_id: string;
  scheduled_set_id: string;
  child_id: string;
  stars_earned: number;
  completed_at: string | null;
}
interface WaitingSetRow {
  scheduled_set_id: string;
  set_id: string;
}
interface SetNameRow {
  set_id: string;
  set_name: string;
  icon_emoji: string;
}

/**
 * Join the three queue queries (pure, unit-tested). A completion is pending
 * only while its scheduled set is AWAITING_APPROVAL; one whose activity set the
 * reviewer can't read is left out (it can't be shown meaningfully).
 */
export function joinPendingApprovals(
  completions: CompletionRow[],
  waitingSets: WaitingSetRow[],
  setNames: SetNameRow[],
  children: ChildRef[],
): PendingApproval[] {
  const setIdByScheduled = new Map(waitingSets.map((s) => [s.scheduled_set_id, s.set_id]));
  const nameBySet = new Map(setNames.map((a) => [a.set_id, a]));
  const childName = new Map(children.map((c) => [c.id, c.name]));
  const out: PendingApproval[] = [];
  for (const c of completions) {
    const setId = setIdByScheduled.get(c.scheduled_set_id);
    const act = setId ? nameBySet.get(setId) : undefined;
    if (!act || !c.completed_at) continue;
    out.push({
      completionId: c.completion_id,
      scheduledSetId: c.scheduled_set_id,
      childId: c.child_id,
      childName: childName.get(c.child_id) ?? 'Child',
      setName: act.set_name,
      iconEmoji: act.icon_emoji,
      starsEarned: c.stars_earned,
      completedAt: c.completed_at,
    });
  }
  return out;
}

/**
 * Activities waiting for approval for the given children, newest first.
 * Three requests in total whatever the queue length (the parent queue used to
 * make two requests per completion).
 */
export async function fetchPendingApprovals(children: ChildRef[]): Promise<PendingApproval[]> {
  if (children.length === 0) return [];
  const { data: completions, error } = await supabase
    .from('completions')
    .select('completion_id, scheduled_set_id, child_id, stars_earned, completed_at')
    .in(
      'child_id',
      children.map((c) => c.id),
    )
    .eq('parent_approved', false)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  if (!completions || completions.length === 0) return [];

  const { data: waiting, error: waitErr } = await supabase
    .from('scheduled_sets')
    .select('scheduled_set_id, set_id')
    .in(
      'scheduled_set_id',
      completions.map((c) => c.scheduled_set_id),
    )
    .eq('status', 'AWAITING_APPROVAL');
  if (waitErr) throw waitErr;
  if (!waiting || waiting.length === 0) return [];

  const { data: sets, error: setErr } = await supabase
    .from('activity_sets')
    .select('set_id, set_name, icon_emoji')
    .in('set_id', [...new Set(waiting.map((w) => w.set_id))]);
  if (setErr) throw setErr;

  return joinPendingApprovals(completions, waiting, sets ?? [], children);
}

export interface ReviewResult {
  decision: 'approved' | 'redo';
  childId: string;
  starsAwarded: number;
}

/** Turn a review_completion error into something a parent or carer can act on. */
export function friendlyReviewError(message: string): string {
  if (message.includes('already reviewed')) return 'This activity has already been reviewed.';
  if (message.includes('not authorised')) return 'You can’t review activities for this child.';
  if (message.includes('too many approvals')) {
    return 'That’s a lot of approvals in a row — please wait a minute and try again.';
  }
  if (message.includes('completion not found')) return 'This activity no longer exists.';
  return 'Could not save. Please check your connection and try again.';
}

/** Approve (optionally with a +5 gold star) or send back for a redo. Throws on failure. */
export async function reviewCompletion(
  completionId: string,
  approve: boolean,
  goldStar = false,
): Promise<ReviewResult> {
  const { data, error } = await supabase.rpc('review_completion', {
    p_completion_id: completionId,
    p_approve: approve,
    p_gold_star: goldStar,
  });
  if (error) throw new Error(friendlyReviewError(error.message));
  const r = data as { decision: 'approved' | 'redo'; child_id: string; stars_awarded: number };
  return { decision: r.decision, childId: r.child_id, starsAwarded: r.stars_awarded };
}

/**
 * Tell the child's waiting screen (ApprovalScreen) to go home after a redo.
 * Best-effort, and never hangs: gives up after 5 s if the socket won't connect.
 */
export function broadcastRedo(completionId: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const channel = supabase.channel(`approval-${completionId}`);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
      resolve();
    };
    const timer = setTimeout(finish, 5000);
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      void channel.send({ type: 'broadcast', event: 'redo', payload: {} }).finally(finish);
    });
  });
}

/**
 * Badges, streak and bonus stars after an approval. The reward engine adds the
 * bonus stars itself — callers must NOT add `bonus_stars` again (they used to,
 * doubling every bonus). Fire-and-forget.
 */
export function runRewardEngine(childId: string, completionId: string): void {
  void supabase.functions.invoke('reward-engine', {
    body: { child_id: childId, completion_id: completionId },
  });
}

/**
 * useApprovalQueue — Sprint 2.4
 *
 * Fetches all completions for a parent's children that are awaiting approval.
 * Used in the parent dashboard to show a badge count and the approval list.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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

async function fetchPendingApprovals(parentId: string): Promise<PendingApproval[]> {
  // 1. Get all child profile IDs for this parent
  const { data: children, error: childErr } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name')
    .eq('parent_id', parentId);

  if (childErr || !children || children.length === 0) return [];

  const childIds = children.map((c) => c.profile_id);
  const childNameMap = new Map(children.map((c) => [c.profile_id, c.child_name]));

  // 2. Fetch completions awaiting approval
  const { data: completions, error: compErr } = await supabase
    .from('completions')
    .select('completion_id, scheduled_set_id, child_id, stars_earned, completed_at')
    .in('child_id', childIds)
    .eq('parent_approved', false)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (compErr || !completions || completions.length === 0) return [];

  // 3. For each completion, fetch scheduled_set → activity_set name + emoji
  const results: PendingApproval[] = [];

  for (const comp of completions) {
    const { data: scheduledSet } = await supabase
      .from('scheduled_sets')
      .select('set_id, status')
      .eq('scheduled_set_id', comp.scheduled_set_id)
      .eq('status', 'AWAITING_APPROVAL')
      .single();

    if (!scheduledSet) continue;

    const { data: actSet } = await supabase
      .from('activity_sets')
      .select('set_name, icon_emoji')
      .eq('set_id', scheduledSet.set_id)
      .single();

    if (!actSet) continue;

    results.push({
      completionId: comp.completion_id,
      scheduledSetId: comp.scheduled_set_id,
      childId: comp.child_id,
      childName: childNameMap.get(comp.child_id) ?? 'Child',
      setName: actSet.set_name,
      iconEmoji: actSet.icon_emoji,
      starsEarned: comp.stars_earned,
      completedAt: comp.completed_at as string,
    });
  }

  return results;
}

export function useApprovalQueue(parentId: string | null) {
  return useQuery({
    queryKey: ['approvalQueue', parentId],
    queryFn: () => fetchPendingApprovals(parentId!),
    enabled: !!parentId,
    refetchInterval: 30_000, // Poll every 30s as backup to Realtime
  });
}

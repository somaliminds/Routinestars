/**
 * useApprovalQueue — Sprint 2.4
 *
 * Fetches all completions for a parent's children that are awaiting approval.
 * Used in the parent dashboard to show a badge count and the approval list.
 * The fetch itself is shared with the care-team Approver app (@/lib/approvals).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchPendingApprovals, type PendingApproval } from '@/lib/approvals';

export type { PendingApproval };

async function fetchParentQueue(parentId: string): Promise<PendingApproval[]> {
  const { data: children, error } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name')
    .eq('parent_id', parentId);
  if (error) throw error;
  return fetchPendingApprovals(
    (children ?? []).map((c) => ({ id: c.profile_id, name: c.child_name })),
  );
}

export function useApprovalQueue(parentId: string | null) {
  const queryClient = useQueryClient();

  // Realtime: refresh the queue the instant a child's completion changes
  // (finished → AWAITING_APPROVAL, or approved/redone elsewhere — including by
  // a care-team Approver). RLS scopes the events to this parent's own
  // children. The 30s poll below is the fallback if the socket drops.
  useEffect(() => {
    if (!parentId) return;
    const channel = supabase
      .channel(`approval-queue-${parentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'completions' },
        () => void queryClient.invalidateQueries({ queryKey: ['approvalQueue', parentId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [parentId, queryClient]);

  return useQuery({
    queryKey: ['approvalQueue', parentId],
    queryFn: () => fetchParentQueue(parentId!),
    enabled: !!parentId,
    refetchInterval: 30_000, // Poll every 30s as a fallback to Realtime
  });
}

/**
 * Parent Approval Detail Screen — Sprint 2.4
 *
 * Review what a child completed and approve it (stars + celebration on the
 * child's device) or ask for a redo. The screen body is shared with the
 * care-team Approver app — see CompletionReview.
 *
 * Spec: Section 11.1 — Parental Approval Flow
 */
import { useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { CompletionReview } from '@/components/approval/CompletionReview';

export default function ApprovalDetailScreen() {
  const router = useRouter();
  const { completionId } = useLocalSearchParams<{ completionId: string }>();
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();

  const onDone = useCallback(() => {
    // Refresh the approval queue so the dashboard badge updates.
    void queryClient.invalidateQueries({ queryKey: ['approvalQueue', session?.user.id] });
    router.back();
  }, [queryClient, session, router]);

  return (
    <CompletionReview
      completionId={completionId ?? ''}
      onDone={onDone}
      onBack={() => router.back()}
    />
  );
}

/**
 * Care-team Approver: review one finished activity (approve or ask for a redo).
 * Same screen body as the parent's — CompletionReview — and the same server
 * call (review_completion), which only lets an accepted Approver for this
 * child (or the parent) act.
 */
import { useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CompletionReview } from '@/components/approval/CompletionReview';

export default function CarerApproveScreen() {
  const router = useRouter();
  const { completionId } = useLocalSearchParams<{ completionId: string }>();
  const queryClient = useQueryClient();

  // Opened straight from a link (web) there is no history to go back to.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(carer)/home' as never);
  }, [router]);

  const onDone = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['carer'] });
    goBack();
  }, [queryClient, goBack]);

  return <CompletionReview completionId={completionId ?? ''} onDone={onDone} onBack={goBack} />;
}

/**
 * Parent Approval Detail Screen — Sprint 2.4
 *
 * Shows the parent a summary of what their child completed:
 *  - Set name, child name, stars earned
 *  - List of steps with time taken
 *  - APPROVE button → marks approved, awards stars, triggers celebration on child device
 *  - REDO button → marks for redo, resets scheduled_set to PENDING
 *
 * Spec: Section 11.1 — Parental Approval Flow
 */
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

interface StepSummary {
  stepId: string;
  title: string;
  timeTakenSeconds: number;
  orderIndex: number;
}

interface CompletionDetail {
  completionId: string;
  childId: string;
  childName: string;
  setName: string;
  iconEmoji: string;
  starsEarned: number;
  scheduledSetId: string;
  steps: StepSummary[];
  environment: 'HOME' | 'SCHOOL' | 'RESPITE';
  carerName: string | null;
  carerNote: string | null;
}

async function fetchCompletionDetail(completionId: string): Promise<CompletionDetail | null> {
  // 1. Get completion
  const { data: comp, error: compErr } = await supabase
    .from('completions')
    .select(
      'completion_id, child_id, scheduled_set_id, stars_earned, environment, carer_user_id, carer_note',
    )
    .eq('completion_id', completionId)
    .single();

  if (compErr || !comp) return null;

  // 2. Child name
  const { data: child } = await supabase
    .from('child_profiles')
    .select('child_name')
    .eq('profile_id', comp.child_id)
    .single();

  // 3. Activity set details
  const { data: scheduledSet } = await supabase
    .from('scheduled_sets')
    .select('set_id')
    .eq('scheduled_set_id', comp.scheduled_set_id)
    .single();

  const { data: actSet } = scheduledSet
    ? await supabase
        .from('activity_sets')
        .select('set_name, icon_emoji')
        .eq('set_id', scheduledSet.set_id)
        .single()
    : { data: null };

  // 4. Step completions with step titles
  const { data: stepCompletions } = await supabase
    .from('step_completions')
    .select('step_id, time_taken_seconds')
    .eq('completion_id', completionId);

  const steps: StepSummary[] = [];
  if (stepCompletions && stepCompletions.length > 0) {
    const stepIds = stepCompletions.map((s) => s.step_id);
    const { data: stepRows } = await supabase
      .from('steps')
      .select('step_id, title, order_index')
      .in('step_id', stepIds)
      .order('order_index');

    if (stepRows) {
      const timeMap = new Map(stepCompletions.map((s) => [s.step_id, s.time_taken_seconds]));
      for (const step of stepRows) {
        steps.push({
          stepId: step.step_id,
          title: step.title,
          timeTakenSeconds: timeMap.get(step.step_id) ?? 0,
          orderIndex: step.order_index,
        });
      }
    }
  }

  // 5. Carer name lookup if this completion came from a TA / non-child actor
  let carerName: string | null = null;
  if (comp.carer_user_id) {
    const { data: carer } = await supabase
      .from('users')
      .select('name')
      .eq('user_id', comp.carer_user_id)
      .maybeSingle();
    carerName = carer?.name ?? null;
  }

  return {
    completionId,
    childId: comp.child_id,
    childName: child?.child_name ?? 'Child',
    setName: actSet?.set_name ?? 'Activity',
    iconEmoji: actSet?.icon_emoji ?? '📋',
    starsEarned: comp.stars_earned,
    scheduledSetId: comp.scheduled_set_id,
    steps,
    environment: (comp.environment as 'HOME' | 'SCHOOL' | 'RESPITE') ?? 'HOME',
    carerName,
    carerNote: comp.carer_note ?? null,
  };
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function ApprovalDetailScreen() {
  const router = useRouter();
  const { completionId } = useLocalSearchParams<{ completionId: string }>();
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentGoldStar, setParentGoldStar] = useState(false);

  const {
    data: detail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['completionDetail', completionId],
    queryFn: () => fetchCompletionDetail(completionId ?? ''),
    enabled: !!completionId,
  });

  const handleApprove = useCallback(async () => {
    if (!detail || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Mark completion approved
      await supabase
        .from('completions')
        .update({ parent_approved: true })
        .eq('completion_id', detail.completionId);

      // Update scheduled_set status to APPROVED
      await supabase
        .from('scheduled_sets')
        .update({ status: 'APPROVED' })
        .eq('scheduled_set_id', detail.scheduledSetId);

      // Award stars to child atomically (per-step stars + optional parent gold star)
      const totalStars = detail.starsEarned + (parentGoldStar ? 5 : 0);
      await supabase.rpc('increment_child_stars', {
        p_child_id: detail.childId,
        p_stars: totalStars,
      });

      // Run reward engine — awards bonus stars (set complete, on-time, weekend, streaks)
      void supabase.functions
        .invoke('reward-engine', {
          body: { child_id: detail.childId, completion_id: detail.completionId },
        })
        .then(({ data }) => {
          const bonusStars =
            (data as { bonus_stars?: number } | null)?.bonus_stars ?? 0;
          if (bonusStars > 0) {
            void supabase.rpc('increment_child_stars', {
              p_child_id: detail.childId,
              p_stars: bonusStars,
            });
          }
        });

      // Invalidate approval queue so dashboard badge updates
      void queryClient.invalidateQueries({ queryKey: ['approvalQueue', session?.user.id] });

      router.back();
    } catch {
      setIsSubmitting(false);
    }
  }, [detail, isSubmitting, queryClient, session, router]);

  const handleRedo = useCallback(async () => {
    if (!detail || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Broadcast redo event to the child's waiting ApprovalScreen BEFORE deleting
      // so the child is navigated home gracefully before the completion row disappears.
      // The channel is removed immediately after sending to avoid a leak.
      await new Promise<void>((resolve) => {
        const redoChannel = supabase.channel(`approval-${detail.completionId}`);
        redoChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await redoChannel.send({ type: 'broadcast', event: 'redo', payload: {} });
            void supabase.removeChannel(redoChannel);
            resolve();
          }
        });
      });

      // Reset scheduled_set back to PENDING so child can redo
      await supabase
        .from('scheduled_sets')
        .update({ status: 'PENDING' })
        .eq('scheduled_set_id', detail.scheduledSetId);

      // Delete the completion + step_completions so child starts fresh
      await supabase
        .from('step_completions')
        .delete()
        .eq('completion_id', detail.completionId);
      await supabase.from('completions').delete().eq('completion_id', detail.completionId);

      void queryClient.invalidateQueries({ queryKey: ['approvalQueue', session?.user.id] });

      router.back();
    } catch {
      setIsSubmitting(false);
    }
  }, [detail, isSubmitting, queryClient, session, router]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF] items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  if (error || !detail) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0FF] items-center justify-center px-6">
        <Text className="font-inter text-neutral-500 text-center">
          Could not load activity details.
        </Text>
        <TouchableOpacity
          className="mt-6 bg-brand-primary rounded-xl px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="font-inter font-semibold text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0FF]">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-neutral-200">
        <TouchableOpacity
          className="w-[44px] h-[44px] items-center justify-center"
          onPress={() => router.back()}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text className="font-inter text-brand-primary text-base">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 font-inter font-semibold text-neutral-900 text-lg text-center mr-11">
          Review Activity
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Summary card */}
        <View className="bg-white rounded-2xl p-5 mb-5 shadow-sm">
          <View className="flex-row items-center mb-3">
            <Text style={{ fontSize: 36 }} className="mr-3">
              {detail.iconEmoji}
            </Text>
            <View className="flex-1">
              <Text className="font-inter font-semibold text-neutral-900 text-lg">
                {detail.setName}
              </Text>
              <Text className="font-inter text-neutral-500 text-sm">
                Completed by {detail.childName}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center bg-accent-star/10 rounded-xl px-4 py-3 mb-3">
            <Text className="text-[28px] mr-2">⭐</Text>
            <Text className="font-inter font-semibold text-neutral-900 text-base">
              {detail.starsEarned + (parentGoldStar ? 5 : 0)} stars earned
              {parentGoldStar ? ' (+5 bonus)' : ''}
            </Text>
          </View>

          {/* Parent Gold Star — optional +5 bonus awarded at approval */}
          <TouchableOpacity
            className={`flex-row items-center rounded-xl px-4 py-3 ${
              parentGoldStar ? 'bg-accent-star/20 border border-accent-star' : 'bg-[#F5F0FF]'
            }`}
            onPress={() => setParentGoldStar((v) => !v)}
            accessibilityLabel={parentGoldStar ? 'Remove gold star bonus' : 'Add gold star bonus (+5 stars)'}
            accessibilityRole="checkbox"
          >
            <Text className="text-[22px] mr-2">{parentGoldStar ? '🌟' : '☆'}</Text>
            <View className="flex-1">
              <Text className="font-inter font-semibold text-neutral-900 text-sm">
                Parent Gold Star
              </Text>
              <Text className="font-inter text-neutral-500 text-xs">
                Tap to award a bonus +5 stars
              </Text>
            </View>
            {parentGoldStar && (
              <Text className="font-inter font-bold text-accent-star text-sm">+5 ⭐</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Carer banner — only when this completion came from a non-child actor
            (school TA, grandparent, etc.). Shows who marked it done, where, and
            their note if any. Gives the parent context before they decide
            approve/redo. */}
        {(detail.carerName || detail.environment !== 'HOME') && (
          <View className="bg-sky-50 rounded-2xl p-4 mb-4 border border-sky-200">
            <Text className="font-inter font-semibold text-sky-900 text-xs mb-1">
              {detail.environment === 'SCHOOL'
                ? '🏫 Marked done at school'
                : detail.environment === 'RESPITE'
                  ? '🌿 Marked done at respite'
                  : '🏠 Marked done at home'}
              {detail.carerName ? ` by ${detail.carerName}` : ''}
            </Text>
            {detail.carerNote && (
              <Text className="font-inter text-sky-900 text-sm leading-relaxed">
                "{detail.carerNote}"
              </Text>
            )}
          </View>
        )}

        {/* Steps breakdown */}
        <Text className="font-inter font-semibold text-neutral-700 text-sm uppercase tracking-wide mb-3">
          Steps Completed
        </Text>

        <View className="bg-white rounded-2xl overflow-hidden mb-6 shadow-sm">
          {detail.steps.map((step, idx) => (
            <View
              key={step.stepId}
              className={`flex-row items-center px-4 py-4 ${
                idx < detail.steps.length - 1 ? 'border-b border-neutral-100' : ''
              }`}
            >
              <View className="w-7 h-7 rounded-full bg-accent-success/20 items-center justify-center mr-3">
                <Text className="text-accent-success font-inter font-bold text-xs">✓</Text>
              </View>
              <Text className="flex-1 font-inter text-neutral-900 text-sm">{step.title}</Text>
              <Text className="font-inter text-neutral-400 text-xs">
                {formatTime(step.timeTakenSeconds)}
              </Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          className="bg-accent-success rounded-2xl items-center justify-center mb-3"
          style={{ height: 64 }}
          onPress={() => void handleApprove()}
          disabled={isSubmitting}
          accessibilityLabel="Approve activity"
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-inter font-semibold text-white text-lg">✓ Approve</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-white border border-neutral-300 rounded-2xl items-center justify-center"
          style={{ height: 64 }}
          onPress={() => void handleRedo()}
          disabled={isSubmitting}
          accessibilityLabel="Ask child to redo activity"
          accessibilityRole="button"
        >
          <Text className="font-inter font-semibold text-neutral-700 text-lg">↺ Redo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Step Sequencer Screen — Sprint 2.2 / 2.4
 *
 * Shows one step at a time from an activity set.
 * Countdown timer is INFORMATIONAL only — never blocks the child.
 * BIG TICK button (88px height) advances to the next step.
 * Audio narration plays automatically when each step is shown.
 *
 * After all steps:
 *   requiresApproval  → shows ApprovalScreen (no back escape)
 *                     → Realtime watches completions row
 *                     → parent approves → CelebrationModal → home
 *   !requiresApproval → shows CelebrationModal → back to home
 */
import { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { StepCard } from '@/components/ui/StepCard';
import { ApprovalScreen } from '@/components/ui/ApprovalScreen';
import { CelebrationModal } from '@/components/ui/CelebrationModal';
import { StarCounter } from '@/components/ui/StarCounter';
import { useStepSequencer } from '@/hooks/useStepSequencer';
import { useChildStore } from '@/stores/child.store';
import { playStepAudio, stopStepAudio } from '@/lib/audio';
import { supabase } from '@/lib/supabase';

export default function StepSequencerScreen() {
  const router = useRouter();
  const { scheduledSetId } = useLocalSearchParams<{ scheduledSetId: string }>();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const queryClient = useQueryClient();
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [isTicking, setIsTicking] = useState(false);
  // Stars shown in celebration modal — may be updated when parent approves
  const [celebrationStars, setCelebrationStars] = useState(0);

  const {
    isLoading,
    error,
    steps,
    currentIndex,
    currentStep,
    elapsedSeconds,
    starsEarned,
    isComplete,
    requiresApproval,
    setName,
    iconEmoji,
    newlyEarnedBadges,
    completionId,
    markStepComplete,
  } = useStepSequencer(
    scheduledSetId ?? '',
    selectedChild?.profile_id ?? '',
    selectedChild?.child_name ?? '',
  );

  // Speak step title + instruction whenever step changes
  useEffect(() => {
    if (!currentStep) return;
    const text = `${currentStep.title}. ${currentStep.instruction_text}`;
    void playStepAudio(text);
    return () => {
      void stopStepAudio();
    };
  }, [currentStep]);

  // Show celebration modal when set is complete and no approval needed
  useEffect(() => {
    if (isComplete && !requiresApproval) {
      setCelebrationStars(starsEarned);
      setCelebrationVisible(true);
    }
  }, [isComplete, requiresApproval, starsEarned]);

  // Invalidate rewards cache when set completes so the Rewards tab shows fresh data
  useEffect(() => {
    if (isComplete && selectedChild?.profile_id) {
      void queryClient.invalidateQueries({ queryKey: ['childRewards', selectedChild.profile_id] });
    }
  }, [isComplete, selectedChild?.profile_id, queryClient]);

  const handleTick = useCallback(async () => {
    if (isTicking) return;
    setIsTicking(true);
    try {
      await markStepComplete();
    } finally {
      setIsTicking(false);
    }
  }, [isTicking, markStepComplete]);

  // Called by ApprovalScreen when parent approves via Realtime
  const handleApproved = useCallback((stars: number) => {
    setCelebrationStars(stars);
    setCelebrationVisible(true);
  }, []);

  const handleCelebrationDismiss = useCallback(() => {
    setCelebrationVisible(false);
    router.replace('/(child)/(tabs)/home');
  }, [router]);

  if (!selectedChild) {
    return (
      <View className="flex-1 bg-neutral-100 items-center justify-center px-6">
        <Text className="text-subhead font-nunito-bold text-neutral-900 text-center">
          No profile selected
        </Text>
      </View>
    );
  }

  // Approval waiting screen — shown OVER the celebration modal (celebration triggers via Realtime)
  if (isComplete && requiresApproval && !celebrationVisible) {
    return (
      <>
        <ApprovalScreen
          childName={selectedChild.child_name}
          setName={setName}
          completionId={completionId ?? ''}
          onApproved={handleApproved}
          onGoHome={() => router.replace('/(child)/(tabs)/home')}
        />
        <CelebrationModal
          visible={celebrationVisible}
          childName={selectedChild.child_name}
          setName={setName}
          starsEarned={celebrationStars}
          badgesEarned={newlyEarnedBadges}
          onDismiss={handleCelebrationDismiss}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-100">
        <StepCard
          stepNumber={1}
          totalSteps={1}
          title=""
          instructionText=""
          durationSeconds={60}
          elapsedSeconds={0}
          onComplete={() => undefined}
          isLoading
        />
      </SafeAreaView>
    );
  }

  if (error || steps.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-100 items-center justify-center px-6">
        <Text className="text-[48px] mb-4">😟</Text>
        <Text
          className="font-nunito-bold text-neutral-900 text-center mb-3"
          style={{ fontSize: 24 }}
        >
          We couldn't load this activity
        </Text>
        <Text className="font-nunito text-neutral-500 text-center mb-8" style={{ fontSize: 20 }}>
          Ask a grown-up for help, or go back and try again.
        </Text>
        <TouchableOpacity
          className="bg-brand-primary rounded-2xl px-8 items-center justify-center"
          style={{ height: 80 }}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text className="text-subhead font-nunito-bold text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-100">
      <StatusBar barStyle="dark-content" />

      <View className="flex-row items-center justify-between px-5 pt-2 pb-1">
        <TouchableOpacity
          className="w-[44px] h-[44px] items-center justify-center"
          onPress={async () => {
            // Pause the set so the child can resume from here later
            if (!isComplete && scheduledSetId) {
              await supabase
                .from('scheduled_sets')
                .update({ status: 'PAUSED' })
                .eq('scheduled_set_id', scheduledSetId);
            }
            router.back();
          }}
          accessibilityLabel="Pause and go back"
          accessibilityRole="button"
        >
          <Text className="text-subhead text-neutral-500">←</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 20 }}>{iconEmoji}</Text>
          <Text
            className="font-nunito-bold text-neutral-900"
            style={{ fontSize: 16 }}
            numberOfLines={1}
          >
            {setName}
          </Text>
        </View>

        <View className="bg-accent-star/10 rounded-xl px-3 py-1">
          <StarCounter count={starsEarned} size="sm" />
        </View>
      </View>

      {currentStep && (
        <StepCard
          stepNumber={currentIndex + 1}
          totalSteps={steps.length}
          title={currentStep.title}
          instructionText={currentStep.instruction_text}
          illustrationUrl={currentStep.illustration_url}
          illustrationEmoji={iconEmoji}
          durationSeconds={currentStep.duration_seconds}
          elapsedSeconds={elapsedSeconds}
          onComplete={() => void handleTick()}
          isLoading={isTicking}
        />
      )}

      <CelebrationModal
        visible={celebrationVisible}
        childName={selectedChild.child_name}
        setName={setName}
        starsEarned={celebrationStars}
        badgesEarned={newlyEarnedBadges}
        onDismiss={handleCelebrationDismiss}
      />
    </SafeAreaView>
  );
}

import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';

interface ApprovalScreenProps {
  childName: string;
  setName: string;
  /** The completion_id to watch for parent_approved = true via Realtime */
  completionId: string;
  /** Called when parent approves — triggers CelebrationModal transition */
  onApproved: (starsEarned: number) => void;
  /** Called when child taps "Go Home" — allows escape if parent is unavailable */
  onGoHome: () => void;
}

/**
 * ApprovalScreen — Sprint 2.2 / 2.4
 * Fullscreen modal shown after child completes a set requiring approval.
 *
 * CRITICAL: No navigation escape possible — back button is disabled.
 * Child must wait for parent to review and approve on their device.
 *
 * Supabase Realtime watches the `completions` row. When parent_approved
 * flips to true, onApproved is called with the stars earned.
 *
 * Spec: Section 11.1, Step 2.
 */
export function ApprovalScreen({
  childName,
  setName,
  completionId,
  onApproved,
  onGoHome,
}: ApprovalScreenProps) {
  // Refs so callbacks are always current without causing channel re-creation
  const onApprovedRef = useRef(onApproved);
  const onGoHomeRef = useRef(onGoHome);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  });
  useEffect(() => {
    onGoHomeRef.current = onGoHome;
  });

  // Disable hardware back button — no navigation escape
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // Subscribe to Realtime changes on this completion row + redo broadcast.
  // Only completionId in deps — callbacks are read via refs so the channel
  // is never torn down and recreated when parent re-renders.
  useEffect(() => {
    if (!completionId) return;

    const channel = supabase
      .channel(`approval-${completionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'completions',
          filter: `completion_id=eq.${completionId}`,
        },
        (payload) => {
          const updated = payload.new as { parent_approved: boolean; stars_earned: number };
          if (updated.parent_approved === true) {
            onApprovedRef.current(updated.stars_earned);
          }
        },
      )
      // Listen for redo broadcast — parent tapped "Redo" on their device
      .on('broadcast', { event: 'redo' }, () => {
        onGoHomeRef.current();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [completionId]);

  return (
    <View className="flex-1 bg-brand-primary items-center justify-center px-8">
      <StatusBar style="light" />

      {/* Large celebratory emoji */}
      <Text className="text-[100px] mb-6">🎉</Text>

      <Text
        className="font-nunito-extrabold text-white text-center mb-4"
        style={{ fontSize: 32, lineHeight: 40 }}
      >
        Amazing work, {childName}!
      </Text>

      <Text
        className="font-nunito text-white/90 text-center mb-10"
        style={{ fontSize: 22, lineHeight: 30 }}
      >
        You finished {setName}!{'\n'}Get Mum or Dad to check! 🦷
      </Text>

      {/* Visual cue — waiting indicator */}
      <View className="bg-white/20 rounded-3xl px-8 py-6 items-center mb-8">
        <Text className="text-[48px] mb-3">👨‍👩‍👧</Text>
        <Text
          className="font-nunito-bold text-white text-center"
          style={{ fontSize: 18, lineHeight: 26 }}
        >
          Waiting for a parent to review…
        </Text>
        <Text
          className="font-nunito text-white/70 text-center mt-2"
          style={{ fontSize: 16, lineHeight: 22 }}
        >
          They'll get a notification on their phone
        </Text>
      </View>

      {/* Go home button — lets child return if parent is unavailable */}
      <TouchableOpacity
        className="bg-white/20 rounded-2xl items-center justify-center"
        style={{ height: 80, width: '100%' }}
        onPress={onGoHome}
        accessibilityLabel="Go back to home screen"
        accessibilityRole="button"
      >
        <Text className="font-nunito-bold text-white" style={{ fontSize: 22 }}>
          🏠 Go Home for Now
        </Text>
      </TouchableOpacity>
    </View>
  );
}

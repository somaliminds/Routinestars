import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { ProgressBar } from './ProgressBar';
import { TimeTimerWedge } from './TimeTimerWedge';
import { useLocalIllustration } from '@/hooks/useLocalIllustration';

interface StepCardProps {
  /** When provided, a parent-uploaded local photo for this step takes
   *  priority over illustrationUrl. */
  stepId?: string | null;
  stepNumber: number;
  totalSteps: number;
  title: string;
  instructionText: string;
  illustrationUrl?: string | null;
  illustrationEmoji?: string;
  durationSeconds: number;
  elapsedSeconds: number;
  onComplete: () => void;
  isLoading?: boolean;
}

export function StepCard({
  stepId,
  stepNumber,
  totalSteps,
  title,
  instructionText,
  illustrationUrl,
  illustrationEmoji = '📋',
  durationSeconds,
  elapsedSeconds,
  onComplete,
  isLoading = false,
}: StepCardProps) {
  const progress = Math.min(elapsedSeconds / Math.max(durationSeconds, 1), 1);
  const remaining = Math.max(durationSeconds - elapsedSeconds, 0);
  const isOvertime = elapsedSeconds > durationSeconds;
  const [imgFailed, setImgFailed] = useState(false);

  // ── Hold-to-finish (anti-cheat) ──────────────────────────────────────────
  // Parents reported children tapping "Done" instantly to reach the reward
  // without doing the step. A short press-and-hold adds just enough friction
  // to stop impulsive tapping, without ever blocking the child (SEN rule:
  // the timer/feedback never punishes). Released early = no penalty, resets.
  const HOLD_MS = 1400;
  const [holding, setHolding] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Reset the hold whenever the step changes.
  useEffect(() => {
    doneRef.current = false;
    setHolding(false);
    fill.setValue(0);
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, [stepNumber, fill]);

  // Clear any pending timer on unmount.
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  const startHold = () => {
    if (doneRef.current) return;
    setHolding(true);
    if (!reduceMotion) {
      Animated.timing(fill, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start();
    }
    holdTimer.current = setTimeout(() => {
      doneRef.current = true;
      fill.setValue(1);
      onComplete();
    }, HOLD_MS);
  };

  const endHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (!doneRef.current) {
      setHolding(false);
      Animated.timing(fill, { toValue: 0, duration: 160, useNativeDriver: false }).start();
    }
  };

  // Sprint 7: parent photo on this device wins over the database URL.
  const { uri: localUri } = useLocalIllustration(stepId);
  const effectiveImageUri = localUri ?? illustrationUrl;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingBlock} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Step progress indicator */}
      <View style={styles.progressSection}>
        <Text style={styles.stepCounter}>
          Step {stepNumber} of {totalSteps}
        </Text>
        <ProgressBar progress={stepNumber / totalSteps} variant="step" showLabel={false} />
      </View>

      {/* Illustration — neumorphic white card lifted off pastel bg */}
      <View style={styles.illustrationCard}>
        {effectiveImageUri && !imgFailed ? (
          <Image
            source={{ uri: effectiveImageUri }}
            style={styles.illustrationImage}
            resizeMode={localUri ? 'cover' : 'contain'}
            accessibilityLabel={title}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text style={styles.illustrationEmoji}>{illustrationEmoji}</Text>
        )}
      </View>

      {/* Step content */}
      <View style={styles.contentArea}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepInstruction}>{instructionText}</Text>

        {/* Timer — visual Time Timer wedge alongside the digital readout.
            The wedge is the dominant indicator (SEN-classroom standard);
            the digital text supports children who can read numbers; the
            linear bar underneath reinforces both for users with low
            vision or who prefer linear progress cues. */}
        <View style={styles.timerRow}>
          <TimeTimerWedge progress={progress} isOvertime={isOvertime} size={80} />
          <Text style={[styles.timerText, isOvertime && styles.timerOvertime]}>
            {isOvertime
              ? `+${formatTime(elapsedSeconds - durationSeconds)}`
              : formatTime(remaining)}
          </Text>
        </View>
        <ProgressBar progress={progress} variant="timer" showLabel={false} />
      </View>

      {/* BIG hold-to-finish button — a darker fill sweeps as the child holds */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.tickButton, reduceMotion && holding && styles.tickButtonHolding]}
          onPressIn={startHold}
          onPressOut={endHold}
          onAccessibilityTap={onComplete}
          accessibilityLabel={`Mark step ${stepNumber} complete`}
          accessibilityRole="button"
          accessibilityHint="Press and hold the button until it fills to mark this step done"
        >
          {!reduceMotion && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tickFill,
                { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          )}
          <Text style={styles.tickEmoji}>✅</Text>
          <Text style={styles.tickLabel}>{holding ? 'Keep holding…' : 'Hold to finish'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F0FF', // soft lavender — matches home screen bg
  },
  loadingBlock: {
    margin: 20,
    height: 300,
    backgroundColor: '#EDE0FF',
    borderRadius: 24,
    opacity: 0.6,
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  stepCounter: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  illustrationCard: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 7,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  illustrationEmoji: { fontSize: 80 },
  contentArea: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 20,
  },
  stepTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 32,
    lineHeight: 40,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  stepInstruction: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 22,
    lineHeight: 30,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 28, // larger now that the wedge sits beside it — pair reads as one unit
    color: '#6B7280',
  },
  timerRow: {
    // Wedge + digital readout sit side by side, mirroring the physical
    // Time Timer device. Centred so the pair feels like a single object.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  timerOvertime: {
    color: '#D97706', // amber — not red, avoids anxiety
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    marginTop: 12,
  },
  tickButton: {
    height: 80, // 4dp grid (was 88)
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden', // clips the sweeping fill to the rounded shape
    // Shadow matches surface colour, not darker — physically correct light
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  // Reduced-motion: a single static darkening instead of a moving sweep.
  tickButtonHolding: { backgroundColor: '#059669' },
  // The progress sweep — a darker green filling left→right as the child holds.
  tickFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#059669',
  },
  tickEmoji: { fontSize: 36 },
  tickLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
  },
});

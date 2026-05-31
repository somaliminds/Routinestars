import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { ProgressBar } from './ProgressBar';

interface StepCardProps {
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
        {illustrationUrl && !imgFailed ? (
          <Image
            source={{ uri: illustrationUrl }}
            style={styles.illustrationImage}
            resizeMode="contain"
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

        {/* Timer — informational only, amber when overtime (not red) */}
        <View style={styles.timerContainer}>
          <Text style={[styles.timerText, isOvertime && styles.timerOvertime]}>
            {isOvertime
              ? `+${formatTime(elapsedSeconds - durationSeconds)}`
              : formatTime(remaining)}
          </Text>
        </View>
        <ProgressBar progress={progress} variant="timer" showLabel={false} />
      </View>

      {/* BIG TICK button — solid success green with depth */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.tickButton}
          onPress={onComplete}
          accessibilityLabel={`Mark step ${stepNumber} complete`}
          accessibilityRole="button"
          accessibilityHint="Double tap to mark this step as done"
          activeOpacity={0.85}
        >
          <Text style={styles.tickEmoji}>✅</Text>
          <Text style={styles.tickLabel}>Done!</Text>
        </TouchableOpacity>
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
    shadowOpacity: 0.20,
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
    fontSize: 22,
    color: '#6B7280',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 8,
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
    height: 88,
    borderRadius: 28,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  tickEmoji: { fontSize: 36 },
  tickLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
  },
});

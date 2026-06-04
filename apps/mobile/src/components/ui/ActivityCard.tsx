import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ScheduledSetStatus } from '@/types/database';

// MY24 solid pastel circles — bright, warm, child-friendly
const ICON_COLORS = ['#4FD1C5', '#F687B3', '#A78BFA', '#FBB774', '#7DD3FC', '#86EFAC'];

const STATUS_BADGE: Record<
  ScheduledSetStatus,
  { bg: string; text: string; label: string }
> = {
  PENDING:           { bg: '#EDE0FF', text: '#7C3AED', label: 'Ready' },
  IN_PROGRESS:       { bg: '#7C3AED', text: '#FFFFFF', label: 'In Progress' },
  PAUSED:            { bg: '#FFE4C8', text: '#D97706', label: 'Paused' },
  AWAITING_APPROVAL: { bg: '#FFF0C0', text: '#B45309', label: 'Waiting' },
  APPROVED:          { bg: '#C8F5E0', text: '#059669', label: 'Approved' },
  LOCKED:            { bg: '#C8F5E0', text: '#059669', label: '✓ Done' },
  SKIPPED:           { bg: '#F3F4F6', text: '#6B7280', label: 'Skipped' },
};

interface ActivityCardProps {
  title: string;
  iconEmoji: string;
  starValue: number;
  status: ScheduledSetStatus;
  startTime: string;
  onPress?: () => void;
  isLoading?: boolean;
  colorIndex?: number;
}

export function ActivityCard({
  title,
  iconEmoji,
  starValue,
  status,
  startTime,
  onPress,
  isLoading = false,
  colorIndex = 0,
}: ActivityCardProps) {
  const isInteractive = status === 'PENDING' || status === 'IN_PROGRESS' || status === 'PAUSED';
  const badge = STATUS_BADGE[status];
  const iconBg = ICON_COLORS[colorIndex % ICON_COLORS.length]!;

  if (isLoading) {
    return <View style={styles.skeleton} />;
  }

  return (
    <TouchableOpacity
      style={[styles.card, !isInteractive && styles.cardDisabled]}
      onPress={onPress}
      disabled={!isInteractive}
      accessibilityLabel={`${title}, ${badge.label}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive }}
      activeOpacity={0.85}
    >
      {/* Solid-colour icon square (MY24-style) */}
      <View style={[styles.iconSquare, { backgroundColor: iconBg }]}>
        <Text style={styles.iconEmoji}>{iconEmoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <Text style={styles.time} numberOfLines={1}>{startTime}</Text>
        <Text style={styles.stars} numberOfLines={1}>⭐ {starValue} stars</Text>
      </View>

      {/* Status pill */}
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.badgeText, { color: badge.text }]} numberOfLines={1}>
          {badge.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    width: '100%',
    height: 100,
    backgroundColor: '#EDE0FF',
    borderRadius: 24,
    marginBottom: 12,
    opacity: 0.6,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  cardDisabled: { opacity: 0.75 },
  iconSquare: {
    width: 64,
    height: 64,
    borderRadius: 32, // full circle — matches MY24
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  iconEmoji: { fontSize: 30 },
  content: { flex: 1 },
  title: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: '#111827',
    lineHeight: 26,
  },
  time: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  stars: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 2,
  },
  badge: {
    borderRadius: 999, // true pill, not 20px rounded square
    paddingHorizontal: 12,
    paddingVertical: 8,  // was 6 — proportional to text (1.6× rule)
    marginLeft: 8,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold', // Inter > Nunito for small-size legibility
    fontSize: 12,
    letterSpacing: 0.2,
  },
});

/**
 * ZonesCheckInModal — child-facing Zones of Regulation emotional picker.
 *
 * Four large coloured tiles arranged in a 2x2 grid. Tapping one inserts
 * an emotional_checkins row and dismisses the modal.
 *
 * Why this design:
 *   - Tiles are minimum 140x140 to comfortably hit the 80x80 child target
 *     guidance plus give space for the emoji + label.
 *   - Colours match the Kuypers Zones of Regulation curriculum exactly so
 *     SENCOs / parents can map directly to printed classroom posters.
 *   - Labels use simple verbs and emojis, not adjectives — easier for
 *     pre-readers and children with receptive language delays.
 *   - "Skip for now" exists because forcing an emotional response can be
 *     dysregulating. Avoidance is data too — we log nothing rather than
 *     wrong data.
 *
 * The caller (home screen) decides WHEN to show this — typically:
 *   - First load of the day if no check-in exists yet
 *   - After approval / lockout flow completes
 */
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Zone } from '@/types/database';

interface ZonesCheckInModalProps {
  visible: boolean;
  childName: string;
  /** Caller-supplied context tag for the row, e.g. 'start_of_day' | 'post_lockout'. */
  context: string;
  onSelect: (zone: Zone, context: string) => void;
  onSkip: () => void;
}

interface ZoneTile {
  zone: Zone;
  emoji: string;
  label: string;
  bg: string;
  fg: string; // text colour
}

// Kuypers Zones colour reference — see https://www.zonesofregulation.com
const ZONES: ZoneTile[] = [
  { zone: 'BLUE',   emoji: '😴', label: 'Tired',  bg: '#BFDBFE', fg: '#1E3A8A' },
  { zone: 'GREEN',  emoji: '🙂', label: 'Ready',  bg: '#BBF7D0', fg: '#14532D' },
  { zone: 'YELLOW', emoji: '😬', label: 'Wiggly', bg: '#FEF08A', fg: '#713F12' },
  { zone: 'RED',    emoji: '😡', label: 'Big',    bg: '#FECACA', fg: '#7F1D1D' },
];

export function ZonesCheckInModal({
  visible,
  childName,
  context,
  onSelect,
  onSkip,
}: ZonesCheckInModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>How are you feeling, {childName}?</Text>
          <Text style={styles.sub}>Pick the one that's closest.</Text>

          <View style={styles.grid}>
            {ZONES.map((z) => (
              <TouchableOpacity
                key={z.zone}
                style={[styles.tile, { backgroundColor: z.bg }]}
                onPress={() => onSelect(z.zone, context)}
                accessibilityLabel={`${z.label} zone`}
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Text style={styles.tileEmoji}>{z.emoji}</Text>
                <Text style={[styles.tileLabel, { color: z.fg }]}>{z.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/*
            Skip is intentionally low-prominence — we want a real answer
            when we can get one, but never force it. Forcing emotional
            disclosure can dysregulate; absence-of-answer is fine data.
          */}
          <TouchableOpacity
            style={styles.skip}
            onPress={onSkip}
            accessibilityLabel="Skip the feelings check-in for now"
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(91, 33, 182, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    // Subtle inner depth matches the MY24 glass cards elsewhere
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tileEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  tileLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    letterSpacing: -0.2,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  skipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#9CA3AF',
  },
});

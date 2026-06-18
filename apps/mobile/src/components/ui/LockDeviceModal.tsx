/**
 * LockDeviceModal — Phase 5 Sprint 5.1 (device-lock).
 *
 * Parent-facing helper that walks them through enabling the OS-level
 * single-app lock so the child can't escape to other apps. We can't
 * trigger this from JS (Apple/Google reserve real kiosk mode for MDM
 * profiles), but we can give the parent a one-step path with the right
 * platform-specific instructions and trust them to do the hardware
 * gesture.
 *
 * Why this approach:
 *   - No native module dependency, no rebuild required.
 *   - Works on any consumer iPad or Android tablet, no MDM enrollment.
 *   - Parent learns the gesture once and uses it daily.
 */
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LockDeviceModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LockDeviceModal({ visible, onClose }: LockDeviceModalProps) {
  const isIOS = Platform.OS === 'ios';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Lock the tablet</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.lead}>
            {isIOS ? 'Use iOS Guided Access' : 'Use Android Screen Pinning'} to keep the tablet on
            RoutineStars until you unlock it.
          </Text>

          {isIOS ? (
            <>
              <Step n={1} title="One-time setup (if not done)">
                Open the iPad's Settings → Accessibility → Guided Access → toggle it on. Set a
                Guided Access passcode you'll remember.
              </Step>
              <Step n={2} title="To lock now">
                Triple-click the side button (top button on iPad). Tap "Start" in the corner.
              </Step>
              <Step n={3} title="To unlock later">
                Triple-click the side button again, enter your Guided Access passcode, tap "End".
              </Step>
            </>
          ) : (
            <>
              <Step n={1} title="One-time setup (if not done)">
                Open the tablet's Settings → Security → App pinning (or "Screen pinning") → turn
                it on. Make sure "Ask for PIN before unpinning" is also on.
              </Step>
              <Step n={2} title="To lock now">
                Open the Recent Apps screen (the square or three-line gesture at the bottom). Tap
                the RoutineStars icon at the top of its card, then tap "Pin".
              </Step>
              <Step n={3} title="To unlock later">
                Hold Back and Recent Apps together (or follow the on-screen prompt) and enter
                your unlock PIN.
              </Step>
            </>
          )}

          <View style={styles.calloutBox}>
            <Text style={styles.calloutText}>
              💡 Once locked, your child can't open other apps, see notifications, or close
              RoutineStars. The lock survives screen-off and screen-on.
            </Text>
          </View>

          <TouchableOpacity style={styles.done} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneText}>I've locked it</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{n}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: '#111827' },
  cancel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7C3AED' },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 18,
  },
  step: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#7C3AED',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  stepTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#111827', marginBottom: 2 },
  stepBody: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: '#4B5563', lineHeight: 20 },
  calloutBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  calloutText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
  },
  done: {
    backgroundColor: '#10B981',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 7,
  },
  doneText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },
});

/**
 * useBlockBackButton — swallow the Android hardware back button.
 *
 * Sprint 5.2 (device lock). The child screens should never let the
 * hardware back gesture leak the user out of the child experience -
 * either to a previous screen the parent navigated through (which can
 * happen on Expo Router) or to the home launcher (which leaves the
 * app, defeating the soft-lock entirely).
 *
 * iOS has no hardware back button so this is a noop there; the hook
 * still mounts to keep the call site platform-agnostic.
 *
 * Pass `enabled: false` to temporarily allow the back button (e.g.
 * the step sequencer's exit-confirm modal can let it through to
 * dismiss).
 */
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useBlockBackButton(enabled: boolean = true) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    // Returning true tells React Native we handled the press, so it
    // does not propagate to the system / navigator.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [enabled]);
}

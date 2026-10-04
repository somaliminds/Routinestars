/**
 * ui-dialogs — cross-platform confirm / notice.
 *
 * react-native-web stubs `Alert.alert` to a no-op (`static alert() {}`), so on
 * web the button callbacks never fire and destructive confirmations become
 * unreachable. These helpers use the native Alert on device and the browser's
 * blocking `confirm` / `alert` on web, so the admin panel (which runs on web)
 * behaves correctly on both.
 */
import { Alert, Platform } from 'react-native';

// Reference the browser dialogs without requiring the DOM lib in tsconfig.
type WebDialogs = {
  confirm?: (message?: string) => boolean;
  alert?: (message?: string) => void;
};
const web = globalThis as unknown as WebDialogs;

/** Ask the user to confirm an action. Resolves true if confirmed. */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
    return Promise.resolve(web.confirm ? web.confirm(text) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: opts.confirmLabel ?? 'Confirm',
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Show an informational message (no choices). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (web.alert) web.alert(text);
    return;
  }
  Alert.alert(title, message);
}

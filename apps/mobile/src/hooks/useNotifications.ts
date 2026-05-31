/**
 * useNotifications — Sprint 2.4
 *
 * Registers the device for Expo Push Notifications and persists the token
 * to the parent's profile in Supabase so notify-parent Edge Function can use it.
 *
 * Call this once from the parent app root/layout after authentication.
 * Safe to call multiple times — de-dupes by comparing stored token.
 */
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Show alerts when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  // Physical device required for push notifications
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    // Simulator or environment without push support
    return null;
  }
}

/**
 * Hook for use in parent app layout/root.
 * Registers for push notifications and saves the token to Supabase.
 *
 * @param userId - Supabase auth user ID of the logged-in parent (null if not yet authenticated)
 */
export function useNotifications(userId: string | null): void {
  useEffect(() => {
    if (!userId) return;

    async function setup() {
      try {
        const token = await registerForPushNotifications();
        if (!token) return;

        // Check if token is already stored to avoid unnecessary writes
        const { data: existing } = await supabase
          .from('parent_profiles')
          .select('expo_push_token')
          .eq('user_id', userId!)
          .single();

        if (existing?.expo_push_token === token) return;

        await supabase
          .from('parent_profiles')
          .update({ expo_push_token: token })
          .eq('user_id', userId!);
      } catch {
        // Push setup errors must never crash the app
      }
    }

    void setup();
  }, [userId]);
}

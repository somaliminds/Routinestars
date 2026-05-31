import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
  );
}

/**
 * Expo SecureStore adapter for Supabase Auth token persistence.
 * On native: tokens stored in device keychain via SecureStore.
 * On web: falls back to localStorage (SecureStore not supported on web).
 * Quality Rule 7: Sensitive data (tokens) never logged or exposed.
 *
 * SecureStore has a 2048-byte limit per key. The Supabase session JWT
 * can exceed this, so large values are split into 1800-byte chunks stored
 * under keys like "supabase.auth.token.chunk_0", "supabase.auth.token.chunk_1", etc.
 * A metadata key stores the chunk count for reassembly.
 */
const CHUNK_SIZE = 1800;

async function setChunked(key: string, value: string): Promise<void> {
  const SecureStore = await import('expo-secure-store');
  if (value.length <= CHUNK_SIZE) {
    // Clean up any previous chunks for this key
    await SecureStore.deleteItemAsync(`${key}.chunk_count`);
    await SecureStore.setItemAsync(key, value);
    return;
  }
  // Delete the non-chunked key if it exists
  await SecureStore.deleteItemAsync(key);
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(`${key}.chunk_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}.chunk_count`, String(chunks));
}

async function getChunked(key: string): Promise<string | null> {
  const SecureStore = await import('expo-secure-store');
  const countStr = await SecureStore.getItemAsync(`${key}.chunk_count`);
  if (!countStr) {
    // Not chunked — read directly
    return SecureStore.getItemAsync(key);
  }
  const count = parseInt(countStr, 10);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}.chunk_${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function deleteChunked(key: string): Promise<void> {
  const SecureStore = await import('expo-secure-store');
  const countStr = await SecureStore.getItemAsync(`${key}.chunk_count`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}.chunk_${i}`);
    }
    await SecureStore.deleteItemAsync(`${key}.chunk_count`);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return getChunked(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // ignore — web storage unavailable (e.g. private browsing)
      }
      return;
    }
    await setChunked(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
      return;
    }
    await deleteChunked(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

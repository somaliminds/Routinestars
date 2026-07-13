/**
 * language.store — the user's chosen UI language, persisted across restarts.
 *
 * `null` means "follow the device language" (the default). Persistence is
 * web-safe: SecureStore on native, localStorage on web (the professional
 * portal build runs in a browser).
 *
 * The actual i18next language switch + RTL handling lives in src/i18n; this
 * store is only the persisted preference so the app can restore it on boot.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

const STORAGE_KEY = 'routinestars.language';
const isWeb = Platform.OS === 'web';

async function persist(value: string | null): Promise<void> {
  try {
    if (isWeb) {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    if (value) await SecureStore.setItemAsync(STORAGE_KEY, value);
    else await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Best-effort — a failed write just means we fall back to device language.
  }
}

async function readStored(): Promise<string | null> {
  try {
    if (isWeb) return window.localStorage.getItem(STORAGE_KEY);
    const SecureStore = await import('expo-secure-store');
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface LanguageState {
  /** BCP-47 code (e.g. 'so', 'pl', 'ur') or null to follow the device. */
  language: string | null;
  isReady: boolean;
  /** Set + persist the chosen language (null = follow device). */
  setLanguage: (lang: string | null) => void;
  /** Load the stored preference on boot. */
  hydrate: () => Promise<string | null>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: null,
  isReady: false,

  setLanguage: (lang) => {
    set({ language: lang });
    void persist(lang);
  },

  hydrate: async () => {
    const stored = await readStored();
    set({ language: stored, isReady: true });
    return stored;
  },
}));

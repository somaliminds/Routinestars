/**
 * Voice store — persists the parent's chosen TTS voice identifier across
 * app restarts so the child always hears the same voice they're used to.
 * Uses expo-secure-store (already a dependency) for persistence.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'routinestars.voice_id';

interface VoiceState {
  voiceId: string | null;
  /** True once we've hydrated from SecureStore (avoids race on first call). */
  isReady: boolean;
  setVoiceId: (id: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  voiceId: null,
  isReady: false,

  setVoiceId: (id) => {
    set({ voiceId: id });
    void (async () => {
      try {
        if (id) await SecureStore.setItemAsync(STORAGE_KEY, id);
        else await SecureStore.deleteItemAsync(STORAGE_KEY);
      } catch {
        // Persistence is best-effort
      }
    })();
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      set({ voiceId: stored ?? null, isReady: true });
    } catch {
      set({ isReady: true });
    }
  },
}));

/** Sync read of the stored voice id (no async). Returns null if not hydrated yet. */
export function getStoredVoiceId(): string | null {
  return useVoiceStore.getState().voiceId;
}

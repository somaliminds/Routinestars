/**
 * Audio narration — expo-speech (device TTS).
 *
 * Voice priority for each call:
 *   1. Parent's chosen voice from useVoiceStore (set in Settings)
 *   2. Best en-GB voice on the device (auto-picked, cached for session)
 *   3. System default
 */
import * as Speech from 'expo-speech';
import { getStoredVoiceId } from '@/stores/voice.store';

const TARGET_LANG = 'en-GB';

let cachedAutoVoiceId: string | null | undefined = undefined;

async function pickBestVoice(): Promise<string | null> {
  if (cachedAutoVoiceId !== undefined) return cachedAutoVoiceId;

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const enGb = voices.filter((v) => v.language === TARGET_LANG);
    const enAny = voices.filter((v) => v.language?.startsWith('en'));

    const score = (v: Speech.Voice): number => {
      let s = 0;
      if (v.language === TARGET_LANG) s += 100;
      else if (v.language?.startsWith('en')) s += 40;
      if (v.quality === Speech.VoiceQuality.Enhanced) s += 50;
      const name = v.name?.toLowerCase() ?? '';
      if (name.includes('network')) s += 30;
      if (name.includes('enhanced')) s += 20;
      if (/(female|woman|f\b|gbg|gbb|rjs)/i.test(v.name ?? '')) s += 10;
      return s;
    };

    const pool = enGb.length ? enGb : enAny.length ? enAny : voices;
    if (pool.length === 0) {
      cachedAutoVoiceId = null;
      return null;
    }

    pool.sort((a, b) => score(b) - score(a));
    cachedAutoVoiceId = pool[0]!.identifier;
    return cachedAutoVoiceId;
  } catch {
    cachedAutoVoiceId = null;
    return null;
  }
}

async function resolveVoice(): Promise<string | null> {
  const chosen = getStoredVoiceId();
  if (chosen) return chosen;
  return await pickBestVoice();
}

export async function playStepAudio(text: string | null): Promise<void> {
  await stopStepAudio();
  if (!text) return;

  const voice = await resolveVoice();
  try {
    const options: Speech.SpeechOptions = {
      language: TARGET_LANG,
      pitch: 1.05,
      rate: 0.9,
    };
    if (voice) options.voice = voice;
    Speech.speak(text, options);
  } catch (e) {
    console.log('[audio] speak threw:', e);
  }
}

/** One-shot speak — used for previewing a specific voice in Settings. */
export function previewVoice(voiceId: string, text: string): void {
  try {
    void Speech.stop();
    Speech.speak(text, {
      voice: voiceId,
      language: TARGET_LANG,
      pitch: 1.05,
      rate: 0.9,
    });
  } catch {
    // Ignore preview errors
  }
}

export async function stopStepAudio(): Promise<void> {
  try {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) await Speech.stop();
  } catch {
    // Ignore
  }
}

/** List en-GB voices only, sorted alphabetically by name. */
export async function listEnglishVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const enGb = voices.filter((v) => v.language === TARGET_LANG);
    enGb.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    return enGb;
  } catch {
    return [];
  }
}

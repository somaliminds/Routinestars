/**
 * Local-only per-step photo overrides (Sprint 7).
 *
 * Parents can take or pick a photo for any step. The photo is saved to
 * the app's document directory under {stepId}.jpg and indexed by step_id.
 * The child app prefers a local photo over the database illustration_url.
 *
 * Photos never leave the device — no cloud upload, no cross-device sync.
 * Trade-off (intentional): photos live on the device they were added on.
 * Reason: zero storage cost, GDPR-friendly, works offline, no upload UI
 * to fail. Multi-device families re-add per device.
 */
import * as FileSystem from 'expo-file-system/legacy';

const DIR = FileSystem.documentDirectory + 'step-illustrations/';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

function pathFor(stepId: string): string {
  return DIR + stepId + '.jpg';
}

/** Returns a file:// URI usable as <Image source={{ uri }}>, or null. */
export async function getLocalIllustrationUri(stepId: string): Promise<string | null> {
  if (!stepId) return null;
  const path = pathFor(stepId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

/** Copies the picked image into our managed dir, returns the new local URI. */
export async function setLocalIllustration(stepId: string, sourceUri: string): Promise<string> {
  await ensureDir();
  const dest = pathFor(stepId);
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) await FileSystem.deleteAsync(dest);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

/** Removes the local override (no-op if none exists). */
export async function removeLocalIllustration(stepId: string): Promise<void> {
  const path = pathFor(stepId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path);
}

/**
 * offline-db.web — web stub for offline-db.
 *
 * expo-sqlite is native-only (its web build needs a WASM asset Metro can't
 * resolve here), and the offline queue is a child-tablet concern the
 * professional web build never uses. Metro picks this file on web, keeping
 * expo-sqlite entirely out of the web bundle. Every function is a no-op.
 *
 * Signatures mirror offline-db.ts so callers type-check identically on both
 * platforms.
 */
import type { PendingCompletion, StepCompletionEntry, EnqueueParams } from './offline-db';

export type { PendingCompletion, StepCompletionEntry, EnqueueParams };

export async function getDb(): Promise<never> {
  throw new Error('offline-db is not available on web');
}

export async function saveScheduleCache(
  _childId: string,
  _scheduleDate: string,
  _data: unknown,
): Promise<void> {}

export async function loadScheduleCache(
  _childId: string,
  _scheduleDate: string,
): Promise<unknown | null> {
  return null;
}

export async function enqueuePendingCompletion(_params: EnqueueParams): Promise<void> {}

export async function getPendingCompletions(): Promise<PendingCompletion[]> {
  return [];
}

export async function deletePendingCompletion(_id: number): Promise<void> {}

export async function pendingCompletionCount(): Promise<number> {
  return 0;
}

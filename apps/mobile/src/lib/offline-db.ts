/**
 * offline-db — Sprint 4.3
 *
 * SQLite database for offline-first support:
 *  - cached_schedules: today's schedule JSON for the child app
 *  - pending_completions: completions queued when network was unavailable
 *
 * Uses expo-sqlite (Expo SDK 51+ API). NATIVE ONLY — on web, Metro resolves
 * offline-db.web.ts instead (expo-sqlite is native-only and the offline queue
 * is a child-tablet concern the professional web build never needs).
 */
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('routinestars.db');
  await initSchema(db);
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cached_schedules (
      child_id     TEXT NOT NULL,
      schedule_date TEXT NOT NULL,
      data         TEXT NOT NULL,
      cached_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (child_id, schedule_date)
    );

    CREATE TABLE IF NOT EXISTS pending_completions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduled_set_id    TEXT NOT NULL,
      child_id            TEXT NOT NULL,
      stars_earned        INTEGER NOT NULL DEFAULT 0,
      completed_at        TEXT NOT NULL,
      requires_approval   INTEGER NOT NULL DEFAULT 0,
      set_name            TEXT NOT NULL DEFAULT '',
      child_name          TEXT NOT NULL DEFAULT '',
      step_completions    TEXT NOT NULL DEFAULT '[]',
      created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ── Schedule cache ─────────────────────────────────────────────────────────

export async function saveScheduleCache(
  childId: string,
  scheduleDate: string,
  data: unknown,
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO cached_schedules (child_id, schedule_date, data, cached_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(child_id, schedule_date) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at`,
    [childId, scheduleDate, JSON.stringify(data)],
  );
}

export async function loadScheduleCache(
  childId: string,
  scheduleDate: string,
): Promise<unknown | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ data: string }>(
    `SELECT data FROM cached_schedules WHERE child_id = ? AND schedule_date = ?`,
    [childId, scheduleDate],
  );
  if (!row) return null;
  try {
    return JSON.parse(row.data) as unknown;
  } catch {
    return null;
  }
}

// ── Pending completions queue ──────────────────────────────────────────────

export interface PendingCompletion {
  id: number;
  scheduled_set_id: string;
  child_id: string;
  stars_earned: number;
  completed_at: string;
  requires_approval: boolean;
  set_name: string;
  child_name: string;
  step_completions: StepCompletionEntry[];
  created_at: string;
}

export interface StepCompletionEntry {
  step_id: string;
  time_taken_seconds: number;
}

export interface EnqueueParams {
  scheduledSetId: string;
  childId: string;
  starsEarned: number;
  completedAt: string;
  requiresApproval: boolean;
  setName: string;
  childName: string;
  stepCompletions: StepCompletionEntry[];
}

export async function enqueuePendingCompletion(params: EnqueueParams): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO pending_completions
       (scheduled_set_id, child_id, stars_earned, completed_at, requires_approval, set_name, child_name, step_completions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.scheduledSetId,
      params.childId,
      params.starsEarned,
      params.completedAt,
      params.requiresApproval ? 1 : 0,
      params.setName,
      params.childName,
      JSON.stringify(params.stepCompletions),
    ],
  );
}

export async function getPendingCompletions(): Promise<PendingCompletion[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: number;
    scheduled_set_id: string;
    child_id: string;
    stars_earned: number;
    completed_at: string;
    requires_approval: number;
    set_name: string;
    child_name: string;
    step_completions: string;
    created_at: string;
  }>(`SELECT * FROM pending_completions ORDER BY created_at ASC`);

  return rows.map((r) => ({
    id: r.id,
    scheduled_set_id: r.scheduled_set_id,
    child_id: r.child_id,
    stars_earned: r.stars_earned,
    completed_at: r.completed_at,
    requires_approval: r.requires_approval === 1,
    set_name: r.set_name,
    child_name: r.child_name,
    step_completions: (JSON.parse(r.step_completions) as StepCompletionEntry[]) ?? [],
    created_at: r.created_at,
  }));
}

export async function deletePendingCompletion(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM pending_completions WHERE id = ?`, [id]);
}

export async function pendingCompletionCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_completions`,
  );
  return row?.count ?? 0;
}

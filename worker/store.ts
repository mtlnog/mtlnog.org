import type { Locale, Submission, Topic } from '../src/lib/contact';

// Times are epoch milliseconds.
export const RETRY_GRACE_MS = 60_000;
export const GIVE_UP_MS = 24 * 3600_000;
export const KEEP_DELIVERED_MS = 30 * 24 * 3600_000;

export interface Row {
  id: number;
  created_at: number;
  topic: Topic;
  locale: Locale;
  payload: Submission;
  delivered_at: number | null;
  attempts: number;
  last_error: string | null;
  failed_at: number | null;
  alerted_at: number | null;
}

export interface Store {
  insert(sub: Submission, now: number): Promise<number>;
  // Undelivered, not failed, older than RETRY_GRACE_MS; oldest first.
  retryable(now: number, limit: number): Promise<Row[]>;
  markDelivered(id: number, now: number): Promise<void>;
  markAttemptFailed(id: number, error: string): Promise<void>;
  markFailed(id: number, now: number): Promise<void>;
  // Failed rows whose warning has not reached Slack yet; oldest first.
  pendingAlerts(limit: number): Promise<Row[]>;
  markAlerted(id: number, now: number): Promise<void>;
  // Deletes rows delivered more than KEEP_DELIVERED_MS ago; returns how many.
  purgeDelivered(now: number): Promise<number>;
}

type DbRow = Omit<Row, 'payload'> & { payload: string };

export function d1Store(db: D1Database): Store {
  return {
    async insert(sub, now) {
      const row = await db
        .prepare('INSERT INTO submissions (created_at, topic, locale, payload) VALUES (?, ?, ?, ?) RETURNING id')
        .bind(now, sub.topic, sub.locale, JSON.stringify(sub))
        .first<{ id: number }>();
      if (!row) throw new Error('insert returned no id');
      return row.id;
    },
    async retryable(now, limit) {
      const { results } = await db
        .prepare(
          `SELECT * FROM submissions
           WHERE delivered_at IS NULL AND failed_at IS NULL AND created_at <= ?
           ORDER BY created_at, id LIMIT ?`,
        )
        .bind(now - RETRY_GRACE_MS, limit)
        .all<DbRow>();
      return results.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Submission }));
    },
    async markDelivered(id, now) {
      await db.prepare('UPDATE submissions SET delivered_at = ? WHERE id = ?').bind(now, id).run();
    },
    async markAttemptFailed(id, error) {
      await db
        .prepare('UPDATE submissions SET attempts = attempts + 1, last_error = ? WHERE id = ?')
        .bind(error, id)
        .run();
    },
    async markFailed(id, now) {
      await db.prepare('UPDATE submissions SET failed_at = ? WHERE id = ?').bind(now, id).run();
    },
    async pendingAlerts(limit) {
      const { results } = await db
        .prepare('SELECT * FROM submissions WHERE failed_at IS NOT NULL AND alerted_at IS NULL ORDER BY created_at, id LIMIT ?')
        .bind(limit)
        .all<DbRow>();
      return results.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Submission }));
    },
    async markAlerted(id, now) {
      await db.prepare('UPDATE submissions SET alerted_at = ? WHERE id = ?').bind(now, id).run();
    },
    async purgeDelivered(now) {
      const result = await db
        .prepare('DELETE FROM submissions WHERE delivered_at IS NOT NULL AND delivered_at < ?')
        .bind(now - KEEP_DELIVERED_MS)
        .run();
      return result.meta.changes ?? 0;
    },
  };
}

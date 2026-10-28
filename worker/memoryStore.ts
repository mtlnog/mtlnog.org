// In-memory Store used by tests. It mirrors the SQL in d1Store.
import { KEEP_DELIVERED_MS, RETRY_GRACE_MS, type Row, type Store } from './store';

export function memoryStore(): Store & { rows: Row[] } {
  const rows: Row[] = [];
  let nextId = 1;
  const find = (id: number) => rows.find((r) => r.id === id);

  return {
    rows,
    async insert(sub, now) {
      const id = nextId++;
      rows.push({
        id,
        created_at: now,
        topic: sub.topic,
        locale: sub.locale,
        payload: structuredClone(sub),
        delivered_at: null,
        attempts: 0,
        last_error: null,
        failed_at: null,
      });
      return id;
    },
    async retryable(now, limit) {
      return rows
        .filter((r) => r.delivered_at === null && r.failed_at === null && r.created_at <= now - RETRY_GRACE_MS)
        .sort((a, b) => a.created_at - b.created_at || a.id - b.id)
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
    async markDelivered(id, now) {
      const row = find(id);
      if (row) row.delivered_at = now;
    },
    async markAttemptFailed(id, error) {
      const row = find(id);
      if (row) {
        row.attempts += 1;
        row.last_error = error;
      }
    },
    async markFailed(id, now) {
      const row = find(id);
      if (row) row.failed_at = now;
    },
    async purgeDelivered(now) {
      const keep = rows.filter((r) => r.delivered_at === null || r.delivered_at >= now - KEEP_DELIVERED_MS);
      const removed = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return removed;
    },
  };
}

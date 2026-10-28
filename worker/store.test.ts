import { describe, it, expect } from 'vitest';
import type { Submission } from '../src/lib/contact';
import { memoryStore } from './memoryStore';
import { KEEP_DELIVERED_MS, RETRY_GRACE_MS } from './store';

const sub: Submission = {
  topic: 'general',
  locale: 'en',
  fname: 'Alex',
  lname: 'Tremblay',
  email: 'alex@example.net',
  org: '',
  fields: { message: 'hi' },
};

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('Store (memory reference)', () => {
  it('stores the submission and returns increasing ids', async () => {
    const store = memoryStore();
    const a = await store.insert(sub, NOW);
    const b = await store.insert(sub, NOW);
    expect(b).toBeGreaterThan(a);
    expect(store.rows[0]).toMatchObject({ id: a, topic: 'general', locale: 'en', payload: sub, attempts: 0, delivered_at: null, failed_at: null, alerted_at: null });
  });

  it('retryable skips fresh, delivered and failed rows', async () => {
    const store = memoryStore();
    await store.insert(sub, NOW - RETRY_GRACE_MS + 1000); // too fresh
    const delivered = await store.insert(sub, NOW - 10 * MIN);
    await store.markDelivered(delivered, NOW - 9 * MIN);
    const failed = await store.insert(sub, NOW - 10 * MIN);
    await store.markFailed(failed, NOW - MIN);
    expect(await store.retryable(NOW, 25)).toEqual([]);
  });

  it('retryable includes never-attempted rows, oldest first, up to the limit', async () => {
    const store = memoryStore();
    const newer = await store.insert(sub, NOW - 2 * MIN);
    const older = await store.insert(sub, NOW - 3 * MIN);
    const oldest = await store.insert(sub, NOW - 4 * MIN);
    await store.markAttemptFailed(older, 'http_500');
    expect((await store.retryable(NOW, 25)).map((r) => r.id)).toEqual([oldest, older, newer]);
    expect((await store.retryable(NOW, 2)).map((r) => r.id)).toEqual([oldest, older]);
  });

  it('markAttemptFailed counts attempts and keeps the last error', async () => {
    const store = memoryStore();
    const id = await store.insert(sub, NOW);
    await store.markAttemptFailed(id, 'http_500');
    await store.markAttemptFailed(id, 'network');
    expect(store.rows[0]).toMatchObject({ attempts: 2, last_error: 'network' });
  });

  it('pendingAlerts lists failed rows until they are marked alerted', async () => {
    const store = memoryStore();
    const failed = await store.insert(sub, NOW - DAY);
    await store.markFailed(failed, NOW);
    await store.insert(sub, NOW - DAY);
    expect((await store.pendingAlerts(25)).map((r) => r.id)).toEqual([failed]);
    await store.markAlerted(failed, NOW);
    expect(await store.pendingAlerts(25)).toEqual([]);
    expect(store.rows[0].alerted_at).toBe(NOW);
  });

  it('purgeDelivered deletes only rows delivered more than 30 days ago', async () => {
    const store = memoryStore();
    const old = await store.insert(sub, NOW - 40 * DAY);
    await store.markDelivered(old, NOW - KEEP_DELIVERED_MS - 1000);
    const recent = await store.insert(sub, NOW - 29 * DAY);
    await store.markDelivered(recent, NOW - 29 * DAY);
    const undelivered = await store.insert(sub, NOW - 90 * DAY);
    const failed = await store.insert(sub, NOW - 90 * DAY);
    await store.markFailed(failed, NOW - 80 * DAY);
    expect(await store.purgeDelivered(NOW)).toBe(1);
    expect(store.rows.map((r) => r.id)).toEqual([recent, undelivered, failed]);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import type { Submission } from '../src/lib/contact';
import worker, { handleContact, runScheduled, type Deps, type Env } from './index';
import { memoryStore } from './memoryStore';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEBHOOK = 'https://hooks.slack.test/abc';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let store: ReturnType<typeof memoryStore>;
let calls: { url: string; body: string }[];
let captchaOk: boolean;
let webhookStatus: number;
let pending: Promise<unknown>[];

const env = { TURNSTILE_SECRET: 'secret', SLACK_WEBHOOK_URL: WEBHOOK } as unknown as Env;

const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
  if (url === SITEVERIFY) return new Response(JSON.stringify({ success: captchaOk }));
  if (url === WEBHOOK) return new Response('', { status: webhookStatus });
  throw new Error(`unexpected fetch ${url}`);
}) as typeof fetch;

const deps = (): Deps => ({ store, fetchFn, now: () => NOW });
const waitUntil = (p: Promise<unknown>) => void pending.push(p);
const settle = () => Promise.all(pending);

const general = {
  topic: 'general',
  locale: 'en',
  fname: 'Alex',
  lname: 'Tremblay',
  email: 'alex@example.net',
  org: '',
  message: 'Hello',
  'cf-turnstile-response': 'token',
};

const post = (body: unknown, contentType = 'application/json') =>
  new Request('https://mtlnog.org/api/contact', {
    method: 'POST',
    headers: { 'content-type': contentType, 'CF-Connecting-IP': '1.2.3.4' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const json = async (res: Response) => ({ status: res.status, body: await res.json() });

beforeEach(() => {
  store = memoryStore();
  calls = [];
  captchaOk = true;
  webhookStatus = 200;
  pending = [];
});

describe('handleContact', () => {
  it('stores a valid submission, answers ok and delivers it to Slack', async () => {
    expect(await json(await handleContact(post(general), env, deps(), waitUntil))).toEqual({ status: 200, body: { ok: true } });
    expect(store.rows).toHaveLength(1);
    await settle();
    expect(store.rows[0].delivered_at).toBe(NOW);
    expect(calls.filter((c) => c.url === WEBHOOK)).toHaveLength(1);
  });

  it('answers ok to a filled honeypot without storing or calling out', async () => {
    const res = await handleContact(post({ ...general, validation: 'spam' }), env, deps(), waitUntil);
    expect(await json(res)).toEqual({ status: 200, body: { ok: true } });
    await settle();
    expect(store.rows).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('rejects a failed captcha', async () => {
    captchaOk = false;
    const res = await handleContact(post(general), env, deps(), waitUntil);
    expect(await json(res)).toEqual({ status: 400, body: { ok: false, error: 'captcha' } });
    expect(store.rows).toHaveLength(0);
  });

  it('rejects invalid input before calling siteverify', async () => {
    const res = await handleContact(post({ ...general, message: '' }), env, deps(), waitUntil);
    expect(await json(res)).toEqual({ status: 400, body: { ok: false, error: 'invalid' } });
    expect(calls).toHaveLength(0);
  });

  it('rejects non-JSON, unparseable and oversized bodies', async () => {
    const bad = { status: 400, body: { ok: false, error: 'invalid' } };
    expect(await json(await handleContact(post(JSON.stringify(general), 'text/plain'), env, deps(), waitUntil))).toEqual(bad);
    expect(await json(await handleContact(post('{nope'), env, deps(), waitUntil))).toEqual(bad);
    const huge = { ...general, message: 'a'.repeat(40_000) };
    expect(await json(await handleContact(post(huge), env, deps(), waitUntil))).toEqual(bad);
    expect(store.rows).toHaveLength(0);
  });

  it('still answers ok when Slack fails, and records the failed attempt', async () => {
    webhookStatus = 500;
    expect((await handleContact(post(general), env, deps(), waitUntil)).status).toBe(200);
    await settle();
    expect(store.rows[0]).toMatchObject({ delivered_at: null, attempts: 1, last_error: 'http_500' });
  });

  it('accepts the English role value from the French form', async () => {
    const slack = { ...general, topic: 'slack', locale: 'fr', role: 'Network Engineer', message: undefined };
    expect((await handleContact(post(slack), env, deps(), waitUntil)).status).toBe(200);
    expect(store.rows[0].payload.fields).toEqual({ role: 'Network Engineer' });
  });

  it('answers server error when storing fails', async () => {
    store.insert = async () => {
      throw new Error('db down');
    };
    const res = await handleContact(post(general), env, deps(), waitUntil);
    expect(await json(res)).toEqual({ status: 500, body: { ok: false, error: 'server' } });
  });
});

describe('runScheduled', () => {
  const sub: Submission = {
    topic: 'venue',
    locale: 'en',
    fname: 'Alex',
    lname: 'Tremblay',
    email: 'alex@example.net',
    org: '',
    fields: { venue_location: 'Griffintown', capacity: 30 },
  };

  it('delivers a row whose first attempt never ran', async () => {
    await store.insert(sub, NOW - 2 * MIN);
    await runScheduled(env, deps());
    expect(store.rows[0].delivered_at).toBe(NOW);
  });

  it('gives up after 24 hours and alerts with no personal data', async () => {
    webhookStatus = 500;
    const id = await store.insert(sub, NOW - 25 * HOUR);
    await runScheduled(env, deps());
    expect(store.rows[0].failed_at).toBe(NOW);
    const alerts = calls.filter((c) => c.url === WEBHOOK);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain(String(id));
    expect(alerts[0].body).not.toContain('alex@example.net');
    expect(alerts[0].body).not.toContain('Tremblay');
  });

  it('retries the alert itself until Slack accepts it', async () => {
    webhookStatus = 500;
    await store.insert(sub, NOW - 25 * HOUR);
    await runScheduled(env, deps());
    webhookStatus = 200;
    await runScheduled(env, deps());
    expect(calls.filter((c) => c.url === WEBHOOK)).toHaveLength(2);
    await runScheduled(env, deps());
    expect(calls.filter((c) => c.url === WEBHOOK)).toHaveLength(2);
  });

  it('keeps going when one row fails, then still alerts and purges', async () => {
    const bad = await store.insert(sub, NOW - 3 * MIN);
    const good = await store.insert(sub, NOW - 2 * MIN);
    const failed = await store.insert(sub, NOW - 25 * HOUR);
    await store.markFailed(failed, NOW - HOUR);
    const old = await store.insert(sub, NOW - 40 * DAY);
    await store.markDelivered(old, NOW - 31 * DAY);
    const markDelivered = store.markDelivered.bind(store);
    store.markDelivered = async (id, now) => {
      if (id === bad) throw new Error('db hiccup');
      return markDelivered(id, now);
    };
    await runScheduled(env, deps());
    expect(store.rows.find((r) => r.id === good)?.delivered_at).toBe(NOW);
    expect(store.rows.find((r) => r.id === failed)?.alerted_at).toBe(NOW);
    expect(store.rows.some((r) => r.id === old)).toBe(false);
  });

  it('purges rows delivered more than 30 days ago', async () => {
    const old = await store.insert(sub, NOW - 40 * DAY);
    await store.markDelivered(old, NOW - 31 * DAY);
    const recent = await store.insert(sub, NOW - 30 * DAY);
    await store.markDelivered(recent, NOW - 29 * DAY);
    await runScheduled(env, deps());
    expect(store.rows.map((r) => r.id)).toEqual([recent]);
  });
});

describe('fetch', () => {
  const assetsEnv = {
    ...env,
    ASSETS: { fetch: async () => new Response('page', { status: 200 }) },
  } as unknown as Env;
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

  it('rejects other methods on the contact endpoint', async () => {
    const res = await worker.fetch(new Request('https://mtlnog.org/api/contact'), assetsEnv, ctx);
    expect(res.status).toBe(405);
  });

  it('answers 404 for unknown API paths', async () => {
    const res = await worker.fetch(new Request('https://mtlnog.org/api/nope'), assetsEnv, ctx);
    expect(res.status).toBe(404);
  });

  it('serves everything else from the static assets', async () => {
    const res = await worker.fetch(new Request('https://mtlnog.org/fr/'), assetsEnv, ctx);
    expect(await res.text()).toBe('page');
  });
});

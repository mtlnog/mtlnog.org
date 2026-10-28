// Worker entry: /api/contact plus the retry/purge cron. Everything else is served from dist/.
import { HONEYPOT_FIELD, LIMITS, validateSubmission, type Submission } from '../src/lib/contact';
import { buildFailureAlert, buildSubmissionMessage, postToSlack } from './slack';
import { d1Store, GIVE_UP_MS, type Store } from './store';
import { verifyTurnstile } from './turnstile';

export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
  SLACK_WEBHOOK_URL: string;
  ASSETS: Fetcher;
}

export interface Deps {
  store: Store;
  fetchFn: typeof fetch;
  now: () => number;
}

const BATCH = 25;

const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const invalid = () => reply(400, { ok: false, error: 'invalid' });

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return null;
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > LIMITS.maxBodyBytes) return null;
  const text = await req.text();
  if (new TextEncoder().encode(text).length > LIMITS.maxBodyBytes) return null;
  try {
    const data: unknown = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function deliver(id: number, sub: Submission, env: Env, deps: Deps): Promise<boolean> {
  const result = await postToSlack(env.SLACK_WEBHOOK_URL, buildSubmissionMessage(id, sub), deps.fetchFn);
  if (result.ok) await deps.store.markDelivered(id, deps.now());
  else await deps.store.markAttemptFailed(id, result.error);
  return result.ok;
}

export async function handleContact(
  req: Request,
  env: Env,
  deps: Deps,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const body = await readJson(req);
  if (!body) return invalid();

  // Bots fill every field; pretend it worked and keep nothing.
  const trap = body[HONEYPOT_FIELD];
  if (typeof trap === 'string' ? trap.trim() !== '' : trap !== undefined && trap !== null) {
    return reply(200, { ok: true });
  }

  const result = validateSubmission(body);
  if (!result.ok) return invalid();

  const token = typeof body['cf-turnstile-response'] === 'string' ? body['cf-turnstile-response'] : '';
  const human = await verifyTurnstile(token, env.TURNSTILE_SECRET, req.headers.get('CF-Connecting-IP'), deps.fetchFn);
  if (!human) return reply(400, { ok: false, error: 'captcha' });

  let id: number;
  try {
    id = await deps.store.insert(result.value, deps.now());
  } catch {
    console.error('contact: store failed');
    return reply(500, { ok: false, error: 'server' });
  }

  // The row is safe; Slack delivery can finish (or be retried by the cron) without the visitor waiting.
  waitUntil(
    deliver(id, result.value, env, deps).catch(() => console.error('contact: delivery bookkeeping failed')),
  );
  return reply(200, { ok: true });
}

export async function runScheduled(env: Env, deps: Deps): Promise<void> {
  const now = deps.now();
  for (const row of await deps.store.retryable(now, BATCH)) {
    if (now - row.created_at >= GIVE_UP_MS) await deps.store.markFailed(row.id, now);
    else await deliver(row.id, row.payload, env, deps);
  }

  // Warnings go through the same webhook, so they are retried on later runs too.
  for (const row of await deps.store.pendingAlerts(BATCH)) {
    const result = await postToSlack(env.SLACK_WEBHOOK_URL, buildFailureAlert(row.id, row.topic), deps.fetchFn);
    if (result.ok) await deps.store.markAlerted(row.id, now);
  }

  await deps.store.purgeDelivered(now);
}

const liveDeps = (env: Env): Deps => ({ store: d1Store(env.DB), fetchFn: fetch, now: Date.now });

export default {
  async fetch(req, env, ctx) {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/contact') {
      if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
      return handleContact(req, env, liveDeps(env), (p) => ctx.waitUntil(p));
    }
    if (pathname.startsWith('/api/')) return reply(404, { ok: false, error: 'not_found' });
    return env.ASSETS.fetch(req);
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduled(env, liveDeps(env)));
  },
} satisfies ExportedHandler<Env>;

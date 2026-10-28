# Contact Form Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Formspree and hCaptcha with a `/api/contact` handler on the site's own Cloudflare Worker. The handler takes five topics, verifies Turnstile, stores each submission in D1, posts it to Slack, and has a cron job that retries failed posts and purges old rows.

**Architecture:**
- **Static build:** the Astro site stays static.
- **Worker entry:** a TypeScript entry in `worker/` becomes the Worker's `main`.
  - Only `/api/*` runs the script (`assets.run_worker_first`); everything else is served from `dist/` as today.
  - A cron trigger runs retries and purges.
- **Shared contract:** `src/lib/contact.ts` holds the topic values, field rules and validation. Both the form (client script) and the Worker import it, so the two can't drift.
- **Thin I/O:** D1, Slack and Turnstile I/O sit behind small functions with injected `fetch` and a `Store` interface, so the handler and the cron logic are unit-tested with an in-memory store.

**Tech Stack:**
- Astro 5 (static output), TypeScript.
- Cloudflare Workers with D1 and cron triggers, wrangler 4.
- vitest 2.
- Cloudflare Turnstile and Slack incoming webhooks.

**Spec:** `docs/superpowers/specs/2026-10-28-contact-form-worker-design.md`

## Global Constraints

**Topics and fields**
- **Topic values are exactly** `slack`, `sponsorship`, `speaking`, `venue` and `general`.
- **Shared request fields:** `topic`, `locale` (`fr`|`en`), `fname`, `lname`, `email`, `org`, `cf-turnstile-response`, plus the honeypot field.
- **Topic fields:**
  - `slack`: `role` (required), `intro`
  - `sponsorship`: `tier` (`unsure`/`gold`/`silver`/`custom`), `message`
  - `speaking`: `talk_title` (required), `abstract` (required), `talk_length` (`lightning`/`standard`/`long`), `talk_language` (`fr`/`en`/`either`), `notes`
  - `venue`: `venue_location` (required), `capacity` (required, integer), `amenities` (array of `projector`/`sound`/`wifi`/`food`/`evening`), `notes`
  - `general`: `message` (required)
- **`role` values** are the English labels: `Network Engineer`, `Network Operator`, `Systems & Infrastructure Engineer`, `Network Manager`, `Researcher & Academic`, `Other`. The French form shows French text but submits these values.

**API and behavior**
- **Responses:**
  - 200 `{ "ok": true }`
  - 400 `{ "ok": false, "error": "invalid" | "captcha" }`
  - 500 `{ "ok": false, "error": "server" }`
  - Honeypot filled: 200 `{ "ok": true }`, and nothing is stored.
- **Slack and cron timing:**
  - The Slack post happens in `ctx.waitUntil` after the row is stored.
  - The cron runs every 5 minutes (`*/5 * * * *`).
  - It retries undelivered, non-failed rows older than 1 minute, oldest first, 25 per run.
  - After 24 hours of failures it sets `failed_at` and posts an alert containing only the id and topic.
  - It purges rows with `delivered_at` older than 30 days.
- **Slack content:**
  - Labels are in English.
  - Every message includes the visitor's locale (FR/EN).
  - `&`, `<` and `>` in user text are escaped.

**Config and privacy**
- **Config names:**
  - `PUBLIC_TURNSTILE_SITEKEY` (build var; CI uses `1x00000000000000000000AA`)
  - `TURNSTILE_SECRET` and `SLACK_WEBHOOK_URL` (Worker secrets)
  - `DB` (D1 binding)
  - The production sitekey is `0x4AAAAAAFo_cWZB_zA8Phzj`.
  - `PUBLIC_FORMSPREE_ID` and `PUBLIC_HCAPTCHA_SITEKEY` are removed everywhere.
- **Logging and storage:**
  - Never log names, emails or message text. `last_error` holds a short code or status only.
  - No secrets in the repo or in `dist/`.
  - No email address anywhere in `dist/`.
- **Copy:**
  - Every new string goes in both `src/i18n/fr.json` and `src/i18n/en.json`, using straight apostrophes (`'`).
  - The form note promises no deletion period.
- **Commits:** no attribution trailers.

## Review Focus

1. **A visitor types `<!channel>` or `<https://evil|click>` in their name or message.** Slack must show it as literal text, with no ping and no link. Pinned in Task 2.
2. **Fields from a different topic are sent anyway** (stale or crafted data, e.g. `talk_title` with `topic=general`). They must not be stored or posted. Pinned in Task 1.
3. **The Worker stops before the `waitUntil` Slack post runs** (row stored, `attempts = 0`). The next cron run must deliver it. Pinned in Task 4.
4. **A French visitor picks a role.** The submitted value is the English role and validation accepts it. A translated French label is rejected. Pinned in Tasks 1 and 5.
5. **Legacy links** `?type=slack` and `?type=sponsorship` still pre-select, and `?type=SPONSORSHIP` or an unknown value pre-selects nothing. Pinned in Task 1.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/contact.ts` (new) | Topics, field rules, `validateSubmission`, `formEntriesToPayload` |
| `src/lib/inviteType.ts` (modify) | `?type=` parsing over the new topic list |
| `worker/slack.ts` (new) | Escaping, message building, posting |
| `worker/turnstile.ts` (new) | Siteverify call |
| `worker/store.ts` (new) | `Store` interface, D1 implementation, time cutoffs |
| `worker/memoryStore.ts` (new) | In-memory `Store` used only by tests |
| `worker/index.ts` (new) | `fetch` (`/api/contact`) and `scheduled` handlers |
| `migrations/0001_submissions.sql` (new) | D1 schema |
| `wrangler.jsonc`, `worker/tsconfig.json`, `.dev.vars.example`, `mise.toml`, `.gitignore` | Worker config |
| `src/components/InviteForm.astro`, `src/i18n/{fr,en}.json` | The form |
| `src/i18n/routes.ts`, `SponsorshipPage.astro`, `MeetingsPage.astro` | Topic links |
| `.env.example`, `.github/workflows/ci.yml`, `README.md` | Config and docs |

---

### Task 1: Shared contract and validation

**Files:**
- Create: `src/lib/contact.ts`
- Create: `src/lib/contact.test.ts`
- Modify: `src/lib/inviteType.ts`, `src/lib/inviteType.test.ts`

**Interfaces:**
- Produces, in `src/lib/contact.ts`:
  - `TOPICS = ['slack','sponsorship','speaking','venue','general'] as const`, and `type Topic`
  - `ROLES` (the six English labels, `as const`)
  - `TIERS`, `TALK_LENGTHS`, `TALK_LANGUAGES`, `AMENITIES` (the value lists from Global Constraints, `as const`)
  - `HONEYPOT_FIELD = 'website'`
  - `LIMITS = { short: 200, long: 5000, maxCapacity: 100000, maxBodyBytes: 32768 }`
  - `type Submission = { topic: Topic; locale: 'fr'|'en'; fname: string; lname: string; email: string; org: string; fields: Record<string, string | number | string[]> }`. `fields` holds only the selected topic's fields, with empty optional fields left out.
  - `validateSubmission(input: unknown): { ok: true; value: Submission } | { ok: false }`. It ignores the token and honeypot keys; the caller handles those.
  - `formEntriesToPayload(entries: Iterable<[string, string]>): Record<string, unknown>`. Repeated `amenities` keys become an array, `capacity` becomes a number when numeric, and other keys stay trimmed strings.
- Produces, in `src/lib/inviteType.ts`: `inviteTypeFromSearch(search: string): Topic | null`.

- [ ] **Step 1: Write the failing tests** in `src/lib/contact.test.ts`. Use a `base = { topic, locale:'en', fname:'Alex', lname:'Tremblay', email:'alex@example.net', org:'' }` helper.

  `validateSubmission` cases:
  - Accepts each topic with only its required fields:
    - slack + `role:'Network Engineer'`
    - sponsorship with no extra fields
    - speaking + `talk_title`, `abstract`
    - venue + `venue_location`, `capacity: 30`
    - general + `message`
  - Rejects:
    - an unknown topic
    - a missing `fname`, `lname` or `email`
    - email `'not-an-email'`
    - `locale:'de'`
  - Rejects each topic missing one of its required fields. For venue that includes `capacity: 0`, `-1`, `2.5` and `100001`.
  - Rejects `role:'Ingénieur réseau'` (Review Focus 4).
  - Rejects unknown enum values: `tier:'platinum'`, `talk_length:'epic'`, `amenities:['jacuzzi']`.
  - Rejects `fname` longer than 200 characters and `message` longer than 5000.
  - Drops other topics' fields (Review Focus 2): `{...base, topic:'general', message:'hi', talk_title:'x'}` gives `value.fields` deep-equal to `{ message: 'hi' }`.
  - Trims strings and omits empty optional fields.

  `formEntriesToPayload` cases:
  - `[['amenities','wifi'],['amenities','food'],['capacity','30'],['fname',' Alex ']]` gives `{ amenities:['wifi','food'], capacity:30, fname:'Alex' }`.
  - A single `amenities` value still gives an array.

  Update `src/lib/inviteType.test.ts`: add `'?type=venue'` → `'venue'`, `'?type=speaking'` → `'speaking'` and `'?type=general'` → `'general'`, and keep the existing cases (Review Focus 5).

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run src/lib/contact.test.ts src/lib/inviteType.test.ts`
  Expected: FAIL, because the module is not found or the venue/speaking cases return null.

- [ ] **Step 3: Implement `src/lib/contact.ts`, and point `inviteType.ts` at `TOPICS`** (remove `INVITE_TYPES`, and re-export `Topic` as `InviteType` if anything still imports it).
  - Check email with a simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
  - The module must have no DOM or Worker APIs, because both sides import it.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npm test`
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/contact.ts src/lib/contact.test.ts src/lib/inviteType.ts src/lib/inviteType.test.ts
  git commit -m "Add shared contact form contract and validation"
  ```

### Task 2: Slack message and Turnstile verification

**Files:**
- Create: `worker/slack.ts`, `worker/slack.test.ts`
- Create: `worker/turnstile.ts`, `worker/turnstile.test.ts`
- Modify: `vitest.config.ts`, only if `worker/**/*.test.ts` isn't picked up by default. vitest's default include already matches it; verify in Step 2.

**Interfaces:**
- Consumes: `Submission`, `Topic` from Task 1.
- Produces, in `worker/slack.ts`:
  - `escapeSlack(text: string): string`
  - `buildSubmissionMessage(id: number, sub: Submission): { text: string; blocks: unknown[] }`
  - `buildFailureAlert(id: number, topic: Topic): { text: string }`
  - `postToSlack(url: string, body: object, fetchFn: typeof fetch): Promise<{ ok: true } | { ok: false; error: string }>`. `error` is a short code: `http_<status>` or `network`.
- Produces, in `worker/turnstile.ts`:
  - `verifyTurnstile(token: string, secret: string, ip: string | null, fetchFn: typeof fetch): Promise<boolean>`. It POSTs form data to `https://challenges.cloudflare.com/turnstile/v0/siteverify`, returns `success === true`, and returns false on any network or parse error.

- [ ] **Step 1: Write the failing tests.**

  `slack.test.ts` cases:
  - `escapeSlack('<!channel> & <https://x|y>')` returns `'&lt;!channel&gt; &amp; &lt;https://x|y&gt;'`.
  - **No raw user text** (Review Focus 1): build a speaking submission whose `fname` is `'<!channel>'` and whose `abstract` is `'<https://evil|click>'`. The JSON-stringified result must not contain `<!channel>` or `<https://evil`.
  - **Message contents:** the text includes the topic label (`Speaking`), the full name, the email and `EN`.
  - **Topic fields shown:** for venue, `amenities` render as a comma list, and capacity is present.
  - **Alert content:** `buildFailureAlert(42,'venue').text` contains `42` and `venue`, and nothing else from a submission.
  - **Posting** uses a fake `fetchFn`:
    - 200 → `{ok:true}`
    - 404 → `{ok:false, error:'http_404'}`
    - a thrown error → `{ok:false, error:'network'}`
    - the call uses POST with a JSON content type.

  `turnstile.test.ts` cases (fake `fetchFn`):
  - Returns true when siteverify answers `{success:true}`.
  - Returns false on `{success:false}`, on a thrown error, on an empty token (no fetch call at all), and on non-JSON.
  - The request body contains `secret`, `response` and `remoteip` when an ip is given.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run worker/`
  Expected: FAIL with modules not found. That also confirms vitest picks up `worker/`.

- [ ] **Step 3: Implement both modules.**
  - **Topic labels:** Slack, Sponsorship, Speaking, Venue, General.
  - **Text field:** a one-line summary, used for notifications.
  - **Blocks:** one header section, then a fields section for name, email, org and locale, then a section for the topic's fields, then the long text.
  - **Email display:** show it as `mailto` text. Escape it like other text; Slack auto-links plain emails.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npm test`
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add worker/slack.ts worker/slack.test.ts worker/turnstile.ts worker/turnstile.test.ts
  git commit -m "Add Slack message building and Turnstile verification"
  ```

### Task 3: Storage (schema, Store interface, D1 and in-memory implementations)

**Files:**
- Create: `migrations/0001_submissions.sql`
- Create: `worker/store.ts`, `worker/memoryStore.ts`, `worker/store.test.ts`

**Interfaces:**
- Consumes: `Submission`, `Topic` from Task 1.
- Produces, in `worker/store.ts`:
  ```ts
  export interface Row { id: number; created_at: number; topic: Topic; locale: 'fr'|'en'; payload: Submission; delivered_at: number | null; attempts: number; last_error: string | null; failed_at: number | null }
  export interface Store {
    insert(sub: Submission, now: number): Promise<number>;            // returns id
    retryable(now: number, limit: number): Promise<Row[]>;           // undelivered, not failed, created_at <= now - 60_000, oldest first
    markDelivered(id: number, now: number): Promise<void>;
    markAttemptFailed(id: number, error: string): Promise<void>;     // attempts += 1, last_error = error
    markFailed(id: number, now: number): Promise<void>;
    purgeDelivered(now: number): Promise<number>;                    // deletes delivered_at < now - 30 days, returns count
  }
  export const RETRY_GRACE_MS = 60_000, GIVE_UP_MS = 24 * 3600_000, KEEP_DELIVERED_MS = 30 * 24 * 3600_000;
  export function d1Store(db: D1Database): Store;
  ```
  Times are epoch milliseconds, stored as `INTEGER`. `payload` is stored as JSON text and parsed on read.
- Produces, in `worker/memoryStore.ts`: `memoryStore(): Store & { rows: Row[] }`, for tests only.

**Migration:** table `submissions`. Columns match `Row`; `payload` is TEXT and NOT NULL, and `attempts` is INTEGER NOT NULL DEFAULT 0. Add an index on `(delivered_at, failed_at, created_at)`.

- [ ] **Step 1: Write the failing test** `worker/store.test.ts` against `memoryStore()`. It is the executable spec that `d1Store` must match.
  - `retryable` excludes rows that are:
    - created less than 60 s ago
    - delivered
    - failed
  - `retryable` includes rows with `attempts: 0` (Review Focus 3), returns them oldest first, and honours `limit`.
  - `purgeDelivered` deletes only rows delivered more than 30 days ago, keeps undelivered and failed rows of any age, and returns the count.
  - `markAttemptFailed` increments `attempts` and sets `last_error`.

- [ ] **Step 2: Run the test and confirm it fails**

  Run: `npx vitest run worker/store.test.ts`
  Expected: FAIL, because the modules are not found.

- [ ] **Step 3: Implement `memoryStore`, `d1Store` (prepared statements with `.bind`) and the migration.**

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npm test`
  Expected: all pass.

- [ ] **Step 5: Check the SQL against a local D1.** This needs the `wrangler.jsonc` binding. Add the `d1_databases` entry from Task 4 Step 3 now, with `database_id` set to a placeholder `"local"`. Then:
  ```bash
  npx wrangler d1 migrations apply DB --local
  npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'"
  ```
  Expected: the migration applies, and the query returns `submissions`.

- [ ] **Step 6: Commit**

  ```bash
  git add migrations worker/store.ts worker/memoryStore.ts worker/store.test.ts wrangler.jsonc
  git commit -m "Add submissions table and storage layer"
  ```

### Task 4: Worker handlers and config

**Files:**
- Create: `worker/index.ts`, `worker/index.test.ts`, `worker/tsconfig.json`, `.dev.vars.example`
- Modify: `wrangler.jsonc`, `mise.toml`, `.gitignore`, `package.json`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces, in `worker/index.ts`:
  ```ts
  export interface Env { DB: D1Database; TURNSTILE_SECRET: string; SLACK_WEBHOOK_URL: string; ASSETS: Fetcher }
  export interface Deps { store: Store; fetchFn: typeof fetch; now: () => number }
  export async function handleContact(req: Request, env: Env, deps: Deps, waitUntil: (p: Promise<unknown>) => void): Promise<Response>;
  export async function deliver(id: number, sub: Submission, env: Env, deps: Deps): Promise<boolean>; // posts, then markDelivered or markAttemptFailed
  export async function runScheduled(env: Env, deps: Deps): Promise<void>;
  export default { fetch, scheduled } satisfies ExportedHandler<Env>;
  ```
- **The default `fetch`:**
  - `POST /api/contact` → `handleContact`.
  - Any other method on `/api/contact` → 405.
  - Other `/api/*` paths → 404 JSON.
  - Everything else → `env.ASSETS.fetch(req)`.
  - It builds `deps` from `d1Store(env.DB)`, global `fetch` and `Date.now`.
- **`scheduled`** uses `ctx.waitUntil(runScheduled(...))`.

**`handleContact` order:**
1. **Content type:** not JSON → 400 `invalid`.
2. **Body size:** over `LIMITS.maxBodyBytes` → 400 `invalid`. Unparseable JSON → 400 `invalid`.
3. **Honeypot:** if `HONEYPOT_FIELD` is non-empty, return 200 `{ok:true}`, with no store and no fetch.
4. **Validation:** `validateSubmission` fails → 400 `invalid`.
5. **Turnstile:** `verifyTurnstile(body['cf-turnstile-response'], env.TURNSTILE_SECRET, req.headers.get('CF-Connecting-IP'), fetchFn)` returns false → 400 `captcha`.
6. **Store and deliver:** call `store.insert`, then `waitUntil(deliver(...))`, then return 200 `{ok:true}`.
7. **Errors:** a thrown store error returns 500 `server`. Log only `console.error('contact: store failed')`, with no payload.

**`runScheduled`:** for each `retryable(now, 25)` row:
- If `now - created_at >= GIVE_UP_MS`, call `markFailed` and post `buildFailureAlert`. Post the alert only once; the row is excluded afterwards because `failed_at` is set.
- Otherwise call `deliver`.

Then call `purgeDelivered(now)`.

- [ ] **Step 1: Write the failing tests** in `worker/index.test.ts`. Use `memoryStore()`, a fake `fetchFn` that routes by URL (siteverify vs the webhook) and records calls, a fixed `now`, and a `waitUntil` that collects promises the test awaits.

  `handleContact`:
  - **Valid general submission:** returns 200 `{ok:true}`, stores 1 row, and after awaiting `waitUntil` the row is `delivered_at = now` and the webhook was called once.
  - **Honeypot:** filled → 200, 0 rows, and no fetch at all.
  - **Captcha:** siteverify answers `success:false` → 400 `{ok:false,error:'captcha'}`, 0 rows.
  - **Invalid input:** a missing required field → 400 `invalid`, with no siteverify call (cheap checks first).
  - **Bad requests:** a `text/plain` body → 400 `invalid`; a 40 KB body → 400 `invalid`.
  - **Slack failure:** the webhook returns 500 → response still 200; the row is undelivered with `attempts: 1` and `last_error: 'http_500'`.
  - **French role:** a French-locale slack submission with `role:'Network Engineer'` → 200 (Review Focus 4).

  `runScheduled`:
  - **Never-attempted row** (Review Focus 3): created 2 minutes ago with `attempts: 0` → delivered.
  - **Old failing row:** created 25 h ago, webhook failing → `failed_at` set. The alert was attempted, and its body has no name or email. A second run doesn't post again.
  - **Purge:** a delivered row 31 days old is deleted; one 29 days old is kept.

  The default `fetch` handler (needs a fake `env.ASSETS`):
  - `GET /api/contact` → 405.
  - `GET /fr/` → passed to `ASSETS.fetch`.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run worker/index.test.ts`
  Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement `worker/index.ts`, and the config:**
  - **`wrangler.jsonc`:**
    - add `"main": "worker/index.ts"`
    - add `"assets": { "directory": "./dist", "binding": "ASSETS", "run_worker_first": ["/api/*"] }`
    - add `"d1_databases": [{ "binding": "DB", "database_name": "mtlnog-contact", "database_id": "<filled at rollout>", "migrations_dir": "migrations" }]`
    - add `"triggers": { "crons": ["*/5 * * * *"] }`
    - Keep `compatibility_date`.
  - **Worker types:** add `@cloudflare/workers-types` as a devDependency. In `worker/tsconfig.json`, extend nothing, and set `"types": ["@cloudflare/workers-types"]`, `"strict": true`, `"noEmit": true`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"target": "ES2022"`, and `"include": ["./**/*.ts", "../src/lib/contact.ts"]`. Exclude `worker` from the root `tsconfig.json` if Astro's check complains.
  - **`.dev.vars.example`:**
    - `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` (Turnstile's always-pass test secret)
    - `SLACK_WEBHOOK_URL=` (fill in a test webhook)
  - **`.gitignore`:** add `.dev.vars`.
  - **`package.json` scripts:**
    - `"typecheck:worker": "tsc -p worker"`
    - `"dev:worker": "astro build && wrangler dev"`
  - **`mise.toml`:**
    - task `dev-worker`: description "Build, then run the Worker (API + assets) locally with a local D1", depends `install`, runs `npm run dev:worker`.
    - task `typecheck`, which runs `npm run typecheck:worker`.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npm test && npm run typecheck:worker`
  Expected: all tests pass, and tsc reports no errors.

- [ ] **Step 5: Local smoke test.**
  1. Copy `.dev.vars.example` to `.dev.vars`, with an empty webhook.
  2. Apply the local migration: `npx wrangler d1 migrations apply DB --local`.
  3. Start the Worker with `PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA npm run dev:worker` (in the background).
  4. Send a submission:
  ```bash
  curl -s -X POST localhost:8787/api/contact -H 'content-type: application/json' \
    -d '{"topic":"general","locale":"en","fname":"A","lname":"B","email":"a@b.co","org":"","message":"hi","cf-turnstile-response":"XXXX.DUMMY.TOKEN.XXXX"}'
  ```
  5. Check it was stored with `npx wrangler d1 execute DB --local --command "SELECT id, topic, attempts FROM submissions"`.

  Expected:
  - The POST returns `{"ok":true}`.
  - One row exists, with `attempts` 1, because the empty webhook fails.
  - `curl -s -o /dev/null -w '%{http_code}' localhost:8787/en/` returns `200`.

  Stop the dev server afterwards.

- [ ] **Step 6: Commit**

  ```bash
  git add worker/index.ts worker/index.test.ts worker/tsconfig.json .dev.vars.example wrangler.jsonc mise.toml .gitignore package.json package-lock.json
  git commit -m "Add contact API and cron handlers to the Worker"
  ```

### Task 5: The form

**Files:**
- Modify: `src/components/InviteForm.astro`, `src/i18n/fr.json`, `src/i18n/en.json`, `src/i18n/translated.test.ts`, `src/styles/_form.scss` (or whichever partial holds the form styles; find it with `grep -l "captcha-wrap" src/styles`), `src/styles/_responsive.scss`
- Create: `src/i18n/formTopics.test.ts`

**Interfaces:**
- Consumes: `TOPICS`, `ROLES`, `TIERS`, `TALK_LENGTHS`, `TALK_LANGUAGES`, `AMENITIES`, `HONEYPOT_FIELD`, `formEntriesToPayload` (Task 1), and `inviteTypeFromSearch` (Task 1).
- Produces:
  - the `form` i18n section, keyed by the value lists:
    - `form.topics.<topic>` (option labels)
    - `form.fields.topic`
    - `form.roles` (an array aligned with `ROLES`)
    - `form.tiers.<tier>`, `form.talkLengths.<v>`, `form.talkLanguages.<v>`, `form.amenities.<v>`
    - labels and placeholders for every topic field
    - `form.noscript`
  - the form posting JSON to `/api/contact`.

**Markup and behavior:**
- **Structure:** one `<form id="invite-form">` with the topic select first (`id="invite-type"` kept for links, `name="topic"`), then the shared fields, then one `<fieldset class="topic-block" data-topic="<topic>">` per topic.
  - Non-selected fieldsets get `hidden` and `disabled`, so they are neither validated nor submitted.
  - The default selection is `slack`.
- **Hidden fields:** `<input type="hidden" name="locale">` with the page locale, and the honeypot `<input name="website" tabindex="-1" autocomplete="off">` inside an off-screen, `aria-hidden` wrapper.
- **Roles:** `<option value={ROLES[i]}>{form.roles[i]}</option>`.
- **Turnstile:** `<div class="cf-turnstile" data-sitekey={PUBLIC_TURNSTILE_SITEKEY} data-theme="dark">`, plus the `https://challenges.cloudflare.com/turnstile/v0/api.js` script. The build fails if `PUBLIC_TURNSTILE_SITEKEY` is unset, with the message naming only that var.
- **Submit flow:**
  - Require `turnstile.getResponse()`.
  - Build the body with `formEntriesToPayload` over the `FormData` entries (string values only).
  - POST `application/json` to `/api/contact`.
  - Map responses: `ok` → success; `error:'captcha'` → captchaError; `invalid` → error; network failure → networkError.
  - Call `turnstile.reset()` after every attempt, and on success also reset the form and re-apply the topic.
- **`<noscript>`:** shows `form.noscript`.
- **Copy:**
  - The heading and intro become a general contact framing. EN: "Get in touch" / "Join the Slack, sponsor, speak, host an event, or just ask us something." Write the FR equivalent.
  - The `sectionLabel` changes to Contact.
  - The note says the info is only used to reply. The header nav label `nav.invite` may stay.
  - Use the mockup wording for field labels and placeholders: `.superpowers/brainstorm/1754413-1793192937/content/contact-form.html` if present, otherwise the spec's table.

- [ ] **Step 1: Write the failing tests.**

  `src/i18n/formTopics.test.ts`, for both locales:
  - every value in `TOPICS`, `TIERS`, `TALK_LENGTHS`, `TALK_LANGUAGES` and `AMENITIES` has a non-empty label under the matching `form.*` key;
  - `form.roles.length === ROLES.length`;
  - `en.form.roles` deep-equals `ROLES`, so English labels and values match.

  Add `'form'` to `SECTIONS` in `translated.test.ts`, with `SAME_IN_BOTH` entries only for strings that are legitimately identical (e.g. `form.fields.org.placeholder`). List each one explicitly.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run src/i18n/`
  Expected: FAIL, because the `form.topics` keys are missing.

- [ ] **Step 3: Update the strings and `InviteForm.astro`, and remove all hCaptcha/Formspree code.** Style the topic blocks after the mockup (left accent border) and make sure they stack at ≤600px.

- [ ] **Step 4: Run the tests, build, and check the output.**

  Run: `npm test && PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA npm run build && ! grep -rqiE "formspree|hcaptcha|mailto|@mtlnog\.org" dist && grep -q 'cf-turnstile' dist/en/index.html && echo OK`
  Expected: tests pass, the build has 9 pages, and the command prints `OK`.

- [ ] **Step 5: Browser smoke test with `npm run dev:worker`.**
  - With a local `.dev.vars`, open `/en/?type=venue#invite`: the Venue fields show and the other topics are hidden.
  - Switch to Speaking: talk title and abstract are required.
  - Submit General with the test sitekey: a success message shows, and a row exists in local D1.
  - Open `/fr/?type=slack#invite`: the role options show French text, and the submitted payload in D1 has the English role.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/InviteForm.astro src/i18n src/styles
  git commit -m "Turn the invite form into a five-topic contact form on Turnstile"
  ```

### Task 6: Topic links, config cleanup and docs

**Files:**
- Modify: `src/i18n/routes.ts`, `src/i18n/routes.test.ts`, `src/components/SponsorshipPage.astro`, `src/components/MeetingsPage.astro`, `src/i18n/{fr,en}.json`, `.env.example`, `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: `Topic` (Task 1).
- Produces, in `src/i18n/routes.ts`:
  - `contactHref(locale: Locale, topic: Topic): string`, which returns `${home}?type=${topic}#invite`.
  - `sponsorFormHref(locale)` becomes `contactHref(locale, 'sponsorship')`.

- [ ] **Step 1: Write the failing test** in `routes.test.ts`:
  - `contactHref('fr','venue') === '/fr/?type=venue#invite'`
  - `contactHref('en','speaking') === '/en/?type=speaking#invite'`
  - `sponsorFormHref('en')` is unchanged: `'/en/?type=sponsorship#invite'`.

- [ ] **Step 2: Run it and confirm it fails**

  Run: `npx vitest run src/i18n/routes.test.ts`
  Expected: FAIL, because `contactHref` is not exported.

- [ ] **Step 3: Implement the links and clean up config.**
  - **`contactHref`:** implement it.
  - **Sponsorship page:** add a link after the venue callout text, "Offer a space →" / "Proposer un espace →" (key `sponsorship.venue.cta`) → `contactHref(locale,'venue')`.
  - **Events page:** add a short line with a link, "Want to speak at an event? Propose a talk →" / FR equivalent (keys `meetings.speak.text` and `meetings.speak.cta`) → `contactHref(locale,'speaking')`.
  - **`.env.example`:** only `PUBLIC_TURNSTILE_SITEKEY`, with a comment about the test key.
  - **CI env:** only `PUBLIC_TURNSTILE_SITEKEY: 1x00000000000000000000AA`.
  - **README:** update it to cover:
    - configuration (the table of vars, secrets and bindings);
    - local Worker dev (`mise run dev-worker`, `.dev.vars`);
    - D1 setup and manual migrations (`npx wrangler d1 migrations apply DB --remote`, before merging any schema change);
    - preview builds sharing production bindings, and why that's tolerated;
    - the undelivered-rows check: `npx wrangler d1 execute DB --remote --command "SELECT id, topic, attempts, last_error, failed_at FROM submissions WHERE delivered_at IS NULL"`;
    - the known blind spot (a broken webhook silences its own alert);
    - the Workers Builds variables list.
  - **README cleanup:** remove all Formspree and hCaptcha mentions.

- [ ] **Step 4: Run the tests and build.**

  Run: `npm test && PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA npm run build && grep -q '?type=venue#invite' dist/en/sponsorship/index.html && grep -q '?type=speaking#invite' dist/fr/evenements/index.html && ! grep -rqiE "formspree|hcaptcha" README.md .env.example .github src && echo OK`
  Expected: `OK`.

- [ ] **Step 5: Commit**

  ```bash
  git add src .env.example .github/workflows/ci.yml README.md
  git commit -m "Link venue and speaking topics, drop Formspree config, document the Worker"
  ```

---

## After the plan (rollout, with Jonathan; not executor tasks)

1. **Jonathan:** create the private Slack channel and its incoming webhook.
2. **D1 database:**
   - Create it: `npx wrangler d1 create mtlnog-contact`.
   - Put its id in `wrangler.jsonc` and commit.
   - Run `npx wrangler d1 migrations apply DB --remote`.
3. **Worker secrets:** `npx wrangler secret put TURNSTILE_SECRET` (the secret saved in the scratchpad) and `npx wrangler secret put SLACK_WEBHOOK_URL`.
4. **Turnstile widget:** confirm its allowed hostnames include `mtlnog.org`.
5. **Workers Builds:** set `PUBLIC_TURNSTILE_SITEKEY=0x4AAAAAAFo_cWZB_zA8Phzj`.
6. **Ship:** merge to `main` and push. Then smoke-test one submission per topic on production, and confirm each arrives in Slack and appears in D1.
7. **Cleanup:**
   - Remove the `PUBLIC_FORMSPREE_ID` and `PUBLIC_HCAPTCHA_SITEKEY` build variables.
   - Delete the `turnstile` branch.

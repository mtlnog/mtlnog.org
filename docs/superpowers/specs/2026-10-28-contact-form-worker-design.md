# Contact form on the site's own Worker

Date: 2026-10-28
Branch: `contact-forms`

## Why

The home page form posts to Formspree. Formspree emails hello@mtlnog.org, a Google group that holds Jonathan and Eric, and they reply from their own inboxes.

Three problems drive this change:

- **Nobody can reach the Formspree account.** That blocks the planned switch from hCaptcha to Turnstile (shelved on the `turnstile` branch), because Formspree holds the captcha secret.
- **The form only knows two topics**, Slack invite and sponsorship. People also want to speak at events, host events or ask general questions. Until today they did that by emailing addresses printed on the site.
- **Those addresses drew spam.** They were removed today (`Remove email addresses from the site`), so the form is now the only way in.

The site already runs as a Cloudflare Worker serving static assets. Adding a small request handler to that Worker lets MTLNOG own the whole pipeline on the free tier:

- Turnstile checked on our side.
- Submissions stored in D1.
- Notifications posted to Slack.

## Goals

- **One form, five topics,** still on the home page at `#invite`:
  - Slack invite
  - Sponsorship
  - Speak at an event
  - Host an event (venue)
  - General question
- **Topic-specific fields** for speakers and venue hosts, so organizers rarely have to write back just to ask basic questions.
- **Turnstile verified server-side** by the Worker. hCaptcha and Formspree are removed entirely.
- **Every valid submission is stored before anything else,** then posted to one private Slack channel. If Slack fails, it is retried automatically, so nothing is lost silently.
- **Delivered submissions are deleted after 30 days.**
- **Everything stays on the Cloudflare free tier** (Workers, D1, cron triggers, Turnstile) plus a free Slack incoming webhook.

## Non-goals

- **No email sending.** No Cloudflare Email Service and no Email Routing: mtlnog.org mail stays on Google Workspace and its MX records are untouched.
- **No admin page for reading submissions.** Slack is the inbox, and replies go by email from the organizers' own mailboxes to the address the visitor typed.
- **No automatic Slack invites.** Organizers still invite people by hand.
- **No per-topic routing to different people or channels.** Everything goes to Jonathan and Eric in one channel, with the topic shown on the message.
- **No separate Contact page.** The form stays on the home page.

## Anti-goals (would count as failure even if it "works")

- **A submission the visitor was told succeeded never reaches Slack, and nobody is warned.**
- **Personal data kept indefinitely,** or stored anywhere outside D1 and Slack (logs included: do not log names, emails or message bodies).
- **Any secret in the repo or the built HTML:** the Turnstile secret or the Slack webhook URL.
- **Breaking existing links.** `/fr/?type=sponsorship#invite` and `/en/?type=sponsorship#invite` must keep pre-selecting Sponsorship, and `?type=slack` must keep working.
- **An email address reappearing anywhere in the built site.**

## What the visitor sees

The approved mockup is `.superpowers/brainstorm/1754413-1793192937/content/contact-form.html`. It is local and not committed; its contents are summarized here.

**Copy.** The section keeps its `#invite` anchor and place on the home page. Its heading and intro change from "Join the Community" to a general contact framing; the mockup used "Get in touch" and "Join the Slack, sponsor, speak, host an event, or just ask us something." Final copy is in both `fr.json` and `en.json`, with straight apostrophes, matching the rest of the site.

**Field order:**
1. **"What's this about?"** (required), a select with five options. The values are listed under "Data contract" below.
2. **Fields shared by every topic:** first name, last name and email (all required), and organization / ASN (optional).
3. **Topic fields,** shown only for the selected topic:

| Topic | Fields (\* = required) |
|---|---|
| Slack invite | Role\* (the current six-option select), brief introduction |
| Sponsorship | Tier of interest (Not sure yet / Gold / Silver / Something custom), message |
| Speaking | Talk title\*, short abstract\*, talk length (Lightning 5–10 min / Standard 15–20 min, the default / Longer 30 min+), language (French / English / Either), anything else |
| Venue | Venue location\* (neighbourhood or address), approximate capacity\* (number), what's available (checkboxes: projector or screen, microphone / sound, guest Wi-Fi, food & drinks allowed, evening access), anything else |
| General question | Message\* |

4. **Turnstile widget:** managed mode with a visible box, dark theme. Use the existing widget, sitekey `0x4AAAAAAFo_cWZB_zA8Phzj`.
5. **Send button,** with a note under it saying the information is only used to reply. The note makes no promise about deletion: the 30-day purge is internal housekeeping for D1, and the Slack notification and email replies follow the organizers' normal retention, like any email would.

**Behavior:**
- Fields of hidden topics are not required and are not sent.
- With JavaScript off, the form can't work, because Turnstile needs JS. Showing a short message in that case is acceptable.
- Status messages stay localized: success, validation error, captcha error, network error. They reach the client script through `data-*` attributes, as today.

**Links that pre-select a topic,** through `?type=<value>#invite`:
- "Become a sponsor" (already exists) → `sponsorship`
- the Venue paragraph on the Sponsorship page → `venue`
- the Events page → `speaking`, for example a "Want to speak?" line

`inviteTypeFromSearch` in `src/lib/inviteType.ts` grows to accept the new values. Unknown values still pre-select nothing.

## Data contract

**Topic values.** These are public, because they appear in `?type=` links, and they are stored in D1, so treat them as fixed:

| Value | Topic |
|---|---|
| `slack` | Slack invite |
| `sponsorship` | Sponsorship |
| `speaking` | Speak at an event |
| `venue` | Host an event (venue) |
| `general` | General question |

**Request.** The request body is JSON. Shared field names keep today's form names, so existing muscle memory and any saved data line up:
- `topic` (replaces `invite_type`), `locale`
- `fname`, `lname`, `email`, `org`
- the Turnstile token, `cf-turnstile-response`
- the honeypot field

Topic fields are flat, snake_case and unique across topics:

| Topic | Fields |
|---|---|
| `slack` | `role`, `intro` |
| `sponsorship` | `tier` (`unsure` / `gold` / `silver` / `custom`), `message` |
| `speaking` | `talk_title`, `abstract`, `talk_length` (`lightning` / `standard` / `long`), `talk_language` (`fr` / `en` / `either`), `notes` |
| `venue` | `venue_location`, `capacity` (integer), `amenities` (array of `projector` / `sound` / `wifi` / `food` / `evening`), `notes` |
| `general` | `message` |

Select and checkbox fields send these stable values, not translated labels. `role` stays a free label from the six-option list; the Worker checks it against the English list, and the French form sends the English value.

**Response.**
- **200** `{ "ok": true }`
- **400** `{ "ok": false, "error": "invalid" | "captcha" }`
- **500** `{ "ok": false, "error": "server" }`

**Stored payload.** The `payload` column holds the validated request minus the token and the honeypot. That makes the rows readable with `wrangler d1 execute`.

## How it works

### Request path

1. The browser POSTs JSON to `/api/contact` on the same origin.
2. The Worker handles `/api/*`; everything else falls through to the static assets as today.
3. **Validation**, done before anything is stored:
   - **Method and content type:** only POST with `application/json`.
   - **Honeypot:** a hidden field (named something a bot would fill in, kept off-screen and out of the tab order). If it isn't empty, the Worker answers with a fake success and stores nothing.
   - **Topic** is one of the five values. **Email** is syntactically plausible.
   - **Required fields** for that topic are present, and **every field has a length cap**: names and short fields about 200 characters, long text about 5,000.
   - **Fields from other topics** are dropped.
   - **Capacity** is a positive integer, and checkbox values come from the known set.
   - **Turnstile:** the token is verified with Cloudflare's siteverify endpoint, using the secret plus the visitor's IP from `CF-Connecting-IP`.
4. **Response:**
   - **On failure:** 400 with a machine-readable error code (`invalid`, `captcha`), which the client maps to localized text. A server error returns 500.
   - **On success:** insert one row in D1, return 200 to the visitor, then try the Slack post in `ctx.waitUntil`, so the visitor never waits on Slack.

### Storage (D1)

One table, roughly:

| Column | Notes |
|---|---|
| `id` | |
| `created_at` | |
| `topic` | |
| `locale` | `fr` or `en`, the page the visitor was on |
| `payload` | JSON: shared and topic fields |
| `delivered_at` | null until Slack accepts the message |
| `attempts` | |
| `last_error` | short, with no personal data |
| `failed_at` | set when retries stop |

Exact schema and migration files are the builder's call. Migrations go through `wrangler d1 migrations`.

### Slack message

- One incoming webhook for one private channel. Each message shows:
  - **topic** as a label;
  - **visitor:** name, email and organization;
  - **topic details:** the topic's fields as a short key/value list;
  - **message:** the long text, if any;
  - **language:** FR or EN, so organizers know which language to reply in.
- **Formatting:**
  - Use Block Kit or mrkdwn, the builder's call.
  - Labels are in English regardless of the visitor's language.
  - The email is shown so it can be clicked and replied to.
- **Escaping:** Slack control characters (`<`, `>`, `&`) are escaped in user text, so a visitor can't inject mentions like `<!channel>` or links.

### Retries and cleanup (cron trigger)

A cron trigger runs every 5 minutes. Each run does two things:

**Retry.** Rows with `delivered_at` and `failed_at` both null are retried, oldest first and capped per run. Skip rows created in the last minute, so the first `waitUntil` attempt can finish. Rows that were never attempted, because `waitUntil` was cut short, are picked up too. Once a row has been failing for 24 hours, the run:
- sets `failed_at`;
- stops retrying it;
- posts a warning to Slack saying a submission could not be delivered, giving only its id and topic, with no personal data.

If Slack itself is down, that warning is retried on later runs like any other message. Undelivered rows are kept until they are delivered or handled by hand.

**Purge.** Delete rows whose `delivered_at` is older than 30 days. Rows marked failed are kept until someone handles them; the README explains how to read them with `wrangler d1 execute` and delete them.

### Configuration

| Name | Kind | Where |
|---|---|---|
| `PUBLIC_TURNSTILE_SITEKEY` | build var (public) | Workers Builds settings, `.env`, CI uses the test key `1x00000000000000000000AA` |
| `TURNSTILE_SECRET` | Worker secret | `wrangler secret put` |
| `SLACK_WEBHOOK_URL` | Worker secret | `wrangler secret put` |
| `DB` | D1 binding | `wrangler.jsonc` |

- **Removed:** `PUBLIC_FORMSPREE_ID` and `PUBLIC_HCAPTCHA_SITEKEY` go from `.env.example`, CI, the README and the Workers Builds settings.
- **Build check:** the existing fail-the-build check becomes a check on `PUBLIC_TURNSTILE_SITEKEY` alone.
- **Local development:** use `.dev.vars` for secrets (git-ignored) with Turnstile's always-pass test secret, and a local D1. Running the full Worker locally should be one mise task.

## Known blind spot (accepted)

If the Slack webhook itself breaks (revoked, or the channel archived), every post fails, including the warning, because it goes through the same webhook. Submissions are still safe in D1, but nobody is told. This is accepted. The README documents a one-line `wrangler d1 execute` query to count undelivered rows, and a second alert channel can be added later if this ever bites.

## Preview builds and migrations (my calls)

**Preview builds.** If Workers Builds produces preview versions for other branches, those versions share the production D1 database and secrets. There is no separate environment. Two things keep previews from polluting the inbox:
- The Turnstile widget only allows mtlnog.org, so a preview hostname can't pass verification. If a preview hostname is ever added to the widget for testing, test submissions go to the real channel. That is acceptable, because they are labelled and purged like any other message.
- The README says so.

**D1 migrations** stay manual: `wrangler d1 migrations apply --remote`, run before merging any change that needs one. The README documents this. The Workers Builds deploy command is unchanged. The schema is one small table that will rarely change.

## Constraints

- **Stack:** Astro 5 static output stays. The Worker is a separate TypeScript entry point in the repo, declared as `main` in `wrangler.jsonc` alongside the existing `assets` block, so `/api/*` reaches the script and other paths are served as assets. Workers Builds keeps deploying on push to `main`.
- **Tests:** vitest stays the test runner. Validation, payload shaping, Slack formatting and escaping, and the retry/purge selection logic are pure functions with unit tests. Adding the Cloudflare Workers vitest pool for integration tests is the builder's call.
- **Bilingual copy:** every new string goes in both `fr.json` and `en.json`. `shape.test.ts` enforces matching keys, and `translated.test.ts` checks that French strings differ from English.
- **Privacy (Quebec Law 25):** collect only what the form asks for, store it only in D1 and Slack, delete delivered rows after 30 days, and never write personal data to logs or error fields. The form note says how the data is used.

## Rollout

Nothing goes live until the Slack webhook exists, so the order matters:

1. **Jonathan** creates the private channel and its incoming webhook.
2. **Create the D1 database, run the migration, and set both Worker secrets.** This is done by Claude with the Cloudflare token, if it has D1 and Workers edit permissions, or by Jonathan with `wrangler`.
3. **Check the Turnstile widget's allowed hostnames** cover mtlnog.org and any preview hostname used for testing.
4. **Merge and push.** Workers Builds deploys.
5. **Smoke test on production:** submit one message per topic and confirm each arrives in Slack and appears in D1.
6. **After the smoke test:**
   - remove the Formspree build variables from the Workers Builds settings;
   - delete the `turnstile` branch, since its work is folded in here;
   - retire the Formspree form if anyone regains access.

## Left to the builder

- The final French and English copy for the heading, intro, field labels, placeholders and the deletion note, starting from the mockup wording.
- Worker file layout, D1 schema details, and Slack message formatting.
- How topic fields are shown and hidden. Prefer one form with grouped sections and `hidden` plus `disabled`, so hidden fields are neither validated by the browser nor sent.
- Exact length caps, the retry batch size, and the honeypot field name.
- Whether to add the Workers vitest pool.

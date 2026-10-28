# MTLNOG site

Bilingual (FR/EN) static site for the Montreal Network Operator Group, built with Astro.

## Develop

```bash
mise install           # installs Node (version from .nvmrc)
cp .env.example .env   # then fill in real values (see below)
mise run dev           # installs npm deps if needed, then starts astro dev
```

`mise run dev` serves the pages only. To exercise the contact form end to end, run the Worker locally (see "Contact form" below).

Node version is pinned in `.nvmrc` (Node 22, required by wrangler); mise, nvm, CI, and Cloudflare all read it. `mise tasks` lists the available tasks (`dev`, `test`, `build`, `preview`, `deploy`); each one runs `npm ci` first if the lockfile changed. Plain `npm install` / `npm run …` still works without mise.

## Configuration

| Name | Kind | Where |
|---|---|---|
| `PUBLIC_TURNSTILE_SITEKEY` | Build variable (public, ends up in the HTML) | `.env` locally, Workers Builds settings in production (`0x4AAAAAAFo_cWZB_zA8Phzj`) |
| `TURNSTILE_SECRET` | Worker secret | `.dev.vars` locally, `npx wrangler secret put TURNSTILE_SECRET` in production |
| `SLACK_WEBHOOK_URL` | Worker secret | `.dev.vars` locally, `npx wrangler secret put SLACK_WEBHOOK_URL` in production |
| `DB` | D1 binding (`mtlnog-contact`) | `wrangler.jsonc` |

The build fails fast if `PUBLIC_TURNSTILE_SITEKEY` is missing. Cloudflare's test keys (sitekey `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`) always pass and are what `.env.example`, `.dev.vars.example` and CI use. Secrets never go in the repo.

## Contact form

The home page form (`#invite`) posts JSON to `/api/contact`, handled by `worker/index.ts`. The Worker:

1. checks the fields (rules shared with the form in `src/lib/contact.ts`), a honeypot, and the Turnstile token;
2. stores the submission in D1;
3. posts it to a private Slack channel through the incoming webhook.

A cron trigger (every 5 minutes) retries Slack deliveries that failed. After 24 hours it gives up on a submission, marks it failed and posts a warning (id and topic only) to Slack. Delivered submissions are deleted after 30 days; failed ones stay until someone handles them.

Topics are `slack`, `sponsorship`, `speaking`, `venue` and `general`. Links like `/en/?type=venue#invite` open the form with that topic selected (`contactHref()` in `src/i18n/routes.ts`).

**Run it locally:**

```bash
cp .dev.vars.example .dev.vars                  # test Turnstile secret; add a test webhook if you have one
npx wrangler d1 migrations apply DB --local     # once, and after schema changes
mise run dev-worker                             # builds the site, then wrangler dev on http://localhost:8787
```

With an empty `SLACK_WEBHOOK_URL`, submissions are stored but every delivery fails; inspect them with `npx wrangler d1 execute DB --local --command "SELECT * FROM submissions"`.

**Check for undelivered submissions in production:**

```bash
npx wrangler d1 execute DB --remote --command "SELECT id, topic, attempts, last_error, failed_at FROM submissions WHERE delivered_at IS NULL"
```

Known blind spot: if the webhook itself breaks (revoked, or the channel archived), the failure warning can't reach Slack either. Submissions are still safe in D1; the query above shows them.

**Database changes:** migrations live in `migrations/` and are applied by hand, before merging the change that needs them: `npx wrangler d1 migrations apply DB --remote`. The Workers Builds deploy does not run them.

**Preview builds** share the production database and secrets. The Turnstile widget only allows mtlnog.org, so previews can't submit unless a preview hostname is added to it; if one is, its test submissions land in the real Slack channel (labelled, and purged like any other).

## Build & test

```bash
npm test          # vitest (i18n + detection logic)
npm run build     # static output to dist/
npm run preview   # serve the built site locally
```

## Pages and yearly updates

| Page | French | English |
|---|---|---|
| Home + invite form | `/fr/` | `/en/` |
| Events | `/fr/evenements/` | `/en/events/` |
| Team | `/fr/equipe/` | `/en/team/` |
| Sponsorship | `/fr/commandites/` | `/en/sponsorship/` |

URLs are defined once in `src/i18n/routes.ts`. All page text lives in `src/i18n/{fr,en}.json`. Facts that change over time live in `src/data/`:

- `sponsorship.ts`: program year, stats and their date, event months, tier prices and limits. Update it each year.
- `meetings.ts`: add an event (`date`, `title`, `venue`, optional `url`) to the Events page; it shows under Upcoming until its date passes, then under Past on the next build.
- `team.ts`: members. Email addresses are deliberately not published. To add a photo, put it in `public/team/` and set `photo: '/team/<name>.jpg'`; until then the page shows initials.
- `social.ts`: social links used in the hero, footer and Team page.

The old `/fr/rencontres/` and `/en/meetings/` URLs redirect to the Events page (`public/_redirects`).

Links like `/en/?type=sponsorship#invite` open the contact form with that topic pre-selected.

## Deploy (Cloudflare Workers - static assets)

The GitHub repo is connected to Cloudflare via Workers Builds; CF builds and deploys on push to `main`. Deploy config lives in `wrangler.jsonc` (Worker name `mtlnog-org`): the built site in `./dist` is served as static assets, `/api/*` runs `worker/index.ts`, and a cron trigger runs every 5 minutes.

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Node version:** from `.nvmrc` (22)
- **Build environment variables** (set for Production and Preview): `PUBLIC_TURNSTILE_SITEKEY`
- **Worker secrets:** `TURNSTILE_SECRET`, `SLACK_WEBHOOK_URL` (set once with `wrangler secret put`)

Deploy manually with `npm run deploy` (requires `wrangler login` or a `CLOUDFLARE_API_TOKEN`).

## CI

`.github/workflows/ci.yml` runs the tests, a Worker type-check and a build (with the Turnstile test sitekey) on every PR and push to `main`. It does not deploy.

## License

[MIT](LICENSE) (c) 2026 MTLNOG (Montreal Network Operator Group).

# MTLNOG site

Bilingual (FR/EN) site for the Montreal Network Operator Group: a static Astro site plus a small Cloudflare Worker that handles the contact form.

## Development setup

```bash
mise install                                    # installs Node (version from .nvmrc)
cp .env.example .env                            # Turnstile test sitekey; works as is
cp .dev.vars.example .dev.vars                  # Worker secrets for local runs
mise run dev                                    # installs npm deps if needed, then starts astro dev
```

`mise run dev` serves the pages only. To test the contact form end to end, run the Worker locally:

```bash
npx wrangler d1 migrations apply DB --local     # once, and after schema changes
mise run dev-worker                             # builds the site, then wrangler dev on http://localhost:8787
```

With an empty `SLACK_WEBHOOK_URL`, submissions are stored but every delivery fails; inspect them with `npx wrangler d1 execute DB --local --command "SELECT * FROM submissions"`.

Tests and build:

```bash
mise run test       # vitest
mise run build      # static output to dist/
mise run preview    # build, then serve dist/
```

`mise tasks` lists every task; each runs `npm ci` first if the lockfile changed. Plain `npm install` / `npm run …` works without mise. Node is pinned in `.nvmrc` (Node 22, required by wrangler); mise, nvm, CI and Cloudflare all read it.

The local example files use Cloudflare's Turnstile test keys (sitekey `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`), which always pass. The build fails if `PUBLIC_TURNSTILE_SITEKEY` is unset. Secrets never go in the repo.

CI (`.github/workflows/ci.yml`) runs the tests, a Worker type-check and a build on every PR and push to `main`. It does not deploy.

## Operations

### Deploy

Cloudflare Workers Builds builds and deploys on every push to `main` (`npm run build`, then `npx wrangler deploy`). `wrangler.jsonc` defines the Worker `mtlnog-org`: `./dist` is served as static assets, `/api/*` runs `worker/index.ts`, and a cron trigger runs every 5 minutes.

Deploy manually with `mise run deploy` (requires `wrangler login` or a `CLOUDFLARE_API_TOKEN`).

Preview builds share the production database and secrets. The Turnstile widget only allows mtlnog.org, so previews can't submit unless a preview hostname is added to it; if one is, its test submissions land in the real Slack channel.

### Configuration

| Name | Kind | Production |
|---|---|---|
| `PUBLIC_TURNSTILE_SITEKEY` | Build variable (public, ends up in the HTML) | Workers Builds settings, Production and Preview (`0x4AAAAAAFo_cWZB_zA8Phzj`) |
| `TURNSTILE_SECRET` | Worker secret | `npx wrangler secret put TURNSTILE_SECRET` |
| `SLACK_WEBHOOK_URL` | Worker secret | `npx wrangler secret put SLACK_WEBHOOK_URL` |
| `DB` | D1 binding (`mtlnog-contact`) | `wrangler.jsonc` |

### Contact form messages

Messages go to the private Slack channel. Failed deliveries are retried for 24 hours, then flagged in Slack. To list messages that never reached Slack:

```bash
npx wrangler d1 execute DB --remote --command "SELECT id, topic, attempts, last_error, failed_at FROM submissions WHERE delivered_at IS NULL"
```

The database can also be browsed in the Cloudflare dashboard under **Storage & databases → D1 SQL database → `mtlnog-contact`**. Check it if Slack has gone quiet: a broken webhook can't report its own failure.

### Database migrations

Migrations live in `migrations/` and are applied by hand, before merging the change that needs them:

```bash
npx wrangler d1 migrations apply DB --remote
```

The Workers Builds deploy does not run them.

### Content updates

Events, team members, sponsorship tiers and social links are edited in `src/data/`; see [docs/content.md](docs/content.md). Update `sponsorship.ts` each year.

## More documentation

- [docs/content.md](docs/content.md): pages, URLs, and the data files behind them
- [docs/contact-form.md](docs/contact-form.md): how the contact form works, and how to set it up from scratch
- [docs/slack-app-manifest.yml](docs/slack-app-manifest.yml): the Slack app for the webhook
- [docs/superpowers/](docs/superpowers/): design specs and implementation plans

## License

[MIT](LICENSE) (c) 2026 MTLNOG (Montreal Network Operator Group).

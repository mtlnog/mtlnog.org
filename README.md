# MTLNOG site

Bilingual (FR/EN) static site for the Montreal Network Operator Group, built with Astro.

## Develop

```bash
mise install           # installs Node (version from .nvmrc)
cp .env.example .env   # then fill in real values (see below)
mise run dev           # installs npm deps if needed, then starts astro dev
```

Node version is pinned in `.nvmrc` (Node 22, required by wrangler); mise, nvm, CI, and Cloudflare all read it. `mise tasks` lists the available tasks (`dev`, `test`, `build`, `preview`, `deploy`); each one runs `npm ci` first if the lockfile changed. Plain `npm install` / `npm run …` still works without mise.

## Configuration

Two public, client-side identifiers are injected via env vars (Astro requires the `PUBLIC_` prefix):

| Var | Value |
|---|---|
| `PUBLIC_FORMSPREE_ID` | Formspree form id (the part after `/f/`) |
| `PUBLIC_HCAPTCHA_SITEKEY` | hCaptcha sitekey |

These appear in the shipped HTML - they are not secrets. Locally they live in `.env` (git-ignored). In production they are set as build variables in the Cloudflare Workers project. The build fails fast if either is missing.

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
| Meetings | `/fr/rencontres/` | `/en/meetings/` |
| Team | `/fr/equipe/` | `/en/team/` |
| Sponsorship | `/fr/commandites/` | `/en/sponsorship/` |

URLs are defined once in `src/i18n/routes.ts`. All page text lives in `src/i18n/{fr,en}.json`. Facts that change over time live in `src/data/`:

- `sponsorship.ts`: program year, stats and their date, meeting months, tier prices and limits, per-meeting costs. Update it each year.
- `meetings.ts`: add a meeting (`date`, `title`, `venue`, optional `url`) and it shows under Upcoming until its date passes, then under Past on the next build.
- `team.ts`: members and emails. To add a photo, put it in `public/team/` and set `photo: '/team/<name>.jpg'`; until then the page shows initials.
- `social.ts`: social links used in the hero, footer and Team page.

Links like `/en/?type=sponsorship#invite` open the invite form with that option pre-selected.

## Deploy (Cloudflare Workers - static assets)

The GitHub repo is connected to Cloudflare via Workers Builds; CF builds and deploys on push to `main`. Deploy config lives in `wrangler.jsonc` (Worker name `mtlnog-org`; the built site in `./dist` is served as static assets).

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Node version:** from `.nvmrc` (22)
- **Build environment variables** (set for Production and Preview): `PUBLIC_FORMSPREE_ID`, `PUBLIC_HCAPTCHA_SITEKEY`

Deploy manually with `npm run deploy` (requires `wrangler login` or a `CLOUDFLARE_API_TOKEN`).

### Production email obfuscation

The footer uses a plain `mailto:hello@mtlnog.org`. Enable **Scrape Shield > Email Address Obfuscation** on the production Cloudflare zone so Cloudflare rewrites the address at serve time. No source-side obfuscation is needed.

## CI

`.github/workflows/ci.yml` runs tests + a build (with dummy public env values) on every PR and push to `main`. It does not deploy.

## License

[MIT](LICENSE) (c) 2026 MTLNOG (Montreal Network Operator Group).

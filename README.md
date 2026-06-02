# MTLNOG site

Bilingual (FR/EN) static site for the Montreal Network Operator Group, built with Astro.

## Develop

```bash
npm install
cp .env.example .env   # then fill in real values (see below)
npm run dev
```

Node version is pinned in `.nvmrc` (Node 22, required by wrangler); nvm, mise, and Cloudflare all read it.

## Configuration

Two public, client-side identifiers are injected via env vars (Astro requires the `PUBLIC_` prefix):

| Var | Value |
|---|---|
| `PUBLIC_FORMSPREE_ID` | Formspree form id (the part after `/f/`) |
| `PUBLIC_HCAPTCHA_SITEKEY` | hCaptcha sitekey |

These appear in the shipped HTML - they are not secrets. Locally they live in `.env` (git-ignored). In production they are set in the Cloudflare Pages dashboard. The build fails fast if either is missing.

## Build & test

```bash
npm test          # vitest (i18n + detection logic)
npm run build     # static output to dist/
npm run preview   # serve the built site locally
```

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

# MTLNOG site

Bilingual (FR/EN) static site for the Montreal Network Operator Group, built with Astro.

## Develop

```bash
npm install
cp .env.example .env   # then fill in real values (see below)
npm run dev
```

Node version is pinned in `.nvmrc` (Node 20); nvm, mise, and Cloudflare Pages all read it.

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

## Deploy (Cloudflare Pages - native build)

The GitHub repo is connected to Cloudflare Pages; CF builds and deploys on push.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** from `.nvmrc` (20)
- **Environment variables** (set for both Production and Preview): `PUBLIC_FORMSPREE_ID`, `PUBLIC_HCAPTCHA_SITEKEY`

### Production email obfuscation

The footer uses a plain `mailto:hello@mtlnog.org`. Enable **Scrape Shield > Email Address Obfuscation** on the production Cloudflare zone so Cloudflare rewrites the address at serve time. No source-side obfuscation is needed.

## CI

`.github/workflows/ci.yml` runs tests + a build (with dummy public env values) on every PR and push to `main`. It does not deploy.

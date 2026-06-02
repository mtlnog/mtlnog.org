# MTLNOG site — Astro rebuild design

**Date:** 2026-06-02
**Status:** Approved (pending spec review)

## Goal

Recreate the existing single-page MTLNOG landing page
(`https://dev.mtlnog.org/index_20260602.html`) as a maintainable static site
built with **Astro**, with:

- proper per-language pages (FR / EN) plus a language switcher and browser-language detection
- responsive layout (preserved from the source)
- CSS generated from **SCSS** instead of an inlined `<style>` block

The visual result must match the source (dark "terminal" aesthetic), except for
the color-alignment fix described below.

## Source summary

The source is one HTML file with all CSS inlined and both languages interleaved
as combined strings (e.g. `Prénom / First Name`). Sections:

- **Header:** logo (inline base64 PNG, 605×147) + `MTLNOG / Montreal Network Operator Group` text + nav (LinkedIn, Mastodon, Request Invite anchor)
- **Hero:** `<h1>` "Montreal Network Operator Group", a FR intro paragraph + an EN intro paragraph (italic/dimmed), and a row of social "pill" links (X, Mastodon, LinkedIn) with inline SVG icons
- **Invite form:** posts to Formspree (`https://formspree.io/f/xjgznrjb`, endpoint id `xjgznrjb`) with hCaptcha (sitekey `7a007138-8286-449e-af82-7bd25d9ed86a`, dark theme). Fields: first name (req), last name (req), email (req), organisation/ASN, role (select, req), invitation type (select, req — only "Workspace Slack"), intro (textarea), hCaptcha (req), submit. Styled `.status.success`/`.status.error` exist but no JS drove them — original did a native POST redirect.
- **Footer:** `© 2025 MTLNOG …` + Cloudflare-obfuscated email + social links

Fonts: Share Tech Mono (`--mono`) + DM Sans (`--sans`) from Google Fonts.
Color tokens: `--bg #08090d`, `--surface #0e1018`, `--border #2a3048`,
`--accent #e8162b`, `--accent2 #ff6b35`, `--muted #7c8aaa`, `--text #dde2f2`,
`--text-dim #9ba5c4`.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Static site generator | **Astro** (static output) |
| i18n URL strategy | **Both locales prefixed**: `/fr/` and `/en/`; bare `/` redirects by browser language |
| Default ordering | FR-first content ordering preserved where both appear |
| Form submission | **AJAX** via `fetch()` to Formspree with inline `.status` messages; button disabled while sending |
| Credentials/config | Formspree form ID + hCaptcha sitekey injected via Astro `PUBLIC_*` env vars; real `.env` git-ignored, `.env.example` committed with placeholders; production values set as build variables in the Cloudflare Workers project |
| Logo | **Extract** base64 → `public/logo.png` real asset |
| Color states | **Align to red accent** (fix cyan focus/hover/status flashes) |
| Email | Plain `mailto:hello@mtlnog.org` in source; rely on Cloudflare's serve-time **Email Address Obfuscation** (Scrape Shield) in production |
| Deploy | **Cloudflare Workers Builds** (static assets via `wrangler.jsonc`; CF builds + deploys on push; `npm run build` then `npx wrangler deploy`) |
| CI gate | Lightweight **GitHub Actions** workflow runs tests + build check on PRs (no deploy) |

> **Note on "secrets":** the hCaptcha *sitekey* and Formspree *form ID* are public client-side identifiers — they are sent to every browser and appear in the deployed HTML/JS regardless. Env-var injection provides config hygiene and easy rotation, **not** secrecy. The genuinely secret hCaptcha secret key lives on Formspree's side, never in this repo.

## Architecture

Static Astro project (`output: 'static'`), no SSR runtime.

```
mtlnog_dot_org/
├─ astro.config.mjs          # i18n: locales ['fr','en'], defaultLocale 'fr', prefixDefaultLocale: true
├─ wrangler.jsonc            # Cloudflare Workers deploy config (assets.directory: ./dist)
├─ package.json
├─ .env.example              # PUBLIC_FORMSPREE_ID / PUBLIC_HCAPTCHA_SITEKEY placeholders (committed)
├─ .env                      # real values for local dev (git-ignored)
├─ .github/workflows/ci.yml  # PR gate: npm test + npm run build (no deploy)
├─ README.md                 # build, config, and Cloudflare Workers deploy notes
├─ public/
│  └─ logo.png               # decoded from source base64 (605×147 PNG)
├─ src/
│  ├─ layouts/
│  │  └─ Base.astro          # <html lang>, <head>, font links, .page wrapper, Footer include
│  ├─ components/
│  │  ├─ Header.astro        # logo + nav + LanguageSwitcher
│  │  ├─ LanguageSwitcher.astro  # FR · EN toggle, links to same page in other locale, persists choice
│  │  ├─ Hero.astro          # tag, h1, intro paragraph(s), social pills
│  │  ├─ InviteForm.astro    # form markup + hCaptcha + AJAX submit script
│  │  └─ Footer.astro
│  ├─ i18n/
│  │  ├─ fr.json             # all French strings (nav, hero, form labels, options, footer)
│  │  ├─ en.json             # all English strings
│  │  └─ utils.ts            # getStrings(locale), other-locale helper
│  ├─ pages/
│  │  ├─ index.astro         # root redirect page (lang detection)
│  │  ├─ fr/index.astro      # renders components with fr strings, lang="fr"
│  │  └─ en/index.astro      # renders components with en strings, lang="en"
│  └─ styles/
│     ├─ main.scss           # @use's the partials
│     ├─ _tokens.scss        # :root custom properties (color + font tokens)
│     ├─ _base.scss          # reset, html/body, .page, .inner-wrap, .divider
│     ├─ _header.scss        # header, logo, nav, language switcher
│     ├─ _hero.scss          # hero, tag, h1, hero-body, links-row, pill
│     ├─ _form.scss          # form-section, fields, inputs, select, button, status, captcha
│     ├─ _footer.scss
│     ├─ _animations.scss    # fadeDown, fadeUp keyframes
│     └─ _responsive.scss    # @media (max-width: 600px) rules
```

## Components / units

Each component takes a `strings` object (the active locale's dictionary) and a
`locale` prop; none reaches into another's internals.

- **Base.astro** — page shell. Props: `locale`, `title`, `description`. Sets `<html lang>`, meta, font preconnect/link, renders `<slot/>` inside `.page`, includes Footer. Imports `main.scss` once.
- **Header.astro** — props: `strings`, `locale`. Logo (`/logo.png`) + text + nav (external social links + invite anchor) + `LanguageSwitcher`.
- **LanguageSwitcher.astro** — props: `locale`. Renders `FR · EN`, current locale marked active, the other links to its `/xx/` page. Inline script writes chosen locale to `localStorage('mtlnog-lang')`.
- **Hero.astro** — props: `strings`. Tag, `<h1>`, intro paragraph(s), social pills with inline SVGs.
- **InviteForm.astro** — props: `strings`. Full form, hCaptcha div, status node. Inline `<script>` does AJAX submit (below). hCaptcha API script loaded here/in Base.
- **Footer.astro** — no props (language-neutral). Copyright (dynamic year) + email + social links.

## Data flow

1. `/fr/index.astro` and `/en/index.astro` import their dictionary
   (`getStrings('fr'|'en')`) and pass it to `Base` + components.
2. Components render purely from passed strings — no global locale lookup inside.
3. Client side: `LanguageSwitcher` persists the user's choice; the root page reads it.

## Language detection (root `/`)

`src/pages/index.astro` outputs a minimal HTML page whose only logic is a
client-side redirect script:

```js
const saved = localStorage.getItem('mtlnog-lang');
const nav = (navigator.languages || [navigator.language || 'en']);
const prefersFr = saved === 'fr' || (!saved && nav.some(l => l.toLowerCase().startsWith('fr')));
location.replace(prefersFr ? '/fr/' : '/en/');
```

A `<noscript>` meta-refresh fallback points to `/fr/` (Quebec-default), plus
visible `FR | EN` links so no-JS users are never stranded. Host-agnostic — no
Cloudflare/Netlify redirect config required.

## Form behavior (AJAX)

Inline script in `InviteForm`:

- intercept `submit`, `preventDefault`
- disable submit button, clear prior status
- `fetch(action, { method:'POST', body: new FormData(form), headers:{ Accept:'application/json' } })`
- on `res.ok` → show `.status.success` (localized), reset form (`hcaptcha.reset()` if present)
- else → parse Formspree error JSON, show `.status.error` (localized)
- network error → generic localized error
- re-enable button in `finally`

hCaptcha continues to load via `https://js.hcaptcha.com/1/api.js`. Submit
requires a captcha token (Formspree enforces server-side; client also checks).

The Formspree action URL and hCaptcha `data-sitekey` are read from env vars in
the component frontmatter (`import.meta.env.PUBLIC_FORMSPREE_ID` /
`PUBLIC_HCAPTCHA_SITEKEY`). A guard in the frontmatter throws at build time if
either is missing, so a misconfigured CI build fails fast instead of shipping a
broken form.

## Configuration & secrets

Values that vary by environment are injected, not hard-coded:

| Env var | Used for | Public? |
|---|---|---|
| `PUBLIC_FORMSPREE_ID` | Formspree form id → `https://formspree.io/f/<id>` | Yes (in shipped HTML) |
| `PUBLIC_HCAPTCHA_SITEKEY` | hCaptcha `data-sitekey` | Yes (in shipped HTML) |

- `.env.example` (committed) documents both with placeholder values.
- `.env` (git-ignored) holds the real values for local dev/build.
- Astro requires the `PUBLIC_` prefix to expose a var to component/client code;
  these become part of the static output by design.
- **Not secret:** both are client-side identifiers visible in any served page —
  injection is for config hygiene/rotation, not concealment. No private key
  (hCaptcha secret) exists in this repo; Formspree holds it.

## Deployment (Cloudflare Workers — static assets)

- **Workers Builds:** the GitHub repo is connected to Cloudflare via Workers
  Builds; CF builds and deploys on push to `main`. Build command `npm run build`,
  deploy command `npx wrangler deploy`, Node from `.nvmrc` (22). Deploy config is
  `wrangler.jsonc` (Worker name `mtlnog-org`; `assets.directory: ./dist` serves
  the built site — no server script).
- **Env vars:** `PUBLIC_FORMSPREE_ID` and `PUBLIC_HCAPTCHA_SITEKEY` set as build
  variables in the Worker project (Production + Preview).
- **Email obfuscation:** the source uses a plain `mailto:hello@mtlnog.org`.
  Enable Cloudflare's **Email Address Obfuscation** (Scrape Shield) on the
  production zone — Cloudflare rewrites the address at serve time. No source-side
  obfuscation is hand-rolled.
- **CI gate (GitHub Actions):** `.github/workflows/ci.yml` runs `npm ci`,
  `npm test`, and `npm run build` on pull requests. It does **not** deploy
  (Cloudflare Workers Builds owns deploy). The build step uses dummy `PUBLIC_*`
  values so it validates without needing real secrets.

## Styling

Port the source `<style>` block **verbatim** into the SCSS partials — identical
tokens, selectors, and the `@media (max-width: 600px)` block (form → 1 column,
`.field.full`/`.captcha-wrap`/`.submit-row` → single column, `nav` hidden).
The language switcher must remain reachable on mobile even though `nav` social
links hide — switcher is a separate element kept visible at ≤600px.

**Color alignment (the one intentional visual change):**

| State | Source (cyan) | New (red) |
|---|---|---|
| input/select/textarea focus box-shadow | `rgba(0,229,255,0.08)` | `rgba(232,22,43,0.12)` |
| submit button hover background | `#33ecff` | `#ff2d42` |
| `.status.success` background | `rgba(0,229,255,0.06)` | `rgba(232,22,43,0.06)` |

(`.status.success` border/color were already `--accent` red; only its background tint changes.)

Astro compiles SCSS natively (needs the `sass` dev dependency). Output: one
hashed, minified CSS file linked from `<head>`.

## Out of scope (YAGNI)

No CMS, no additional pages/routes, no JS framework or Astro islands, no
analytics, no build-time image optimization beyond serving the static PNG.

## Success criteria

- `npm run build` produces static `/fr/`, `/en/`, and `/` pages
- `/` redirects to `/fr/` or `/en/` per browser language; choice persists across visits via the switcher
- Both pages are single-language with correct `<html lang>` and localized `<title>`
- Form submits via AJAX and shows localized inline success/error without leaving the page
- Layout matches the source at desktop and ≤600px; no cyan remains in focus/hover/status states
- All styling originates from SCSS partials compiled by Astro (no inline `<style>` blocks of substance)
- No Formspree id or hCaptcha sitekey is hard-coded in tracked source; both come from `PUBLIC_*` env vars, with `.env` git-ignored and `.env.example` committed
- A build with missing env vars fails fast (frontmatter guard), rather than shipping a broken form
- `.github/workflows/ci.yml` runs tests + build on PRs and passes with dummy env values

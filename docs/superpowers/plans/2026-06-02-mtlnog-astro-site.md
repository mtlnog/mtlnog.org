# MTLNOG Astro Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the MTLNOG single-page landing site as a maintainable Astro static site with per-language pages (FR/EN), a language switcher with browser detection, responsive layout, and CSS compiled from SCSS.

**Architecture:** Static Astro project. Two single-language pages (`/fr/`, `/en/`) assembled from shared components that receive a per-locale string dictionary. The bare `/` is a tiny client-side redirect page that picks a locale from `localStorage` then `navigator.languages`. All styling lives in SCSS partials compiled by Astro into one hashed CSS file. The invite form submits to Formspree via `fetch()` and shows localized inline status messages.

**Tech Stack:** Astro 5, Sass (SCSS), Vitest (for the pure i18n/detection logic), Formspree + hCaptcha (existing credentials).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Dependencies + scripts (`dev`, `build`, `preview`, `test`) |
| `astro.config.mjs` | Static output + i18n locale config |
| `tsconfig.json` | Strict TS, JSON module resolution |
| `public/logo.png` | Decoded brand logo asset (605×147) |
| `src/i18n/utils.ts` | `Locale` type, `getStrings`, `otherLocale`, `isLocale`, `Strings` type |
| `src/i18n/detect.ts` | Pure `detectLocale(saved, navigatorLanguages)` |
| `src/i18n/fr.json` / `en.json` | All localized strings |
| `src/i18n/*.test.ts` | Vitest unit tests for the above pure logic |
| `src/styles/main.scss` + `_*.scss` | Compiled stylesheet (tokens, base, header, hero, form, footer, animations, responsive) |
| `src/layouts/Base.astro` | HTML shell: `<html lang>`, head, fonts, `.page` wrapper, footer |
| `src/components/Footer.astro` | Language-neutral footer (copyright, email, socials) |
| `src/components/LanguageSwitcher.astro` | FR · EN toggle, persists choice |
| `src/components/Header.astro` | Logo + nav + switcher |
| `src/components/Hero.astro` | h1, intro copy, social pills |
| `src/components/InviteForm.astro` | Form markup + hCaptcha + AJAX submit script |
| `src/components/HomePage.astro` | Assembles the page from `locale` |
| `src/pages/fr/index.astro` / `en/index.astro` | Thin per-locale entrypoints |
| `src/pages/index.astro` | Root redirect / language detection |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mtlnog-site",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.0.0"
  },
  "devDependencies": {
    "sass": "^1.80.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "resolveJsonModule": true,
    "allowJs": true
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: completes without error; `node_modules/` and `package-lock.json` created.

- [ ] **Step 5: Verify Astro is installed**

Run: `npx astro --version`
Expected: prints a version number (e.g. `5.x.x`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json
git commit -m "Scaffold Astro project with i18n config"
```

---

## Task 2: Extract logo asset

**Files:**
- Create: `public/logo.png`

- [ ] **Step 1: Decode the logo from the live source into `public/logo.png`**

The logo is an inline base64 PNG in the source page. Decode it directly:

```bash
mkdir -p public
curl -s https://dev.mtlnog.org/index_20260602.html \
  | grep -o 'data:image/png;base64,[A-Za-z0-9+/=]*' \
  | head -1 \
  | sed 's/^data:image\/png;base64,//' \
  | base64 -d > public/logo.png
```

- [ ] **Step 2: Verify the asset is a valid PNG of expected size**

Run: `file public/logo.png`
Expected: `public/logo.png: PNG image data, 605 x 147, 8-bit/color RGBA, non-interlaced`

(If `curl` to the dev host fails, a pre-decoded copy was saved at `/tmp/mtlnog-logo.png` during planning — `cp /tmp/mtlnog-logo.png public/logo.png` and re-verify with `file`.)

- [ ] **Step 3: Commit**

```bash
git add public/logo.png
git commit -m "Add MTLNOG logo asset"
```

---

## Task 3: i18n locale utilities and detection (TDD)

**Files:**
- Create: `src/i18n/detect.ts`
- Create: `src/i18n/detect.test.ts`
- Create: `src/i18n/utils.ts`
- Create: `src/i18n/utils.test.ts`

> Note: `utils.ts` imports the JSON dictionaries created in Task 4. To keep this task self-contained and testable first, create minimal stub dictionaries now; Task 4 replaces them with full content. The stubs share an identical shape so `getStrings` typechecks.

- [ ] **Step 1: Create stub dictionaries so `utils.ts` compiles**

`src/i18n/fr.json`:

```json
{ "meta": { "title": "MTLNOG", "description": "fr" } }
```

`src/i18n/en.json`:

```json
{ "meta": { "title": "MTLNOG", "description": "en" } }
```

- [ ] **Step 2: Write the failing test for `detectLocale`**

`src/i18n/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectLocale } from './detect';

describe('detectLocale', () => {
  it('returns saved locale when valid, ignoring navigator', () => {
    expect(detectLocale('en', ['fr-CA', 'fr'])).toBe('en');
    expect(detectLocale('fr', ['en-US'])).toBe('fr');
  });

  it('uses navigator languages when nothing saved', () => {
    expect(detectLocale(null, ['fr-CA', 'en'])).toBe('fr');
    expect(detectLocale(null, ['en-US'])).toBe('en');
  });

  it('ignores an invalid saved value and falls back to navigator', () => {
    expect(detectLocale('de', ['fr'])).toBe('fr');
  });

  it('defaults to en when navigator has no French and nothing saved', () => {
    expect(detectLocale(null, [])).toBe('en');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/i18n/detect.test.ts`
Expected: FAIL — cannot find module `./detect`.

- [ ] **Step 4: Implement `detect.ts`**

`src/i18n/detect.ts`:

```ts
export type Locale = 'fr' | 'en';

export function detectLocale(
  saved: string | null,
  navigatorLanguages: readonly string[],
): Locale {
  if (saved === 'fr' || saved === 'en') return saved;
  const prefersFr = navigatorLanguages.some((l) => l.toLowerCase().startsWith('fr'));
  return prefersFr ? 'fr' : 'en';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/i18n/detect.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing test for `utils.ts`**

`src/i18n/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getStrings, otherLocale, isLocale, locales } from './utils';

describe('locale utils', () => {
  it('exposes both locales', () => {
    expect(locales).toEqual(['fr', 'en']);
  });

  it('getStrings returns the matching dictionary', () => {
    expect(getStrings('fr').meta.description).toBe('fr');
    expect(getStrings('en').meta.description).toBe('en');
  });

  it('otherLocale flips the locale', () => {
    expect(otherLocale('fr')).toBe('en');
    expect(otherLocale('en')).toBe('fr');
  });

  it('isLocale narrows valid values', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/i18n/utils.test.ts`
Expected: FAIL — cannot find module `./utils`.

- [ ] **Step 8: Implement `utils.ts`**

`src/i18n/utils.ts`:

```ts
import type { Locale } from './detect';
import fr from './fr.json';
import en from './en.json';

export type { Locale } from './detect';
export type Strings = typeof fr;

export const locales: readonly Locale[] = ['fr', 'en'];

const dictionaries: Record<Locale, Strings> = { fr, en };

export function getStrings(locale: Locale): Strings {
  return dictionaries[locale];
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'fr' ? 'en' : 'fr';
}

export function isLocale(value: string): value is Locale {
  return value === 'fr' || value === 'en';
}
```

- [ ] **Step 9: Run both test files to verify they pass**

Run: `npx vitest run src/i18n`
Expected: PASS (all tests in `detect.test.ts` + `utils.test.ts`).

- [ ] **Step 10: Commit**

```bash
git add src/i18n
git commit -m "Add i18n locale utilities and detection with tests"
```

---

## Task 4: Full localized string dictionaries

**Files:**
- Modify: `src/i18n/fr.json` (replace stub)
- Modify: `src/i18n/en.json` (replace stub)
- Create: `src/i18n/shape.test.ts`

- [ ] **Step 1: Write `src/i18n/fr.json` with full French content**

```json
{
  "meta": {
    "title": "MTLNOG // Montreal Network Operator Group",
    "description": "MTLNOG réunit les ingénieurs et opérateurs de réseau à Montréal, au Québec et au-delà pour partager des connaissances et favoriser les échanges au sein de la communauté des opérateurs de réseau."
  },
  "nav": {
    "invite": "Demander une invitation"
  },
  "hero": {
    "intro": "MTLNOG réunit les ingénieurs et opérateurs de réseau à Montréal, au Québec et au-delà pour partager des connaissances et favoriser les échanges au sein de la communauté des opérateurs de réseau."
  },
  "form": {
    "sectionLabel": "Demande d'accès",
    "heading": "Rejoindre la communauté",
    "sub": "Le workspace Slack est soumis à approbation par l'équipe MTLNOG.",
    "fields": {
      "fname": { "label": "Prénom", "placeholder": "Jean" },
      "lname": { "label": "Nom", "placeholder": "Tremblay" },
      "email": { "label": "Courriel", "placeholder": "vous@exemple.net" },
      "org": { "label": "Organisation / ASN", "placeholder": "Acme Networks / AS12345" },
      "role": {
        "label": "Rôle",
        "placeholder": "Sélectionner…",
        "options": [
          "Ingénieur réseau",
          "Opérateur réseau",
          "Ingénieur systèmes",
          "Gestionnaire réseau",
          "Chercheur",
          "Autre"
        ]
      },
      "inviteType": {
        "label": "Invitation pour",
        "placeholder": "Sélectionner…",
        "slack": "Workspace Slack"
      },
      "intro": {
        "label": "Présentation",
        "placeholder": "Parlez-nous de votre expérience en réseaux et pourquoi vous souhaitez rejoindre MTLNOG."
      },
      "captcha": "Vérification"
    },
    "submit": "Envoyer →",
    "note": "Vos données ne servent qu'à évaluer votre demande.",
    "status": {
      "success": "Merci ! Votre demande a été envoyée.",
      "error": "Une erreur s'est produite. Veuillez réessayer.",
      "networkError": "Erreur réseau. Veuillez vérifier votre connexion et réessayer."
    }
  }
}
```

- [ ] **Step 2: Write `src/i18n/en.json` with full English content (identical shape)**

```json
{
  "meta": {
    "title": "MTLNOG // Montreal Network Operator Group",
    "description": "MTLNOG brings together network engineers and operators in Montréal, Quebec, and beyond to share knowledge and foster connections within the network operator community."
  },
  "nav": {
    "invite": "Request an Invite"
  },
  "hero": {
    "intro": "MTLNOG brings together network engineers and operators in Montréal, Quebec, and beyond to share knowledge and foster connections within the network operator community."
  },
  "form": {
    "sectionLabel": "Request Access",
    "heading": "Join the Community",
    "sub": "The Slack workspace is subject to approval by the MTLNOG team.",
    "fields": {
      "fname": { "label": "First Name", "placeholder": "John" },
      "lname": { "label": "Last Name", "placeholder": "Smith" },
      "email": { "label": "Email", "placeholder": "you@example.net" },
      "org": { "label": "Organization / ASN", "placeholder": "Acme Networks / AS12345" },
      "role": {
        "label": "Role",
        "placeholder": "Select…",
        "options": [
          "Network Engineer",
          "Network Operator",
          "Systems & Infrastructure Engineer",
          "Network Manager",
          "Researcher & Academic",
          "Other"
        ]
      },
      "inviteType": {
        "label": "Invitation For",
        "placeholder": "Select…",
        "slack": "Slack Workspace"
      },
      "intro": {
        "label": "Brief Introduction",
        "placeholder": "Tell us about your networking background and why you'd like to join MTLNOG."
      },
      "captcha": "Verification"
    },
    "submit": "Send →",
    "note": "Your info is used solely to review your membership request.",
    "status": {
      "success": "Thanks! Your request has been sent.",
      "error": "Something went wrong. Please try again.",
      "networkError": "Network error. Please check your connection and try again."
    }
  }
}
```

- [ ] **Step 3: Write a test asserting both dictionaries share an identical key structure**

`src/i18n/shape.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import en from './en.json';

function paths(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [`${prefix}[]`];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) =>
      paths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('dictionary shape', () => {
  it('fr and en have identical key structure', () => {
    expect(paths(fr).sort()).toEqual(paths(en).sort());
  });

  it('role options have the same count in both locales', () => {
    expect(fr.form.fields.role.options.length).toBe(en.form.fields.role.options.length);
  });
});
```

- [ ] **Step 4: Run all i18n tests**

Run: `npx vitest run src/i18n`
Expected: PASS — including the existing `utils.test.ts` (note: `getStrings('fr').meta.description` no longer equals `"fr"`).

> If `utils.test.ts` step "getStrings returns the matching dictionary" now fails because the stub values changed, update that assertion to check a stable real value:
> ```ts
> expect(getStrings('fr').nav.invite).toBe('Demander une invitation');
> expect(getStrings('en').nav.invite).toBe('Request an Invite');
> ```

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "Add full FR/EN string dictionaries with shape test"
```

---

## Task 5: SCSS stylesheet

**Files:**
- Create: `src/styles/_tokens.scss`
- Create: `src/styles/_base.scss`
- Create: `src/styles/_header.scss`
- Create: `src/styles/_hero.scss`
- Create: `src/styles/_form.scss`
- Create: `src/styles/_footer.scss`
- Create: `src/styles/_animations.scss`
- Create: `src/styles/_responsive.scss`
- Create: `src/styles/main.scss`

> This is a faithful port of the source page's inline CSS, split into partials, with the three cyan→red color fixes from the spec applied (input focus glow, button hover, `.status.success` background).

- [ ] **Step 1: Create `src/styles/_tokens.scss`**

```scss
:root {
  --bg:        #08090d;
  --surface:   #0e1018;
  --border:    #2a3048;
  --accent:    #e8162b;
  --accent2:   #ff6b35;
  --muted:     #7c8aaa;
  --text:      #dde2f2;
  --text-dim:  #9ba5c4;
  --mono:      'Share Tech Mono', monospace;
  --sans:      'DM Sans', sans-serif;
}
```

- [ ] **Step 2: Create `src/styles/_base.scss`**

```scss
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-weight: 300;
  min-height: 100vh;
  overflow-x: hidden;
}

.page {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.inner-wrap {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 2.5rem;
}

.divider-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 2.5rem;
}

.divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(to right, var(--accent) 0%, var(--border) 40%, transparent 100%);
  margin: 0 2.5rem;
  max-width: 1000px;
  align-self: center;
}
```

- [ ] **Step 3: Create `src/styles/_header.scss`**

```scss
header {
  padding: 2rem 0;
  border-bottom: 1px solid var(--border);
  animation: fadeDown 0.7s ease both;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-mark {
  height: 32px;
  width: auto;
  flex-shrink: 0;
}

.logo-text {
  font-family: var(--mono);
  font-size: 1rem;
  letter-spacing: 0.12em;
  color: var(--accent);

  span {
    color: var(--text-dim);
    font-size: 0.75rem;
    display: block;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

nav {
  display: flex;
  gap: 1.75rem;
  align-items: center;

  a {
    font-family: var(--mono);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    text-decoration: none;
    text-transform: uppercase;
    transition: color 0.2s;

    &:hover { color: var(--accent); }
  }
}

.lang-switch {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;

  a,
  span {
    text-decoration: none;
    text-transform: uppercase;
    color: var(--text-dim);
    transition: color 0.2s;
  }

  a:hover { color: var(--accent); }
  .active { color: var(--accent); }
  .sep { color: var(--muted); }
}
```

- [ ] **Step 4: Create `src/styles/_hero.scss`**

```scss
.hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 5rem 2.5rem 4rem;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

h1 {
  font-family: var(--mono);
  font-size: clamp(2.4rem, 6vw, 4.2rem);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: #fff;
  animation: fadeUp 0.7s 0.2s ease both;

  .city { color: var(--accent); }
  .slash { color: var(--muted); }
}

.hero-body {
  margin-top: 2rem;
  max-width: 580px;
  animation: fadeUp 0.7s 0.3s ease both;

  p {
    font-size: 1rem;
    line-height: 1.75;
    color: var(--text);
    margin-bottom: 0.75rem;
  }
}

.links-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2.5rem;
  animation: fadeUp 0.7s 0.4s ease both;
}

.pill {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-decoration: none;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 0.4rem 0.9rem;
  border-radius: 2px;
  transition: border-color 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &:hover { border-color: var(--accent); color: var(--accent); }

  svg { width: 13px; height: 13px; }
}
```

- [ ] **Step 5: Create `src/styles/_form.scss`** (color fixes applied)

```scss
.form-section {
  padding: 4rem 2.5rem 5rem;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  animation: fadeUp 0.7s 0.5s ease both;

  h2 {
    font-family: var(--mono);
    font-size: 1.5rem;
    font-weight: 400;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .sub {
    font-size: 0.9rem;
    color: var(--text-dim);
    margin-bottom: 2.5rem;
    line-height: 1.6;
  }
}

.section-label {
  font-family: var(--mono);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  color: var(--accent2);
  text-transform: uppercase;
  margin-bottom: 1.25rem;

  &::before {
    content: '> ';
    color: var(--muted);
  }
}

form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &.full { grid-column: 1 / -1; }
}

label {
  font-family: var(--mono);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);

  .req { color: var(--accent); margin-left: 2px; }
}

input, select, textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.85rem;
  padding: 0.65rem 0.85rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}

input:focus, select:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(232, 22, 43, 0.12);
}

select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a5270'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.85rem center;
  padding-right: 2rem;
}

select option { background: #0e1018; }

textarea { resize: vertical; min-height: 90px; }

.captcha-wrap {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 0.4rem;
}

.submit-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

button[type="submit"] {
  font-family: var(--mono);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: var(--accent);
  color: #08090d;
  border: none;
  border-radius: 2px;
  padding: 0.75rem 2rem;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.2s, transform 0.1s;

  &:hover { background: #ff2d42; }
  &:active { transform: scale(0.98); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.form-note {
  font-size: 0.78rem;
  color: var(--text-dim);
  line-height: 1.5;
}

.status {
  display: none;
  grid-column: 1 / -1;
  font-family: var(--mono);
  font-size: 0.82rem;
  padding: 0.75rem 1rem;
  border-radius: 3px;
  border-left: 3px solid;

  &.success {
    display: block;
    background: rgba(232, 22, 43, 0.06);
    border-color: var(--accent);
    color: var(--accent);
  }

  &.error {
    display: block;
    background: rgba(255, 107, 53, 0.07);
    border-color: var(--accent2);
    color: var(--accent2);
  }
}
```

- [ ] **Step 6: Create `src/styles/_footer.scss`**

```scss
footer {
  border-top: 1px solid var(--border);
  padding: 1.5rem 0;

  p {
    font-family: var(--mono);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  a {
    color: var(--muted);
    text-decoration: none;

    &:hover { color: var(--accent); }
  }
}

.footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
```

- [ ] **Step 7: Create `src/styles/_animations.scss`**

```scss
@keyframes fadeDown {
  from { opacity: 0; transform: translateY(-14px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 8: Create `src/styles/_responsive.scss`**

```scss
@media (max-width: 600px) {
  form { grid-template-columns: 1fr; }
  .field.full { grid-column: 1; }
  .captcha-wrap { grid-column: 1; }
  .submit-row { grid-column: 1; }
  nav { display: none; }
}
```

- [ ] **Step 9: Create `src/styles/main.scss`**

```scss
@use 'tokens';
@use 'base';
@use 'header';
@use 'hero';
@use 'form';
@use 'footer';
@use 'animations';
@use 'responsive';
```

- [ ] **Step 10: Commit**

```bash
git add src/styles
git commit -m "Add SCSS stylesheet ported from source with red-accent color fixes"
```

---

## Task 6: Base layout and Footer

**Files:**
- Create: `src/components/Footer.astro`
- Create: `src/layouts/Base.astro`

- [ ] **Step 1: Create `src/components/Footer.astro`**

```astro
---
// Footer is language-neutral: brand, contact email, social links.
---
<footer>
  <div class="inner-wrap footer-inner">
    <p>© 2025 MTLNOG · Montreal Network Operator Group · <a href="mailto:hello@mtlnog.org">hello@mtlnog.org</a></p>
    <p>
      <a href="https://x.com/mtlnog" target="_blank" rel="noopener">X</a> ·
      <a href="https://mastodon.social/@mtlnog" target="_blank" rel="noopener">Mastodon</a> ·
      <a href="https://www.linkedin.com/company/mtlnog/" target="_blank" rel="noopener">LinkedIn</a>
    </p>
  </div>
</footer>
```

- [ ] **Step 2: Create `src/layouts/Base.astro`**

```astro
---
import '../styles/main.scss';
import Footer from '../components/Footer.astro';
import type { Locale, Strings } from '../i18n/utils';

interface Props {
  locale: Locale;
  strings: Strings;
}

const { locale, strings } = Astro.props;
---
<!doctype html>
<html lang={locale}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{strings.meta.title}</title>
    <meta name="description" content={strings.meta.description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div class="page">
      <slot />
      <Footer />
    </div>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.astro src/layouts/Base.astro
git commit -m "Add Base layout and Footer component"
```

---

## Task 7: LanguageSwitcher component

**Files:**
- Create: `src/components/LanguageSwitcher.astro`

- [ ] **Step 1: Create `src/components/LanguageSwitcher.astro`**

```astro
---
import type { Locale } from '../i18n/utils';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
---
<div class="lang-switch">
  {locale === 'fr'
    ? <span class="active">FR</span>
    : <a href="/fr/" data-lang="fr">FR</a>}
  <span class="sep">·</span>
  {locale === 'en'
    ? <span class="active">EN</span>
    : <a href="/en/" data-lang="en">EN</a>}
</div>

<script>
  document.querySelectorAll('.lang-switch a[data-lang]').forEach((el) => {
    el.addEventListener('click', () => {
      const lang = el.getAttribute('data-lang');
      if (lang) localStorage.setItem('mtlnog-lang', lang);
    });
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LanguageSwitcher.astro
git commit -m "Add language switcher component"
```

---

## Task 8: Header component

**Files:**
- Create: `src/components/Header.astro`

- [ ] **Step 1: Create `src/components/Header.astro`**

```astro
---
import LanguageSwitcher from './LanguageSwitcher.astro';
import type { Locale, Strings } from '../i18n/utils';

interface Props {
  locale: Locale;
  strings: Strings;
}

const { locale, strings } = Astro.props;
---
<header>
  <div class="inner-wrap header-inner">
    <img class="logo-mark" src="/logo.png" alt="MTLNOG logo" width="605" height="147" />
    <div class="logo-text">
      MTLNOG
      <span>Montreal Network Operator Group</span>
    </div>
    <div class="header-actions">
      <nav>
        <a href="https://www.linkedin.com/company/mtlnog/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://mastodon.social/@mtlnog" target="_blank" rel="noopener">Mastodon</a>
        <a href="#invite">{strings.nav.invite}</a>
      </nav>
      <LanguageSwitcher locale={locale} />
    </div>
  </div>
</header>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.astro
git commit -m "Add header component with logo, nav, and switcher"
```

---

## Task 9: Hero component

**Files:**
- Create: `src/components/Hero.astro`

- [ ] **Step 1: Create `src/components/Hero.astro`**

> The X icon path is from the source page. The Mastodon and LinkedIn icon paths are the standard Simple Icons brand glyphs (24×24 viewBox), substituted for the source's collapsed-base64 inline SVGs.

```astro
---
import type { Strings } from '../i18n/utils';

interface Props {
  strings: Strings;
}

const { strings } = Astro.props;
---
<main class="hero">
  <h1>
    <span class="city">Montreal Network<br />Operator Group</span>
  </h1>
  <div class="hero-body">
    <p>{strings.hero.intro}</p>
  </div>
  <div class="links-row">
    <a class="pill" href="https://x.com/mtlnog" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.12 2.25h6.962l4.264 5.634zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      X
    </a>
    <a class="pill" href="https://mastodon.social/@mtlnog" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403H12.39V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H6.323V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.504 2.962 1.51l.638 1.07.638-1.07c.66-1.006 1.65-1.51 2.96-1.51 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/></svg>
      Mastodon
    </a>
    <a class="pill" href="https://www.linkedin.com/company/mtlnog/" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>
      LinkedIn
    </a>
  </div>
</main>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Hero.astro
git commit -m "Add hero component with intro copy and social pills"
```

---

## Task 10: InviteForm component

**Files:**
- Create: `src/components/InviteForm.astro`

- [ ] **Step 1: Create `src/components/InviteForm.astro`**

```astro
---
import type { Strings } from '../i18n/utils';

interface Props {
  strings: Strings;
}

const { strings } = Astro.props;
const f = strings.form;
---
<section class="form-section" id="invite">
  <div class="section-label">{f.sectionLabel}</div>
  <h2>{f.heading}</h2>
  <p class="sub">{f.sub}</p>

  <form
    id="invite-form"
    action="https://formspree.io/f/xjgznrjb"
    method="POST"
    novalidate
    data-success={f.status.success}
    data-error={f.status.error}
    data-network-error={f.status.networkError}
  >
    <div class="field">
      <label for="fname">{f.fields.fname.label} <span class="req">*</span></label>
      <input type="text" id="fname" name="fname" autocomplete="given-name" required placeholder={f.fields.fname.placeholder} />
    </div>

    <div class="field">
      <label for="lname">{f.fields.lname.label} <span class="req">*</span></label>
      <input type="text" id="lname" name="lname" autocomplete="family-name" required placeholder={f.fields.lname.placeholder} />
    </div>

    <div class="field">
      <label for="email">{f.fields.email.label} <span class="req">*</span></label>
      <input type="email" id="email" name="email" autocomplete="email" required placeholder={f.fields.email.placeholder} />
    </div>

    <div class="field">
      <label for="org">{f.fields.org.label}</label>
      <input type="text" id="org" name="org" placeholder={f.fields.org.placeholder} />
    </div>

    <div class="field">
      <label for="role">{f.fields.role.label} <span class="req">*</span></label>
      <select id="role" name="role" required>
        <option value="" disabled selected>{f.fields.role.placeholder}</option>
        {f.fields.role.options.map((opt) => <option>{opt}</option>)}
      </select>
    </div>

    <div class="field">
      <label for="invite-type">{f.fields.inviteType.label} <span class="req">*</span></label>
      <select id="invite-type" name="invite_type" required>
        <option value="" disabled selected>{f.fields.inviteType.placeholder}</option>
        <option value="slack">{f.fields.inviteType.slack}</option>
      </select>
    </div>

    <div class="field full">
      <label for="intro">{f.fields.intro.label}</label>
      <textarea id="intro" name="intro" placeholder={f.fields.intro.placeholder}></textarea>
    </div>

    <div class="captcha-wrap">
      <label>{f.fields.captcha} <span class="req">*</span></label>
      <div class="h-captcha" data-sitekey="7a007138-8286-449e-af82-7bd25d9ed86a" data-theme="dark"></div>
    </div>

    <div class="status" id="form-status" role="alert"></div>

    <div class="submit-row">
      <button type="submit" id="submit-btn">{f.submit}</button>
      <p class="form-note">{f.note}</p>
    </div>
  </form>
</section>

<script src="https://js.hcaptcha.com/1/api.js" async defer></script>

<script>
  const form = document.getElementById('invite-form') as HTMLFormElement | null;
  const statusEl = document.getElementById('form-status');
  const btn = document.getElementById('submit-btn') as HTMLButtonElement | null;

  if (form && statusEl && btn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.className = 'status';
      statusEl.textContent = '';
      btn.disabled = true;

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });

        if (res.ok) {
          statusEl.textContent = form.dataset.success ?? '';
          statusEl.classList.add('success');
          form.reset();
          const h = (window as unknown as { hcaptcha?: { reset: () => void } }).hcaptcha;
          if (h) h.reset();
        } else {
          const data = await res.json().catch(() => null);
          const apiMsg = data?.errors?.map((x: { message: string }) => x.message).join(', ');
          statusEl.textContent = apiMsg || form.dataset.error || '';
          statusEl.classList.add('error');
        }
      } catch {
        statusEl.textContent = form.dataset.networkError ?? '';
        statusEl.classList.add('error');
      } finally {
        btn.disabled = false;
      }
    });
  }
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/InviteForm.astro
git commit -m "Add invite form with AJAX Formspree submission and hCaptcha"
```

---

## Task 11: Localized pages

**Files:**
- Create: `src/components/HomePage.astro`
- Create: `src/pages/fr/index.astro`
- Create: `src/pages/en/index.astro`

- [ ] **Step 1: Create `src/components/HomePage.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Header from './Header.astro';
import Hero from './Hero.astro';
import InviteForm from './InviteForm.astro';
import { getStrings, type Locale } from '../i18n/utils';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const t = getStrings(locale);
---
<Base locale={locale} strings={t}>
  <Header locale={locale} strings={t} />
  <Hero strings={t} />
  <div class="divider-wrap"><div class="divider"></div></div>
  <InviteForm strings={t} />
</Base>
```

- [ ] **Step 2: Create `src/pages/fr/index.astro`**

```astro
---
import HomePage from '../../components/HomePage.astro';
---
<HomePage locale="fr" />
```

- [ ] **Step 3: Create `src/pages/en/index.astro`**

```astro
---
import HomePage from '../../components/HomePage.astro';
---
<HomePage locale="en" />
```

- [ ] **Step 4: Build and verify both pages render**

Run: `npm run build`
Expected: build succeeds; `dist/fr/index.html` and `dist/en/index.html` exist.

- [ ] **Step 5: Verify language-specific content landed in each page**

Run: `grep -l 'lang="fr"' dist/fr/index.html && grep -c "Demander une invitation" dist/fr/index.html && grep -l 'lang="en"' dist/en/index.html && grep -c "Request an Invite" dist/en/index.html`
Expected: prints `dist/fr/index.html`, `1`, `dist/en/index.html`, `1` — confirming FR copy in FR page and EN copy in EN page.

- [ ] **Step 6: Commit**

```bash
git add src/components/HomePage.astro src/pages/fr src/pages/en
git commit -m "Add localized FR and EN pages"
```

---

## Task 12: Root language-detection redirect

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Create `src/pages/index.astro`**

```astro
---
// Bare "/" entry point: client-side language detection + redirect.
// No-JS visitors get a meta-refresh to /fr/ (Quebec default) and visible links.
---
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MTLNOG</title>
    <noscript><meta http-equiv="refresh" content="0; url=/fr/" /></noscript>
  </head>
  <body>
    <p>Redirecting… <a href="/fr/">Français</a> | <a href="/en/">English</a></p>
    <script>
      import { detectLocale } from '../i18n/detect';
      const saved = localStorage.getItem('mtlnog-lang');
      const langs = navigator.languages ?? [navigator.language ?? 'en'];
      const target = detectLocale(saved, langs);
      window.location.replace(target === 'fr' ? '/fr/' : '/en/');
    </script>
  </body>
</html>
```

- [ ] **Step 2: Build and verify the root page**

Run: `npm run build`
Expected: build succeeds; `dist/index.html` exists.

- [ ] **Step 3: Verify the no-JS fallback and detection wiring are present**

Run: `grep -c 'http-equiv="refresh" content="0; url=/fr/"' dist/index.html && grep -c 'detectLocale\|location.replace\|/fr/\|/en/' dist/index.html`
Expected: first count is `1`; second count is `>= 1` (the detection script is bundled — the literal `detectLocale` name may be minified away, but the `/fr/` and `/en/` redirect targets remain). If the second `grep` returns 0, open `dist/index.html` and confirm a bundled `<script type="module">` referencing the redirect targets is present.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "Add root language-detection redirect page"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all Vitest tests pass.

- [ ] **Step 2: Clean build**

Run: `rm -rf dist && npm run build`
Expected: success; `dist/` contains `index.html`, `fr/index.html`, `en/index.html`, `logo.png`, and a hashed CSS file under `dist/_astro/`.

- [ ] **Step 3: Confirm CSS compiled from SCSS and the color fix shipped**

Run: `cat dist/_astro/*.css | grep -c '232,22,43\|232, 22, 43\|#ff2d42' && cat dist/_astro/*.css | grep -c '0,229,255\|0, 229, 255\|#33ecff'`
Expected: first count `>= 1` (red fixes present); second count `0` (no cyan remains).

- [ ] **Step 4: Manual smoke test in a browser**

Run: `npm run preview`
Then open the printed URL and verify manually:
- `/` redirects to `/fr/` or `/en/` based on browser language; using the switcher and reloading `/` honors the saved choice (`localStorage` key `mtlnog-lang`).
- `/fr/` shows French throughout with `<html lang="fr">`; `/en/` shows English with `<html lang="en">`.
- Switcher toggles between the two and the inactive locale is a working link.
- Resize to ≤600px: form collapses to one column, social nav links hide, the **FR · EN switcher stays visible**.
- Submitting the form shows a localized inline success/error message without leaving the page (hCaptcha must be completed first).
- No cyan flashes on input focus, button hover, or success status — all red.

Stop preview with Ctrl-C when done.

- [ ] **Step 5: Final commit (if any verification fixes were made)**

```bash
git add -A
git commit -m "Verify build and finalize MTLNOG Astro site"
```

---

## Self-Review

**Spec coverage:**
- SSG = Astro → Task 1. ✓
- Both locales prefixed `/fr/` `/en/`, `/` redirects → Tasks 11, 12. ✓
- Language switcher + persistence + browser detection → Tasks 7, 12 (+ tested logic in Task 3). ✓
- SCSS-compiled CSS, responsive layout preserved → Task 5 (+ verified Task 13). ✓
- Form via AJAX with inline localized status, Formspree + hCaptcha kept → Task 10. ✓
- Logo extracted to file → Task 2. ✓
- Color alignment (3 cyan→red fixes) → Task 5 (+ verified Task 13 step 3). ✓
- Per-language `<html lang>` + localized `<title>`/description → Tasks 6, 11. ✓
- YAGNI (no CMS/extra pages/islands) → respected. ✓

**Placeholder scan:** No "TBD"/"implement later"; every code step contains complete content. Mastodon/LinkedIn SVG paths are concrete (Simple Icons); X path from source. Note about possible `utils.test.ts` assertion update in Task 4 step 4 is explicit with the exact replacement code.

**Type consistency:** `Locale`/`Strings` defined in Task 3, imported consistently in Tasks 6–11. `detectLocale(saved, navigatorLanguages)` signature matches its call site in Task 12. `getStrings`/`otherLocale`/`isLocale` names consistent throughout. Form `data-*` attributes (`data-success`/`data-error`/`data-network-error`) set in Task 10 markup match `form.dataset.success`/`.error`/`.networkError` reads in the same task's script. CSS class names (`.header-actions`, `.lang-switch .active`, `.divider-wrap`) defined in Task 5 match markup in Tasks 7, 8, 11.

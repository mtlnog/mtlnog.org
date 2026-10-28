# Team, Sponsorship and Meetings Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bilingual Meetings, Team and Sponsorship pages to the MTLNOG site, with a shared nav and a language switcher that stays on the same page.

**Architecture:** One page component per new page, rendered by one-line route files under `src/pages/{fr,en}/`. A route map (`src/i18n/routes.ts`) is the single source of truth for URLs. All prose lives in `src/i18n/{fr,en}.json`. Non-translated facts (numbers, emails, dates, social URLs) live in small modules under `src/data/`.

**Tech Stack:** Astro 5 (static), TypeScript strict, SCSS partials, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-team-sponsorship-meetings-pages-design.md`. Read it first. All page copy comes from it.

## Global Constraints

- **Branch:** work on `pages`, which already holds the spec.
- **Commit messages:** plain imperative subject lines like the existing history (for example `Add meetings page`). No `feat:` prefixes, and no attribution or Co-Authored-By lines.
- **Phone numbers:** never write the organizers' phone numbers anywhere in the repo.
- **URLs:** `/fr/` `/en/`, `/fr/rencontres/` `/en/meetings/`, `/fr/equipe/` `/en/team/`, `/fr/commandites/` `/en/sponsorship/`.
- **Sponsorship links:** sponsorship CTAs link to `/{locale}/?type=sponsorship#invite`.
- **Invite links:** "Request an invite" links to `/{locale}/#invite`.
- **Social URLs:**
  - Bluesky: `https://bsky.app/profile/mtlnog.org`
  - LinkedIn: `https://www.linkedin.com/company/mtlnog/`
  - Mastodon: `https://mastodon.social/@mtlnog`
  - X: `https://x.com/mtlnog`
- **Money format:** EN `$5,000`, FR `5 000 $`. Use CAD and no decimals.
- **Language parity:** every new string goes into both `fr.json` and `en.json` (the shape test enforces matching keys). The French sponsorship and meetings copy is your translation, and it uses "commandite/commanditaire".
- **Styling:** use the existing tokens in `src/styles/_tokens.scss`, with no new colors except the Gold tier border (`#c9a227`) and Gold name (`#e6c34a`) from the approved mockup.
- **Build env:** builds need dummy env vars, as in CI. Every build command below uses `PUBLIC_FORMSPREE_ID=ci-dummy PUBLIC_HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000001`.
- **Code style:** no trailing whitespace, and every file ends with a newline.

## Review Focus

1. **Phone width (≤600px):** the nav bar is visible and usable, and no page scrolls horizontally. The home page currently hides `nav` at ≤600px, which Task 2 must change.
2. **Language switch from a new page:** it lands on that page's counterpart, never on the home page. Task 1 tests the route map; Task 7 greps the built HTML.
3. **Unexpected `?type=` values:** `?type=SPONSORSHIP`, `?type=foo`, `?type=` or a missing parameter leaves the invite-type select on its placeholder. Task 3 tests this.
4. **English left on a French page:** a French string copied unchanged from English. Task 4 adds the test, and Tasks 5 and 6 extend it.
5. **A meeting dated today:** it is still "upcoming" on build day. Task 4 tests this.

---

### Task 1: Route map and text helpers

**Files:**
- Create: `src/i18n/routes.ts`, `src/i18n/routes.test.ts`
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `type PageKey = 'home' | 'meetings' | 'team' | 'sponsorship'`
  - `routes: Record<PageKey, Record<Locale, string>>`
  - `pathFor(page: PageKey, locale: Locale): string`
  - `inviteHref(locale: Locale): string`
  - `sponsorFormHref(locale: Locale): string`
  - `formatCad(amount: number, locale: Locale): string`
  - `monthName(month: number, locale: Locale): string`: `month` runs 1–12, and the result is capitalized.
  - `monthYear(isoMonth: string, locale: Locale): string`: `'2026-10'` becomes "October 2026" or "Octobre 2026".
  - `fill(template: string, vars: Record<string, string | number>): string`: replaces each `{key}` with its value.
  - `initials(name: string): string`

- [ ] **Step 1: Write failing tests**

`routes.test.ts`:
```ts
expect(pathFor('home', 'fr')).toBe('/fr/');
expect(pathFor('meetings', 'fr')).toBe('/fr/rencontres/');
expect(pathFor('meetings', 'en')).toBe('/en/meetings/');
expect(pathFor('team', 'fr')).toBe('/fr/equipe/');
expect(pathFor('team', 'en')).toBe('/en/team/');
expect(pathFor('sponsorship', 'fr')).toBe('/fr/commandites/');
expect(pathFor('sponsorship', 'en')).toBe('/en/sponsorship/');
expect(inviteHref('en')).toBe('/en/#invite');
expect(sponsorFormHref('fr')).toBe('/fr/?type=sponsorship#invite');
// every page has both locales and all paths are unique
expect(new Set(Object.values(routes).flatMap((r) => [r.fr, r.en])).size).toBe(8);
```

`format.test.ts` (normalize spaces, because Intl emits U+00A0/U+202F):
```ts
const n = (s: string) => s.replace(/\s/g, ' ');
expect(n(formatCad(5000, 'en'))).toBe('$5,000');
expect(n(formatCad(5000, 'fr'))).toBe('5 000 $');
expect(n(formatCad(250, 'fr'))).toBe('250 $');
expect(monthName(3, 'fr')).toBe('Mars');
expect(monthName(10, 'en')).toBe('October');
expect(monthYear('2026-10', 'fr')).toBe('Octobre 2026');
expect(fill('limited to {n} sponsors', { n: 2 })).toBe('limited to 2 sponsors');
expect(fill('no vars', {})).toBe('no vars');
expect(initials('Jonathan Senecal')).toBe('JS');
expect(initials('Eric Dugas')).toBe('ED');
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run src/i18n/routes.test.ts src/lib/format.test.ts`. Expect a FAIL, because the modules don't exist yet.

- [ ] **Step 3: Implement the two modules.**
  - `formatCad`: use `Intl.NumberFormat` with `en-CA`/`fr-CA`, `style: 'currency'`, `currency: 'CAD'`, `maximumFractionDigits: 0`. If `en-CA` renders `CA$`, use `currencyDisplay: 'narrowSymbol'`.
  - `monthName` and `monthYear`: use `Intl.DateTimeFormat` with a UTC date, then uppercase the first character.

- [ ] **Step 4: Run all tests.** Run `npm test`. Expect everything to PASS.

- [ ] **Step 5: Commit.** Run `git add src/i18n/routes* src/lib/format*`, then `git commit -m "Add route map and text formatting helpers"`.

---

### Task 2: Shared site navigation, language switcher and Bluesky links

**Files:**
- Create: `src/data/social.ts`
- Modify:
  - `src/layouts/Base.astro`: props become `{ locale, strings, page: PageKey, title?: string, description?: string }`. `title` and `description` fall back to `strings.meta.*`.
  - `src/components/Header.astro`: takes `page`. The logo links to `pathFor('home', locale)`. The nav shows Meetings, Team and Sponsorship via `pathFor`, plus `strings.nav.invite` linking to `inviteHref(locale)`. The current page gets `class="active"` and `aria-current="page"`. The LinkedIn and Mastodon links are removed from the header.
  - `src/components/LanguageSwitcher.astro`: takes `page`. The other-language link uses `pathFor(page, otherLocale(locale))`.
  - `src/components/HomePage.astro`: pass `page="home"`.
  - `src/components/Hero.astro`, `src/components/Footer.astro`: render the social links from `social.ts` and add Bluesky. The Hero pill uses the Simple Icons "bluesky" SVG path.
  - `src/i18n/{fr,en}.json`: add `nav.meetings` ("Rencontres"/"Meetings"), `nav.team` ("Équipe"/"Team") and `nav.sponsorship` ("Commandites"/"Sponsorship").
  - `src/styles/_header.scss`, `src/styles/_responsive.scss`: remove `nav { display: none; }`. At ≤600px the nav wraps onto its own row under the logo, and links stay ≥ 0.72rem. Style `nav a.active` with `color: var(--accent)`.

**Interfaces:**
- Consumes (Task 1): `PageKey`, `pathFor`, `inviteHref`, `otherLocale`.
- Produces:
  - `social: readonly { name: 'Bluesky' | 'LinkedIn' | 'Mastodon' | 'X'; url: string }[]`, using the URLs from Global Constraints, in the order X, Bluesky, Mastodon, LinkedIn.
  - `Base` and `Header` props as listed above. Every later page passes `page`.

- [ ] **Step 1: Write a failing test.** Add a test to `src/i18n/utils.test.ts` asserting `getStrings('fr').nav.team === 'Équipe'` and `getStrings('en').nav.sponsorship === 'Sponsorship'`.
- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/i18n/utils.test.ts`. Expect a FAIL.
- [ ] **Step 3: Make the changes listed under Files.**
- [ ] **Step 4: Run tests and build.** Run `npm test`, then the build with the dummy env from Global Constraints. Expect PASS. Then check the built home page:
  - `grep -o 'href="/en/team/"' dist/en/index.html` prints one match.
  - `grep -c bsky.app dist/fr/index.html` prints at least `1`.
- [ ] **Step 5: Commit.** `git commit -am "Add site navigation, page-aware language switcher and Bluesky links"`, after `git add src/data/social.ts`.

---

### Task 3: Pre-select invite type from `?type=`

**Files:**
- Create: `src/lib/inviteType.ts`, `src/lib/inviteType.test.ts`
- Modify: `src/components/InviteForm.astro` (client script)

**Interfaces:**
- Produces:
  - `INVITE_TYPES = ['slack', 'sponsorship'] as const`
  - `type InviteType = (typeof INVITE_TYPES)[number]`
  - `inviteTypeFromSearch(search: string): InviteType | null`

- [ ] **Step 1: Write failing tests.**
```ts
expect(inviteTypeFromSearch('?type=sponsorship')).toBe('sponsorship');
expect(inviteTypeFromSearch('?type=slack&x=1')).toBe('slack');
expect(inviteTypeFromSearch('?type=SPONSORSHIP')).toBeNull();
expect(inviteTypeFromSearch('?type=foo')).toBeNull();
expect(inviteTypeFromSearch('?type=')).toBeNull();
expect(inviteTypeFromSearch('')).toBeNull();
```
- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/lib/inviteType.test.ts`. Expect a FAIL.
- [ ] **Step 3: Implement the function with `URLSearchParams`.** In the form script, on load, if the result isn't null, set `#invite-type`'s `value` to it. The `<option value>`s in `InviteForm.astro` must use `INVITE_TYPES`, so the values can't drift.
- [ ] **Step 4: Run tests and build.** Run `npm test` and the build. Expect PASS.
- [ ] **Step 5: Commit.** `git add src/lib/inviteType* src/components/InviteForm.astro && git commit -m "Pre-select invite type from the type query parameter"`.

---

### Task 4: Meetings page

**Files:**
- Create:
  - `src/data/meetings.ts`, `src/data/meetings.test.ts`
  - `src/components/MeetingsPage.astro`
  - `src/pages/fr/rencontres.astro`, `src/pages/en/meetings.astro`
  - `src/styles/_pages.scss`: shared page header, sections and `.empty-state` dashed box, from the mockup.
  - `src/i18n/translated.test.ts`
- Modify: `src/styles/main.scss` (`@use 'pages'`), `src/i18n/{fr,en}.json`

**Interfaces:**
- Consumes: `Base` and `Header` (Task 2), `pathFor` and `inviteHref` (Task 1).
- Produces:
  - `interface Meeting { date: string /* YYYY-MM-DD */; title: string; venue: string; url?: string }`
  - `meetings: Meeting[]`: empty for now.
  - `splitMeetings(list: Meeting[], today: string): { upcoming: Meeting[]; past: Meeting[] }`: upcoming is ascending, past is descending.
  - The `.page-header`, `.page-section` and `.empty-state` classes from `_pages.scss`, which Tasks 5 and 6 reuse.

**Strings:** add a `meetings` key with this structure:

```
meetings: {
  meta: { title, description },
  label, heading, intro,
  upcoming: { heading, emptyTitle, emptyText, emptyLink },
  past: { heading, emptyTitle, emptyText, emptyLink },
}
```

- **English copy:** exactly as written in the spec's "Meetings page" section.
- **French copy:** your translation.

**Page structure:**
- The sections are `id="upcoming"` and `id="past"`.
- When a list is empty, the section shows `.empty-state`:
  - In Upcoming, the link goes to `inviteHref(locale)`.
  - In Past, it goes to `pathFor('sponsorship', locale)`.
- When a list isn't empty, render a minimal list (date, title, venue). This branch is untested and has no extra styling.

- [ ] **Step 1: Write failing tests.**

`meetings.test.ts`:
```ts
const a = { date: '2027-03-18', title: 'A', venue: 'V' };
const b = { date: '2026-01-10', title: 'B', venue: 'V' };
const c = { date: '2027-10-01', title: 'C', venue: 'V' };
const { upcoming, past } = splitMeetings([c, b, a], '2027-03-18');
expect(upcoming.map((m) => m.title)).toEqual(['A', 'C']); // today counts as upcoming
expect(past.map((m) => m.title)).toEqual(['B']);
expect(splitMeetings([], '2027-01-01')).toEqual({ upcoming: [], past: [] });
```

`translated.test.ts` walks every string leaf under each section in `const SECTIONS = ['meetings']` and asserts that `fr` differs from `en`, except for paths listed in `const SAME_IN_BOTH: string[] = []`. On failure, the error names the offending path.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run src/data src/i18n`. Expect a FAIL.
- [ ] **Step 3: Implement the data module, strings, component, route files and styles.**
- [ ] **Step 4: Run tests and build, then check the output.** Run `npm test` and the build. Expect PASS. Then check that:
  - `dist/fr/rencontres/index.html` and `dist/en/meetings/index.html` exist.
  - The French page's language-switcher link is `/en/meetings/`.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "Add meetings page with upcoming and past sections"`.

---

### Task 5: Team page

**Files:**
- Create:
  - `src/data/team.ts`
  - `src/components/TeamPage.astro`
  - `src/pages/fr/equipe.astro`, `src/pages/en/team.astro`
  - `src/styles/_team.scss`
- Modify:
  - `src/styles/main.scss`, `src/styles/_responsive.scss`: at ≤600px, the photo stacks above the text.
  - `src/i18n/{fr,en}.json`
  - `src/i18n/translated.test.ts`: add `'team'` to `SECTIONS`.

**Interfaces:**
- Consumes: `initials` (Task 1), `social` (Task 2), and `.page-header` and `.page-section` (Task 4).
- Produces:
  - `interface TeamMember { id: 'eric' | 'jonathan' | 'denis'; name: string; email: string; photo?: string }`
  - `team: readonly TeamMember[]`, in the order Eric Dugas, Jonathan Senecal, Denis Bonneau, with emails `eric@`, `jonathan@` and `denis@mtlnog.org`.

**Strings:** add a `team` key with this structure:

```
team: {
  meta: { title, description },
  label, heading, followUs,
  members: {
    eric: { role, bio },
    jonathan: { role, bio },
    denis: { role, bio },
  },
}
```

- **Roles and bios:** exactly as in the spec's Team section and Appendix B, with the corrections already applied there.
- **Heading:** EN "The people behind MTLNOG". FR is your translation.

**Page structure:**
- **Each person:** a photo slot (`<img src={photo}>` when `photo` is set, otherwise an initials tile), then name, role, bio, and a `mailto:` link to their email. No phone numbers.
- **Social links:** the `social` list renders under the team.

- [ ] **Step 1: Write a failing test.** Add `'team'` to `SECTIONS` in `translated.test.ts`, then run `npx vitest run src/i18n`. Expect a FAIL, because the `team` keys are missing.
- [ ] **Step 2: Implement the data module, strings, component, route files and styles.**
- [ ] **Step 3: Run tests and build, then check the output.** Run `npm test` and the build. Expect PASS. Then:
  - `grep -c 'mailto:' dist/en/team/index.html` prints `3`.
  - `grep -rE '514[- ]?(531|710|510)' dist src` prints nothing.
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "Add team page"`.

---

### Task 6: Sponsorship page

**Files:**
- Create:
  - `src/data/sponsorship.ts`
  - `src/components/SponsorshipPage.astro`
  - `src/pages/fr/commandites.astro`, `src/pages/en/sponsorship.astro`
  - `src/styles/_sponsorship.scss`
- Modify:
  - `src/styles/main.scss`, `src/styles/_responsive.scss`: at ≤600px, the tiers stack and the stats show in 2 columns.
  - `src/i18n/{fr,en}.json`
  - `src/i18n/shape.test.ts`: assert that `sponsorship.tiers.gold.bullets`, `sponsorship.tiers.silver.bullets`, `sponsorship.mission` and `sponsorship.closing.paragraphs` have the same length in `fr` and `en`.
  - `src/i18n/translated.test.ts`: add `'sponsorship'` to `SECTIONS`, and add the tier names to `SAME_IN_BOTH` only if the French uses the same words.

**Interfaces:**
- Consumes: `formatCad`, `monthName`, `monthYear`, `fill`, `sponsorFormHref` and `pathFor` (Task 1); `.page-*` (Task 4).
- Produces:
```ts
export const sponsorship = {
  year: 2027,
  statsDate: '2026-10',
  stats: { members: 115, weeklyActive: 36, monthlyMessages: 1600, industries: 7 },
  months: [3, 8, 10],
  tiers: { gold: { price: 5000, limit: 2 }, silver: { price: 2500, limit: 8 } },
  costs: { meeting: 1000, food: 750, organization: 250, swagFirstBatch: 750 },
} as const;
```

**Strings:** add a `sponsorship` key with this structure. Templates use `{year}`, `{date}` and `{n}`, filled with `fill`:

```
sponsorship: {
  meta: { title, description },
  label, heading, missionHeading, mission: [p1, p2], cta,
  stats: { label, members, weeklyActive, monthlyMessages, industries, industriesLine },
  program: { label, intro, schedule, tentative },
  tiers: {
    label, perYear, limit,
    gold: { name, bullets: [] },
    silver: { name, bullets: [] },
  },
  venue: { label, text },
  costs: {
    label,
    meeting: { name, text },
    food: { name, text },
    organization: { name, text },
    swag: {
      heading, intro,
      first: { name, text },
      second: { name, amount, text },
    },
  },
  closing: { heading, paragraphs: [], cta, note },
}
```

- **English copy:** exactly as in the spec's Appendix A, with the corrections applied, and with the section labels from the spec's "Section order".
- **French copy:** your translation.
- **Numbers:** prices and counts come from `sponsorship.ts`, never from the strings.

**Page structure:**
- **Order:** follow the spec's seven sections in order.
- **Gold card:** add `.tier-gold`, with border `#c9a227` and name `#e6c34a`.
- **Buttons:** both "Become a sponsor" and "Contact us" link to `sponsorFormHref(locale)`.
- **"Upcoming/Past meetings" in the tier bullets:** these link to `pathFor('meetings', locale) + '#upcoming'` and `'#past'`, as the spec requires. Mark the linked phrase in the string with a placeholder, for example `{upcoming}`, and render the link in the component, so the JSON stays plain text.

- [ ] **Step 1: Write failing tests.** Add the shape-test length assertions and the `'sponsorship'` entry in `SECTIONS`. Run `npx vitest run src/i18n` and expect a FAIL.
- [ ] **Step 2: Implement the data module, strings, component, route files and styles.**
- [ ] **Step 3: Run tests and build, then check the output.** Run `npm test` and the build. Expect PASS. Then:
  - `grep -o 'href="/fr/?type=sponsorship#invite"' dist/fr/commandites/index.html | wc -l` prints `2`.
  - `grep -c '5 000' dist/fr/commandites/index.html` prints at least `1`.
  - `grep -ci 'diamond\|platinum' dist/en/sponsorship/index.html` prints `0`.
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "Add sponsorship page"`.

---

### Task 7: Final verification and docs

**Files:**
- Modify: `README.md`: one short section listing the pages, and which `src/data/*.ts` file to edit each year (sponsorship numbers, meetings, team photos).

- [ ] **Step 1: Run tests and build.** Run `npm test` and the build. Expect all tests to PASS and the build to complete with 8 pages plus the root redirect.
- [ ] **Step 2: Check the language switcher in the built output.** For each pair (home, meetings, team, sponsorship), the French page's other-language link points to the English counterpart and vice versa. Script it with `grep -o 'data-lang="en" href="[^"]*"'` or similar on each `dist/fr/**/index.html`.
- [ ] **Step 3: Check that no phone numbers were published.** Run `grep -rE '514[- ]?(531|710|510)' dist src docs`. Expect only the spec to match, if anything, and nothing in `dist` or `src`.
- [ ] **Step 4: Do a visual check at phone width.** Run `mise run preview` (it binds to all interfaces) and ask the user to open `http://100.71.215.112:4321/fr/commandites/` and the other pages on a phone. Confirm the nav is visible and nothing scrolls horizontally.
- [ ] **Step 5: Commit.** `git commit -am "Document pages and yearly data updates"`.

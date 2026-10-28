# Pages and content

| Page | French | English |
|---|---|---|
| Home + contact form | `/fr/` | `/en/` |
| Events | `/fr/evenements/` | `/en/events/` |
| Team | `/fr/equipe/` | `/en/team/` |
| Sponsorship | `/fr/commandites/` | `/en/sponsorship/` |

URLs are defined once in `src/i18n/routes.ts`. All page text lives in `src/i18n/{fr,en}.json`; any new string goes in both files (a test checks they match).

The old `/fr/rencontres/` and `/en/meetings/` URLs redirect to the Events page (`public/_redirects`).

## Data that changes over time

Facts that change over time live in `src/data/`:

- `sponsorship.ts`: program year, stats and their date, event months, tier prices and limits. Update it each year.
- `meetings.ts`: add an event (`date`, `title`, `venue`, optional `url`) to the Events page; it shows under Upcoming until its date passes, then under Past on the next build.
- `team.ts`: members. Email addresses are deliberately not published. To add a photo, put it in `public/team/` and set `photo: '/team/<name>.jpg'`; until then the page shows initials.
- `social.ts`: social links used in the hero, footer and Team page.

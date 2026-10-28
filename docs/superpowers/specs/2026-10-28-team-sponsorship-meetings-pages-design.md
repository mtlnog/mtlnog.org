# Team, Sponsorship and Meetings pages: design

Date: 2026-10-28
Branch: `pages`

## Intent

The MTLNOG site is a single bilingual landing page with an invite form. MTLNOG is now asking companies to sponsor its 2027 in-person meetings, so the site needs a page sponsors can read and act on. It also needs pages to introduce the organizers, and to list upcoming and past meetings, because the sponsorship tiers promise logos and mentions on those pages.

## Goals

- **Sponsorship page:** a page that walks a company through the 2027 program and leads it to the invite form with "Sponsorship" already selected.
- **Team page:** introduces the three organizers with their bios and @mtlnog.org email.
- **Meetings page:** has "Upcoming meetings" and "Past meetings" sections. Both are empty today and must look intentional, not broken.
- **Navigation:** a nav bar on every page that links to each page, and a language switcher that keeps the visitor on the same page in the other language.
- **Languages:** every page in French and English, like the rest of the site.

## Non-goals

- Displaying sponsor logos. There are no sponsors yet. Add this when there is one.
- Showing real meeting entries. None exist yet.
- Organizer photos. They come later; the layout must accept them without a redesign.
- Payment, invoicing, or any sponsorship flow beyond the existing form.
- The Turnstile change (separate `turnstile` branch).

## Anti-goals (failure even if it "works")

- **Phone numbers:** the organizers' phone numbers appear anywhere on the site. They were supplied but must not be published.
- **Untranslated French:** French pages show English text, or vice versa.
- **Broken form or language links:** the home page form behaves differently for its existing users, or the "Request an invite" link stops working from the new pages.
- **Mobile:** layouts that overflow or break at phone width.

## Constraints

- **Stack:** Astro static output, SCSS partials, strings in `src/i18n/{fr,en}.json` with identical key structure (enforced by `src/i18n/shape.test.ts`). Follow the existing patterns in `CLAUDE.md`.
- **Style:** the existing dark visual style. Use the tokens in `_tokens.scss`: mono headings, `--accent` red, `--accent2` orange section labels. The approved mockups follow this style (see "Approved mockups").
- **Routing:** `fr` is the default locale and every page lives under `/fr/…` and `/en/…`.

## What was decided

### Pages and URLs

| Page | French | English |
|---|---|---|
| Home (existing) | `/fr/` | `/en/` |
| Meetings | `/fr/rencontres/` | `/en/meetings/` |
| Team | `/fr/equipe/` | `/en/team/` |
| Sponsorship | `/fr/commandites/` | `/en/sponsorship/` |

French slugs are my call. The language switcher must map each page to its counterpart, for example `/fr/equipe/` ↔ `/en/team/`, instead of always going to the home page.

### Navigation (my call)

The header nav gets four links: Meetings, Team, Sponsorship, and the existing "Request an invite".

- **"Request an invite" link:** it points to `/{locale}/#invite`, so it works from every page.
- **Social links:** the LinkedIn and Mastodon links currently in the header nav move out to make room. They stay in the hero and footer.
- **Current page:** the active page is highlighted.
- **Phone width:** the nav must work. Wrapping or a compact layout is the builder's choice; no hamburger menu is required.

### Sponsorship page

**Content:** the user's 2027 sponsorship document, kept nearly verbatim (Appendix A). It is the full text, not a summary.

**Section order (approved in mockup v2):**
1. **Header and mission:** a label "Sponsorship 2027 · BBQ & meetings", the title, both mission paragraphs, and a "Become a sponsor" button.
2. **Statistics (October 2026):** stat tiles for 115 total members, 36 weekly active, ~1,600 messages/month and 7 industries, followed by the industries line.
3. **Sponsorship program 2027:** the intro paragraph, the "three events… March, August and October" sentence, and three month tiles marked "tentative".
4. **Tiers:** Gold and Silver side by side, with price, "yearly · limited to N sponsors", and every bullet from the document. The Gold card is visually distinguished (gold border).
5. **Venue:** the venue paragraph as a callout.
6. **Projected costs per meeting (approximately 20–25 people):** each line has its amount and full description: meeting expenses $1,000, food and beverages $750 including the RACJ alcohol sentence, and organization fee $250. Then a Swag subsection: the intro paragraph, the first batch at $750, and the second batch marked "subject to sponsorship".
7. **Closing:** both closing paragraphs, a "Contact us" button, and the "subject to revision" note in small italic text.

**Corrections to the source text** (user-approved):
- **Gold bullets:** "Priority placement… (over Platinum and Gold sponsors)" becomes "Priority placement of your company logo/presence with banners (provided by the sponsor)", and "as MTLNOG's Diamond partner" becomes "as MTLNOG's Gold partner".
- **Second swag batch:** "for the second 2027 meeting" becomes "for a later 2027 meeting".

**Calls to action:** both buttons go to `/{locale}/?type=sponsorship#invite`. On load, the home page form reads the `type` query parameter. If the value matches an option of the invite-type select (`slack` or `sponsorship`), it pre-selects that option. Any other value is ignored.

**French text:** the source is English only. The builder writes the French version, and the user will review it. Use "commandite/commanditaire" (the form already says "Commandite").

**Data layout (my call):**
- **Prose:** goes in the i18n JSON files.
- **Numbers that change yearly** (stats and stats date, the three months, tier prices and limits, cost amounts): go in one shared, non-translated data module, so next year's update is a single small edit.
- **Money formatting:** `$5,000` in English and `5 000 $` in French.

### Team page

**Content:** the three organizers, in this order: Eric Dugas, Jonathan Senecal, Denis Bonneau. Each has a picture slot, name, role, bio, and a `mailto:` link to their @mtlnog.org address. The bios are verbatim per language (Appendix B).

**Roles:**

| Name | EN | FR |
|---|---|---|
| Eric Dugas | Co-founder | Cofondateur |
| Jonathan Senecal | Co-founder | Cofondateur |
| Denis Bonneau | Ad Hoc Director | Directeur ad hoc |

**Spelling:** "Co Fondateur" in the French bios becomes "Cofondateur".

**Eric's English bio:** "a federally incorporated non-profit organization created in 2021" becomes "a non-profit organization founded in 2019 and federally incorporated in 2021" (my call), so it doesn't contradict the 2019 founding. The French "constitué en 2021" already means incorporated and stays.

**Photos:** each person has an optional photo. When it is absent, the slot shows the person's initials, in mono type on a bordered dark tile (mockup). Adding a photo later should only mean dropping an image in and setting one field.

**Not shown:** phone numbers (anti-goal).

**Social links:** the MTLNOG social links appear below the team: Bluesky (`https://bsky.app/profile/mtlnog.org`), LinkedIn (`https://www.linkedin.com/company/mtlnog/`), Mastodon (`https://mastodon.social/@mtlnog`) and X (`https://x.com/mtlnog`). Bluesky is also added next to the other social links in the existing hero and footer (my call), since the sponsorship tiers promise posts there.

**Founding facts** (user-confirmed): MTLNOG was established in 2019 and federally incorporated on 2021-06-07. The sponsorship text's "established in 2019" stays.

### Meetings page

**Sections:** "Upcoming meetings" and "Past meetings", each with an empty state shown as a dashed box. The wording below was approved in mockup `meetings-v1.html` (left side); translate it to French:
- **Intro:** "MTLNOG brings network operators together in person a few times a year. Three meetings are being planned for 2027."
- **Upcoming, empty:** "No meeting scheduled yet" / "Dates are announced in the Slack workspace first." / a "Request an invite →" link to `/{locale}/#invite`.
- **Past, empty:** "No past meetings yet" / "Our first in-person meeting is coming in 2027." / a "Sponsor a meeting →" link to the Sponsorship page.

The right side of that mockup (meeting cards with sponsor logos) shows a future direction only and is out of scope.

**Single page (my call):** both sections share one page, with `#upcoming` and `#past` anchors. The sponsorship tiers' references to the "Upcoming meetings" and "Past meetings" pages point at those anchors.

**Data:** a meetings data list, empty for now, drives both sections, split into upcoming and past by date. The builder picks a minimal entry shape: date, title, venue, optional link.

### Per-page metadata

Each new page gets its own `<title>` and meta description in both languages. The builder writes them.

## Left to the builder

- **Components:** how pages and components are split, and how the language switcher learns the counterpart URL.
- **Spacing and layout:** exact spacing and responsive breakpoints, staying consistent with existing partials.
- **Tests:** add unit tests for any new pure logic, such as the query-parameter pre-select and the locale route map. The existing shape test must keep passing. Tests and build must pass.

## Approved mockups

The mockups are in `.superpowers/brainstorm/1130813-1793154967/content/`, which is local and not committed:
- `sponsorship-v2.html`: the approved sponsorship layout.
- `team-v1.html`: the approved team layout.
- `meetings-v1.html`: the approved meetings layout (left side).

## Appendix A: sponsorship source text (English, corrections applied)

> **Mission.** MTLNOG is a non-profit organization established in 2019 with the aim of fostering coordination and collaboration among network operators in the greater Montreal area. Our mission is to facilitate knowledge sharing and professional development among networking professionals from diverse industries. We strive to promote meaningful partnerships and collaborations among our members to address common challenges and achieve shared objectives in network operations. Additionally, we are dedicated to engaging with the broader community, including students and professionals in the IT field, to raise awareness about networking technologies and create a platform for community interaction, partnership and learning.
>
> **Statistics (October 2026).** Total members: 115. Weekly active: 36. Monthly messages posted: ~1600. Industries: ISPs, NSPs, MSPs, gaming, education, government, network vendors.
>
> **Sponsorship program (2027).** To ensure the success of our in-person meetings, we have developed a comprehensive sponsorship program. This program aims to secure financial support from sponsors, partners, and donors to cover the costs associated with organizing and hosting these events. For the year 2027, we are planning three events tentatively scheduled for March, August and October.
>
> **Venue.** To minimize expenses, we are seeking sponsors, partners, and donors who can provide meeting spaces free of charge. As per our current sponsorship plans, renting meeting spaces is not financially feasible. We greatly appreciate any support in this regard.
>
> **Cost breakdown per meeting (approximately 20–25 people).**
> - Meeting expenses, $1,000: This includes various costs associated with organizing the event, such as administrative fees, logistical arrangements, and any necessary equipment or supplies.
> - Food and beverages, $750 (non-alcoholic): To ensure a comfortable and engaging environment for attendees, we will provide quality food and non-alcoholic beverages. These provisions contribute to the overall meeting experience. Alcoholic beverages may be provided (for free) if the venue allows for it without a permit from the Régie des alcools, des courses et des jeux (RACJ).
> - Organization fee, $250: This fee covers the expenses associated with managing and coordinating the event, including pre-event planning, logistics, and on-site support. It helps ensure the smooth execution of the meeting.
>
> **Swag.** To foster a sense of unity and pride among participants, we plan to provide event-specific merchandise, such as t-shirts, as part of the sponsorship program. Everybody loves swag.
> - First batch of swag, $750 (approximately 20–25 people): We will collaborate with an existing local partner to produce the initial batch of t-shirts. These shirts will serve as mementos for participants, highlighting their participation in the event.
> - Second batch of swag (subject to sponsorship): If we secure sufficient sponsors, we aim to produce an additional batch of t-shirts for a later 2027 meeting. This will allow us to extend the opportunity for participants to receive personalized event merchandise.
>
> **Gold sponsorship: $5,000 (yearly), limited to 2 sponsors.**
> - Valid for all three (3) MTLNOG events of 2027.
> - Provides local recognition and branding exposure, extending to all MTLNOG events throughout the year
> - Priority placement of your company logo/presence with banners (provided by the sponsor)
> - Logo placement on swag (for 2027, t-shirt only) as MTLNOG's Gold partner
> - Large-sized logo and link on the "Upcoming meetings" page of MTLNOG's website
> - Two social media posts (before and after each 2027 meeting) on LinkedIn, Mastodon, Bluesky, and X
> - Speaking slot (15-20 min) at one 2027 meeting of your choice
> - Permanent mention on the "Past meetings" page
> - Exclusive sponsor provided marketing material and SWAG allowed during selected event
>
> **Silver sponsorship: $2,500 (yearly), limited to 8 sponsors.**
> - Valid for all three MTLNOG events of 2027.
> - Provides year long local recognition and branding exposure.
> - Logo and link on the "Upcoming meetings" page of MTLNOG's website
> - Two social media posts (before and after each of the meetings) on LinkedIn, Mastodon, Bluesky, and X
> - Sponsorship highlight during welcoming presentation.
> - Permanent mention on the "Past meetings" page
>
> **Closing.** By participating in our sponsorship program, you will not only contribute to the success of our in-person meetings but also gain exposure and recognition within our community. Your generosity will help us continue organizing meaningful and engaging events for our participants.
>
> Please let us know if you have any questions or require further information. We look forward to partnering with you to make our events a resounding success.
>
> Note: The proposed sponsorship program is subject to revision and customization based on individual sponsors' requirements and preferences.

## Appendix B: team bios (verbatim, with the corrections above applied)

**Eric Dugas** (eric@mtlnog.org)

FR: Eric Dugas est un leader de l'architecture, de l'ingénierie et des opérations réseau et un rassembleur de la communauté Internet montréalaise. Fort de près de 20 ans d'expérience dans l'industrie des télécommunications auprès de divers fournisseurs de services, il est directeur, Opérations réseau chez EBOX et vice-président de CANIX (anciennement QIX), exploitant de points d'échange Internet à Montréal, Québec, Ottawa et Toronto. Cofondateur de MTLNOG, un organisme à but non lucratif fédéral constitué en 2021 et regroupant plus de 110 membres, Eric contribue à réunir les opérateurs et ingénieurs réseau de Montréal afin de favoriser le partage de connaissances, de renforcer les relations de pair-à-pair (peering) et de faire grandir la communauté Internet locale.

EN: Eric Dugas is a network architecture, engineering and operations leader and community builder in Montreal's Internet ecosystem, with almost 20 years of experience in the telecom industry across a range of service providers. He is Director, Network Operations at EBOX and Vice-Chair of CANIX (formerly QIX), the community-driven Internet exchange operator with exchanges in Montréal, Québec City, Ottawa and Toronto. Co-founder of MTLNOG, a non-profit organization founded in 2019 and federally incorporated in 2021 that now has over 110 members, Eric helps bring Montreal's network operators and engineers together to share knowledge, strengthen peering relationships and grow a stronger local Internet community.

**Jonathan Senecal** (jonathan@mtlnog.org)

FR: Jonathan Senecal est un gestionnaire des opérations réseau et un développeur open source actif dans la communauté Internet montréalaise. Sa mission : bâtir des choses, réparer ce qui brise et aider les autres. Ses pairs le décrivent comme un autodidacte curieux, un pro de la résolution de problèmes et un mentor généreux. Avec près de 20 ans d'expérience en télécommunications, il a conçu et exploité des réseaux de télécommunications pour divers fournisseurs de services au Canada et dans le nord des États-Unis. Il est gestionnaire, Opérations réseau et technologie chez Métro Optic et dirige également Les Réseaux Loop Inc., une firme-conseil en infrastructure réseau. Ancien administrateur du QIX (aujourd'hui CANIX), il a aussi été l'un des mainteneurs de NetBox, un logiciel libre largement utilisé par les opérateurs réseau à travers le monde, auquel il continue de contribuer. Cofondateur de MTLNOG, un organisme à but non lucratif fédéral qui réunit plus de 110 opérateurs et ingénieurs réseau de la région de Montréal, Jonathan s'implique dans l'organisation de ses rencontres et fait la promotion du partage de connaissances et de la collaboration au sein de la communauté.

EN: Jonathan Senecal is a network operations leader and open-source developer in Montreal's Internet community. Driven by a personal mission to make things, fix stuff and help others, he is known among peers as a curious, self-taught problem solver and a generous mentor. With almost 20 years of experience in the telecom industry, he has designed and operated telecommunications networks for service providers across Canada and the northern US. He is Manager, Network Operations and Technology at Métro Optic and also runs Les Réseaux Loop Inc., a network infrastructure consulting firm. A former board member of QIX (now CANIX), he was also a core maintainer of NetBox, an open-source tool widely used by network operators around the world, and continues to contribute to it. As co-founder of MTLNOG, a federally incorporated non-profit that brings together over 110 network operators and engineers in the Montreal area, Jonathan helps organize its meetups and promotes knowledge sharing and collaboration across the community.

**Denis Bonneau** (denis@mtlnog.org)

FR: Denis Bonneau est un leader reconnu dans les secteurs des télécommunications, des infrastructures numériques et des technologies de diffusion. Fort de plus de 20 ans d'expérience en développement des affaires et en mobilisation de communautés technologiques, il s'est récemment joint à l'organisation de MTLNOG à titre de directeur ad hoc. En s'appuyant sur son expérience au sein de SMPTE, où il a contribué activement à la croissance et au rayonnement de la section Montréal/Québec, Denis accompagne MTLNOG dans le développement de ses activités, le renforcement de son réseau de partenaires et la création d'événements à forte valeur pour la communauté des réseaux et de l'Internet au Québec.

EN: Denis Bonneau is a recognized leader in the telecommunications, digital infrastructure, and broadcast technology sectors. With more than 20 years of experience in business development and building technology communities, he recently joined MTLNOG as an Ad Hoc Director. Drawing on his experience with SMPTE, where he actively contributed to the growth and visibility of the Montreal/Quebec Section, Denis supports MTLNOG in developing its activities, strengthening its network of partners, and creating high-value events for Quebec's networking and Internet community.

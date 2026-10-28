import type { Locale } from './detect';

export type PageKey = 'home' | 'meetings' | 'team' | 'sponsorship';

// Single source of truth for page URLs in each language.
export const routes: Record<PageKey, Record<Locale, string>> = {
  home: { fr: '/fr/', en: '/en/' },
  meetings: { fr: '/fr/rencontres/', en: '/en/meetings/' },
  team: { fr: '/fr/equipe/', en: '/en/team/' },
  sponsorship: { fr: '/fr/commandites/', en: '/en/sponsorship/' },
};

export function pathFor(page: PageKey, locale: Locale): string {
  return routes[page][locale];
}

export function inviteHref(locale: Locale): string {
  return `${pathFor('home', locale)}#invite`;
}

export function sponsorFormHref(locale: Locale): string {
  return `${pathFor('home', locale)}?type=sponsorship#invite`;
}

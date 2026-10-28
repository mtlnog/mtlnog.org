import type { Locale } from './detect';
import type { Topic } from '../lib/contact';

export type PageKey = 'home' | 'meetings' | 'team' | 'sponsorship';

// Single source of truth for page URLs in each language.
export const routes: Record<PageKey, Record<Locale, string>> = {
  home: { fr: '/fr/', en: '/en/' },
  meetings: { fr: '/fr/evenements/', en: '/en/events/' },
  team: { fr: '/fr/equipe/', en: '/en/team/' },
  sponsorship: { fr: '/fr/commandites/', en: '/en/sponsorship/' },
};

export function pathFor(page: PageKey, locale: Locale): string {
  return routes[page][locale];
}

export function inviteHref(locale: Locale): string {
  return `${pathFor('home', locale)}#invite`;
}

// Opens the home page contact form with a topic pre-selected.
export function contactHref(locale: Locale, topic: Topic): string {
  return `${pathFor('home', locale)}?type=${topic}#invite`;
}

export function sponsorFormHref(locale: Locale): string {
  return contactHref(locale, 'sponsorship');
}

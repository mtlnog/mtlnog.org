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

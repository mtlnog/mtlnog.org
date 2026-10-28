import type { Locale } from '../i18n/detect';

const intlLocale: Record<Locale, string> = { fr: 'fr-CA', en: 'en-CA' };

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatCad(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function monthName(month: number, locale: Locale): string {
  const date = new Date(Date.UTC(2000, month - 1, 1));
  return capitalize(
    new Intl.DateTimeFormat(intlLocale[locale], { month: 'long', timeZone: 'UTC' }).format(date),
  );
}

// '2026-10' -> 'October 2026' / 'Octobre 2026'
export function monthYear(isoMonth: string, locale: Locale): string {
  const [year, month] = isoMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return capitalize(
    new Intl.DateTimeFormat(intlLocale[locale], {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date),
  );
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale]).format(value);
}

export function formatList(items: string[], locale: Locale): string {
  return new Intl.ListFormat(intlLocale[locale], { type: 'conjunction' }).format(items);
}

// Splits 'text {key} more' into ['text ', ' more'] so a link can be placed between.
export function splitAt(template: string, key: string): [string, string] | null {
  const marker = `{${key}}`;
  const i = template.indexOf(marker);
  return i === -1 ? null : [template.slice(0, i), template.slice(i + marker.length)];
}

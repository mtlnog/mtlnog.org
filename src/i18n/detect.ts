export type Locale = 'fr' | 'en';

export function detectLocale(
  saved: string | null,
  navigatorLanguages: readonly string[],
): Locale {
  if (saved === 'fr' || saved === 'en') return saved;
  const prefersFr = navigatorLanguages.some((l) => l.toLowerCase().startsWith('fr'));
  return prefersFr ? 'fr' : 'en';
}

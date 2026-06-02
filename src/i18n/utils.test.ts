import { describe, it, expect } from 'vitest';
import { getStrings, otherLocale, isLocale, locales } from './utils';

describe('locale utils', () => {
  it('exposes both locales', () => {
    expect(locales).toEqual(['fr', 'en']);
  });

  it('getStrings returns the matching dictionary', () => {
    expect(getStrings('fr').nav.invite).toBe('Demander une invitation');
    expect(getStrings('en').nav.invite).toBe('Request an Invite');
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

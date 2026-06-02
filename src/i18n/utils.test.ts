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

import { describe, it, expect } from 'vitest';
import { detectLocale } from './detect';

describe('detectLocale', () => {
  it('returns saved locale when valid, ignoring navigator', () => {
    expect(detectLocale('en', ['fr-CA', 'fr'])).toBe('en');
    expect(detectLocale('fr', ['en-US'])).toBe('fr');
  });

  it('uses navigator languages when nothing saved', () => {
    expect(detectLocale(null, ['fr-CA', 'en'])).toBe('fr');
    expect(detectLocale(null, ['en-US'])).toBe('en');
  });

  it('ignores an invalid saved value and falls back to navigator', () => {
    expect(detectLocale('de', ['fr'])).toBe('fr');
  });

  it('defaults to en when navigator has no French and nothing saved', () => {
    expect(detectLocale(null, [])).toBe('en');
  });
});

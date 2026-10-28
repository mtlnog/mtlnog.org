import { describe, it, expect } from 'vitest';
import { formatCad, formatNumber, formatList, monthName, monthYear, fill, initials, splitAt } from './format';

// Intl emits non-breaking spaces (U+00A0 / U+202F); normalize for comparison.
const n = (s: string) => s.replace(/\s/g, ' ');

describe('formatCad', () => {
  it('formats dollars per locale without decimals', () => {
    expect(n(formatCad(5000, 'en'))).toBe('$5,000');
    expect(n(formatCad(5000, 'fr'))).toBe('5 000 $');
    expect(n(formatCad(250, 'fr'))).toBe('250 $');
  });
});

describe('month helpers', () => {
  it('returns the month name as written mid-sentence', () => {
    expect(monthName(3, 'fr')).toBe('mars');
    expect(monthName(10, 'en')).toBe('October');
  });

  it('formats a YYYY-MM value as month and year', () => {
    expect(monthYear('2026-10', 'fr')).toBe('Octobre 2026');
  });
});

describe('fill', () => {
  it('replaces {key} placeholders', () => {
    expect(fill('limited to {n} sponsors', { n: 2 })).toBe('limited to 2 sponsors');
    expect(fill('no vars', {})).toBe('no vars');
  });
});

describe('initials', () => {
  it('takes the first letter of each name', () => {
    expect(initials('Jonathan Senecal')).toBe('JS');
    expect(initials('Eric Dugas')).toBe('ED');
  });
});

describe('formatNumber', () => {
  it('groups thousands per locale', () => {
    expect(n(formatNumber(1600, 'en'))).toBe('1,600');
    expect(n(formatNumber(1600, 'fr'))).toBe('1 600');
  });
});

describe('formatList', () => {
  it('joins items with the locale conjunction', () => {
    expect(formatList(['mars', 'août', 'octobre'], 'fr')).toBe('mars, août et octobre');
    expect(formatList(['March', 'August', 'October'], 'en')).toMatch(/^March, August,? and October$/);
  });
});

describe('splitAt', () => {
  it('splits a template around one placeholder', () => {
    expect(splitAt('Logo on the {upcoming} page', 'upcoming')).toEqual(['Logo on the ', ' page']);
  });

  it('returns null when the placeholder is absent', () => {
    expect(splitAt('No link here', 'upcoming')).toBeNull();
  });
});

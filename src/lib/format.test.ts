import { describe, it, expect } from 'vitest';
import { formatCad, monthName, monthYear, fill, initials } from './format';

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
  it('returns a capitalized month name', () => {
    expect(monthName(3, 'fr')).toBe('Mars');
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

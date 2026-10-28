import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import en from './en.json';

function paths(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [`${prefix}[]`];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) =>
      paths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('dictionary shape', () => {
  it('fr and en have identical key structure', () => {
    expect(paths(fr).sort()).toEqual(paths(en).sort());
  });

  it('sponsorship lists have the same length in both locales', () => {
    expect(fr.sponsorship.mission.length).toBe(en.sponsorship.mission.length);
    expect(fr.sponsorship.tiers.gold.bullets.length).toBe(en.sponsorship.tiers.gold.bullets.length);
    expect(fr.sponsorship.tiers.silver.bullets.length).toBe(en.sponsorship.tiers.silver.bullets.length);
    expect(fr.sponsorship.closing.paragraphs.length).toBe(en.sponsorship.closing.paragraphs.length);
  });

  it('role options have the same count in both locales', () => {
    expect(fr.form.fields.role.options.length).toBe(en.form.fields.role.options.length);
  });
});

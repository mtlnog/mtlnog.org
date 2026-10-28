import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import en from './en.json';

// Page sections whose French text must not be left in English.
const SECTIONS = ['meetings', 'team'] as const;

// Leaf paths that are legitimately identical in both languages.
const SAME_IN_BOTH: string[] = [];

function leaves(obj: unknown, prefix: string): [string, string][] {
  if (typeof obj === 'string') return [[prefix, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => leaves(v, `${prefix}.${k}`));
  }
  return [];
}

describe('French pages are translated', () => {
  for (const section of SECTIONS) {
    it(`${section}: every French string differs from English`, () => {
      const frSection = (fr as Record<string, unknown>)[section];
      const enSection = (en as Record<string, unknown>)[section];
      expect(frSection, `fr.${section} is missing`).toBeDefined();
      expect(enSection, `en.${section} is missing`).toBeDefined();
      const enMap = new Map(leaves(enSection, section));
      const untranslated = leaves(frSection, section)
        .filter(([path, text]) => !SAME_IN_BOTH.includes(path) && enMap.get(path) === text)
        .map(([path]) => path);
      expect(untranslated).toEqual([]);
    });
  }
});

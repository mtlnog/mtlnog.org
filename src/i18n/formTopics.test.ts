import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import en from './en.json';
import { AMENITIES, ROLES, TALK_LANGUAGES, TALK_LENGTHS, TIERS, TOPICS } from '../lib/contact';

const lists = {
  topics: TOPICS,
  tiers: TIERS,
  talkLengths: TALK_LENGTHS,
  talkLanguages: TALK_LANGUAGES,
  amenities: AMENITIES,
} as const;

describe('contact form labels', () => {
  for (const [locale, dict] of [['fr', fr], ['en', en]] as const) {
    it(`${locale}: every form value has a label`, () => {
      const form = dict.form as unknown as Record<string, Record<string, string>>;
      for (const [key, values] of Object.entries(lists)) {
        for (const value of values) {
          expect(form[key]?.[value], `${locale}.form.${key}.${value}`).toBeTruthy();
        }
      }
    });

    it(`${locale}: one role label per role value`, () => {
      expect(dict.form.roles).toHaveLength(ROLES.length);
    });
  }

  it('English role labels are the submitted values', () => {
    expect(en.form.roles).toEqual([...ROLES]);
  });
});

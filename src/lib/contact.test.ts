import { describe, it, expect } from 'vitest';
import { formEntriesToPayload, validateSubmission } from './contact';

const base = (topic: string) => ({
  topic,
  locale: 'en',
  fname: 'Alex',
  lname: 'Tremblay',
  email: 'alex@example.net',
  org: '',
});

const valid = {
  slack: { ...base('slack'), role: 'Network Engineer' },
  sponsorship: { ...base('sponsorship') },
  speaking: { ...base('speaking'), talk_title: 'RPKI ROV', abstract: 'What we learned.' },
  venue: { ...base('venue'), venue_location: 'Griffintown', capacity: 30 },
  general: { ...base('general'), message: 'Hello' },
};

describe('validateSubmission', () => {
  it('accepts each topic with only its required fields', () => {
    for (const input of Object.values(valid)) {
      expect(validateSubmission(input).ok, input.topic).toBe(true);
    }
  });

  it('rejects an unknown topic, missing shared fields, a bad email or locale', () => {
    expect(validateSubmission({ ...valid.general, topic: 'jobs' }).ok).toBe(false);
    for (const key of ['fname', 'lname', 'email'] as const) {
      expect(validateSubmission({ ...valid.general, [key]: '' }).ok, key).toBe(false);
    }
    expect(validateSubmission({ ...valid.general, email: 'not-an-email' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.general, locale: 'de' }).ok).toBe(false);
    expect(validateSubmission(null).ok).toBe(false);
    expect(validateSubmission('nope').ok).toBe(false);
  });

  it('rejects each topic missing a required field', () => {
    expect(validateSubmission({ ...valid.slack, role: '' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.speaking, talk_title: '' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.speaking, abstract: '  ' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.venue, venue_location: '' }).ok).toBe(false);
    for (const capacity of [0, -1, 2.5, 100001, undefined, 'lots']) {
      expect(validateSubmission({ ...valid.venue, capacity }).ok, String(capacity)).toBe(false);
    }
    expect(validateSubmission({ ...valid.general, message: '' }).ok).toBe(false);
  });

  it('rejects a translated role label', () => {
    expect(validateSubmission({ ...valid.slack, role: 'Ingénieur réseau' }).ok).toBe(false);
  });

  it('rejects unknown enum values', () => {
    expect(validateSubmission({ ...valid.sponsorship, tier: 'platinum' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.speaking, talk_length: 'epic' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.speaking, talk_language: 'de' }).ok).toBe(false);
    expect(validateSubmission({ ...valid.venue, amenities: ['jacuzzi'] }).ok).toBe(false);
    expect(validateSubmission({ ...valid.venue, amenities: 'wifi' }).ok).toBe(false);
  });

  it('rejects over-long fields', () => {
    expect(validateSubmission({ ...valid.general, fname: 'a'.repeat(201) }).ok).toBe(false);
    expect(validateSubmission({ ...valid.general, message: 'a'.repeat(5001) }).ok).toBe(false);
    expect(validateSubmission({ ...valid.general, message: 'a'.repeat(5000) }).ok).toBe(true);
  });

  it("drops other topics' fields", () => {
    const result = validateSubmission({ ...valid.general, message: 'hi', talk_title: 'x', role: 'Other' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.fields).toEqual({ message: 'hi' });
  });

  it('trims strings and omits empty optional fields', () => {
    const result = validateSubmission({
      ...valid.speaking,
      fname: '  Alex ',
      talk_title: ' RPKI ROV ',
      notes: '   ',
      talk_length: 'standard',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fname).toBe('Alex');
      expect(result.value.fields).toEqual({
        talk_title: 'RPKI ROV',
        abstract: 'What we learned.',
        talk_length: 'standard',
      });
    }
  });

  it('keeps venue amenities and capacity typed', () => {
    const result = validateSubmission({ ...valid.venue, amenities: ['wifi', 'food'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fields).toEqual({ venue_location: 'Griffintown', capacity: 30, amenities: ['wifi', 'food'] });
    }
  });
});

describe('formEntriesToPayload', () => {
  it('groups amenities, converts capacity and trims strings', () => {
    expect(
      formEntriesToPayload([
        ['amenities', 'wifi'],
        ['amenities', 'food'],
        ['capacity', '30'],
        ['fname', ' Alex '],
      ]),
    ).toEqual({ amenities: ['wifi', 'food'], capacity: 30, fname: 'Alex' });
  });

  it('makes a single amenity an array', () => {
    expect(formEntriesToPayload([['amenities', 'wifi']])).toEqual({ amenities: ['wifi'] });
  });
});

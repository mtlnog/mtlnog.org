// Contact form contract, shared by the form's client script and the Worker.
// Keep it free of DOM and Worker APIs: both sides import it.

export const TOPICS = ['slack', 'sponsorship', 'speaking', 'venue', 'general'] as const;
export type Topic = (typeof TOPICS)[number];

// Submitted role values are these English labels in both languages.
export const ROLES = [
  'Network Engineer',
  'Network Operator',
  'Systems & Infrastructure Engineer',
  'Network Manager',
  'Researcher & Academic',
  'Other',
] as const;
export const TIERS = ['unsure', 'gold', 'silver', 'custom'] as const;
export const TALK_LENGTHS = ['lightning', 'standard', 'long'] as const;
export const TALK_LANGUAGES = ['fr', 'en', 'either'] as const;
export const AMENITIES = ['projector', 'sound', 'wifi', 'food', 'evening'] as const;

export const HONEYPOT_FIELD = 'turnstile_validation';
export const LIMITS = { short: 200, long: 5000, maxCapacity: 100000, maxBodyBytes: 32768 } as const;

export type Locale = 'fr' | 'en';
export type FieldValue = string | number | string[];

export interface Submission {
  topic: Topic;
  locale: Locale;
  fname: string;
  lname: string;
  email: string;
  org: string;
  fields: Record<string, FieldValue>;
}

type Rule =
  | { kind: 'text'; max: number; required?: boolean }
  | { kind: 'choice'; values: readonly string[]; required?: boolean }
  | { kind: 'capacity'; required: true }
  | { kind: 'amenities' };

const short = (required = false): Rule => ({ kind: 'text', max: LIMITS.short, required });
const long = (required = false): Rule => ({ kind: 'text', max: LIMITS.long, required });

// Fields each topic accepts. Anything else in the input is dropped.
const TOPIC_FIELDS: Record<Topic, Record<string, Rule>> = {
  slack: { role: { kind: 'choice', values: ROLES, required: true }, intro: long() },
  sponsorship: { tier: { kind: 'choice', values: TIERS }, message: long() },
  speaking: {
    talk_title: short(true),
    abstract: long(true),
    talk_length: { kind: 'choice', values: TALK_LENGTHS },
    talk_language: { kind: 'choice', values: TALK_LANGUAGES },
    notes: long(),
  },
  venue: {
    venue_location: short(true),
    capacity: { kind: 'capacity', required: true },
    amenities: { kind: 'amenities' },
    notes: long(),
  },
  general: { message: long(true) },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID = { ok: false } as const;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

// undefined: absent or empty; null: present but invalid.
function readText(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text === '') return undefined;
  return text.length > max ? null : text;
}

function readField(rule: Rule, value: unknown): FieldValue | undefined | null {
  switch (rule.kind) {
    case 'text':
      return readText(value, rule.max);
    case 'choice': {
      if (value === undefined || value === null || value === '') return undefined;
      return isOneOf(rule.values, value) ? value : null;
    }
    case 'capacity': {
      if (value === undefined || value === null || value === '') return undefined;
      const ok = typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= LIMITS.maxCapacity;
      return ok ? value : null;
    }
    case 'amenities': {
      if (value === undefined || value === null) return undefined;
      if (!Array.isArray(value) || !value.every((v) => isOneOf(AMENITIES, v))) return null;
      const unique = [...new Set(value as string[])];
      return unique.length ? unique : undefined;
    }
  }
}

export function validateSubmission(input: unknown): { ok: true; value: Submission } | { ok: false } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return INVALID;
  const data = input as Record<string, unknown>;

  if (!isOneOf(TOPICS, data.topic)) return INVALID;
  if (data.locale !== 'fr' && data.locale !== 'en') return INVALID;
  const topic = data.topic;

  const fname = readText(data.fname, LIMITS.short);
  const lname = readText(data.lname, LIMITS.short);
  const email = readText(data.email, LIMITS.short);
  const org = readText(data.org, LIMITS.short);
  if (!fname || !lname || !email || org === null) return INVALID;
  if (!EMAIL.test(email)) return INVALID;

  const fields: Record<string, FieldValue> = {};
  for (const [name, rule] of Object.entries(TOPIC_FIELDS[topic])) {
    const value = readField(rule, data[name]);
    if (value === null) return INVALID;
    if (value === undefined) {
      if ('required' in rule && rule.required) return INVALID;
      continue;
    }
    fields[name] = value;
  }

  return { ok: true, value: { topic, locale: data.locale, fname, lname, email, org: org ?? '', fields } };
}

// Turns form entries into the JSON body: repeated amenities become an array, capacity a number.
export function formEntriesToPayload(entries: Iterable<[string, string]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    const value = raw.trim();
    if (key === 'amenities') {
      const list = (out.amenities as string[] | undefined) ?? [];
      list.push(value);
      out.amenities = list;
    } else if (key === 'capacity') {
      out.capacity = /^\d+$/.test(value) ? Number(value) : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

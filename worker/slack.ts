import type { FieldValue, Submission, Topic } from '../src/lib/contact';

const TOPIC_LABELS: Record<Topic, string> = {
  slack: 'Slack',
  sponsorship: 'Sponsorship',
  speaking: 'Speaking',
  venue: 'Venue',
  general: 'General',
};

// English labels for topic fields; long text is shown below them.
const FIELD_LABELS: Record<string, string> = {
  role: 'Role',
  tier: 'Tier',
  talk_title: 'Talk title',
  talk_length: 'Length',
  talk_language: 'Language',
  venue_location: 'Location',
  capacity: 'Capacity',
  amenities: 'Available',
};
const LONG_FIELDS: Record<string, string> = {
  intro: 'Introduction',
  abstract: 'Abstract',
  message: 'Message',
  notes: 'Notes',
};

// Slack treats &, < and > as control characters in mrkdwn and plain text.
export function escapeSlack(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Slack rejects a section text over 3,000 characters and a section field over 2,000.
const SECTION_MAX = 3000;
const FIELD_MAX = 2000;

const raw = (value: FieldValue) => (Array.isArray(value) ? value.join(', ') : String(value));

// Splits text into escaped chunks of at most `max` characters, never inside an escape.
function escapedChunks(text: string, max: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of text) {
    const piece = escapeSlack(char);
    if (current.length + piece.length > max) {
      chunks.push(current);
      current = '';
    }
    current += piece;
  }
  if (current || !chunks.length) chunks.push(current);
  return chunks;
}

// Escapes text and shortens it to `max` characters, ending with an ellipsis when cut.
function clamp(text: string, max: number): string {
  const chunks = escapedChunks(text, max - 1);
  return chunks.length === 1 ? chunks[0] : `${chunks[0]}…`;
}

const field = (label: string, value: string) => {
  const head = `*${label}*\n`;
  return { type: 'mrkdwn', text: head + clamp(value, FIELD_MAX - head.length) };
};

export function buildSubmissionMessage(id: number, sub: Submission): { text: string; blocks: unknown[] } {
  const topic = TOPIC_LABELS[sub.topic];
  const fullName = `${sub.fname} ${sub.lname}`;
  const lang = sub.locale.toUpperCase();

  const people = [
    field('Name', fullName),
    field('Email', sub.email),
    field('Organization', sub.org || '—'),
    field('Language', lang),
  ];
  const details = Object.entries(sub.fields)
    .filter(([key]) => key in FIELD_LABELS)
    .map(([key, value]) => field(FIELD_LABELS[key], raw(value)));

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `${topic} · #${id}` } },
    { type: 'section', fields: people },
  ];
  if (details.length) blocks.push({ type: 'section', fields: details });

  // Long text is split over as many sections as it needs, so nothing is cut.
  for (const [key, value] of Object.entries(sub.fields)) {
    if (!(key in LONG_FIELDS)) continue;
    const label = LONG_FIELDS[key];
    const contLabel = `*${label} (cont.)*\n`;
    escapedChunks(raw(value), SECTION_MAX - contLabel.length).forEach((chunk, i) => {
      const head = i === 0 ? `*${label}*\n` : contLabel;
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: head + chunk } });
    });
  }

  return { text: `New ${topic} request from ${clamp(fullName, 200)} (${lang})`, blocks };
}

export function buildFailureAlert(id: number, topic: Topic): { text: string } {
  return {
    text: `:warning: Contact submission #${id} (${topic}) could not be delivered to Slack for 24 hours. It is kept in D1; see the README to read it.`,
  };
}

export async function postToSlack(
  url: string,
  body: object,
  fetchFn: typeof fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!url) return { ok: false, error: 'no_webhook' };
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok ? { ok: true } : { ok: false, error: `http_${res.status}` };
  } catch {
    return { ok: false, error: 'network' };
  }
}

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

function show(value: FieldValue): string {
  return escapeSlack(Array.isArray(value) ? value.join(', ') : String(value));
}

export function buildSubmissionMessage(id: number, sub: Submission): { text: string; blocks: unknown[] } {
  const topic = TOPIC_LABELS[sub.topic];
  const name = escapeSlack(`${sub.fname} ${sub.lname}`);
  const lang = sub.locale.toUpperCase();

  const people = [
    `*Name*\n${name}`,
    `*Email*\n${escapeSlack(sub.email)}`,
    `*Organization*\n${sub.org ? escapeSlack(sub.org) : '—'}`,
    `*Language*\n${lang}`,
  ];
  const details = Object.entries(sub.fields)
    .filter(([key]) => key in FIELD_LABELS)
    .map(([key, value]) => `*${FIELD_LABELS[key]}*\n${show(value)}`);
  const texts = Object.entries(sub.fields)
    .filter(([key]) => key in LONG_FIELDS)
    .map(([key, value]) => `*${LONG_FIELDS[key]}*\n${show(value)}`);

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `${topic} · #${id}` } },
    { type: 'section', fields: people.map((text) => ({ type: 'mrkdwn', text })) },
  ];
  if (details.length) blocks.push({ type: 'section', fields: details.map((text) => ({ type: 'mrkdwn', text })) });
  for (const text of texts) blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });

  return { text: `New ${topic} request from ${name} (${lang})`, blocks };
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

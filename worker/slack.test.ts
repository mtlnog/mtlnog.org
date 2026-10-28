import { describe, it, expect, vi } from 'vitest';
import type { Submission } from '../src/lib/contact';
import { buildFailureAlert, buildSubmissionMessage, escapeSlack, postToSlack } from './slack';

const speaking: Submission = {
  topic: 'speaking',
  locale: 'en',
  fname: 'Alex',
  lname: 'Tremblay',
  email: 'alex@example.net',
  org: 'Acme / AS12345',
  fields: { talk_title: 'RPKI ROV', abstract: 'What we learned.', talk_length: 'standard' },
};

describe('escapeSlack', () => {
  it('escapes Slack control characters', () => {
    expect(escapeSlack('<!channel> & <https://x|y>')).toBe('&lt;!channel&gt; &amp; &lt;https://x|y&gt;');
  });
});

describe('buildSubmissionMessage', () => {
  it('never contains raw user markup', () => {
    const json = JSON.stringify(
      buildSubmissionMessage(7, {
        ...speaking,
        fname: '<!channel>',
        fields: { ...speaking.fields, abstract: '<https://evil|click>' },
      }),
    );
    expect(json).not.toContain('<!channel>');
    expect(json).not.toContain('<https://evil');
  });

  it('shows topic, name, email and language', () => {
    const msg = buildSubmissionMessage(7, speaking);
    const json = JSON.stringify(msg);
    expect(msg.text).toContain('Speaking');
    expect(msg.text).toContain('Alex Tremblay');
    for (const part of ['alex@example.net', 'EN', 'RPKI ROV', 'What we learned.', 'Acme / AS12345']) {
      expect(json).toContain(part);
    }
  });

  it('lists venue amenities and capacity', () => {
    const json = JSON.stringify(
      buildSubmissionMessage(8, {
        ...speaking,
        topic: 'venue',
        locale: 'fr',
        fields: { venue_location: 'Griffintown', capacity: 30, amenities: ['projector', 'wifi'] },
      }),
    );
    expect(json).toContain('projector, wifi');
    expect(json).toContain('30');
    expect(json).toContain('FR');
  });
});

describe('buildFailureAlert', () => {
  it('names only the id and topic', () => {
    const alert = buildFailureAlert(42, 'venue');
    expect(alert.text).toContain('42');
    expect(alert.text).toContain('venue');
  });
});

describe('postToSlack', () => {
  const ok = () => vi.fn(async () => new Response('ok', { status: 200 }));

  it('posts JSON and reports success', async () => {
    const fetchFn = ok();
    expect(await postToSlack('https://hooks.example/x', { text: 'hi' }, fetchFn)).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example/x');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toContain('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hi' });
  });

  it('reports HTTP and network failures as short codes', async () => {
    const notFound = vi.fn(async () => new Response('no', { status: 404 }));
    expect(await postToSlack('u', {}, notFound)).toEqual({ ok: false, error: 'http_404' });
    const broken = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await postToSlack('u', {}, broken)).toEqual({ ok: false, error: 'network' });
  });

  it('fails without calling out when no webhook is configured', async () => {
    const fetchFn = ok();
    expect(await postToSlack('', {}, fetchFn)).toEqual({ ok: false, error: 'no_webhook' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

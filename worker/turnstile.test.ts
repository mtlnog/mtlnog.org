import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

const answer = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

describe('verifyTurnstile', () => {
  it('returns true when siteverify succeeds', async () => {
    expect(await verifyTurnstile('tok', 'sec', '1.2.3.4', answer({ success: true }))).toBe(true);
  });

  it('returns false on failure, errors, empty tokens and non-JSON', async () => {
    expect(await verifyTurnstile('tok', 'sec', null, answer({ success: false }))).toBe(false);
    const broken = vi.fn(async () => {
      throw new Error('down');
    });
    expect(await verifyTurnstile('tok', 'sec', null, broken)).toBe(false);
    const html = vi.fn(async () => new Response('<html>', { status: 200 }));
    expect(await verifyTurnstile('tok', 'sec', null, html)).toBe(false);
    const fetchFn = answer({ success: true });
    expect(await verifyTurnstile('', 'sec', null, fetchFn)).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends secret, response and remote ip to siteverify', async () => {
    const fetchFn = answer({ success: true });
    await verifyTurnstile('tok', 'sec', '1.2.3.4', fetchFn);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = init.body as FormData;
    expect(body.get('secret')).toBe('sec');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });
});

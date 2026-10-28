const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// True only when Cloudflare confirms the token; any error counts as a failure.
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
  fetchFn: typeof fetch,
): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetchFn(SITEVERIFY, { method: 'POST', body });
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  }
}

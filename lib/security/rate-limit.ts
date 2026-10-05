import 'server-only';

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();
let calls = 0;

/** In-process rate limit for deployments without a shared rate-limit service. */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  calls += 1;
  if (calls % 128 === 0 || windows.size >= 10_000) {
    windows.forEach((value, entry) => { if (value.resetAt <= now) windows.delete(entry); });
  }
  const current = windows.get(key);
  if (!current && windows.size >= 10_000) return { allowed: false, retryAfterSeconds: 1 };
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearRateLimit(key: string) { windows.delete(key); }

export function requestAddress(headers?: Headers | Record<string, string | string[] | undefined>) {
  const get = (name: string) => !headers ? undefined : headers instanceof Headers ? headers.get(name) : headers[name] ?? headers[name.toLowerCase()];
  const forwarded = get('x-forwarded-for');
  const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return candidate || (Array.isArray(get('x-real-ip')) ? (get('x-real-ip') as string[])[0] : get('x-real-ip')) || 'unknown';
}

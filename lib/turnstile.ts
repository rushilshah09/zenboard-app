import 'server-only';
// Cloudflare Turnstile verification — the server half of the per-form spam check
// (F4). Like the rest of the spam defences, this is written so it can never punish
// a real person for our own infrastructure hiccup, and so a form owner who toggles
// the check on but hasn't deployed the keys yet simply gets no enforcement (never a
// wall of errors). Mirrors the best-effort contract of lib/webhook.ts / lib/email.ts.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** True only when the secret is deployed — i.e. the check can actually be enforced. */
export function turnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Verify a Turnstile token. Returns:
 *   • true  when Turnstile isn't configured (feature effectively off — never blocks),
 *   • true  when the token is valid,
 *   • false when a token is required but missing or Cloudflare says it's invalid.
 * A network failure reaching Cloudflare resolves to true (fail-open): an outage on
 * their side must not take every form on the platform down with it — the honeypot,
 * time-trap and rate-limit still stand behind this.
 */
export async function verifyTurnstile(token: string | null | undefined, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;        // not configured ⇒ the toggle is inert, never a gate
  if (!token) return false;        // required but the client sent nothing

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteip) body.set('remoteip', remoteip);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return true;                   // couldn't reach Cloudflare ⇒ don't strand a real person
  }
}

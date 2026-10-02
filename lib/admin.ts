import 'server-only';
// ── WHO MAY SEE THE PLATFORM'S OWN DATA ─────────────────────────────────────
//
// Zenboard's app is one owner per workspace: every signed-in person owns their own, and RLS keeps
// them inside it. The waitlist is not in anybody's workspace — it is a list of strangers who want
// Zenboard itself — so "the owner" is not a question RLS can answer. This is the gate for that
// narrow platform-level case, and it exists for exactly one page today.
//
// THE LIST IS AN ENVIRONMENT VARIABLE, NOT A COLUMN. There is no `is_admin` flag to escalate, no
// row to edit, and nothing a signed-in person can do to their own record that would let them in:
// the answer lives in the deployment's configuration, where only someone who can deploy can change
// it. Unset ⇒ NOBODY is an admin, which is the safe direction to fail — a missing variable must
// never mean "let everyone in".
//
// Emails are compared folded and trimmed, because `Rushil@…` in the dashboard and `rushil@…` on
// the account are the same person and a case mismatch here reads as a broken page.

import { cookies } from 'next/headers';
import { currentUser } from '@/lib/auth';

/** The addresses allowed to see platform data, from ADMIN_EMAILS (comma-separated). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this address one of them? Unset list ⇒ false, always. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const list = adminEmails();
  if (!list.length) return false;
  const e = (email ?? '').trim().toLowerCase();
  return !!e && list.includes(e);
}

// ── THE PASSWORD DOOR ───────────────────────────────────────────────────────
//
// A second way in, because the waitlist is not in anybody's workspace and the person who runs the
// platform should not need a Supabase account open to read it (user, 2026-09-30: "right now set
// password … then i change it").
//
// THE PASSWORD IS NEVER IN THE SOURCE. It is `ADMIN_PASSWORD`, read at runtime — in `.env.local`
// for development (git-ignored) and as a Cloudflare secret in production. A literal here would be
// in the repository, in every clone of it, and in its history for good.
//
// THE COOKIE IS NOT THE PASSWORD. It carries an HMAC of a fixed string keyed BY the password, so
// the cookie cannot be turned back into it, cannot be forged without it, and every cookie in the
// world stops working the moment the password changes — which is what makes "then i change it"
// safe. httpOnly so no script can read it, `secure` off localhost, and SameSite=Lax so it does not
// travel on a cross-site request.

export const ADMIN_COOKIE = 'zb-admin';
const STAMP = 'zb-admin-v1';

/** What a correct password entitles you to hold. Web Crypto, because a Worker has no node:crypto. */
async function tokenFor(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(STAMP));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compare without leaking WHERE two strings differ through how long the comparison took. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Is this the password? False whenever none is configured — a missing variable is not an open door. */
export async function passwordOk(attempt: string): Promise<boolean> {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return sameSecret(await tokenFor(attempt), await tokenFor(real));
}

/** The value the cookie should hold right now, or null when no password is configured. */
export async function adminToken(): Promise<string | null> {
  const real = process.env.ADMIN_PASSWORD;
  return real ? tokenFor(real) : null;
}

/** Does this request carry a cookie minted by the CURRENT password? */
export async function adminCookieValid(): Promise<boolean> {
  const want = await adminToken();
  if (!want) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!got && sameSecret(got, want);
}

/**
 * May whoever is asking see the platform's own data? Either door: the password, or a signed-in
 * account whose address is in ADMIN_EMAILS.
 *
 * It does NOT redirect. A stranger with the password has no Supabase account and must not be sent
 * to a login screen; the page renders its own door instead. The gate still belongs in the PAGE —
 * a layout is not a gate, because a route rendered under it can still be reached.
 */
export async function adminOk(): Promise<boolean> {
  if (await adminCookieValid()) return true;
  const user = await currentUser();           // null when signed out; never redirects
  return isAdminEmail(user?.email);
}

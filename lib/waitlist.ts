// ── THE WAITLIST'S RULES ────────────────────────────────────────────────────
//
// Everything the waitlist decides that is NOT a database write or a piece of markup: the seed, the
// number on the ticket, the count the site shows, and the words someone posts when they share it.
// A plain module — no 'server-only' — because the form validates in the browser with the same rule
// the action re-checks on the server, and the share text is built where the pointer is.
//
// THE SEED IS ONE NUMBER AND IT FEEDS BOTH READINGS. The list is presented as already eighty
// strong, so the first real person is #81 and the count on the page is 80 + the rows stored. Both
// come from `WAITLIST_SEED` below, and the sequence in migration 0048 starts at `WAITLIST_SEED + 1`
// for exactly that reason. Move one without the other and a person's ticket number stops agreeing
// with the count they were just shown.

import { EMAIL_RE } from '@/lib/form-schema';

/**
 * Is public sign-up open? FALSE while the waitlist is the front door (user, 2026-09-30: the waitlist
 * replaces "Start free"). Existing accounts sign in exactly as before — this closes the creation of
 * NEW ones, nothing else.
 *
 * It is read in two places and both are load-bearing: the auth screen, so nobody is shown a form
 * that cannot work, and app/api/auth/signup/route.ts, so nobody can simply POST to it. A HIDDEN
 * FORM IS NOT A CLOSED DOOR — the route is the gate, the screen is the courtesy.
 */
export const SIGNUPS_OPEN = false;

/** How many the list counts before the first real signup. The sequence in 0048 starts one above it. */
export const WAITLIST_SEED = 80;

/** Where someone joined from. Stored per row so the admin list can say which surface converts. */
export const WAITLIST_SOURCES = ['site', 'hero', 'waitlist', 'footer'] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

export function isWaitlistSource(v: unknown): v is WaitlistSource {
  return typeof v === 'string' && (WAITLIST_SOURCES as readonly string[]).includes(v);
}

/** One person's place in the queue, as it is printed on the ticket: `#081`, `#1042`.
 *  Padded to three digits because that is the width the ticket is drawn for; a longer number
 *  is printed whole rather than truncated, which would silently renumber somebody. */
export function formatTicket(n: number): string {
  return `#${String(Math.trunc(n)).padStart(3, '0')}`;
}

/** The number the site shows: the seed plus the people actually stored. */
export function joinedTotal(rows: number): number {
  return WAITLIST_SEED + Math.max(0, Math.trunc(rows));
}

/** Compare and store addresses one way, so `Jane@Acme.co` and `jane@acme.co` are one person.
 *  The unique index in 0048 is on `lower(email)` and agrees with this. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The same question a form's email field asks (lib/form-schema.ts owns the rule). */
export function emailLooksValid(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}

/** A name is optional; when given it is trimmed, collapsed and capped to the column's 80. */
export function normaliseName(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return v || null;
}

// ── Sharing ────────────────────────────────────────────────────────────────
//
// A share is a composer opened with the words already written, never a post made on someone's
// behalf: posting for them would need their account, and nobody hands that over for a ticket.

/** What someone posts when they share their ticket. Sentence case, no slogan, the number first. */
export function shareMessage(number: number): string {
  return `I just joined the Zenboard waitlist: ticket ${formatTicket(number)}. One calm workspace to run your business.`;
}

export type ShareTarget = 'x' | 'linkedin' | 'whatsapp';

/** The composer URL for each network, with our own text and our own address — nothing a visitor
 *  typed ever reaches these, so there is no open-redirect surface here. */
export function shareUrl(target: ShareTarget, number: number, origin: string): string {
  const text = shareMessage(number);
  const url = `${origin.replace(/\/$/, '')}/waitlist`;
  switch (target) {
    case 'x':
      return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    case 'linkedin':
      // LinkedIn's share-offsite takes the address only and reads the words from the page's own
      // metadata, so /waitlist carries the title and card this post will show.
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  }
}

/** The filename someone gets when they save their ticket. Shares the ticket's own padding, so the
 *  file on their desktop is named the same as the number printed on it. */
export function ticketFilename(number: number): string {
  return `zenboard-ticket-${formatTicket(number).slice(1)}.png`;
}

// ── THE HANDLE ──────────────────────────────────────────────────────────────
//
// Claimed after joining and held until launch (user, 2026-09-30). The rule is deliberately narrow —
// lowercase letters, digits and underscore, 3 to 20 — because a handle ends up in a URL, in an
// @mention and read aloud, and every character class beyond that buys ambiguity: a capital that
// looks like a lowercase, a dot that ends a sentence, a hyphen that wraps.
//
// The same expression is in migration 0048's CHECK, so the database refuses anything this would.

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Names nobody may take, because the product needs them or they would impersonate it. */
const RESERVED = new Set([
  'zenboard', 'admin', 'administrator', 'root', 'support', 'help', 'team', 'staff', 'official',
  'api', 'www', 'mail', 'billing', 'security', 'legal', 'privacy', 'terms', 'settings', 'login',
  'signup', 'waitlist', 'me', 'you', 'null', 'undefined', 'system', 'moderator', 'mod',
]);

/** Fold a typed handle to the one form that is stored and compared. */
export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

/** Why this handle cannot be taken, or null when it can. One sentence, said to a person. */
export function usernameProblem(raw: string): string | null {
  const v = normaliseUsername(raw);
  if (!v) return 'Pick a username.';
  if (v.length < 3) return 'At least 3 characters.';
  if (v.length > 20) return 'At most 20 characters.';
  if (!USERNAME_RE.test(v)) return 'Lowercase letters, numbers and underscores only.';
  if (RESERVED.has(v)) return 'That one is reserved.';
  return null;
}

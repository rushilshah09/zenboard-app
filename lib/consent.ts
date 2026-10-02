// ── THE VISITOR'S COOKIE CHOICE ────────────────────────────────────────────
//
// What a visitor has allowed beyond the essential: one first-party cookie, `zb-consent`, so the
// server could read it as well as the page, kept for a year and versioned so a change in what we
// ask can ask again.
//
// The rule every optional script must follow: it runs only if `readConsent()` says its category is
// allowed, and it listens for `CONSENT_EVENT` to start (or stop) when the choice changes. Nothing
// optional runs today (the cookie notice says so); this is the switch it will have to go through.
//
// Global Privacy Control is honoured as a refusal: a browser that sends it has already answered.

export type ConsentChoice = { analytics: boolean; marketing: boolean };
export type Consent = ConsentChoice & { v: number; at: string };

export const CONSENT_COOKIE = 'zb-consent';
/** Bumped when what we ask changes, so an old answer does not stand for a new question. */
export const CONSENT_VERSION = 1;
/** A year, in seconds: long enough not to ask every visit, short enough to ask again. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
/** Fired on `window` when the choice changes; `detail` is the new `Consent`. */
export const CONSENT_EVENT = 'zb:consent';
/** Fired on `window` to open the cookie settings from anywhere (the footer's link). */
export const CONSENT_SETTINGS_EVENT = 'zb:cookie-settings';

export const ESSENTIAL_ONLY: ConsentChoice = { analytics: false, marketing: false };
export const EVERYTHING: ConsentChoice = { analytics: true, marketing: true };

/** The stored choice, or null when there is none (or it answered an older question). */
export function parseConsent(cookieHeader: string): Consent | null {
  const raw = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    if (v.v !== CONSENT_VERSION || typeof v.analytics !== 'boolean' || typeof v.marketing !== 'boolean') return null;
    return { v: v.v, analytics: v.analytics, marketing: v.marketing, at: typeof v.at === 'string' ? v.at : '' };
  } catch {
    return null;
  }
}

/** The cookie a choice is stored as. `Secure` only where the page itself is https. */
export function serializeConsent(choice: ConsentChoice, now: Date, secure: boolean): string {
  const value: Consent = { v: CONSENT_VERSION, analytics: choice.analytics, marketing: choice.marketing, at: now.toISOString() };
  return [
    `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`,
    'Path=/',
    `Max-Age=${CONSENT_MAX_AGE}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(document.cookie);
}

export function writeConsent(choice: ConsentChoice): Consent {
  const now = new Date();
  document.cookie = serializeConsent(choice, now, location.protocol === 'https:');
  const stored: Consent = { v: CONSENT_VERSION, ...choice, at: now.toISOString() };
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: stored }));
  return stored;
}

/** Whether the browser sends Global Privacy Control, which we treat as "no" to everything optional. */
export function globalPrivacyControl(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT));
}

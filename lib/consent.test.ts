import { describe, expect, it } from 'vitest';
import { CONSENT_COOKIE, CONSENT_MAX_AGE, CONSENT_VERSION, ESSENTIAL_ONLY, EVERYTHING, parseConsent, serializeConsent } from './consent';

// The cookie choice is a promise about what may run on a visitor's device, so its storage is tested
// as a contract: what is written is what is read back, and anything else reads as "not chosen".

const at = new Date('2026-09-26T10:00:00Z');
const cookieOf = (header: string) => header.split(';')[0];

describe('the consent cookie', () => {
  it('reads back exactly what was written', () => {
    for (const choice of [ESSENTIAL_ONLY, EVERYTHING, { analytics: true, marketing: false }]) {
      const read = parseConsent(cookieOf(serializeConsent(choice, at, true)));
      expect(read).toEqual({ v: CONSENT_VERSION, ...choice, at: at.toISOString() });
    }
  });

  it('finds itself among other cookies', () => {
    const mine = cookieOf(serializeConsent(EVERYTHING, at, true));
    expect(parseConsent(`sb-abc-auth-token=xyz; ${mine}; zb-other=1`)?.analytics).toBe(true);
  });

  it('is kept for a year, for the whole site, first-party, and secure where the page is', () => {
    const header = serializeConsent(ESSENTIAL_ONLY, at, true);
    expect(header).toContain('Path=/');
    expect(header).toContain(`Max-Age=${CONSENT_MAX_AGE}`);
    expect(CONSENT_MAX_AGE).toBe(31536000);
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Secure');
    expect(serializeConsent(ESSENTIAL_ONLY, at, false)).not.toContain('Secure');
  });

  it('treats anything it did not write as no choice at all', () => {
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('zb-theme=dark')).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=not-json`)).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, analytics: 'yes', marketing: false }))}`)).toBeNull();
    // An answer to an older question does not stand for the new one.
    expect(parseConsent(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION - 1, analytics: true, marketing: true }))}`)).toBeNull();
  });

  it('allows nothing optional by default', () => {
    expect(ESSENTIAL_ONLY).toEqual({ analytics: false, marketing: false });
  });
});

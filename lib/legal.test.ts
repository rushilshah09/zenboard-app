import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COOKIES, DOCUMENTS, LEGAL, PROVIDERS, isOpen } from './legal';

// The legal pages may only say what is true of the product. These hold them to the code: every
// service they name is one the code calls, every cookie they list is one the code sets, and every
// fact about the company comes from lib/legal.ts (so the facts still open are listed, not invented).

const read = (f: string) => readFileSync(f, 'utf8');
const pages = {
  terms: read('app/legal/terms/page.tsx'),
  privacy: read('app/legal/privacy-notice/page.tsx'),
  cookies: read('app/legal/cookie-notice/page.tsx'),
  hub: read('app/legal/page.tsx'),
};
const words = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');

describe('the company facts', () => {
  it('lists the facts still to be filled in before launch, and invents none of them', () => {
    const open = Object.entries(LEGAL).filter(([, v]) => isOpen(v)).map(([k]) => k);
    // When one of these is filled in, remove it from this list: it is the launch checklist.
    expect(open).toEqual(['entity', 'contactEmail', 'address', 'governingState']);
  });

  it('is never typed into a page: the pages read it from lib/legal.ts', () => {
    for (const [name, src] of Object.entries(pages)) {
      expect(src, name).toMatch(/from '@\/lib\/legal'/);
      expect(words(src), name).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i); // no email typed in
    }
  });
});

describe('the privacy notice', () => {
  it('names every service the code sends data to, and the code calls every service it names', () => {
    const code = ['lib/email.ts', 'lib/google-calendar.ts', 'lib/ai/provider.ts', 'package.json', 'wrangler.jsonc'].map((f) => { try { return read(f); } catch { return ''; } }).join('\n');
    const calls: Record<string, RegExp> = { Supabase: /supabase/i, Cloudflare: /cloudflare|wrangler/i, Resend: /resend/i, Google: /googleapis|genai|gemini/i };
    expect(PROVIDERS.map((p) => p.name)).toEqual(Object.keys(calls));
    for (const [name, re] of Object.entries(calls)) expect(code, name).toMatch(re);
    expect(pages.privacy).toMatch(/PROVIDERS\.map/);
  });

  it('makes the promises the product keeps, and none it does not', () => {
    const p = words(pages.privacy);
    expect(p).toMatch(/We do not sell personal information/);
    expect(p).toMatch(/Global Privacy Control/);
    expect(p).toMatch(/does not process card payments today/);
  });
});

describe('the cookie notice', () => {
  it('lists the cookies the code sets', () => {
    expect(COOKIES.map((c) => c.name)).toEqual(['sb-…-auth-token', 'zb-consent', 'zb-theme']);
    expect(read('lib/consent.ts')).toMatch(/CONSENT_COOKIE = 'zb-consent'/);
    expect(read('lib/theme.ts')).toMatch(/zb-theme/);
    expect(pages.cookies).toMatch(/COOKIES\.map/);
  });

  it('says plainly that nothing optional runs today', () => {
    expect(words(pages.cookies)).toMatch(/We do not use analytics or marketing cookies today/);
  });
});

describe('the pages', () => {
  it('are all linked from the legal centre, and each one exists', () => {
    for (const d of DOCUMENTS) expect(() => read(`app${d.href}/page.tsx`)).not.toThrow();
    expect(pages.hub).toMatch(/DOCUMENTS\.map/);
  });

  it('are written as a person would say them: no em dashes, sentence case titles', () => {
    for (const [name, src] of Object.entries(pages)) {
      const strings = [...words(src).matchAll(/>([^<>{}\n]+)</g), ...words(src).matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
      for (const s of strings) expect(s, `${name}: "${s}"`).not.toMatch(/—/);
    }
    for (const d of DOCUMENTS) expect(d.title, d.title).toMatch(/^[A-Z][a-z ]+$/);
  });
});

describe('the cookie choice', () => {
  const banner = read('components/site/cookie-consent.tsx');

  it('gives declining the same weight as accepting', () => {
    const decline = banner.match(/<Button variant="(\w+)" onClick=\{\(\) => dismissBanner\(ESSENTIAL_ONLY\)\}>Decline<\/Button>/)?.[1];
    const accept = banner.match(/<Button variant="(\w+)" onClick=\{\(\) => dismissBanner\(EVERYTHING\)\}>Accept all<\/Button>/)?.[1];
    expect(decline).toBeTruthy();
    expect(decline).toBe(accept);
    // Parity alone would still allow BOTH to be the filled accent, which is two filled accents on
    // one view (CLAUDE.md) and reads as a pair of Accepts. The accent belongs here as an EDGE.
    expect(decline, 'the accept/decline pair must not carry the filled accent').not.toBe('brand');
  });

  it('treats closing the card, and Global Privacy Control, as a decline', () => {
    expect(banner).toMatch(/label="Close, and keep only essential cookies"[\s\S]{0,200}onClick=\{\(\) => dismissBanner\(ESSENTIAL_ONLY\)\}/);
    expect(banner).toMatch(/if \(state === 'open' && globalPrivacyControl\(\)\) writeConsent\(ESSENTIAL_ONLY\);/);
  });

  it('can be reopened from every page', () => {
    expect(read('components/site/site-chrome.tsx')).toMatch(/<CookieSettingsLink/);
    // ONE place, not one per page. The banner was spelled out in site-home and legal; it now stands in
    // the frame that every page stands in (site-shell.tsx), so "every page" is STRUCTURAL — a page added
    // later cannot forget the choice, because it cannot render without the shell.
    expect(read('components/site/site-shell.tsx')).toMatch(/<CookieConsent \/>/);
    for (const f of ['site-home.tsx', 'legal.tsx']) expect(read(`components/site/${f}`), f).toMatch(/<SiteShell/);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SITE_LOADER_ATTR, SITE_LOADER_EVERY, SITE_LOADER_KEY, shouldShowLoader, siteLoaderScript } from './site-loader';

// The loader plays on an open at most once every four hours. The rule is written twice, once as
// TypeScript and once as the inline script that decides before first paint, so the script is RUN
// here against the same cases: the two cannot drift apart.

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 26, 10, 0, 0);

/** Runs the inline script against a fake page; returns whether it chose to play, and what it stored. */
function run(stored: string | null, now = NOW, storageWorks = true) {
  const store = new Map<string, string>(stored == null ? [] : [[SITE_LOADER_KEY, stored]]);
  const attrs = new Set<string>();
  const localStorage = {
    getItem: (k: string) => { if (!storageWorks) throw new Error('blocked'); return store.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (!storageWorks) throw new Error('blocked'); store.set(k, v); },
  };
  const document = { documentElement: { setAttribute: (a: string) => attrs.add(a) } };
  const DateStub = { now: () => now };
  new Function('localStorage', 'document', 'Date', siteLoaderScript)(localStorage, document, DateStub);
  return { played: attrs.has(SITE_LOADER_ATTR), stored: store.get(SITE_LOADER_KEY) ?? null };
}

describe('when the loader plays', () => {
  it('plays on the first open, and remembers when', () => {
    expect(shouldShowLoader(NOW, null)).toBe(true);
    expect(run(null)).toEqual({ played: true, stored: String(NOW) });
  });

  it('does not play again inside four hours', () => {
    for (const ago of [0, 1, HOUR, 3 * HOUR, 4 * HOUR - 1]) {
      expect(shouldShowLoader(NOW, NOW - ago), `${ago}ms ago`).toBe(false);
      expect(run(String(NOW - ago)), `${ago}ms ago`).toEqual({ played: false, stored: String(NOW - ago) });
    }
  });

  it('plays again once four hours have passed', () => {
    expect(SITE_LOADER_EVERY).toBe(4 * HOUR);
    for (const ago of [4 * HOUR, 5 * HOUR, 48 * HOUR]) {
      expect(shouldShowLoader(NOW, NOW - ago), `${ago}ms ago`).toBe(true);
      expect(run(String(NOW - ago)).played, `${ago}ms ago`).toBe(true);
    }
  });

  it('treats a clock that went backwards, or a value it did not write, as never played', () => {
    expect(shouldShowLoader(NOW, NOW + HOUR)).toBe(true);
    expect(run(String(NOW + HOUR)).played).toBe(true);
    expect(run('not a time').played).toBe(true);
  });

  it('does not play at all where storage is blocked: it could not remember that it ran', () => {
    expect(run(null, NOW, false).played).toBe(false);
  });
});

describe('how it plays', () => {
  const globals = readFileSync('app/globals.css', 'utf8');

  it('is decided before the page paints, on the site\'s own pages only', () => {
    for (const f of ['components/site/site-home.tsx', 'components/site/legal.tsx']) {
      const src = readFileSync(f, 'utf8');
      const script = src.indexOf('<script dangerouslySetInnerHTML={{ __html: siteLoaderScript }} />');
      expect(script, f).toBeGreaterThan(0);
      // Before the navigation and everything under it.
      expect(script, f).toBeLessThan(src.indexOf('<SiteNav />'));
      expect(src, f).toMatch(/<SiteLoader \/>/);
    }
  });

  it('is the app\'s own mark, drawn, and leaves by itself', () => {
    expect(readFileSync('components/site/site-loader.tsx', 'utf8')).toMatch(/<DrawnMark /);
    expect(readFileSync('components/shell/boot-splash.tsx', 'utf8')).toMatch(/<DrawnMark /);
    expect(globals).toMatch(/html\[data-site-loader\] \.site-loader \{[^}]*animation: site-loader-out/);
    // The exit only fades: nothing that moves, so it needs no still twin.
    expect(globals).toMatch(/@keyframes site-loader-out \{ to \{ opacity: 0; visibility: hidden; \} \}/);
    // ...and its end takes the attribute off, so moving around the site never plays it again.
    expect(readFileSync('components/site/site-loader.tsx', 'utf8')).toMatch(/e\.animationName === 'site-loader-out'\) document\.documentElement\.removeAttribute\(SITE_LOADER_ATTR\)/);
  });
});

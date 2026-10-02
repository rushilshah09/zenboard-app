import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (f: string) => readFileSync(f, 'utf8');
import { SITE_LOADER_ATTR, SITE_LOADER_EVERY, SITE_LOADER_KEY, SITE_LOADER_WAIT, loaderScript, shouldShowLoader, siteLoaderScript } from './site-loader';

// The loader plays on the first open on a device and then on every fifth (production), or on every open
// (development). The rule is written twice, once as TypeScript and once as the inline script that
// decides before first paint, so the script is RUN here against the same cases: the two cannot drift.

/** Runs the inline script against a fake page; returns whether it chose to play, and what it stored. */
function run(stored: string | null, every = 5, storageWorks = true) {
  const store = new Map<string, string>(stored == null ? [] : [[SITE_LOADER_KEY, stored]]);
  const attrs = new Set<string>();
  const style = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => { if (!storageWorks) throw new Error('blocked'); return store.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (!storageWorks) throw new Error('blocked'); store.set(k, v); },
  };
  const document = { documentElement: { setAttribute: (a: string) => attrs.add(a), style: { setProperty: (k: string, v: string) => style.set(k, v) } } };
  new Function('localStorage', 'document', loaderScript(every))(localStorage, document);
  const played = attrs.has(SITE_LOADER_ATTR);
  // Whenever it plays, the first screen is told to wait for it; when it does not, nothing waits.
  expect(style.get('--site-wait') ?? null).toBe(played ? SITE_LOADER_WAIT : null);
  return { played, stored: store.get(SITE_LOADER_KEY) ?? null };
}

describe('when the loader plays', () => {
  it('plays on every fifth open in production and on every open while developing', () => {
    expect(SITE_LOADER_EVERY).toBe(process.env.NODE_ENV === 'production' ? 5 : 1);
    expect(siteLoaderScript).toBe(loaderScript(SITE_LOADER_EVERY));
  });

  it('plays on the first open, and counts it', () => {
    expect(shouldShowLoader(1, 5)).toBe(true);
    expect(run(null)).toEqual({ played: true, stored: '1' });
  });

  it('then plays again on every fifth open: the 6th, the 11th', () => {
    const plays: number[] = [];
    let stored: string | null = null;
    for (let open = 1; open <= 16; open++) {
      const r = run(stored);
      expect(r.stored).toBe(String(open));
      expect(r.played, `open ${open}`).toBe(shouldShowLoader(open, 5));
      if (r.played) plays.push(open);
      stored = r.stored;
    }
    expect(plays).toEqual([1, 6, 11, 16]);
  });

  it('plays on every open while developing', () => {
    let stored: string | null = null;
    for (let open = 1; open <= 4; open++) {
      const r = run(stored, 1);
      expect(r.played).toBe(true);
      stored = r.stored;
    }
  });

  it('treats a value it did not write, or the time the four-hour rule used to keep, as never opened', () => {
    expect(run('not a count')).toEqual({ played: true, stored: '1' });
    expect(run(String(Date.UTC(2026, 8, 26)))).toEqual({ played: true, stored: '1' });
    expect(run('-3')).toEqual({ played: true, stored: '1' });
  });

  it('cannot count where storage is blocked: it does not play in production, and plays while developing', () => {
    expect(run(null, 5, false).played).toBe(false);
    expect(run(null, 1, false).played).toBe(true);
  });
});

describe('how it plays', () => {
  const globals = readFileSync('app/globals.css', 'utf8');

  it('is decided before the page paints, on the site\'s own pages only', () => {
    // ONE frame for every page of the site (site-shell.tsx), so a new page cannot leave it out.
    const f = 'components/site/site-shell.tsx';
    const src = readFileSync(f, 'utf8');
    const script = src.indexOf('<script dangerouslySetInnerHTML={{ __html: siteLoaderScript }} />');
    expect(script, f).toBeGreaterThan(0);
    // Before the navigation and everything under it.
    expect(script, f).toBeLessThan(src.indexOf('<SiteNav />'));
    expect(src, f).toMatch(/<SiteLoader \/>/);
    for (const page of ['components/site/site-home.tsx', 'components/site/legal.tsx']) {
      expect(readFileSync(page, 'utf8'), page).toMatch(/<SiteShell /);
    }
  });

  it('is the app\'s own mark, drawn, and leaves by itself', () => {
    expect(readFileSync('components/site/site-loader.tsx', 'utf8')).toMatch(/<DrawnMark /);
    expect(readFileSync('components/shell/boot-splash.tsx', 'utf8')).toMatch(/<DrawnMark /);
    expect(globals).toMatch(/html\[data-site-loader\] \.site-loader \{[^}]*animation: site-loader-out/);
    // The exit only fades: nothing that moves, so it needs no still twin.
    expect(globals).toMatch(/@keyframes site-loader-out \{ to \{ opacity: 0; visibility: hidden; \} \}/);
    // ...and once its exit has finished the attribute comes off, so moving around the site never plays
    // it again. Read from the running animation rather than an event, so a page that woke after the
    // cover had already gone still takes it off.
    const loader = readFileSync('components/site/site-loader.tsx', 'utf8');
    expect(loader).toMatch(/\(a as CSSAnimation\)\.animationName === 'site-loader-out'/);
    expect(loader).toMatch(/cover\.finished\.then\(\(\) => \{ if \(live\) root\.removeAttribute\(SITE_LOADER_ATTR\); \}/);
  });

  it('holds the first screen until its cover lifts, and never moves that moment while the words arrive', () => {
    // The wait is the cover's own delay, spelled once.
    expect(globals).toContain(`animation: site-loader-out calc(var(--duration-slow) * 1.5) var(--ease-out-quiet) ${SITE_LOADER_WAIT} both;`);
    // ...and it leaves only once the mark is whole: the fill has landed before the cover moves.
    expect(globals).toMatch(/\.site-loader \.zb-splash-fill \{ animation: zb-mark-fill calc\(var\(--duration-slow\) \* 3\) calc\(var\(--duration-slow\) \* 4\)/);
    expect(read('components/ds/ui/drawn-mark.tsx')).toMatch(/overflow="visible"/);
    expect(globals).toMatch(/\.site-rise, \.site-rise-lift, \.site-rise-words \.site-word \{[^}]*animation-delay: calc\(var\(--site-wait\) \+/);
    // It is written on <html> by the script, not derived from the attribute: the attribute comes off
    // when the cover has gone, which would have moved every word still arriving.
    expect(globals).not.toMatch(/html\[data-site-loader\][^{]*\{[^}]*--site-wait/);
    // A page reached by moving around the site, where nothing played, waits for nothing.
    expect(readFileSync('components/site/site-loader.tsx', 'utf8')).toMatch(/if \(!root\.hasAttribute\(SITE_LOADER_ATTR\)\) \{\s*root\.style\.removeProperty\('--site-wait'\);/);
  });
});

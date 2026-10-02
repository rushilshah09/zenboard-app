import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  themeInitScript, watchSystemTheme, applyAppearance, APPEARANCE_EVENT, DEFAULT_THEME, THEME_KEY, ACCENT_KEY, SKIN_KEY, ACCENTS,
  SITE_PATHS, isSitePath,
} from './theme';

// The boot script is a STRING that runs in <head> before first paint, so the only
// honest test is to run it. It reads three globals — document, localStorage and
// window.matchMedia — handed in here as stubs. Its try/catch swallows every error,
// so each assertion names a concrete value rather than trusting a quiet run.
function boot({ stored = {}, osDark, path }: { stored?: Record<string, string>; osDark: boolean; path?: string }) {
  const attrs: Record<string, string> = {};
  const props: Record<string, string> = {};
  const document = {
    documentElement: {
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      style: { setProperty: (k: string, v: string) => { props[k] = v; } },
    },
  };
  const localStorage = { getItem: (k: string) => (k in stored ? stored[k] : null) };
  const window = { matchMedia: (q: string) => ({ matches: osDark && q.includes('dark') }), location: path ? { pathname: path } : undefined };
  new Function('document', 'localStorage', 'window', themeInitScript)(document, localStorage, window);
  return { theme: attrs['data-theme'], accent: props['--accent'], skin: attrs['data-skin'] };
}

const berry = ACCENTS.find((a) => a.id === 'berry')!;

describe('the theme a first visit gets', () => {
  it('is LIGHT, whatever the desktop is set to', () => {
    // User directive, 2026-09-25: "i want light mode is default". It followed the OS from
    // 2026-09-12 (the Notion/Linear behaviour), and the reason that is reversible without losing
    // anything is that the OS is a guess at a preference, while the product is drawn against a
    // light reference: a first visit from a dark desktop would otherwise meet Zenboard in a
    // theme it was not designed in. Dark stays one switch away, and is still verified in every
    // state, overlays open included (PROGRESS 2026-09-12/14).
    expect(DEFAULT_THEME).toBe('light');
    expect(boot({ osDark: true }).theme).toBe('light');
    expect(boot({ osDark: false }).theme).toBe('light');
  });

  it('never lets the OS override an explicit choice', () => {
    expect(boot({ stored: { [THEME_KEY]: 'light' }, osDark: true }).theme).toBe('light');
    expect(boot({ stored: { [THEME_KEY]: 'dark' }, osDark: false }).theme).toBe('dark');
    expect(boot({ stored: { [THEME_KEY]: 'system' }, osDark: true }).theme).toBe('dark');
  });

  it('paints the accent for the theme it RESOLVED, not the one it was asked for', () => {
    // Berry's light value is 2.91:1 on a dark card, so dark has its own. Whoever RESOLVES to
    // dark — by choosing it, or by choosing System on a dark desktop — must get the dark berry
    // before first paint.
    expect(boot({ stored: { [THEME_KEY]: 'system' }, osDark: true }).accent).toBe(berry.dark);
    expect(boot({ stored: { [THEME_KEY]: 'dark' }, osDark: false }).accent).toBe(berry.dark);
    expect(boot({ osDark: true }).accent).toBe(berry.hex);   // a first visit is light, so is its berry
    expect(boot({ osDark: false }).accent).toBe(berry.hex);
    expect(boot({ stored: { [THEME_KEY]: 'light', [ACCENT_KEY]: 'berry' }, osDark: true }).accent).toBe(berry.hex);
  });
});

describe('a System reader follows the OS for the life of the session', () => {
  // The boot script resolves once, before paint. After that `watchSystemTheme`
  // (mounted by AppearanceBoot in the root layout) keeps the page in step when the
  // OS flips at sunset. Seen in the browser too — a listener on the same media query
  // found data-theme already flipped when `change` fired, both ways — but colour-
  // scheme emulation is not the OS, so this pins the logic itself.
  afterEach(() => vi.unstubAllGlobals());

  function stubPage(stored: Record<string, string>, osDark: boolean) {
    let matches = osDark;
    const listeners: Array<() => void> = [];
    const removed: Array<() => void> = [];
    const attrs: Record<string, string> = {};
    const events: string[] = [];
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k in stored ? stored[k] : null) });
    vi.stubGlobal('document', {
      documentElement: {
        // `getAttribute` is not decoration: applyAppearance reads the theme it is
        // replacing, to decide whether this is a flip worth holding transitions for.
        getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
        setAttribute: (k: string, v: string) => { attrs[k] = v; },
        style: { setProperty: () => {} },
      },
      createElement: () => ({ textContent: '', remove: () => {} }),
      head: { appendChild: () => {} },
      body: { offsetHeight: 0 },
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({
        get matches() { return matches; },
        addEventListener: (_type: string, fn: () => void) => { listeners.push(fn); },
        removeEventListener: (_type: string, fn: () => void) => { removed.push(fn); },
      }),
      dispatchEvent: (e: Event) => { events.push(e.type); return true; },
    });
    const flip = (dark: boolean) => { matches = dark; listeners.forEach((fn) => fn()); };
    return { attrs, events, listeners, removed, flip };
  }

  it('re-resolves on every OS flip for whoever CHOSE System', () => {
    const page = stubPage({ [THEME_KEY]: 'system' }, true);
    watchSystemTheme();
    expect(page.listeners, 'watchSystemTheme did not subscribe').toHaveLength(1);
    page.flip(false);
    expect(page.attrs['data-theme']).toBe('light');
    page.flip(true);
    expect(page.attrs['data-theme']).toBe('dark');
    expect(page.events).toEqual([APPEARANCE_EVENT, APPEARANCE_EVENT]);
  });

  it('leaves everyone else alone when the desktop flips at sunset', () => {
    // Since 2026-09-25 a first visit is LIGHT rather than System, so "nothing chosen" is no
    // longer a live subscription to the OS: the page must not change under someone who never
    // asked it to.
    const page = stubPage({}, false);
    watchSystemTheme();
    page.flip(true);
    expect(page.attrs['data-theme']).not.toBe('dark');
    expect(page.events).toEqual([]);
  });

  it('leaves an explicit choice alone when the OS flips', () => {
    const page = stubPage({ [THEME_KEY]: 'light' }, false);
    watchSystemTheme();
    page.flip(true);
    expect(page.attrs['data-theme']).toBeUndefined();
    expect(page.events).toEqual([]);
  });

  it('unsubscribes the same listener when the page lets go', () => {
    const page = stubPage({}, true);
    const stop = watchSystemTheme();
    stop();
    expect(page.removed).toHaveLength(1);
    expect(page.removed).toEqual(page.listeners);
  });
});

describe('a theme flip lands instead of smearing', () => {
  // Flipping the theme rewrites colour, background, border and shadow on nearly
  // every element, and the app carries 160 colour transitions. So the swap runs
  // behind a `transition:none` override. Both edges matter: the override has to
  // be in the document while the new theme commits, and gone again before the
  // reader touches anything, or the app would sit with motion disabled.
  afterEach(() => vi.unstubAllGlobals());

  function stubDom(initial: string | null) {
    const attrs: Record<string, string> = {};
    if (initial) attrs['data-theme'] = initial;
    const injected: Array<{ textContent: string; live: boolean }> = [];
    const frames: Array<() => void> = [];
    let flushes = 0;
    vi.stubGlobal('document', {
      documentElement: {
        getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
        setAttribute: (k: string, v: string) => { attrs[k] = v; },
        style: { setProperty: () => {} },
      },
      createElement: () => ({ textContent: '', live: false, remove(this: { live: boolean }) { this.live = false; } }),
      head: { appendChild: (node: { live: boolean }) => { node.live = true; injected.push(node as never); } },
      get body() { return { get offsetHeight() { flushes += 1; return 0; } }; },
    });
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { frames.push(fn); return frames.length; });
    return { attrs, injected, frames, flushes: () => flushes };
  }

  it('holds transitions across the swap, then gives them back two frames later', () => {
    const dom = stubDom('light');
    applyAppearance('dark', 'comfortable');

    expect(dom.attrs['data-theme']).toBe('dark');
    expect(dom.injected, 'the flip ran with transitions live').toHaveLength(1);
    expect(dom.injected[0].textContent).toContain('transition:none');
    expect(dom.injected[0].live, 'the override was dropped before the theme committed').toBe(true);
    expect(dom.flushes(), 'nothing forced the style flush, so the browser can still batch both changes').toBe(1);

    dom.frames.shift()!();
    expect(dom.injected[0].live, 'one frame is too early - it belongs to the paint that just committed').toBe(true);
    dom.frames.shift()!();
    expect(dom.injected[0].live, 'transitions never came back').toBe(false);
  });

  it('restores even when no frame ever runs - a hidden tab never fires rAF', () => {
    // Found in the browser, not in review: with the pane hidden, the rAF pair
    // never ran and the override stayed in <head>, leaving the app with motion
    // disabled. The OS flipping at sunset reaches a background tab this way.
    vi.useFakeTimers();
    const dom = stubDom('light');
    vi.stubGlobal('requestAnimationFrame', undefined);
    applyAppearance('dark', 'comfortable');
    expect(dom.injected[0].live, 'the override never went in').toBe(true);
    vi.advanceTimersByTime(200);
    expect(dom.injected[0].live, 'no frame ran, so nothing gave transitions back').toBe(false);
    vi.useRealTimers();
  });

  it('leaves an accent change alone - it is not a repaint of every surface', () => {
    const dom = stubDom('dark');
    applyAppearance('dark', 'comfortable', 'blue');
    expect(dom.injected).toEqual([]);
  });

  it('does not hold on the first stamp, which only repeats the boot script', () => {
    const dom = stubDom(null);
    applyAppearance('dark', 'comfortable');
    expect(dom.attrs['data-theme']).toBe('dark');
    expect(dom.injected).toEqual([]);
  });
});

describe('the website has one appearance', () => {
  // User, 2026-09-29: "right now we only keep light mode, we're removing dark mode" — of the website.
  // Its pages and the demo it frames are drawn in light, the default skin and the brand's berry; the
  // app keeps whatever was chosen, and the choice itself is never touched.
  afterEach(() => vi.unstubAllGlobals());
  const CHOSE = { [THEME_KEY]: 'dark', [ACCENT_KEY]: 'blue', [SKIN_KEY]: 'paper' };

  it('knows its own addresses: every page in the site list, and the demo', () => {
    for (const path of ['/', '/legal', '/legal/terms', '/legal/privacy-notice', '/legal/cookie-notice', '/demo']) {
      expect(SITE_PATHS, path).toContain(path);
      expect(isSitePath(path), path).toBe(true);
    }
    expect(isSitePath('/legal/'), 'a trailing slash is the same page').toBe(true);
    for (const path of ['/today', '/login', '/projects/p-1', '/p/abc', '/demo-x']) expect(isSitePath(path), path).toBe(false);
  });

  it('boots every site address light, default and berry, whatever was chosen', () => {
    for (const path of ['/', '/legal/terms', '/demo']) {
      const b = boot({ stored: CHOSE, osDark: true, path });
      expect(b.theme, path).toBe('light');
      expect(b.skin, path).toBe('default');
      expect(b.accent, path).toBe(berry.hex);
    }
  });

  it('leaves the app to the stored choice', () => {
    expect(boot({ stored: { [THEME_KEY]: 'dark' }, osDark: false, path: '/today' }).theme).toBe('dark');
    expect(boot({ stored: CHOSE, osDark: false, path: '/login' }).skin).toBe('paper');
  });

  it('holds on every later apply while the address is the site’s', () => {
    const attrs: Record<string, string> = {};
    vi.stubGlobal('document', {
      documentElement: {
        getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
        setAttribute: (k: string, v: string) => { attrs[k] = v; },
        style: { setProperty: () => {}, removeProperty: () => {} },
      },
      createElement: () => ({ textContent: '', remove: () => {} }),
      head: { appendChild: () => {} },
      body: { offsetHeight: 0 },
    });
    const location = { pathname: '/' };
    vi.stubGlobal('window', { location, matchMedia: () => ({ matches: true }) });
    applyAppearance('dark', 'compact', 'blue', 'paper');
    expect(attrs['data-theme']).toBe('light');
    expect(attrs['data-skin']).toBe('default');
    expect(attrs['data-density']).toBe('comfortable');
    location.pathname = '/today';
    applyAppearance('dark', 'compact', 'blue', 'paper');
    expect(attrs['data-skin'], 'the app keeps the chosen skin').toBe('paper');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  themeInitScript, watchSystemTheme, applyAppearance, APPEARANCE_EVENT, DEFAULT_THEME, THEME_KEY, ACCENT_KEY, ACCENTS,
} from './theme';

// The boot script is a STRING that runs in <head> before first paint, so the only
// honest test is to run it. It reads three globals — document, localStorage and
// window.matchMedia — handed in here as stubs. Its try/catch swallows every error,
// so each assertion names a concrete value rather than trusting a quiet run.
function boot({ stored = {}, osDark }: { stored?: Record<string, string>; osDark: boolean }) {
  const attrs: Record<string, string> = {};
  const props: Record<string, string> = {};
  const document = {
    documentElement: {
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      style: { setProperty: (k: string, v: string) => { props[k] = v; } },
    },
  };
  const localStorage = { getItem: (k: string) => (k in stored ? stored[k] : null) };
  const window = { matchMedia: (q: string) => ({ matches: osDark && q.includes('dark') }) };
  new Function('document', 'localStorage', 'window', themeInitScript)(document, localStorage, window);
  return { theme: attrs['data-theme'], accent: props['--accent'] };
}

const berry = ACCENTS.find((a) => a.id === 'berry')!;

describe('the theme a first visit gets', () => {
  it('follows the OS when nothing has been chosen', () => {
    // Both themes are verified in every state — at rest, and with menus, selects
    // and dialogs open (PROGRESS, 2026-09-12/14) — so a first visit takes the
    // reader's own setting, as Notion and Linear do, instead of forcing light
    // onto a dark desktop.
    expect(DEFAULT_THEME).toBe('system');
    expect(boot({ osDark: true }).theme).toBe('dark');
    expect(boot({ osDark: false }).theme).toBe('light');
  });

  it('never lets the OS override an explicit choice', () => {
    expect(boot({ stored: { [THEME_KEY]: 'light' }, osDark: true }).theme).toBe('light');
    expect(boot({ stored: { [THEME_KEY]: 'dark' }, osDark: false }).theme).toBe('dark');
    expect(boot({ stored: { [THEME_KEY]: 'system' }, osDark: true }).theme).toBe('dark');
  });

  it('paints the accent for the theme it RESOLVED, not the one it was asked for', () => {
    // Berry's light value is 2.91:1 on a dark card, so dark has its own. A
    // first visit on a dark OS must get the dark berry before first paint.
    expect(boot({ osDark: true }).accent).toBe(berry.dark);
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

  it('re-resolves on every OS flip when nothing was chosen', () => {
    const page = stubPage({}, true);
    watchSystemTheme();
    expect(page.listeners, 'watchSystemTheme did not subscribe').toHaveLength(1);
    page.flip(false);
    expect(page.attrs['data-theme']).toBe('light');
    page.flip(true);
    expect(page.attrs['data-theme']).toBe('dark');
    expect(page.events).toEqual([APPEARANCE_EVENT, APPEARANCE_EVENT]);
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

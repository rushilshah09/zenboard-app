import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_SIDEBAR_MODE, SIDEBAR_COOKIE, isSidebarMode, toSidebarMode, writeSidebarCookie,
} from './sidebar-mode';

// The sidebar's saved mode moved from `localStorage` into a cookie so the SERVER
// can read it. That is the whole point: `localStorage` is invisible to a server
// render, so every page load painted the expanded sidebar and then corrected it
// — and for `collapsed`/`hover` that is a layout reflow, not a style flicker,
// because `hover` renders a structurally different tree.
//
// What is testable without a DOM or a session is the parsing, which is what
// stands between a cookie value and the layout.

describe('toSidebarMode', () => {
  it('accepts the three real modes', () => {
    for (const m of ['expanded', 'collapsed', 'hover'] as const) {
      expect(toSidebarMode(m)).toBe(m);
    }
  });

  it('falls back for anything else, because a cookie is user-editable', () => {
    // This value arrives from the request. It can be absent, stale from an older
    // build, or hand-edited — none of which may throw or render a broken shell.
    for (const bad of [null, undefined, '', 'EXPANDED', 'wide', 'true', '1', '{}']) {
      expect(toSidebarMode(bad), String(bad)).toBe(DEFAULT_SIDEBAR_MODE);
    }
  });

  it('defaults to expanded — the mode that needs no saved preference', () => {
    expect(DEFAULT_SIDEBAR_MODE).toBe('expanded');
  });
});

describe('isSidebarMode', () => {
  it('narrows only the three modes', () => {
    expect(isSidebarMode('hover')).toBe(true);
    expect(isSidebarMode('hovering')).toBe(false);
    expect(isSidebarMode(null)).toBe(false);
    expect(isSidebarMode(undefined)).toBe(false);
  });
});

describe('writeSidebarCookie', () => {
  const hadDocument = 'document' in globalThis;
  afterEach(() => {
    if (!hadDocument) Reflect.deleteProperty(globalThis, 'document');
  });

  it('does nothing on the server rather than throwing', () => {
    // It is imported by a module the server also imports; touching `document`
    // unguarded would break the render, not just the preference.
    expect(hadDocument).toBe(false);
    expect(() => writeSidebarCookie('collapsed')).not.toThrow();
  });

  it('writes a long-lived, path-wide, lax cookie', () => {
    let written = '';
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { set cookie(v: string) { written = v; }, get cookie() { return written; } },
    });
    writeSidebarCookie('hover');
    expect(written).toContain(`${SIDEBAR_COOKIE}=hover`);
    expect(written).toContain('path=/');          // every route renders the shell
    expect(written).toContain('max-age=31536000'); // a preference, not a session
    expect(written).toContain('samesite=lax');
  });
});

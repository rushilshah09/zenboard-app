import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { crumbRole, trailParts } from './breadcrumbs';

// The breadcrumb, 2026-09-14 (user brief: "our current breadcrumbs look cheap
// because of the underline treatment … should feel like a native navigation
// system, not a collection of links"). Every crumb became ONE control: a quiet
// pill that washes on hover — no underline, and no separate caret button beside
// it, whose invisible 20px slot was the uneven gap before every "/".

describe('crumbRole — what pressing a crumb does', () => {
  const menu = () => [];
  const go = () => {};

  it('a crumb that leads somewhere goes there, even when it also has a menu', () => {
    expect(crumbRole({ label: 'Draft', onNavigate: go }, false)).toBe('place');
    expect(crumbRole({ label: 'Draft', onNavigate: go, menu }, false)).toBe('place');
    expect(crumbRole({ label: 'Projects', href: '/projects' }, false)).toBe('place');
  });

  it('the page you are on never navigates to itself: with a menu, pressing it opens the menu', () => {
    expect(crumbRole({ label: 'Launch plan', onNavigate: go, menu }, true)).toBe('menu');
    expect(crumbRole({ label: 'Launch plan', onNavigate: go }, true)).toBe('text');
  });

  it('a crumb with only a menu opens it — there is nowhere else for it to go', () => {
    // Content's stage crumb: its menu MOVES the piece to another stage.
    expect(crumbRole({ label: 'Idea', menu }, false)).toBe('menu');
  });

  it('a crumb with neither is just words', () => {
    expect(crumbRole({ label: 'Tuesday 14 September' }, false)).toBe('text');
  });
});

describe('trailParts — how much of the path survives', () => {
  const parts = (n: number, collapse: boolean) => trailParts(Array.from({ length: n }, (_, i) => `a${i}`), collapse);

  it('keeps up to three ancestors whole', () => {
    expect(parts(3, false)).toEqual({ head: ['a0', 'a1', 'a2'], hidden: [], tail: [] });
  });

  it('beyond that the MIDDLE collapses — never the root, never the direct parent', () => {
    expect(parts(5, false)).toEqual({ head: ['a0'], hidden: ['a1', 'a2', 'a3'], tail: ['a4'] });
  });

  it('on a narrow screen every ancestor moves into the "…"', () => {
    expect(parts(2, true)).toEqual({ head: [], hidden: ['a0', 'a1'], tail: [] });
    expect(parts(0, true)).toEqual({ head: [], hidden: [], tail: [] });
  });
});

describe('the crumb (source)', () => {
  // Comments are blanked first: this file's own history explains the underline.
  const code = readFileSync('components/ds/ui/breadcrumbs.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('never underlines — hover is a soft wash, like every other row in the app', () => {
    expect(code).not.toMatch(/\bunderline\b/);
    expect(code).toMatch(/hover:bg-surface-hover/);
  });

  it('holds the wash while its menu is open, so you can see which crumb it belongs to', () => {
    expect(code).toMatch(/data-\[state=open\]:bg-surface-hover/);
  });

  it('has no caret button of its own beside the label', () => {
    // The caret was a second control per crumb: two tab stops for one place.
    expect(code).not.toMatch(/reveal-on-hover/);
  });

  it('keeps a 44px hit area on a finger, as Button does', () => {
    expect(code).toMatch(/\[@media\(pointer:coarse\)\]:after:h-11/);
  });
});

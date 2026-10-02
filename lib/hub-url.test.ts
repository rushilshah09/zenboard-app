import { describe, it, expect } from 'vitest';

// `useModeParam`'s resolution rule, extracted so it can be tested without a
// router. Kept in step with the hook by shape, and the cases below are the ones
// that were actually wrong in the app before this file existed.
function resolve<T extends string>(
  raw: string | null,
  fallback: T,
  valid: readonly T[],
  aliases?: Readonly<Record<string, T>>,
): T {
  const resolved = (raw && aliases?.[raw]) ?? (raw as T | null);
  return resolved && valid.includes(resolved) ? resolved : fallback;
}

const TABS = ['overview', 'tasks', 'docs', 'files', 'money', 'portal'] as const;
const MOVED = { forms: 'docs' } as const;

describe('mode resolution', () => {
  it('takes a valid mode from the URL', () => {
    expect(resolve('portal', 'overview', TABS)).toBe('portal');
  });

  it('falls back when the param is absent or junk', () => {
    expect(resolve(null, 'overview', TABS)).toBe('overview');
    expect(resolve('nonsense', 'overview', TABS)).toBe('overview');
    expect(resolve('', 'overview', TABS)).toBe('overview');
  });

  it('resolves a RETIRED mode name through its alias', () => {
    // `?tab=forms` predates Forms being folded into Docs. Links live in emails
    // and notifications long after a screen is reorganised.
    expect(resolve('forms', 'overview', TABS, MOVED)).toBe('docs');
  });

  it('THE BUG THIS FIXES: a real tab the route forgot to whitelist', () => {
    // The project route listed five tabs — overview/tasks/docs/money/portal —
    // while the hub had six. `?tab=files` was a legitimate deep link that
    // silently landed on Overview, because the whitelist and the tab list were
    // two lists in two files. There is one list now.
    expect(resolve('files', 'overview', TABS)).toBe('files');
  });

  it('an alias pointing at something invalid still falls back', () => {
    // A rename that is itself out of date must not smuggle a dead mode through.
    expect(resolve('forms', 'overview', TABS, { forms: 'gone' as never })).toBe('overview');
  });
});

// ── Several modes, one step ────────────────────────────────────────────────
// "12 more in Library" opens the Library ALREADY filtered to published. Two
// setters in a row pushed two history entries, so Back stopped first at an
// unfiltered Library nobody had visited.
import { writeModes } from './hub-url';

describe('writeModes', () => {
  it('pushes ONE history entry carrying every key, and removes a key set to null', () => {
    const pushed: string[] = [];
    const replaced: string[] = [];
    const g = globalThis as { window?: unknown };
    const before = g.window;
    g.window = {
      location: { search: '?view=board&piece=p1', pathname: '/content' },
      history: {
        pushState: (_s: unknown, _t: string, href: string) => { pushed.push(href); },
        replaceState: (_s: unknown, _t: string, href: string) => { replaced.push(href); },
      },
    };
    try {
      writeModes({ view: 'library', kind: 'published', piece: null });
      expect(pushed).toEqual(['?view=library&kind=published']);
      expect(replaced, 'a mode is a place you go back from, never a replace').toEqual([]);
    } finally {
      g.window = before;
    }
  });

  it('removing the last key leaves the bare path, not a dangling "?"', () => {
    const pushed: string[] = [];
    const g = globalThis as { window?: unknown };
    const before = g.window;
    g.window = {
      location: { search: '?kind=saved', pathname: '/content' },
      history: { pushState: (_s: unknown, _t: string, href: string) => { pushed.push(href); }, replaceState: () => {} },
    };
    try {
      writeModes({ kind: null });
      expect(pushed).toEqual(['/content']);
    } finally {
      g.window = before;
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── ONE NAV ROW, TWO COLUMNS ───────────────────────────────────────────────
// Zenboard shows two navigation columns side by side — the app sidebar and,
// inside a hub, the record rail. They are the same kind of row (32px, a 20px
// glyph, a label) and they had drifted apart on every measurement around that
// glyph:
//
//                    sidebar    rail
//   column inset       8px      14px   (`p-3.5`, the only unnamed number)
//   glyph → label      4px       8px
//   row → row          4px       2px
//   radius            6/8 literal  rounded-sm
//
// Compounded, a sidebar label started at x=40 and a rail label at x=50. The
// user's report was "padding is not consistent"; nobody had chosen the
// stagger, it is what two hand-written versions of one idea drift into.

const css = readFileSync('app/globals.css', 'utf8');
// The nav row's geometry lives in shell-parts.tsx (shared by the app, the demo and the pinned rows);
// the shell itself still owns the column.
const shell = readFileSync('components/shell/app-shell.tsx', 'utf8') + readFileSync('components/shell/shell-parts.tsx', 'utf8');
const rail = readFileSync('components/tasks/tasks-rail.tsx', 'utf8');
const hub = readFileSync('components/ui/hub-layout.tsx', 'utf8');

/** The declared value of a `--token` in globals.css. */
function token(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  expect(m, `${name} is not declared`).not.toBeNull();
  return m![1].trim();
}

describe('the nav row recipe is declared once', () => {
  it('names every measurement the two columns disagreed on', () => {
    expect(token('--nav-inset')).toBe('8px');
    expect(token('--nav-px')).toBe('8px');
    expect(token('--nav-gap')).toBe('8px');
    // 2px until 2026-09-29. The user looked at a hovered row and asked for "4 side equal
    // spacing visually": a nav pill has 9px to the panel wall and had 2px to the pill above
    // and below, so the highlight read as crushed vertically and floating horizontally. 6px
    // is where the four sides balance — an OPEN gap next to a gap bounded by the panel's
    // border reads smaller, so 6 open answers 9 bounded. Rendered at 2.6x before choosing;
    // the reasoning and the rejected options are in globals.css beside the token.
    expect(token('--nav-row-gap')).toBe('6px');
  });
});

describe('both columns read it', () => {
  it('the sidebar row takes its gap, inset and radius from tokens', () => {
    expect(shell).toMatch(/gap: 'var\(--nav-gap,/);
    // One geometry in both states: the inset glides from --nav-px to the rail's (rail-motion.ts).
    expect(shell).toMatch(/padding: collapsed \? '0 var\(--nav-rail-px, 6px\)' : '0 var\(--nav-px, 8px\)', justifyContent: 'flex-start'/);
    expect(shell, 'one radius in BOTH states — a row must not change shape when selected')
      .toMatch(/borderRadius: 'var\(--r-sm,/);
    expect(shell, 'no literal 6-or-8 radius left on the nav row').not.toMatch(/borderRadius: active \? 8 : 6/);
  });

  it('the sidebar column and the hub rail take the same inset', () => {
    expect(shell).toMatch(/<nav style=\{\{ padding: 'var\(--nav-inset, 8px\)'/);
    expect(hub, 'p-3.5 was 14px — the only unnamed number in the set').not.toMatch(/'p-3\.5'/);
    expect(hub).toMatch(/p-\[var\(--nav-inset,/);
  });

  it('the rail row matches the sidebar row', () => {
    expect(rail).toMatch(/gap-\[var\(--nav-gap,/);
    expect(rail).toMatch(/px-\[var\(--nav-px,/);
  });

  it('drops the stray 34px collapsed width', () => {
    // The same unnamed 34 the row-height sweep found sixteen times. A collapsed
    // rail row is square because it STRETCHES to the rail's 32px column; the pinned
    // rail carried the last 34 until the collapse was made one geometry.
    expect(shell).not.toMatch(/width: collapsed \? 34 :/);
    expect(readFileSync('components/shell/pinned-rail.tsx', 'utf8')).not.toMatch(/width: collapsed \? 34 :/);
  });

  it('names the rail inset, and derives it', () => {
    expect(token('--nav-rail-px')).toBe('calc((var(--sidebar-w-collapsed) - 2px - 2 * var(--nav-inset) - 20px) / 2)');
  });
});

describe('a token that does not resolve degrades to the value it stands for', () => {
  // Turbopack serves stale CSS across restarts (recorded), and an inline
  // style has no cascade to fall back on: an unresolved `var(--nav-gap)`
  // computes to `gap: normal` and `padding: 0`, which is a hard visual break
  // rather than a graceful one. Every use therefore carries a fallback —
  // and every fallback must equal the token, or the two drift.
  // Named explicitly, not matched by a `--nav-*` prefix: `--nav-active-bg` is
  // a COLOUR on the mobile tab bar, and a colour that fails to resolve goes
  // transparent rather than collapsing a layout. Different risk, different
  // rule — a wildcard here would drag it in and force a pointless fallback.
  const RHYTHM = '(--nav-inset|--nav-px|--nav-gap|--nav-row-gap|--row-nav|--r-sm)';
  const uses = [
    ...shell.matchAll(new RegExp(`var\\(${RHYTHM},\\s*([^)]+)\\)`, 'g')),
    ...rail.matchAll(new RegExp(`var\\(${RHYTHM},\\s*([^)\\]]+)\\)`, 'g')),
    ...hub.matchAll(new RegExp(`var\\(${RHYTHM},\\s*([^)\\]]+)\\)`, 'g')),
  ];

  it('every nav token is used WITH a fallback', () => {
    // Only the FOUR tokens this change introduced. `--row-nav` and `--r-sm`
    // have shipped for a while and are already in every compiled stylesheet;
    // retro-fitting fallbacks onto every existing use of them is a separate
    // sweep, not a rider on this one.
    const NEW = '(--nav-inset|--nav-px|--nav-gap|--nav-row-gap)';
    const bareRe = () => new RegExp(`var\\(${NEW}\\)`, 'g');
    const bare = [
      ...shell.matchAll(bareRe()), ...rail.matchAll(bareRe()), ...hub.matchAll(bareRe()),
    ].map((m) => m[1]);
    expect(bare, 'these would collapse to 0 on stale CSS').toEqual([]);
  });

  it('and no fallback disagrees with its token', () => {
    expect(uses.length).toBeGreaterThan(5);
    for (const m of uses) {
      const [, name, fallback] = m;
      if (name === '--r-sm') continue;   // declared as an alias, not a length
      expect(fallback.trim(), `${name} fallback drifted from its declaration`).toBe(token(name));
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The z-index registry (app/ds-theme.css) exists so overlays cannot be ranked by
// guesswork. It was being bypassed by FORTY raw values — 40, 60, 70, 80, 90,
// 100, 120, 121, 130, 131, 200, 210, 1000 — each picked to beat whatever the
// author happened to be looking at. The consequences were real and measured: the
// time picker opened BEHIND the composer that owned it, and the focus timer sat
// above a DS modal but below the command palette.
//
// ── WHAT THIS DOES AND DOES NOT FLAG ───────────────────────────────────────
// An APP LAYER is a `fixed` overlay: a menu, a scrim, a dialog, a floating
// widget. Those must name a registry token.
//
// LOCAL stacking is different and stays: a calendar event over its grid lines,
// a drop indicator over its blocks, a hover state lifting a card above its
// neighbours. Those are relative to siblings inside one component and mean
// nothing outside it. The test separates them by POSITION (`fixed` is app-level
// by definition) and by SIZE — a local ladder counts 1, 2, 3, not 200.
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx$/.test(path)) out.push(path);
  }
  return out;
}

/** Blank comments rather than dropping them, so line numbers stay honest. */
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => (l.trim().startsWith('//') || l.trim().startsWith('*') ? '' : l));

// The editor spike is a scratch surface, not a shipped screen.
const EXEMPT = /\/spike\//;
const files = walk('components').filter((f) => !EXEMPT.test(f) && !f.endsWith('.test.tsx'));

describe('every app layer comes from the z-index registry', () => {
  it('no fixed overlay picks its own z-index', () => {
    // `position: fixed` means "relative to the viewport", which is the whole
    // definition of an app layer. There is no such thing as a local one.
    const offenders: string[] = [];
    for (const file of files) {
      code(file).forEach((line, i) => {
        const fixed = /position:\s*['"]fixed['"]|\bfixed\b/.test(line);
        const raw = /z-\[\d+\]|zIndex:\s*\d+/.test(line);
        if (fixed && raw) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('no z-index above the local range is written as a number', () => {
    // Anything past ~20 is reaching for a rank in the app, not ordering three
    // siblings. The registry's own floor (`--z-sticky`) is 10.
    // The escape hatch is an explicit `/* z-local */` on the line itself — not a
    // comment above it, which is exactly the kind of thing that drifts away from
    // the code it describes. One line uses it today: block-editor's drop
    // indicator, absolutely positioned inside the editor, whose 50 is a
    // coincidence with --z-modal rather than a reference to it.
    const offenders: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, 'utf8').split('\n');
      code(file).forEach((line, i) => {
        const m = line.match(/z-\[(\d+)\]|zIndex:\s*(\d+)/);
        if (!m) return;
        const n = Number(m[1] ?? m[2]);
        if (n > 20 && !raw[i].includes('z-local')) offenders.push(`${file}:${i + 1}  (${n})`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the registry is declared exactly once', () => {
    // It was declared TWICE — in tokens.css and in ds-theme.css's `@theme` —
    // with different numbers, and because Tailwind hoists `@theme` variables to
    // the top of its output the plain `:root` silently won. The raise of toast
    // and tooltip to 320/330 had never reached a browser.
    const css = ['app/tokens.css', 'app/globals.css', 'app/ds-theme.css']
      .map((f) => [f, readFileSync(f, 'utf8')] as const)
      .filter(([, src]) => /^\s*--z-sticky:/m.test(src))
      .map(([f]) => f);
    expect(css).toEqual(['app/ds-theme.css']);
  });

  it('scanned a believable number of files', () => {
    expect(files.length).toBeGreaterThan(50);
  });
});

// A registry token is only half a layer. Tailwind v4 has no `--z-*` namespace,
// so each name also needs its own `@utility` line — and a token declared without
// one produces a class that compiles to NOTHING, silently. It happened on
// 2026-09-14: `--z-page` was added for full pages inside the content pane, the
// class `z-page` was used, and the page measured `z-index: auto` in the browser.
// It still looked right only because it came later in the DOM; the view's own
// sticky headers (z 10) would have painted over it.
describe('every z-index token is a usable class', () => {
  it('has an @utility for each --z-* it declares', () => {
    const css = readFileSync('app/ds-theme.css', 'utf8');
    const tokens = [...css.matchAll(/--z-([a-z-]+):\s*\d+/g)].map((m) => m[1]);
    const utilities = new Set([...css.matchAll(/@utility z-([a-z-]+)\s*\{/g)].map((m) => m[1]));
    expect(tokens.length).toBeGreaterThan(5);
    expect(tokens.filter((t) => !utilities.has(t)), 'declared without an @utility, so the class does nothing').toEqual([]);
  });
});

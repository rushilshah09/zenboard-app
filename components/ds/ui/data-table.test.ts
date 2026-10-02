import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { rowState, rowWash, ROW_DIVIDER, ROW_TRANSITION } from './row-state';

// ── ONE TABLE, ONE ROW VOCABULARY ──────────────────────────────────────────
//
// Measured 2026-09-24: zero modules used the DS table and `--row-table` was used zero times, so
// every tabular screen built its own — Finance built two. It was not neglect: the DS table was
// WORSE than the hand-rolled ones (rows opened on `<tr onClick>` with no keyboard path, numbers in
// mono, berry for selection, 40px against its own 44px token). A module that adopted it would have
// lost quality, which is exactly why none did. These guards keep it the best table in the app.

const table = readFileSync('components/ds/ui/data-table.tsx', 'utf8');
const code = table.replace(/^\s*\/\/.*$/gm, '').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');

describe('the DS table', () => {
  it('steps by its own row token', () => {
    expect(code).toMatch(/h-\[var\(--row-table\)\]/);
    expect(code, 'the old 40px row').not.toMatch(/\bh-10\b/);
  });

  it('makes a navigating row a REAL link, stretched over the row', () => {
    // A link gets the keyboard, cmd-click and prefetch for free; `<tr onClick>` gets none of them.
    expect(code).toMatch(/import Link from "next\/link"/);
    expect(code).toMatch(/<Link[\s\S]*?after:absolute after:inset-0/);
    // …inside a row that contains the stretch, and keeps it local to itself.
    expect(code).toMatch(/"relative isolate h-\[var\(--row-table\)\]"/);
    // and a keyboard user sees the ROW focused, not a ring round one word.
    expect(code).toMatch(/has-\[a:focus-visible\]:bg-surface-hover/);
  });

  it('lets the keyboard open a row that opens in place', () => {
    expect(code).toMatch(/tabIndex=\{opens \? 0 : undefined\}/);
    expect(code).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
  });

  it('sets numbers in the UI face and keeps mono for identifiers', () => {
    expect(code).toMatch(/c\.numeric \? "text-end tabular-nums"/);
    // Mono is opt-in per column (`mono`), never implied by `numeric`.
    expect(code).toMatch(/c\.mono && "font-mono/);
    expect(code).not.toMatch(/c\.numeric && "text-end font-mono"/);
  });

  it('speaks the shared row vocabulary, not its own', () => {
    expect(code).toMatch(/rowState\(\{ selected: isSel, last, interactive:/);
    expect(code, 'selection is a state wash, not a hue').not.toMatch(/berry/);
    expect(code).toMatch(/cardClass\(/);
    // Column heads are labels, so they take the label role the rest of the app uses.
    expect(code).toMatch(/text-overline/);
  });
});

describe('the row vocabulary', () => {
  it('washes a hovered row only when the row is a target', () => {
    // A read-only row that lights up and then ignores the click is a false affordance.
    expect(rowWash(false, true)).toBe('hover:bg-surface-hover');
    expect(rowWash(false, false)).toBe('');
    expect(rowWash(true, false), 'a selected row is always marked').toBe('bg-surface-selected');
  });

  it('never draws a divider under the last row', () => {
    expect(rowState({ last: false })).toContain(ROW_DIVIDER);
    expect(rowState({ last: true })).not.toContain(ROW_DIVIDER);
    expect(rowState({})).toContain(ROW_TRANSITION);
  });

  it('is the one the task row reads too', () => {
    // The two had drifted — berry vs surface-selected, instant vs fast — and each file was
    // internally consistent, so neither could have shown it. Now there is one source.
    const surface = readFileSync('components/tasks/row-surface.ts', 'utf8');
    expect(surface).toMatch(/from '@\/components\/ds\/ui\/row-state'/);
    expect(surface).toMatch(/rowWash\(selected\)/);
    expect(surface).not.toMatch(/'bg-surface-selected' : 'hover:bg-surface-hover'/);
  });
});

describe('no module hand-rolls a table', () => {
  // An inline `gridTemplateColumns` is how every private table in this app was built. Each file
  // below uses one for something that is NOT a table of records, and says what.
  const ALLOWED: Record<string, string> = {
    'components/calendar/week-grid.tsx': 'a time grid — days by hours, not rows of records',
    'components/documents/database-view.tsx': 'the Notion-style database: resizable, reorderable columns',
    'components/documents/database-gallery.tsx': 'a card gallery',
    'components/documents/block-editor.tsx': 'a table BLOCK inside a document',
    'components/ui/emoji-picker.tsx': 'a glyph grid',
    'components/money/invoice-detail.tsx': 'the line-item EDITOR — a form of inputs; the read view is DataTable',
  };

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
    });

  const offenders = [...walk('components'), ...walk('app')]
    .filter((f) => !f.startsWith('components/ds/') && !f.includes('dev-preview'))
    .filter((f) => readFileSync(f, 'utf8').includes('gridTemplateColumns'))
    .filter((f) => !(f in ALLOWED));

  it('finds none outside the declared exceptions', () => {
    expect(offenders, 'use <DataTable> — a private table is how Finance ended up with two').toEqual([]);
  });

  it('keeps no stale exception', () => {
    const stale = Object.keys(ALLOWED).filter((f) => {
      try { return !readFileSync(f, 'utf8').includes('gridTemplateColumns'); } catch { return true; }
    });
    expect(stale, 'an exception for a file that no longer needs one').toEqual([]);
  });

  it('moved Finance onto the table', () => {
    expect(readFileSync('components/money/money-view.tsx', 'utf8')).toMatch(/<DataTable/);
    expect(readFileSync('components/money/invoice-detail.tsx', 'utf8')).toMatch(/<DataTable/);
    expect(readFileSync('components/money/money-view.tsx', 'utf8')).not.toMatch(/gridTemplateColumns/);
  });
});

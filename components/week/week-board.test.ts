import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── THE WEEK BOARD, ON THE DESIGN SYSTEM ──────────────────────────────────
//
// The product-wide audit (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 3) found the Week board the last
// legacy island in Tasks: a hand-rolled `ChipPop` portal with its own outside-click, scroll and Escape handling; a
// hand-rolled ••• menu and date picker; inline styles on legacy tokens; a priority-ringed CIRCLE for done; ghost
// "Low · Project · Estimate" chips on every card; its own capture grammar beside the app's one; "TODAY" and "MOVE TO"
// in tracked capitals; empty days reading "Open." or "Rest."; today's whole column filled grey — and a card that
// could be dragged, ticked and deleted but not opened.

/** Comments stripped, so a rule's own explanation can never satisfy or trip it. */
const code = (f: string) => readFileSync(f, 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const WEEK = 'components/week/week-view.tsx';

describe('one task card on every board', () => {
  it('the Tasks board and the Week board draw the shared TaskCard', () => {
    expect(code('components/tasks/tasks-board.tsx')).toMatch(/<TaskCard\b/);
    expect(code(WEEK)).toMatch(/<TaskCard\b/);
    expect(code(WEEK), 'the week board keeps no card of its own').not.toMatch(/\nfunction Card\(/);
  });

  it('a card opens its task, as a row does', () => {
    expect(code(WEEK)).toMatch(/onOpen=\{\(\) => open\(id\)\}/);
    expect(code(WEEK)).toMatch(/taskOpenHref\(/);
  });
});

describe('the Week board uses the design system’s parts', () => {
  const week = code(WEEK);

  it('menus are the DS menu — no hand-rolled portal, no hand-rolled popover', () => {
    expect(week).not.toMatch(/createPortal/);
    expect(week).not.toMatch(/ChipPop|OptRow/);
    expect(week).toMatch(/<DropdownMenuSub\b/);
  });

  it('a task is a square box — never a ring', () => {
    expect(week).not.toMatch(/borderRadius: '50%'/);
  });

  it('it adds in the one task grammar, from the house add line', () => {
    expect(week).toMatch(/parseTask\(/);
    expect(week).not.toMatch(/function parseQuick/);
    expect(week).toMatch(/<AddLine\b/);
  });

  it('no tracked capitals and no poetry', () => {
    expect(week).not.toMatch(/'TODAY'|>TODAY<|MOVE TO/);
    expect(week).not.toMatch(/'Rest\.'|'Open\.'|Enjoy it/);
    expect(week).not.toMatch(/letterSpacing: '0\.(0[4-9]|1)/);
  });

  it('today is the Calendar’s whisper and its accent date — not a grey column', () => {
    expect(week).not.toMatch(/--fill-whisper/);
    expect(week).toMatch(/today && 'bg-surface-row'/);
    expect(week).toMatch(/aria-label="Today"[^>]*bg-\[var\(--accent\)\]/);
  });
});

describe('a narrow week column thins the shared card', () => {
  const css = readFileSync('app/ds-theme.css', 'utf8');
  const block = css.slice(css.indexOf('@container weekcol'), css.indexOf('/* ── THE SCROLL REGION'));

  it('aims at the shared card, not the retired week chips', () => {
    expect(block).toMatch(/\[data-task-card\]/);
    expect(block).toMatch(/\[data-task-card-menu\]/);
    expect(block).not.toMatch(/data-week-chip/);
  });

  it('puts a word away for sighted readers only — never display:none', () => {
    const rule = block.slice(block.indexOf('[data-fact-word]'), block.indexOf('}', block.indexOf('[data-fact-word]')));
    expect(rule).toMatch(/position: absolute/);
    expect(rule).not.toMatch(/display:\s*none/);
  });
});


// ── THE COLUMN AND ITS COUNT ARE ONE DECISION ──────────────────────────────
//
// A user's board read "Unscheduled 6" above fourteen rows, nearly all struck through
// (screenshot, 2026-09-24): the header counted only OPEN tasks while the column rendered the whole
// unscheduled pile, finished work included. A task that is done and was never scheduled is not
// waiting to be planned.
describe('the unscheduled column', () => {
  const src = readFileSync('components/week/week-view.tsx', 'utf8');

  it('lists what is still to do, and the count agrees with it', () => {
    expect(src).toMatch(/const inboxIds = \(order\['inbox'\] \?\? \[\]\)\.filter\(\(id\) => byId\[id\] && \(!byId\[id\]\.done \|\| settling\.ids\.has\(id\)\)\)/);
    // The list, its sortable context and its empty line all read the SAME derivation.
    expect(src).toMatch(/<SortableContext items=\{inboxIds\}/);
    expect(src).toMatch(/\{inboxIds\.map\(card\)\}/);
    expect(src).toMatch(/\{inboxIds\.length === 0 &&/);
    expect(src).not.toMatch(/\{\(order\['inbox'\] \?\? \[\]\)\.map\(card\)\}/);
  });

  it('gives a ticked task the beat every other list gives it', () => {
    // Not a blunt `!done`: the shared hook holds it in place first, so it never vanishes under
    // the pointer that ticked it (lib/use-settling.ts, SETTLE_MS).
    expect(src).toMatch(/import \{ useSettling \} from '@\/lib\/use-settling'/);
    expect(src).toMatch(/const settling = useSettling\(\)/);
    expect(src).toMatch(/if \(nd\) settling\.hold\(id\); else settling\.release\(id\);/);
  });

  it('keeps a completed task in its DAY column — that is the record of the day', () => {
    expect(src).toMatch(/const ids = order\[d\.id\] \?\? \[\];/);
  });
});

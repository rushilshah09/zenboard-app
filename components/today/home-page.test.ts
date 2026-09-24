import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── HOME: THE CARDS, IMPROVED FROM THE INSIDE ─────────────────────────────
//
// 2026-09-22, twice. The product-wide audit first turned Home's seven banded panels into plain sections under
// headings. The user, the same day, with a screenshot of the result on their own data: "I really like that card old
// Home screen … we have to enhance that old design but not remove all — this looks so bad and empty." So the cards
// are the design, and these tests pin them; what changed is inside them — one row height, one row surface, the
// task's facts through TaskMeta, a schedule that tells the truth, Completed inside the plan's card.

/** Comments stripped, so a rule's own explanation can never satisfy or trip it. */
const code = (f: string) => readFileSync(f, 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const VIEW = 'components/today/today-view.tsx';
const SECTIONS = ['components/today/waiting-section.tsx', 'components/today/content-today.tsx', 'components/today/schedule-section.tsx', 'components/today/habits-section.tsx'];

describe('Home is cards', () => {
  it('every section is a card with its header band (the user’s call)', () => {
    for (const f of SECTIONS) {
      expect(code(f), `${f} lost its card`).toMatch(/<Panel frame="shadow">/);
      expect(code(f), `${f} lost its header band`).toMatch(/<PanelHeader\b/);
    }
    // The highlight, the plan, and the day's prompt are cards too.
    expect(code(VIEW).match(/<Panel frame="shadow">/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('inside every card, a list is one row: the task row’s own surface and height', () => {
    for (const f of SECTIONS) expect(code(f), f).toMatch(/homeRow\(/);
    expect(readFileSync('components/today/home-rows.ts', 'utf8')).toMatch(/heightClass: 'h-\[var\(--row-task\)\]'/);
  });

  it('one space between cards', () => {
    expect(readFileSync('components/today/home-rows.ts', 'utf8')).toMatch(/export const HOME_SECTION = 'mt-6';/);
    for (const f of [VIEW, ...SECTIONS]) expect(code(f), f).not.toMatch(/className="mb-(6|8)"/);
  });
});

describe('the plan is the whole day', () => {
  const view = code(VIEW);

  it('lists every open task, the highlighted one included', () => {
    expect(view).toMatch(/const plan = open;/);
    expect(view).toMatch(/useListCursor\(plan\.length\)/);
  });

  it('keeps its Completed group inside its own card', () => {
    const plan = view.slice(view.indexOf('title="Today’s plan"'));
    const card = plan.slice(0, plan.indexOf('</Panel>'));
    expect(card).toMatch(/<CompletedSection\b/);
  });

  it('the page keeps one filled button — the plan’s Add while you type', () => {
    expect(view.match(/variant="primary"/g)?.length).toBe(1);
    for (const f of SECTIONS) expect(code(f), f).not.toMatch(/variant="primary"/);
  });
});

describe('the schedule is an agenda that tells the truth', () => {
  const schedule = code('components/today/schedule-section.tsx');

  it('never calls one of Zenboard’s own timeboxes a Google Calendar event', () => {
    // `synced = !!e.source && e.source !== 'manual'` put "Google Calendar" on every timebox.
    expect(schedule).not.toMatch(/Google Calendar/);
    expect(schedule).not.toMatch(/source !== 'manual'/);
  });

  it('has no caret that opens nothing', () => {
    expect(schedule).not.toMatch(/ChevronDown/);
  });

  it('marks now the way the Calendar does', () => {
    expect(schedule).toMatch(/rounded-full bg-\[var\(--accent\)\][^"]*text-\[var\(--on-accent\)\]/);
    expect(schedule).not.toMatch(/bg-ink-900/);
  });
});

describe('row actions are reachable on every pointer', () => {
  it('Home never hand-rolls a hover reveal', () => {
    // `opacity-0 … group-hover:opacity-100` is a control a phone can never see; `reveal-on-hover` turns on for a
    // coarse pointer and for keyboard focus.
    for (const f of SECTIONS) {
      expect(code(f), f).not.toMatch(/opacity-0[^"]*group-hover/);
    }
    for (const f of ['components/today/schedule-section.tsx', 'components/today/habits-section.tsx']) {
      expect(code(f), f).toMatch(/reveal-on-hover/);
    }
  });
});

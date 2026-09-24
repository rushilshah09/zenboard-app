import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskMeta, type TaskFacts } from './task-meta';

// ── ONE TASK, DRAWN ONE WAY ────────────────────────────────────────────────
//
// The product-wide audit (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md) found the app's central object drawn five
// ways. The same task was a 36px line on Home and a two-line 61-or-82px block on Tasks; its priority was signal bars
// with a red word on Home, a grey capsule on Tasks, a flag in Focus and a bare 3px tick on the week board; its project
// was a dot, a filled folder or a rounded square depending on the screen. A person learns a mark once. Five marks for
// one fact reads as five teams — the "different developers" feeling DESIGN_CONSTITUTION names as the thing to avoid.
//
// `TaskMeta` is now the one rendering of a task's facts, and every list draws a task through `TaskRow`.

const html = (facts: TaskFacts) => renderToStaticMarkup(React.createElement(TaskMeta, facts));
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const FULL: TaskFacts = {
  blocked: true,
  project: { name: 'Balluji rebrand', color: 'plum' },
  list: { name: 'Errands', color: 'amber' },
  labels: [{ name: 'Waiting', color: 'orange' }],
  priority: 'high',
  sub: { done: 2, total: 5 },
  recurring: true,
  when: '2031-03-04',
  estimate: 30,
  highlight: true,
};

describe('TaskMeta — the facts of a task, drawn one way', () => {
  it('says nothing when nothing is set: low priority is the default, not a fact', () => {
    expect(html({ priority: 'low' })).toBe('');
    expect(html({ priority: 'low', estimate: null, sub: { done: 0, total: 0 }, labels: [] })).toBe('');
  });

  it('draws each fact once, in one order, on every surface', () => {
    const t = text(html(FULL));
    const order = ['Blocked', 'Balluji rebrand', 'Errands', 'Waiting', 'High', '2/5', '4 Mar 2031', '30m'];
    const at = order.map((w) => t.indexOf(w));
    expect(at.every((i) => i >= 0), `missing a fact in: ${t}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // The star closes the line, after the estimate.
    const m = html(FULL);
    expect(m.lastIndexOf('aria-label="Highlighted"')).toBeGreaterThan(m.indexOf('30m'));
  });

  it("puts priority's colour in the glyph and keeps its word quiet", () => {
    // A red "High" beside red bars is the same signal twice, and the word is the larger area — the chroma rule
    // (CLAUDE.md) puts a hue on the smallest thing that can carry it.
    const m = html({ priority: 'high' });
    expect(m).toMatch(/fill-danger-500/);
    expect(m).not.toMatch(/text-danger-/);
    expect(m).not.toMatch(/text-warning-/);
  });

  it('gives the title the row when the list is narrow', () => {
    // At 390px, with every fact's glyph kept, a filed task's title had 28% of its row (verify-task-row.mjs, E).
    // Where a task lives goes to screen readers whole — still announced, never drawn; priority keeps its glyph and
    // gives up its word; the estimate stays whole.
    const m = html({ project: FULL.project, list: FULL.list, labels: FULL.labels, priority: 'med', estimate: 20 });
    const facts = [...m.matchAll(/<span title="([^"]+)" class="([^"]+)"/g)].map(([, title, cls]) => ({ title, narrowGone: cls.includes('@max-md:sr-only') }));
    expect(facts.filter((f) => f.narrowGone).map((f) => f.title)).toEqual(['Balluji rebrand', 'Errands', 'Waiting']);
    // Priority: the word is the narrow-hidden part, the glyph is outside it.
    expect(m).toMatch(/<svg[^>]*>[\s\S]*?<\/svg><span data-fact-word="true" class="@max-md:sr-only">Medium<\/span>/);
    // The estimate never hides.
    expect(m).not.toMatch(/sr-only[^>]*>[^<]*20m/);
  });

  it('keeps every word on a card, where the facts wrap under the title instead of beside it', () => {
    const m = html({ project: FULL.project, list: FULL.list, labels: FULL.labels, priority: 'med', layout: 'card' });
    expect(m).not.toMatch(/@max-md:sr-only/);
    // Each word is still marked, so a narrow WEEK column can put it away by its own container query.
    expect(m.match(/data-fact-word/g)?.length).toBe(4);
  });

  it('shows an estimate as a clock and a time, and a finished timed task as both numbers', () => {
    expect(text(html({ estimate: 90 }))).toBe('1h 30m');
    expect(html({ estimate: 90 })).toMatch(/<svg/);
    expect(text(html({ estimate: 30, elapsed: 45, done: true }))).toBe('30m · 45m done');
  });
});

// ── Where a task is drawn ──────────────────────────────────────────────────
const src = (f: string) => readFileSync(f, 'utf8');
/** Comments stripped, so a rule's own explanation can never satisfy or trip it. */
const code = (f: string) => src(f).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

describe('every task list draws a task through the shared row and its one meta', () => {
  it('the Tasks page has no row of its own', () => {
    // `tasks-view.tsx` kept a roomy second row (title over a chip line) beside the shared compact one; the Inbox
    // stepped 61 → 82 → 61px down the page depending on whether a row had a chip.
    const c = code('components/tasks/tasks-view.tsx');
    expect(c).not.toMatch(/\nfunction Row\(/);
    expect(c).toMatch(/<TaskRow\b/);
  });

  it('every surface that shows a task’s facts shows them through TaskMeta', () => {
    for (const f of ['components/tasks/task-row.tsx', 'components/tasks/task-card.tsx', 'components/today/today-view.tsx', 'components/focus/focus-view.tsx']) {
      expect(code(f), f).toMatch(/<TaskMeta\b/);
      expect(code(f), `${f} draws priority itself`).not.toMatch(/<PriorityBadge\b/);
    }
  });

  it('there is one priority glyph', () => {
    // A second `PriorityBars` lived in components/ui/panels.tsx, taking a raw colour — Home's highlight card drew its
    // priority with it while the plan list under it used the DS one.
    expect(code('components/ui/panels.tsx')).not.toMatch(/export function PriorityBars/);
    expect(code('components/focus/focus-view.tsx'), 'Focus drew priority as a flag').not.toMatch(/icon=\{Flag\}/);
  });

  it('a task is never a radio circle', () => {
    // CLAUDE.md: "<TaskCheckbox> — SQUARE Radix checkbox. Tasks are never radio circles." Focus's "Up next" drew a
    // hairline circle and a filled disc for done.
    const c = code('components/focus/focus-view.tsx');
    expect(c).not.toMatch(/size-\[15px\][^"]*rounded-full/);
    expect(c).toMatch(/<Checkbox\b/);
  });

  it('a list grows from one add line, in sentence case', () => {
    // `QuickAddRow` was a 48px grey slab reading "Add Task"; Home, the task panel and every foot-of-list add already
    // used the DS `AddLine`.
    expect(existsSync('components/ui/quick-add-row.tsx')).toBe(false);
    for (const f of ['components/tasks/tasks-view.tsx', 'components/focus/focus-view.tsx']) {
      expect(code(f), f).not.toMatch(/QuickAddRow/);
      expect(code(f), f).toMatch(/<AddLine\b/);
    }
    expect(code('components/ui/primitives.tsx')).not.toMatch(/'Add Task'/);
  });
});

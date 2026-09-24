import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// PHASE 4, "the project page on a phone" — 2026-09-11.
//
// Measured at 375px on the project Tasks tab before this pass:
//   · the List / Board / Calendar switcher, floated over the tab bar's right
//     end, covered Docs, Files and Money — three of six sections untappable;
//   · workstream headings lost their NAMES ("0/2 · 1 shared", no "Design");
//   · task titles were cut to six characters ("Stake…") by a trailing cluster
//     of worded chips that never yielded.
// Every fix is CONTAINER-scoped, not viewport-scoped: the same card sits beside
// a rail on a laptop, and the same row lives in wide lists elsewhere.

/** Comments stripped, so a rule's own explanation can never satisfy it. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

const WS = 'components/projects/projects-workspace.tsx';
const TABS = 'components/ds/ui/tabs.tsx';
const SHARE = 'components/sharing/share-toggle.tsx';
const PRIORITY = 'components/ds/ui/priority.tsx';
const ROW = 'components/tasks/task-row.tsx';
const META = 'components/tasks/task-meta.tsx';
const STREAM = 'components/projects/workstream-controls.tsx';

describe('the tab bar owns its trailing control', () => {
  it('hands the switcher to the bar instead of floating it over the tabs', () => {
    const ws = code(WS);
    const at = ws.indexOf('aria-label="Task layout"');
    expect(at, 'the switcher exists').toBeGreaterThan(-1);
    expect(ws.slice(Math.max(0, at - 400), at), 'it arrives through the end slot').toMatch(/end=\{tab === 'tasks' \?/);
    expect(ws, 'nothing is floated over the bar').not.toMatch(/absolute bottom-1\.5 right-0/);
  });

  it('can never cover a tab — the list yields and scrolls, the control never overlaps', () => {
    const tabs = code(TABS);
    expect(tabs).toMatch(/end\?: React\.ReactNode/);
    expect(tabs, 'beside the list when the bar has room').toMatch(/@min-\[[\d.]+rem\]:flex-row/);
    expect(tabs, 'the list gives up width rather than the control giving up its place')
      .toMatch(/min-w-0 border-b border-line @min-\[[\d.]+rem\]:flex-1/);
    expect(tabs, 'the root queries its own width only when there is an end slot').toMatch(/end != null && "@container"/);
    expect(tabs, 'nothing in the bar is floated over the list').not.toMatch(/absolute[^"]*right-0/);
  });

  it('stacks at ONE threshold, stated once — every class in the bar agrees on it', () => {
    // A threshold spelled differently on the row and on the list would let the
    // hairline double or vanish in the band between the two numbers.
    const found = new Set([...code(TABS).matchAll(/@min-\[([\d.]+)rem\]/g)].map((m) => m[1]));
    expect([...found], 'one number').toHaveLength(1);
  });

  it('keeps ONE hairline under both when they share the row', () => {
    const tabs = code(TABS);
    expect(tabs).toMatch(/@min-\[([\d.]+)rem\]:border-b @min-\[\1rem\]:border-line/);
    expect(tabs, 'moved off the list, not doubled').toMatch(/@min-\[[\d.]+rem\]:border-b-0/);
  });
});

describe('a narrow card makes its rows yield width', () => {
  it('queries the CARD, not the viewport and not each row', () => {
    expect(code(WS)).toMatch(/cn\(cardShell, 'overflow-hidden @container'\)/);
  });

  it('gives every list of share pills on the project page a container to answer to', () => {
    // The pill only compacts inside a query container. The sweep at 375px found
    // the two lists that had none: doc titles cut to ~14 characters, and the
    // Overview's update text cut mid-sentence.
    expect(code('components/projects/project-docs.tsx'))
      .toMatch(/cardClass\('overflow-hidden @container'\)/);
    const ws = code(WS);
    const at = ws.indexOf('const activityEntries: ActivityEntry[]');
    expect(at, 'the Overview is found').toBeGreaterThan(-1);
    expect(ws.slice(at), 'its update section is the container').toMatch(/<section className="@container">/);
    // The Files tab (and the task drawer) list attachments with the same pill.
    expect(code('components/attachments/attachments-panel.tsx'))
      .toMatch(/<ul className="flex list-none flex-col gap-0\.5 p-0 @container">/);
  });

  it('the share pill keeps its eye and drops its word', () => {
    const s = code(SHARE);
    expect(s).toMatch(/@max-md:min-w-6 @max-md:px-0/);
    expect(s).toMatch(/<span className="@max-md:sr-only">\{on \? 'Client' : 'Internal'\}<\/span>/);
    expect(s, 'the accessible name is still the action').toMatch(/aria-label=\{label\}/);
  });

  it('priority keeps its bars and drops its word', () => {
    // Since 2026-09-22 a row draws its facts through TaskMeta, and PriorityBadge has one shape (bars + word).
    const p = code(PRIORITY);
    expect(p).toMatch(/labelClassName\?: string/);
    expect(p).toMatch(/<span data-fact-word className=\{labelClassName\}>/);
    expect(code(META)).toMatch(/<PriorityBadge key="priority" level=\{priority\} labelClassName=\{narrow\} \/>/);
    expect(code(META)).toMatch(/const NARROW = '@max-md:sr-only';/);
    // A ROW rule: under a card's title the facts wrap and take nothing from it (2026-09-22).
    expect(code(META)).toMatch(/const narrow = layout === 'row' \? NARROW : undefined;/);
  });

  it('a workstream heading gives up its tally and its date words before its name', () => {
    expect(code(WS)).toMatch(/text-ink-500 @max-md:hidden">· \{shared\} shared/);
    expect(code(STREAM)).toMatch(/<span className="@max-md:sr-only">Add a date<\/span>/);
  });

  it('never compacts by viewport, which would squeeze a wide row on a narrow laptop pane', () => {
    for (const f of [SHARE, PRIORITY, ROW, META, STREAM]) {
      expect(code(f), `${f} compacts by container`).not.toMatch(/(?<!@)\bmax-(?:sm|md|lg):/);
    }
  });
});

describe('a task row on a phone, wherever it is listed', () => {
  it('drops the WORD of every chip through one prop, never a nested span', () => {
    // A span hidden INSIDE a chip label leaves the label box behind at zero
    // width, and the chip's gap still sits after the glyph — 4px of lopsided
    // padding. One prop, on all four chips, hides the label box itself.
    const tag = code('components/ds/ui/tag.tsx');
    expect(tag).toMatch(/labelClassName\?: string/);
    expect(tag).toMatch(/cn\("truncate", labelClassName\)/);
    // The row's facts are TaskMeta's (2026-09-22). Where a task lives — project, list, each label — goes to screen
    // readers WHOLE at phone width (the fact's own box, so no gap is left behind); priority gives up only its word.
    const meta = code(META);
    expect(meta.match(/<Fact key=[^>]*className=\{narrow\}>/g) ?? [], 'project, list and labels').toHaveLength(3);
    expect(meta, 'never a hidden span nested in a fact').not.toMatch(/<span className=\{cn\([^)]*NARROW/);
    expect(code(ROW), 'the row hands its facts to TaskMeta').toMatch(/<TaskMeta\b/);
  });

  it('Home lists its tasks inside a query container', () => {
    // Measured at 375px before: Home's rows sat in no container at all, so the
    // row's compaction never engaged and titles were cut to ~63px.
    // Since 2026-09-22 the plan's card body holds its add line, its rows AND its Completed group (Completed was a
    // second box under the card), so every row there compacts against the same container.
    const today = code('components/today/today-view.tsx');
    const first = today.indexOf('<TaskRow');
    expect(first, 'Home renders task rows').toBeGreaterThan(-1);
    const box = today.lastIndexOf('<PanelBody className="@container">', first);
    expect(box, 'the plan rows sit in a query container — the plan card’s body').toBeGreaterThan(-1);
    const completed = today.indexOf('<CompletedSection', first);
    expect(completed, 'and the completed list sits in the same one').toBeGreaterThan(first);
    expect(today.slice(box, completed), 'the container is not closed before the completed list').not.toMatch(/<\/PanelBody>/);
  });
});

describe('the project calendar on a phone', () => {
  const ws = code(WS);
  const start = ws.indexOf('function CalendarView(');
  const cal = ws.slice(start, ws.indexOf('\nfunction ', start + 10));

  it('answers to its own width, and trades the month grid for an agenda when narrow', () => {
    // Seven columns in 375px left each chip ~30px ("S…"). Both shapes render;
    // the card's width picks one, so there is no hook and no flash.
    expect(start, 'the calendar layout exists').toBeGreaterThan(-1);
    expect(cal).toMatch(/cn\(cardShell, 'p-3\.5 @container'\)/);
    expect(cal, 'the grid steps aside').toMatch(/<div className="@max-md:hidden">/);
    expect(cal, 'the agenda steps in').toMatch(/hidden list-none flex-col gap-3 p-0 @max-md:flex/);
    expect(cal, 'and its rows are touch-sized').toMatch(/touch-row/);
  });

  it('labels its weekdays in sentence case', () => {
    expect(cal).not.toMatch(/toUpperCase\(\)/);
  });
});


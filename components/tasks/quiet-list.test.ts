import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── PHASE 1, "THE QUIET LIST" ──────────────────────────────────────────────
// Six rules, each one a measured fault on the project Tasks tab (2026-09-10),
// pinned here because every one of them is the kind that comes back: they are
// all rules that already existed somewhere — in CLAUDE.md prose, in another
// component's call site, in this codebase's own comments — and were simply not
// enforced in the one place that mattered.
//
// Measured before → after, at 1440×950 on /dev-preview/projects:
//   first task row top      604px → 345px
//   distinct row heights      4   → 2      (29/36/41/53 → 32/36)
//   task row height          48px → 36px
//   always-visible adds        4  → 2
//   heading vs row type    12/14  → 14/14
//   rows on first screen       5  → 16

/**
 * Comments stripped so a rule's own explanation can never satisfy it — the
 * mistake the Count guard made, where a doc comment describing the thing it
 * replaced matched the regex looking for that thing. JSX comments have to go
 * too: `{/* "Client · Not linked" is an absence *\/}` is a comment that
 * contains the exact string the rule forbids.
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx$/.test(path) && !path.includes('.test.')) out.push(path);
  }
  return out;
}

const TASK_ROW = 'components/tasks/task-row.tsx';
const ROW_SURFACE = 'components/tasks/row-surface.ts';
const WORKSPACE = 'components/projects/projects-workspace.tsx';
const COMPLETED = 'components/tasks/completed-section.tsx';

describe('a row shows what is true, not what is set', () => {
  it('never renders priority unconditionally', () => {
    // `low` is the DATABASE DEFAULT (0001_init), so an ungated PriorityBadge
    // draws a coloured chip on every untouched task — measured at 78 of 88 on
    // a real workspace. Five call sites already gated this; the SHARED row,
    // used by Home, the project Tasks tab and the client portal, did not.
    const offenders: string[] = [];
    for (const file of walk('components')) {
      // The DS portal is a SPECIMEN BOARD — showing every level, including the
      // default, is the whole job of that page.
      if (file.includes('design-system/')) continue;
      code(file).split('\n').forEach((line, i) => {
        // Only a render bound to a real task's priority can carry the default.
        // A hardcoded `level="high"` is a literal the author chose, and the
        // picker drawing one swatch per option is drawing the options.
        const bound = /<Priority(?:Badge|Bars)\b[^>]*level=\{([A-Za-z0-9_.]*priority)\}/i.exec(line);
        if (!bound) return;
        const expr = bound[1];
        // Gated either by comparison (`!== 'low'`) or by truthiness — the
        // composer's parsed hint is `null` when the text named no priority,
        // so `{hint.priority && …}` is the same rule stated the other way.
        const escaped = expr.replace(/\./g, '\\.');
        if (new RegExp(`${escaped}\\s*(!==|===)`).test(line)) return;
        if (new RegExp(`${escaped}\\s*&&`).test(line)) return;
        offenders.push(`${file}:${i + 1} — ${line.trim().slice(0, 90)}`);
      });
    }
    expect(
      offenders,
      'Priority must render only when it is SET. `low` is the default; a chip ' +
        'that always draws is wallpaper, not information.',
    ).toEqual([]);
  });

  it('gates it in the shared row specifically', () => {
    // The inverse of the sweep above: deleting the render entirely would also
    // pass it. Something must still draw priority here, behind the guard.
    // Since 2026-09-22 the row draws its facts through TaskMeta, so the gate
    // lives there, and the row must hand it the task's own priority.
    expect(code('components/tasks/task-meta.tsx')).toMatch(/priority !== 'low' && <PriorityBadge key="priority" level=\{priority\}/);
    expect(code(TASK_ROW)).toMatch(/<TaskMeta[\s\S]*?priority=\{task\.priority\}/);
  });
});

describe("a row's height is declared, not inherited from its tallest control", () => {
  it('gives the compact row an explicit height', () => {
    // It read `py-2.5` and its comment claimed 36px; it measured 48, because a
    // 28px star and a 24px share pill had joined the trailing cluster. On an
    // internal task that share pill is at opacity 0 — an invisible control was
    // setting the height of the densest list in the product.
    expect(code(TASK_ROW)).toMatch(/heightClass:\s*'h-\[var\(--row-task\)\]'/);
  });

  it('does not also pad the row vertically', () => {
    // Both together is how the 36 became 48 in the first place.
    const call = /rowSurface\(\{[^}]*\}\)/.exec(code(TASK_ROW))?.[0] ?? '';
    expect(call, 'the compact row must size itself once').not.toMatch(/py-/);
  });

  it('passes the height as a LITERAL class, never built from a string', () => {
    // Tailwind v4 scans source TEXT. A class assembled as `h-[${height}]` is
    // never generated, so the rule silently does not ship — the same trap the
    // z-index registry hit. rowSurface must therefore take a class, not a
    // length.
    const src = code(ROW_SURFACE);
    expect(src, 'rowSurface takes a class name').toMatch(/heightClass\?: string/);
    expect(src, 'and must not construct one').not.toMatch(/`h-\[\$\{/);
  });
});

describe('one rhythm per role', () => {
  it('declares --row-group beside the rest of the row scale', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toMatch(/--row-group:\s*32px;/);
    // The whole scale still lives in one place.
    for (const t of ['--row-nav', '--row-task', '--row-table']) expect(css).toContain(t);
  });

  it('uses it for every piece of list furniture', () => {
    // A workstream heading, the stream composer and the Completed disclosure
    // are the same KIND of thing. They measured 41, 29 and 36.
    const ws = code(WORKSPACE);
    const headings = ws.match(/h-\[var\(--row-group\)\]/g) ?? [];
    expect(headings.length, 'heading + stream composer').toBeGreaterThanOrEqual(2);
    expect(code(COMPLETED)).toMatch(/h-\[var\(--row-group\)\]/);
  });

  it('makes a group heading heavier and shorter than the rows it holds', () => {
    // It was 12px above 14px rows, so the container read as smaller than its
    // contents — most of why the list did not parse at a glance.
    // Anchored to the RULE, not to a local identifier. The first version of
    // this guard matched `{g.section.name}` and broke the moment the render
    // switched to `lib/workstreams.ts`'s shape — the rule was still kept, the
    // spelling had changed, and the test could not tell the difference.
    const ws = code(WORKSPACE);
    const at = ws.indexOf('group group/sec');
    expect(at, 'the workstream heading block moved; re-check these two rules').toBeGreaterThan(-1);
    // A window rather than a balanced match: a brace-counting regex over JSX
    // is a worse guard than a generous slice. Wide enough to clear the rename
    // input, which sits between the class and the name it guards.
    const heading = ws.slice(at, at + 1600);
    expect(heading, 'the name is row-sized (14px) and medium').toMatch(/text-ui font-medium/);
    expect(heading, 'the heading is --row-group, shorter than its 36px rows').toMatch(/h-\[var\(--row-group\)\]/);
    expect(heading, 'and never the 12px section-label style').not.toMatch(/sectionLabel/);
  });

  it('puts list furniture on the panel inset, like the rows above it', () => {
    expect(code(COMPLETED), 'Completed sat 4px inside its own rows').not.toMatch(/\bpx-3\b/);
  });
});

describe('one act, one always-visible control', () => {
  it('has no permanent per-workstream add row', () => {
    // One per stream, permanently drawn, is how a two-stream project came to
    // show FOUR ways to add something — and it grew by one with every stream.
    // Hiding it in place only traded that for a 32px hole between groups,
    // because a hidden row still occupies the flow. It lives in the heading.
    const ws = code(WORKSPACE);
    expect(ws, 'the ghost "Add task" row is gone').not.toMatch(/<Icon icon=\{Plus\} size=\{12\} \/> Add task/);
    expect(ws, 'and the + is a control on the stream header, named for its stream').toMatch(
      /label=\{`Add a task to \$\{[A-Za-z.]*name\}`\}/,
    );
  });
});

// ── THE HEADER: A DECISION THAT WAS REVERSED, AND WHY IT STAYS REVERSED ────
//
// On 2026-09-10 this block asserted the opposite of what it asserts now. The
// project header showed seven labelled properties; the user called the page
// cluttered; I cut it to one quiet line of three self-describing facts
// ("2/5 done · Due 12 Sep") on the rule that anything stating a DEFAULT
// (Status "Active") or an ABSENCE (Client "Not linked") earns no space.
//
// The user's answer was: **"this information is gone — I want it back as it
// was."**
//
// They were right and the rule was too clever. Those seven rows are the facts
// somebody reads a project BY, and a header that hides them does not remove
// work, it relocates it — you go looking instead. "Cluttered" was about the
// PAGE, and the things that actually fixed it were the ones that stayed: the
// row rhythm, the conditional priority chip, the composer moving into the
// card, the layout switcher leaving its own band.
//
// So the guards below pin what SURVIVED plus the one improvement the reversal
// brought with it, and this comment exists so nobody — me included — re-runs
// the same cut and calls it a fix.
describe('the project header', () => {
  const ws = code(WORKSPACE);

  /**
   * The header's property declaration, as a region.
   *
   * Anchored on the BLOCK rather than on a row's JSX, because these two guards
   * have now failed once for the wrong reason: they matched
   * `<PropertyRow icon={Circle} label="Status">`, and the day the rows became a
   * declared list for the arranging work they went red while every rule they
   * exist to protect still held. A guard that fires on a rename is a guard that
   * gets deleted. The anchor is asserted so the region can never be the empty
   * string — that failure mode has bitten a test in this repo before.
   */
  const headerProps = (() => {
    const at = ws.indexOf('<PropertyBlock');
    expect(at, 'the project header declares its properties through PropertyBlock').toBeGreaterThan(-1);
    return ws.slice(at, ws.indexOf('</RecordHeader>', at));
  })();

  it('shows every property, because the user asked for them back', () => {
    for (const label of ['Status', 'Health', 'Progress', 'Deadline', 'Client', 'Started', 'Sharing']) {
      expect(headerProps, `"${label}" was cut once and restored by user directive`).toContain(`label: '${label}'`);
    }
  });

  it('persists an arrangement against the record KIND, never a single project', () => {
    // Hiding Sharing means "I don't read projects by their sharing", not "not on
    // this one" — nobody wants to re-hide a row on all forty projects.
    expect(headerProps).toMatch(/set="project"/);
    expect(headerProps, 'and it saves').toMatch(/onSave=\{setPropertyLayout\}/);
  });

  it('keys the properties by a stable id, not by their label', () => {
    // The key is what lands in `profiles.preferences`. Deriving it from the label
    // would mean renaming a row silently discards everyone's arrangement.
    const keys = [...headerProps.matchAll(/key: '([^']+)'/g)].map((m) => m[1]);
    expect(keys.length, 'every declared property carries one').toBeGreaterThanOrEqual(7);
    expect(new Set(keys).size, 'and they are unique').toBe(keys.length);
    for (const k of keys) expect(k, 'lower-case id, not a display string').toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('NAMES the client instead of asserting one exists', () => {
    // The one thing the reversal improved, and the only part of the cut worth
    // keeping: "Linked" said a relationship existed without saying whose.
    expect(ws).toMatch(/clientNames\[active\.client_id\]/);
    expect(ws, 'and it goes there').toMatch(/recordHref\('client', active\.client_id!\)/);
  });

  it('still speaks about health only when something needs attention', () => {
    // Not a style rule — `projectHealth` is derived, and a row that always
    // rendered would be an alarm that is always on. The RULE is that the Health
    // entry is reached only through a test of `health`, whatever shape the
    // header's rows take; it is pinned by proximity rather than by one spelling.
    const at = headerProps.indexOf("label: 'Health'");
    expect(at, 'the header still has a Health property').toBeGreaterThan(-1);
    const before = headerProps.slice(Math.max(0, at - 120), at);
    expect(before, 'and it is conditional on `health`').toMatch(/\bhealth\s*(\?|&&)/);
  });

  it('keeps ONE header layout, now that nothing asks for a second', () => {
    // The cut added a `facts` variant to the shared RecordHeader. When the
    // header came back, that variant had no caller — and a DS component
    // carrying a mode nobody selects is the kind of thing the next person
    // reads as a supported option. Removed rather than left standing.
    const rh = code('components/ds/ui/record-header.tsx');
    expect(rh).not.toMatch(/RecordHeaderLayout|layout === 'facts'/);
    expect(rh, 'the label column is the layout').toMatch(/w-\[124px\]/);
  });

  it('keeps the task layout switcher out of a band of its own', () => {
    // A 45px strip holding one three-way toggle was the fourth horizontal band
    // between the title and the first task. It rides the tab row instead.
    expect(ws.match(/aria-label="Task layout"/g) ?? [], 'exactly one switcher').toHaveLength(1);
    const idx = ws.indexOf('aria-label="Task layout"');
    const tabs = ws.indexOf('aria-label="Project detail"');
    expect(idx, 'and it sits with the tab strip').toBeGreaterThan(tabs);
    expect(idx - tabs, 'in the same row, not a band below it').toBeLessThan(400);
  });
});

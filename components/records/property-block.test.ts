import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROPERTY_ROW } from '@/components/ds/ui/record-header';

// The arranging work, 2026-09-11. A project header states seven facts; the user
// called the page cluttered, a pass cut the block to three, and the directive
// that followed was "this information is gone — I want it back as it was."
// Neither list is wrong, which is why the app stopped choosing.
//
// These guards pin the three things that would quietly undo it: the two records
// sharing ONE implementation, the geometry staying in the DS, and the stored
// layout staying a preference rather than becoming data.

/** Comments stripped, so a rule's own explanation can never satisfy it. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path) && !path.includes('.test.')) out.push(path);
  }
  return out;
}

const BLOCK = 'components/records/property-block.tsx';
const HEADER = 'components/ds/ui/record-header.tsx';
const CONSUMERS = ['components/projects/projects-workspace.tsx', 'components/clients/clients-view.tsx'];

const px = (cls: string, prop: string): number => {
  const m = cls.match(new RegExp(`${prop}-\\[(\\d+)px\\]`));
  expect(m, `${prop} is an explicit px value in "${cls}"`).not.toBeNull();
  return Number(m![1]);
};

describe('the property column is one geometry', () => {
  it('widens the trigger by exactly the inset it pulls back', () => {
    // The arithmetic the DS comment spells out, asserted rather than described —
    // the first version of that comment said "two insets" and was wrong by 4px.
    // The left padding is cancelled by the negative margin; only the right
    // padding extends the box.
    expect(px(PROPERTY_ROW.labelTrigger, 'w')).toBe(px(PROPERTY_ROW.label, 'w') + PROPERTY_ROW.inset);
  });

  it('pulls the trigger back by that same inset', () => {
    // `-ms-1` is 4px in this scale. If the pull and the padding ever disagree,
    // the label text stops sitting on the column axis and a manageable header
    // stands 4px off a plain one.
    expect(PROPERTY_ROW.labelTrigger).toMatch(/-ms-1\b/);
    expect(PROPERTY_ROW.labelTrigger).toMatch(/\bpx-1\b/);
    expect(PROPERTY_ROW.inset, 'ms-1 / px-1 are 4px on this scale').toBe(4);
  });

  it('is stated once, and the block reads it rather than restating it', () => {
    const block = code(BLOCK);
    expect(block, 'the label column literal belongs to the DS').not.toMatch(/w-\[124px\]/);
    expect(block).toMatch(/PROPERTY_ROW\.labelTrigger/);
    expect(block, 'and the row and value recipes too').toMatch(/PROPERTY_ROW\.row/);
    expect(block).toMatch(/PROPERTY_ROW\.value/);
  });

  it('is spelled out, because Tailwind v4 generates from source text', () => {
    // A class built from a variable produces no CSS at all — the trap
    // components/tasks/row-surface.ts documents. Both widths must be literals.
    const header = readFileSync(HEADER, 'utf8');
    expect(header).toMatch(/w-\[\d+px\]/);
    expect(header, 'never interpolated').not.toMatch(/w-\[\$\{/);
  });

  it('keeps the label column as the layout, with no second header variant', () => {
    const header = code(HEADER);
    expect(header).not.toMatch(/RecordHeaderLayout|layout === 'facts'/);
  });
});

describe('one implementation, two records', () => {
  it('is the only place a property row is composed', () => {
    for (const file of CONSUMERS) {
      const src = code(file);
      expect(src, `${file} declares properties, it does not draw them`)
        .toMatch(/<PropertyBlock/);
      expect(src, `${file} must not restate the label column`).not.toMatch(/w-\[124px\]/);
    }
  });

  it('owns the drag, so neither record wires its own', () => {
    for (const file of CONSUMERS) {
      expect(code(file), `${file} must not bring its own property dnd`)
        .not.toMatch(/SortableContext[\s\S]{0,400}PROPERTY_ROW/);
    }
    expect(code(BLOCK)).toMatch(/SortableContext/);
  });

  it('gives every DndContext in the app a generated id', () => {
    // Found by hydrating this block: dnd-kit derives its drag-description
    // element id from `DndContext`'s `id`, and with none it falls back to a
    // MODULE-LEVEL COUNTER — which keeps counting on the server and restarts at
    // 0 in the browser. The markup arrives as `DndDescribedBy-1`, the client
    // expects `-0`, and React throws the subtree away. Three of the app's six
    // contexts had it, three did not; two of the three that had it used a hard
    // literal, which collides as soon as two of that component mount together.
    //
    // Swept app-wide rather than fixed here, because it is one rule and this
    // block is simply where it surfaced.
    const offenders: string[] = [];
    for (const file of [...walk('components'), ...walk('app')]) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/<DndContext\b([^>]*)>/g)) {
        if (!/\bid=\{/.test(m[1])) offenders.push(`${file}: <DndContext${m[1].slice(0, 40)}…`);
      }
    }
    expect(offenders, 'a DndContext with no id hydrates against a stale counter').toEqual([]);
  });

  it('generates that id rather than hard-coding one', () => {
    for (const file of [...walk('components'), ...walk('app')]) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('<DndContext')) continue;
      expect(src, `${file} should derive its dnd id from useId`).toMatch(/useId\(\)/);
      expect(src, `${file} must not name its DndContext with a literal`)
        .not.toMatch(/<DndContext[^>]*\bid="/);
    }
  });

  it('keeps dnd-kit out of the DS barrel that half the app imports', () => {
    // The reason this pattern lives in components/records and not components/ds:
    // the barrel is imported by dozens of files, and a primitive that drags is a
    // primitive that costs every one of them. Same boundary the DS `Board` keeps.
    const leaked = walk('components/ds').filter((f) => readFileSync(f, 'utf8').includes('@dnd-kit'));
    expect(leaked, 'the DS draws shapes; features bring the drag').toEqual([]);
  });

  it('gives both records a menu twin for the drag', () => {
    // Every pointer gesture ships a keyboard equivalent. The handle is a drag;
    // Move up / Move down in the label's menu is the same act without a mouse.
    const block = code(BLOCK);
    expect(block).toMatch(/Move up/);
    expect(block).toMatch(/Move down/);
    expect(block, 'and dnd-kit keyboard sensing as well').toMatch(/KeyboardSensor/);
  });

  it('names every control, since the handle is icon-only', () => {
    const block = code(BLOCK);
    expect(block).toMatch(/aria-label=\{`Reorder \$\{prop\.label\}`\}/);
    expect(block).toMatch(/aria-label=\{`\$\{prop\.label\} options`\}/);
    expect(block, 'the hidden disclosure reports its state').toMatch(/aria-expanded=\{openHidden\}/);
  });
});

/** The handle's own element, `<button` to `</button>`. Scoped to the element
 *  rather than measured in characters — a class list is free to grow, and a
 *  guard that counts characters breaks on a styling change while its rule holds. */
const handleOf = (src: string) => {
  const from = src.indexOf('aria-label={`Reorder');
  expect(from, 'the handle exists').toBeGreaterThan(-1);
  return src.slice(src.lastIndexOf('<button', from), src.indexOf('</button>', from));
};

describe('the drag handle costs the header nothing', () => {
  it('needs no gutter, so no page inset can clip it', () => {
    // It first shipped in a 24px gutter pulled left of the page's inset. That
    // inset is FLUID — `--view-px` is 18–40px, 14–28px in compact density — so
    // below ~800px, and nearly always in compact, the handle sat partly outside
    // the scroll region: at 375px, 6px of every handle was cut off, and touch
    // showed all seven permanently. Nothing may reach outside the row again.
    const block = code(BLOCK);
    expect(block, 'no gutter constant').not.toMatch(/const GUTTER\b/);
    const row = block.match(/className=\{cn\('group relative'[^}]*\}/)?.[0];
    expect(row, 'the row is found').toBeTruthy();
    expect(row, 'the row pulls itself nowhere').not.toMatch(/-m[sxl]-/);
    // The handle may overhang by at most the label chip's own 4px inset.
    const handle = handleOf(block);
    expect(handle).toMatch(/\babsolute\b/);
    expect(handle, 'offset within the chip inset').toMatch(/(?:^|\s)(?:-left-0\.5|-left-1|left-0)(?=\s|")/);
  });

  it('draws the handle in a control ink, the same one the pinned rail uses', () => {
    // A drag handle is the only sign a row can be dragged, so it is a CONTROL,
    // and WCAG 1.4.11 asks 3:1 of it. It shipped at ink-300 — measured 1.90:1 on
    // white and 1.75:1 on the dark card; ink-400 is 2.6:1 in both. ink-500 is
    // 6.1:1, and it is what the app's other handle already used.
    // The first UNPREFIXED ink — `hover:text-ink-800` is a state, not the rest ink.
    const ink = (h: string) => h.match(/(?<![:\w-])text-ink-(\d+)/)?.[1];
    const ours = ink(handleOf(code(BLOCK)));
    const rail = ink(handleOf(code('components/shell/pinned-rail.tsx')));
    expect(ours, 'below ink-500 the handle is under 3:1 in at least one theme').toBe('500');
    expect(ours, 'one ink for one kind of control').toBe(rail);
  });

  it('shares the glyph slot — the glyph steps aside while the handle steps in', () => {
    // The pinned rail's arrangement. The label beside the glyph already says
    // what the property is, so the swap costs no information.
    const block = code(BLOCK);
    expect(handleOf(block), 'the handle appears on row hover').toMatch(/group-hover:opacity-100/);
    const glyph = block.match(/<Icon icon=\{prop\.icon\}[\s\S]*?\/>/)?.[0];
    expect(glyph, 'the property glyph is found').toBeTruthy();
    expect(glyph, 'and steps aside on that same hover').toMatch(/group-hover:opacity-0/);
    expect(glyph, 'but only on a row that has a handle').toMatch(/!hidden && 'group-hover:opacity-0'/);
    // A transparent glyph still catches the pointer, and below opacity 1 it
    // paints AFTER the handle — so without this the handle is visible and dead.
    expect(glyph, 'and never takes the press meant for the handle').toMatch(/pointer-events-none/);
  });

  it('is absent on touch, where a transparent button would still catch the tap', () => {
    const handle = handleOf(code(BLOCK));
    expect(handle).toMatch(/\[@media\(pointer:coarse\)\]:hidden/);
    expect(handle, 'never forced visible on touch again').not.toMatch(/\[@media\(pointer:coarse\)\]:opacity-100/);
  });

  it('is not a Tab stop, because the label menu is the keyboard path', () => {
    // Seven handles plus seven label menus put 17 Tab stops in a header that had
    // 3. The menu's Move up / Move down / Hide is the keyboard twin, so the
    // handle leaves the Tab order — AFTER dnd-kit's spread, or its `tabIndex: 0`
    // wins. The pinned rail is the opposite case and stays tabbable: there the
    // handle IS the only keyboard path, and removing it would strand the act.
    const ours = handleOf(code(BLOCK));
    const spread = ours.indexOf('{...attributes}');
    expect(spread, 'dnd-kit attributes are spread').toBeGreaterThan(-1);
    expect(ours.indexOf('tabIndex={-1}'), 'the handle leaves the Tab order').toBeGreaterThan(spread);
    expect(code(BLOCK), 'and the menu still moves the row').toMatch(/Move up[\s\S]*Move down/);
    expect(handleOf(code('components/shell/pinned-rail.tsx')), 'the rail keeps its only keyboard path')
      .not.toMatch(/tabIndex=\{-1\}/);
  });
});

describe('the layout is a preference, not data', () => {
  const action = code('lib/actions/property-layout.ts');

  it('writes to the profile, never to the record', () => {
    expect(action).toMatch(/from\('profiles'\)/);
    expect(action, 'a project row carries no reader preference')
      .not.toMatch(/from\('projects'\)|from\('clients'\)/);
  });

  it('is read-modify-write on the whole preferences object', () => {
    // That column also carries the accent, the density, the display font, the
    // timezone, the Google-sync metadata and the sidebar's pins. Writing one key
    // on its own takes every one of them with it.
    expect(action).toMatch(/select\('preferences'\)/);
    expect(action).toMatch(/\.\.\.\(\(prof\?\.preferences/);
    expect(action, 'and re-reads the other record kinds inside the key').toMatch(/readPropLayouts/);
  });

  it('validates the set name, because it arrives from the client', () => {
    expect(action).toMatch(/PROP_SETS\.includes\(set\)/);
  });

  it('reverts the screen when the write fails', () => {
    // A rearrangement that silently did not save is worse than one that visibly
    // refused — you would find out days later, on another machine.
    const block = code(BLOCK);
    expect(block).toMatch(/const previous = layout/);
    expect(block).toMatch(/setLayout\(previous\)/);
    expect(block).toMatch(/toast\(\{ message: res\.error/);
  });

  it('reconciles the server copy during render, not in an effect', () => {
    const block = code(BLOCK);
    expect(block).toMatch(/useServerState\(incoming\)/);
    expect(block, 'the pattern lib/use-server-state.ts exists to stop')
      .not.toMatch(/useEffect\(\(\) => \{?\s*setLayout/);
  });

  it('costs no extra round trip to read', () => {
    // `currentProfile` is request-cached and the (app) layout has already awaited
    // it for the display name, the timezone and the pins. A fresh query here
    // would be a whole 228ms RTT for a preference already in memory.
    for (const file of ['lib/projects-data.ts', 'app/(app)/clients/page.tsx']) {
      const src = code(file);
      expect(src, `${file} reads the layout`).toMatch(/readPropLayout\(/);
      expect(src, `${file} goes through the cached profile`).toMatch(/currentProfile\(\)/);
    }
  });
});

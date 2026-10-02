import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── ONE NAME FOR THE LEVEL BETWEEN A PROJECT AND A TASK ────────────────────
//
// The user asked for "sub-projects": a branding job that contains motion work
// and web work, each with its own tasks. Zenboard has had exactly that since
// 0014 — `sections`, plus 0040's status / due date / client-visible columns,
// with progress roll-up in `lib/workstreams.ts`.
//
// It was called a SECTION in the UI, which is document vocabulary — a heading
// inside a page. Nobody looking for "sub-projects" types "section", so a level
// that was fully built read as missing. The code already knew the right word:
// `lib/workstreams.ts` is named for it, and the schema comment says the table
// "already WAS the Project → X → Task level".
//
// ── WHY THIS GUARD IS NARROW ────────────────────────────────────────────────
// The obvious test is "no visible string anywhere says `section`". Measured, it
// is a BAD test: 7 hits and 6 are correct English — "Client sections" and
// "Form sections" label tab strips, and "Add missing sections" is about a
// brief's headings, which really are sections. A guard that mostly cries wolf
// is a guard someone deletes.
//
// So this checks only the surfaces that NAME this level. `--` prefixed words
// (section_id, createSection, sectionsSupported) are the database's name for
// the table and are deliberately untouched: renaming a shipped table is a
// migration, and the user never sees it.
const SURFACES = [
  'components/projects/projects-workspace.tsx',
  'components/task-detail/task-detail-drawer.tsx',
];

/** Visible copy: JSX text, and the attributes that reach a person. */
function visibleStrings(src: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  const push = (text: string | undefined, index: number) => {
    if (text && text.trim()) out.push({ text, line: src.slice(0, index).split('\n').length });
  };
  const attr = /(?:title|placeholder|aria-label|label|description|actionLabel)=(?:"([^"]{2,90})"|\{\s*['"]([^'"]{2,90})['"]\s*\})/g;
  for (let m = attr.exec(src); m; m = attr.exec(src)) push(m[1] ?? m[2], m.index);
  const jsx = />\s*([A-Z][A-Za-z0-9 ,'’\-—·]{2,60}?)\s*</g;
  for (let m = jsx.exec(src); m; m = jsx.exec(src)) push(m[1], m.index);
  const call = /(?:flash|toast)\(\s*\{?\s*(?:message:\s*)?['"]([^'"]{3,90})['"]/g;
  for (let m = call.exec(src); m; m = call.exec(src)) push(m[1], m.index);
  // `actionLabel: 'Delete workstream'` inside a confirm() object literal.
  const obj = /actionLabel:\s*['"]([^'"]{2,60})['"]/g;
  for (let m = obj.exec(src); m; m = obj.exec(src)) push(m[1], m.index);
  return out;
}

describe('the level between a project and a task has one name', () => {
  it('never calls it a section where a person can read it', () => {
    const offenders: string[] = [];
    for (const f of SURFACES) {
      for (const { text, line } of visibleStrings(readFileSync(f, 'utf8'))) {
        if (/\bsections?\b/i.test(text)) offenders.push(`${f}:${line} — "${text}"`);
      }
    }
    expect(
      offenders,
      'This level is a WORKSTREAM. "Section" is what a heading inside a document ' +
        'is called, and using it here is why a fully-built feature read as missing.',
    ).toEqual([]);
  });

  it('says workstream where it names the level at all', () => {
    // The inverse: a rename that silently deleted the copy would pass the test
    // above. Something must actually say the word.
    const said = SURFACES.map((f) => readFileSync(f, 'utf8'))
      .flatMap(visibleStrings)
      .filter(({ text }) => /\bworkstreams?\b/i.test(text));
    expect(said.length, 'nothing names the level any more').toBeGreaterThanOrEqual(3);
  });

  it('offers the level on an EMPTY project, which is when you set it up', () => {
    // The control was a ghost button under the task list, and the empty-project
    // early return skipped it — so on day one of a branding job, the one screen
    // where you decide "Identity / Motion / Web" had no way to say it.
    const src = readFileSync('components/projects/projects-workspace.tsx', 'utf8');
    const empty = /if \(tasks\.length === 0 && sections\.length === 0[^)]*\)/.exec(src);
    expect(empty, 'the empty-project branch moved; re-check it still offers a workstream').not.toBeNull();
    const after = src.slice(empty!.index, empty!.index + 900);
    expect(after, 'the empty project must offer New workstream').toMatch(/New workstream/);
    expect(after, 'and it must not fire while the composer is open').toMatch(/!addingSection/);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ── THE CLERK INSIDE TRIAGE, AS SOURCE GUARDS ───────────────────────────────
//
// §7Q's promises are not properties of the rules alone — most of them are only kept by the SCREEN:
// that nothing is spent unasked, that no proposal appears without the receipt it rests on, that a
// suggestion is one more key rather than a different flow, and that accepting one goes through the
// mutations triage already had, so Z still works. Each is one careless edit away from gone, and
// none of them can be caught by a test of lib/inbox-file.ts.
//
// This repository tests components by reading them (there is no DOM runner); the behaviour these
// guards describe was also driven in a real browser against the dev-preview harness.

const triage = readFileSync('components/tasks/triage.tsx', 'utf8');
const view = readFileSync('components/tasks/tasks-view.tsx', 'utf8');
const bare = triage.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** One top-level `const NAME = …`, up to the next declaration at the same indent. */
const decl = (name: string) => {
  const start = bare.indexOf(`  const ${name} = `);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const next = bare.slice(start + 1).search(/\n  (const|function|return) /);
  return next === -1 ? bare.slice(start) : bare.slice(start, start + 1 + next);
};

describe('nothing is spent unasked', () => {
  it('has no effect that fetches: the clerk runs only from a press', () => {
    // "Off by default" (§7Q) is kept structurally. An effect that asked on mount would spend a
    // pool shared by every account holder on somebody who opened triage to clear six thoughts.
    const effects = bare.match(/useEffect\([\s\S]*?\n  \}/g) ?? [];
    for (const e of effects) expect(e).not.toMatch(/\bask\(|onSuggest\(/);
    expect(bare).toMatch(/onClick=\{\(\) => void ask\(\)\}/);
  });

  it('will not ask twice at once', () => {
    expect(bare).toMatch(/if \(!onSuggest \|\| reading\.status === 'reading'\) return;/);
  });

  it('offers nothing at all when no host was given', () => {
    // The dev-preview harness and any other caller without a session get a triage with no clerk,
    // rather than a button that fails when pressed.
    expect(bare).toMatch(/onSuggest && !done &&/);
    expect(bare).toMatch(/if \(!proposal \|\| !onFile\) return undefined;/);
  });
});

describe('a proposal is checkable, or it is not shown', () => {
  it('renders the receipt with every proposal, never behind a hover', () => {
    expect(bare).toMatch(/receipts\.map\(\(r\) => \(/);
    expect(bare).not.toMatch(/receipts[\s\S]{0,200}(title=|Tooltip|group-hover)/);
  });

  it('builds the receipt list from the evidence the proposal carries', () => {
    expect(bare).toMatch(/proposal\.project\?\.evidence/);
    expect(bare).toMatch(/proposal\.scheduled\?\.evidence \?\? proposal\.due\?\.evidence/);
  });

  it('names the duplicate it found, so the warning can be checked', () => {
    expect(bare).toMatch(/proposal\.duplicate\.title/);
  });
});

describe('a label is offered, but never on the filing key', () => {
  it('is marked inside the panel where labels are already chosen', () => {
    expect(bare).toMatch(/proposal\?\.label\?\.labelId\)\}/);
    expect(bare).toMatch(/it\.id === markId &&/);
  });

  it('does not reorder that panel: 1–9 have to stay where they were', () => {
    // Moving a suggestion to the top is the obvious way to highlight it and the wrong one — the
    // number keys are what the panel is for.
    const picker = decl('pickerRow');
    expect(picker).not.toMatch(/\.sort\(|\.unshift\(/);
    expect(picker).toMatch(/list\.slice\(0, 9\)\.map\(\(it, i\) =>/);
  });

  it('is never carried by F, which files', () => {
    // `label:` is the button's own text, which is not a Zenboard label; what must not appear is the
    // proposal's.
    expect(decl('suggested')).not.toMatch(/proposal\.label|labelId/);
    expect(bare).toMatch(/onFile!\(cur!, \{ projectId: suggested\.projectId, date: suggested\.date \}\)/);
  });

  it('is dropped when the label itself has gone', () => {
    expect(bare).toMatch(/labels\.some\(\(l\) => l\.id === proposal\.label!\.labelId\)/);
  });
});

describe('a suggestion is one more key, not another flow', () => {
  it('F exists only when there is something to accept', () => {
    expect(bare).toMatch(/k === 'f' && suggested/);
    expect(bare).toMatch(/\{suggested && \(\s*<ActBtn label=\{suggested\.label\} shortcut="F"/);
  });

  it('does not propose a project the thought is already in, or one that has gone', () => {
    expect(bare).toMatch(/projects\.find\(\(x\) => x\.id === proposal\.project!\.projectId\)/);
    expect(bare).toMatch(/cur\?\.project_id !== p\.id/);
  });

  it('labels the act with everything it will do', () => {
    // A button that files AND dates must say so; under-promising is how a person loses track of
    // what a key did to their data.
    expect(bare).toMatch(/File in \$\{p!\.name\}, \$\{day\}/);
  });

  it('leaves every existing key exactly where it was', () => {
    for (const [key, act] of [['e', 'complete'], ['t', 'schedule'], ['d', 'delete']] as const) {
      expect(bare).toMatch(new RegExp(`k === '${key}'\\) \\{ e\\.preventDefault\\(\\); act\\('${act}'`));
    }
    expect(bare).toMatch(/k === 's'\) \{ e\.preventDefault\(\); setPanel\('schedule'\)/);
    expect(bare).toMatch(/k === 'p'\) \{ e\.preventDefault\(\); if \(projects\.length\) setPanel\('project'\)/);
  });
});

describe('accepting is the mutation triage already had', () => {
  it('goes through act(), so it is recorded for Z like every other decision', () => {
    expect(bare).toMatch(/act\(suggested\.kind, \(\) => onFile!\(cur!, \{ projectId: suggested\.projectId, date: suggested\.date \}\)\)/);
  });

  it('is undone as an ordinary return to the Inbox — no new undo kind', () => {
    // Both halves clear `is_inbox`, and `triageUndo` puts a thought back the same way for either,
    // which is why the clerk needed no new reversal path of its own.
    expect(bare).toMatch(/\(projectId \? 'project' : 'schedule'\) as UndoKind/);
    expect(view).toMatch(/const triageFile = \(t: InboxTask, filing: \{ projectId\?: string; date\?: string \}\) => \{[\s\S]*?moveToProject\(t\.id, filing\.projectId\)[\s\S]*?reschedule\(t\.id, filing\.date\)/);
  });

  it('writes nothing itself: the component never imports an action', () => {
    expect(triage).not.toMatch(/from '@\/lib\/actions\//);
    expect(triage).not.toMatch(/from '@\/lib\/ai\//);
  });
});

describe('what the person is told', () => {
  it('says how many have a suggestion, and that nothing was filed', () => {
    expect(bare).toMatch(/nothing is filed until you press/);
  });

  it('has a sentence for an answer with nothing in it', () => {
    expect(bare).toMatch(/Nothing here was clear enough to suggest a home for\./);
  });

  it('offers the press again when it failed, and says so in one line', () => {
    expect(bare).toMatch(/reading\.status === 'failed'/);
    expect(bare).toMatch(/Try again/);
  });
});

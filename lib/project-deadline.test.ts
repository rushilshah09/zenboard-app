import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { nextDeadline, deadlineCandidates, DEADLINE_RANK, type DeadlineCandidate } from '@/lib/project-deadline';

// The rule that used to be eight untestable lines inside a 1600-line
// component, with a comparator that could never return 0.
const c = (date: string, label: string, kind: DeadlineCandidate['kind']): DeadlineCandidate => ({ date, label, kind });
const TODAY = '2026-09-10';

describe('the next deadline', () => {
  it('is the soonest date still ahead', () => {
    const got = nextDeadline([c('2026-09-20', 'later', 'task'), c('2026-09-12', 'sooner', 'task')], TODAY);
    expect(got?.label).toBe('sooner');
  });

  it('counts TODAY, and drops yesterday', () => {
    // A deadline that is today is the most urgent thing a project has;
    // treating it as gone would hide it on the one day it matters most.
    expect(nextDeadline([c(TODAY, 'today', 'task')], TODAY)?.label).toBe('today');
    expect(nextDeadline([c('2026-09-09', 'yesterday', 'task')], TODAY)).toBeNull();
  });

  it('returns null when nothing is ahead', () => {
    expect(nextDeadline([], TODAY)).toBeNull();
  });

  it('breaks a tie by how much the container means', () => {
    // THE BUG THIS REPLACED: `sort((a, b) => (a.date < b.date ? -1 : 1))`
    // never returns 0, so same-day candidates resolved in whatever order the
    // database returned them — a task called "Send file" could beat "Project
    // deadline" on the same date, which is the least useful true thing
    // available.
    const same = [c('2026-09-12', 'a task', 'task'), c('2026-09-12', 'Project deadline', 'project'), c('2026-09-12', 'Discovery', 'workstream')];
    expect(nextDeadline(same, TODAY)?.label).toBe('Project deadline');
    // ...and it is stable whichever order they arrive in.
    expect(nextDeadline([...same].reverse(), TODAY)?.label).toBe('Project deadline');
    expect(nextDeadline(same.slice(0, 1).concat(same[2]), TODAY)?.label).toBe('Discovery');
  });

  it('ranks project above workstream above task, and says so once', () => {
    expect([...DEADLINE_RANK]).toEqual(['project', 'workstream', 'task']);
  });
});

describe('what claims a date on a project', () => {
  const base = {
    project: { deadline: null, deadline_label: null },
    openTasks: [] as { title: string; scheduled_date?: string | null }[],
    streams: [] as { name: string; due_date?: string | null; done: number; total: number }[],
  };

  it('takes a workstream deadline — the reason to date a phase at all', () => {
    const got = deadlineCandidates({ ...base, streams: [{ name: 'Discovery', due_date: '2026-09-12', done: 0, total: 3 }] });
    expect(got).toEqual([{ date: '2026-09-12', label: 'Discovery', kind: 'workstream' }]);
  });

  it('drops a FINISHED workstream', () => {
    // Its date stopped being a claim about the future the moment the work
    // under it was done.
    const got = deadlineCandidates({ ...base, streams: [{ name: 'Discovery', due_date: '2026-09-12', done: 3, total: 3 }] });
    expect(got).toEqual([]);
  });

  it('keeps an EMPTY workstream', () => {
    // Nothing done means nothing finished. A phase you have not started is
    // exactly the one whose deadline you want to see.
    const got = deadlineCandidates({ ...base, streams: [{ name: 'Motion', due_date: '2026-09-12', done: 0, total: 0 }] });
    expect(got).toHaveLength(1);
  });

  it('names an unlabelled project deadline rather than showing a bare date', () => {
    expect(deadlineCandidates({ ...base, project: { deadline: '2026-09-12', deadline_label: '   ' } })[0].label)
      .toBe('Project deadline');
  });

  it('ignores undated everything', () => {
    expect(deadlineCandidates({
      project: { deadline: null },
      openTasks: [{ title: 'no date' }],
      streams: [{ name: 'no date', due_date: null, done: 0, total: 2 }],
    })).toEqual([]);
  });
});

describe("0040's other two columns are finally wired", () => {
  // The measured finding: migration 0040 added `status`, `due_date` and
  // `client_visible` to sections, and only the third was ever rendered or
  // settable. Two columns of dead schema on the level the user called the
  // worst offender.
  const strip = (src: string) =>
    src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const ws = strip(readFileSync('components/projects/projects-workspace.tsx', 'utf8'));
  const actions = strip(readFileSync('lib/actions/labels.ts', 'utf8'));

  it('can write a workstream deadline and its paused state', () => {
    expect(actions).toMatch(/export async function setSectionDate/);
    expect(actions).toMatch(/export async function setSectionStatus/);
    expect(ws).toMatch(/onDateSection=\{setStreamDate\}/);
    expect(ws).toMatch(/onPauseSection=\{setStreamPaused\}/);
  });

  // The heading's controls live in workstream-controls.tsx now, drawn by the
  // List's headings AND the Board's columns — so the rule is asserted where it
  // lives, and each view is held to drawing the shared control rather than a
  // copy of it.
  const controls = strip(readFileSync('components/projects/workstream-controls.tsx', 'utf8'));
  const board = strip(readFileSync('components/projects/project-board.tsx', 'utf8'));

  it('renders the deadline on the heading, with overdue as the only colour', () => {
    expect(controls).toMatch(/formatRelativeDay\(stream\.due_date\)/);
    expect(controls, 'a calm page affords one alarm').toMatch(/stream\.due_date < today \? 'text-danger-600'/);
    for (const [view, src] of [['List', ws], ['Board', board]] as const) {
      expect(src, `the ${view} draws the shared date`).toMatch(/<WorkstreamDate stream=/);
    }
  });

  it('shows a status badge only when someone SET one', () => {
    // `statusOf` derives active and completed from progress, and both are
    // already legible in the n/m beside the name. Paused is the one state
    // progress cannot know, so it is the only one worth the chrome.
    expect(controls).toMatch(/stream\?\.status === 'paused' && <Badge/);
    expect(controls, 'and the menu can set exactly that').toMatch(/onPause\(stream\.id, !paused\)/);
    for (const [view, src] of [['List', ws], ['Board', board]] as const) {
      expect(src, `the ${view} draws the shared facts`).toMatch(/<WorkstreamFacts stream=/);
      expect(src, `and the shared menu`).toMatch(/<WorkstreamMenu stream=/);
    }
  });

  it('feeds the workstream deadline into the project header', () => {
    expect(ws).toMatch(/nextDeadline\(deadlineCandidates\(\{/);
    expect(ws, 'no inline copy left behind').not.toMatch(/deadlineCands/);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── PHASE 3B · ONE LEVEL BETWEEN A PROJECT AND ITS TASKS ───────────────────
// A project had two, and neither worked: a MILESTONE was a dated checkpoint
// that owned nothing ("will we hit Beta to client?" was unanswerable), and a
// WORKSTREAM owned tasks but had no date, so it could never be a phase.
// Migration 0041 folds the first into the second.
//
// These guards are mostly about the TRANSITION, because that is the part that
// silently rots: a half-migrated database has to render correctly, and the
// old surface has to disappear by itself rather than by someone remembering.

const strip = (src: string) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const code = (f: string) => strip(readFileSync(f, 'utf8'));
const sqlRaw = readFileSync('supabase/migrations/0041_milestones_into_workstreams.sql', 'utf8');
// Comments stripped before anything is asserted about the statements. The
// rollback note at the foot of that file spells out an UPDATE and a DELETE in
// prose, and a guard that reads prose as SQL fails on the documentation
// instead of the migration — the same trap the Count guard hit.
const sql = sqlRaw.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

describe('migration 0041', () => {
  it('never touches a GOAL milestone', () => {
    // `milestones` predates projects: it belongs to Goals (0001), and 0036
    // only added `project_id` beside `goal_id`. Copying a goal's step into a
    // project's workstreams would be data loss with extra steps.
    const statements = sql.split(';').filter((x) => /insert|update|delete/i.test(x));
    expect(statements.length).toBeGreaterThan(0);
    for (const st of statements) {
      expect(st, `every write must scope itself to project rows:\n${st.trim().slice(0, 120)}`)
        .toMatch(/project_id is not null|id in \(select id from moved\)/);
    }
  });

  it('stamps rather than deletes', () => {
    // A migration the user pastes into production should not destroy the rows
    // it copied. The stamp is reversible with one UPDATE and is also the
    // application's gate.
    expect(sql).toMatch(/add column if not exists migrated_at/);
    expect(sql, 'no destructive statement in the forward path')
      .not.toMatch(/^\s*delete\s+from/im);
    expect(sqlRaw, 'and the rollback is documented in the file itself')
      .toMatch(/set migrated_at = null/);
  });

  it('is idempotent', () => {
    expect(sql).toMatch(/migrated_at is null/);
  });

  it('carries a finished checkpoint across as an EXPLICIT status', () => {
    // A checkpoint arrives owning no tasks, so a derived status would read it
    // as unstarted. `statusOf` says an explicit one always wins.
    expect(sql).toMatch(/case when m\.done then 'completed' end/);
  });

  it('lands new workstreams AFTER the ones the project already has', () => {
    expect(sql).toMatch(/max\(s\.sort_order\)/);
    expect(sql).toMatch(/row_number\(\) over/);
  });

  it('keeps client visibility closed, like every other shareable thing', () => {
    expect(sql).toMatch(/false\s*\n\s*from moved|, false\b/);
  });
});

describe('the transition renders correctly on both sides', () => {
  const ws = code('components/projects/projects-workspace.tsx');
  const loader = code('lib/projects-data.ts');
  const cal = code('components/calendar/calendar-view.tsx');

  it('asks for the stamp optimistically and drops it on an unmigrated database', () => {
    // Without the retry, every account that has not run 0041 loses its
    // checkpoint list the moment this ships — which is the failure the house
    // gate exists to prevent.
    expect(loader).toMatch(/\.is\('migrated_at', null\)/);
    expect(loader, 'and a fallback that does not name the column')
      .toMatch(/select\('id, project_id, title, done, due_date, sort_order'\)/);
    expect(cal).toMatch(/\.is\('migrated_at', null\)/);
  });

  it('hides the old checkpoint list once nothing is left in it', () => {
    // Not a feature flag anyone has to remember to flip: the loader filters
    // stamped rows out, so the section empties itself.
    expect(ws).toMatch(/\{milestones && milestones\.length > 0 && \(/);
  });

  it('shows workstreams on the Overview whether or not 0041 has run', () => {
    expect(ws).toMatch(/<ProjectWorkstreams streams=\{streams\} tasks=\{tasks\} onOpen=\{onOpenStreams\} \/>/);
  });

  it('keeps dated phases on the calendar after the checkpoints leave it', () => {
    // §7E: "dated checkpoints rendering on Overview + Calendar". If milestones
    // stop being fetched and nothing replaces them, the merge is a regression.
    expect(cal).toMatch(/from\('sections'\)/);
    expect(cal).toMatch(/setMiles\(\[\.\.\.fromMilestones, \.\.\.fromStreams\]\)/);
  });
});

describe('the Overview section is a report, not a second editor', () => {
  const pw = code('components/projects/project-workstreams.tsx');

  it('reads progress from THE projection', () => {
    expect(pw).toMatch(/groupByStream\(tasks, streams\)/);
    expect(pw).toMatch(/statusOf\(/);
  });

  it('drops the unfiled group — it is not part of a chosen shape', () => {
    expect(pw).toMatch(/\.filter\(\(g\) => g\.stream !== null\)/);
  });

  it('offers no rename, date, delete or reorder — those live on the Tasks tab', () => {
    for (const verb of ['onRename', 'onDelete', 'onSetDate', 'onMove', 'DatePicker']) {
      expect(pw, `${verb} would be a second home for something Tasks owns`).not.toMatch(new RegExp(verb));
    }
  });

  it('reports nothing rather than reporting an absence', () => {
    // No "0/0" on an empty stream, and no "Add a date" prompt: this section
    // states where things stand, it does not nag.
    expect(pw).toMatch(/g\.progress\.total > 0 &&/);
    expect(pw).toMatch(/\{s\.due_date && \(/);
    expect(pw, 'and it disappears entirely on a project with no workstreams')
      .toMatch(/if \(streams\.length === 0\) return null;/);
  });
});

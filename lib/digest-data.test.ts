import { describe, it, expect } from 'vitest';
import { loadDigest } from './digest-data';
import { dayWindow } from './date';
import { todaysPlanFilter } from './todays-plan';
import { fakeDb, asked, calls, mentions, type Query } from '@/test/fake-db';

const U = 'user-1';
const TODAY = '2026-09-10';
const TZ = 'Asia/Kolkata';
const who = { userId: U, today: TODAY, tz: TZ, preferences: {} };

/** Rows per table, handed back as if the database had applied the filters. */
function db(rows: Partial<Record<string, unknown[]>> = {}) {
  return fakeDb((q: Query) => ({ data: rows[q.table] ?? [] }));
}
const query = (queries: Query[], table: string) => queries.find((q) => q.table === table)!;

describe('loadDigest — what it asks for', () => {
  it('reads OPEN as `done = false`, never through the Board’s `status`', async () => {
    // `status` is null on 78 of 88 tasks, and `NULL <> 'done'` is NULL, not
    // true — so filtering on it silently dropped most of the open work.
    const { db: d, queries } = db();
    await loadDigest(d, who);
    const tasks = query(queries, 'tasks');
    expect(asked(tasks, 'eq', 'done', false)).toBe(true);
    expect(mentions(tasks, 'status')).toBe(false);
  });

  it('asks for the plan with the one today rule, plus what is late', async () => {
    const { db: d, queries } = db();
    await loadDigest(d, who);
    const [clause] = calls(query(queries, 'tasks'), 'or')[0] as string[];
    expect(clause.startsWith(todaysPlanFilter(TODAY))).toBe(true);
    expect(clause).toContain(`due_date.lt.${TODAY}`);
    expect(asked(query(queries, 'tasks'), 'is', 'parent_task_id', null)).toBe(true);
  });

  it('reads meetings inside the USER’s day, not the database’s', async () => {
    // A zoneless `2026-09-10T00:00:00` is read in the database's zone (UTC),
    // so an IST day used to begin at 05:30 local.
    const { db: d, queries } = db();
    await loadDigest(d, who);
    const ev = query(queries, 'calendar_events');
    const w = dayWindow(TODAY, TZ);
    expect(asked(ev, 'gte', 'starts_at', w.startISO)).toBe(true);
    expect(asked(ev, 'lt', 'starts_at', w.endISO)).toBe(true);
    expect(w.startISO).toBe('2026-09-09T18:30:00.000Z');
  });

  it('never reads archived content, and never the whole document body', async () => {
    const { db: d, queries } = db();
    await loadDigest(d, who);
    const pages = query(queries, 'pages');
    expect(asked(pages, 'is', 'archived_at', null)).toBe(true);
    // Home's select, byte for byte — a mistyped jsonb path answers 200 with
    // nulls instead of failing.
    expect(asked(pages, 'select', 'id, title, content->pipeline')).toBe(true);
  });

  it('scopes every query to the one user — the service role has no RLS', async () => {
    const { db: d, queries } = db({
      tasks: [{ id: 't1', title: 'A', scheduled_date: TODAY, due_date: null, highlight: false, estimate_minutes: null, priority: 'low' }],
      task_links: [{ task_id: 't1', blocked_by_task_id: 'b1' }],
    });
    await loadDigest(d, who);
    for (const q of queries) {
      if (q.table === 'client_requests') expect(asked(q, 'eq', 'projects.user_id', U)).toBe(true);
      // task_links has no owner column; it is reached only through the
      // user's own task ids, which is the scope.
      else if (q.table === 'task_links') expect(calls(q, 'in')[0][1]).toEqual(['t1']);
      else expect(asked(q, 'eq', 'user_id', U), `${q.table} is not scoped`).toBe(true);
    }
  });
});

describe('loadDigest — what it makes of the answer', () => {
  const task = (id: string, o: Record<string, unknown>) =>
    ({ id, title: id, scheduled_date: null, due_date: null, highlight: false, estimate_minutes: null, priority: 'low', ...o });

  it('lists each task once: the plan wins over overdue', async () => {
    const { db: d } = db({
      tasks: [
        task('planned-and-late', { scheduled_date: TODAY, due_date: '2026-09-01' }),
        task('starred', { highlight: true }),
        task('late', { due_date: '2026-09-05' }),
      ],
    });
    const out = await loadDigest(d, who);
    expect(out.today.map((t) => t.id)).toEqual(['planned-and-late', 'starred']);
    expect(out.overdue.map((t) => t.id)).toEqual(['late']);
  });

  it('keeps timebox twins out of meetings — they are tasks already listed', async () => {
    const { db: d } = db({
      calendar_events: [
        { title: 'Kickoff', starts_at: '2026-09-10T04:30:00Z', ends_at: '2026-09-10T05:30:00Z', all_day: false, task_id: null },
        { title: 'Write the brief', starts_at: '2026-09-10T06:00:00Z', ends_at: '2026-09-10T07:00:00Z', all_day: false, task_id: 't9' },
      ],
    });
    const out = await loadDigest(d, who);
    expect(out.meetings.map((m) => m.title)).toEqual(['Kickoff']);
  });

  it('tells the time in the user’s zone', async () => {
    const { db: d } = db({
      calendar_events: [
        { title: 'Kickoff', starts_at: '2026-09-10T04:30:00Z', ends_at: '2026-09-10T05:30:00Z', all_day: false, task_id: null },
        { title: 'Offsite', starts_at: '2026-09-10T00:00:00Z', ends_at: null, all_day: true, task_id: null },
      ],
    });
    const out = await loadDigest(d, who);
    expect(out.meetings).toEqual([
      { title: 'Kickoff', when: '10:00 – 11:00' },
      { title: 'Offsite', when: 'All day' },
    ]);
  });

  it('counts what is being filmed today, and not an untriaged capture', async () => {
    const { db: d } = db({
      pages: [
        { id: 'c1', title: 'Studio tour', pipeline: { stage: 'shoot', bucket: 'piece', shootAt: TODAY } },
        { id: 'c2', title: 'Raw idea', pipeline: { stage: 'idea', bucket: 'inbox', shootAt: TODAY } },
        { id: 'c3', title: 'Next week', pipeline: { stage: 'script', bucket: 'piece', shootAt: '2026-09-17' } },
      ],
    });
    const out = await loadDigest(d, who);
    expect(out.content.map((e) => [e.piece.id, e.kind])).toEqual([['c1', 'shoot']]);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { capture, today, search, listProjects, runTool, type McpContext } from './mcp-tools';
import { inboxCapture } from './content';
import { INTAKE_TITLE_MAX } from './task-intake';
import { taskScopes } from './task-scopes';
import { fakeDb, asked, calls, isSingle, mentions, type Query, type Result } from '@/test/fake-db';

const U = 'owner-1';
const SPACE = 'space-1';
const ORIGIN = 'https://z.app';

/**
 * A context over a fake database. `rows` answers list reads by table; a
 * single-row read on `spaces` finds the account's space; an insert answers
 * with the id `new-1`.
 */
function ctx(rows: Partial<Record<string, unknown[]>> = {}, opts: { noSpace?: boolean } = {}) {
  const { db, queries } = fakeDb((q: Query): Result => {
    if (calls(q, 'insert').length) return { data: { id: q.table === 'spaces' ? 'made-space' : 'new-1' } };
    if (q.table === 'spaces' && isSingle(q)) return { data: opts.noSpace ? null : { id: SPACE } };
    return { data: rows[q.table] ?? [] };
  });
  const c: McpContext = { db, userId: U, tz: 'Asia/Kolkata', preferences: {}, origin: ORIGIN };
  return { c, queries };
}
const inserted = (queries: Query[], table: string) =>
  calls(queries.find((q) => q.table === table && calls(q, 'insert').length)!, 'insert')[0][0] as Record<string, unknown>;

afterEach(() => vi.useRealTimers());

describe('capture — a task', () => {
  it('lands in the Inbox: a project or the Inbox, never neither', async () => {
    // The first version left `is_inbox` at its default (false) with no
    // project — a task in NO pile. The tool said "added to your inbox" and the
    // task appeared nowhere in the app.
    const { c, queries } = ctx();
    await capture(c, { text: 'Film the studio tour' });
    const row = inserted(queries, 'tasks');
    expect(row).toMatchObject({ user_id: U, space_id: SPACE, project_id: null, is_inbox: true, title: 'Film the studio tour' });
    expect(taskScopes({ project_id: null, list_id: null } as never)).toEqual([]);  // why is_inbox is the only thing holding it
  });

  it('claims nothing it was not told: no date, no priority, no Board status', async () => {
    const { c, queries } = ctx();
    await capture(c, { text: 'Chase the TechSpark invoice' });
    const row = inserted(queries, 'tasks');
    for (const k of ['scheduled_date', 'due_date', 'priority', 'status', 'highlight']) expect(row).not.toHaveProperty(k);
  });

  it('keeps the whole thought when the title had to be cut', async () => {
    const long = `${'Rework the onboarding flow so a new studio can import clients from a spreadsheet '.repeat(4).trim()}\nand the second line matters too`;
    const { c, queries } = ctx();
    const reply = await capture(c, { text: long });
    const row = inserted(queries, 'tasks');
    expect((row.title as string).length).toBeLessThanOrEqual(INTAKE_TITLE_MAX);
    expect(row.title).toMatch(/…$/);
    expect(row.notes).toBe(long);
    expect(reply).toContain('full text is kept');
  });

  it('keeps a link it was given', async () => {
    const { c, queries } = ctx();
    await capture(c, { text: 'Look at this edit', url: 'https://example.com/edit' });
    expect(inserted(queries, 'tasks').notes).toBe('https://example.com/edit');
  });

  it('answers with a link to what it made', async () => {
    const { c } = ctx();
    expect(await capture(c, { text: 'Book the studio' })).toContain(`${ORIGIN}/tasks?task=new-1`);
  });

  it('refuses an empty thought without touching the database', async () => {
    const { c, queries } = ctx();
    expect(await capture(c, { text: '  \n  ' })).toMatch(/Nothing to save/);
    expect(queries).toHaveLength(0);
  });

  it('makes a space for an account that has none, rather than failing', async () => {
    const { c, queries } = ctx({}, { noSpace: true });
    await capture(c, { text: 'First thing ever' });
    expect(inserted(queries, 'spaces')).toMatchObject({ user_id: U });
    expect(inserted(queries, 'tasks').space_id).toBe('made-space');
  });
});

describe('capture — an idea', () => {
  it('is exactly the row the app’s own capture makes', async () => {
    const { c, queries } = ctx();
    await capture(c, { text: 'That Nike edit — the match cuts', kind: 'idea', url: 'https://x.com/v' });
    expect(inserted(queries, 'pages')).toEqual(
      inboxCapture({ userId: U, spaceId: SPACE, title: 'That Nike edit — the match cuts', sourceUrl: 'https://x.com/v' }),
    );
  });

  it('keeps a long idea whole, in its note', async () => {
    const text = 'A series idea\nEpisode one is the studio, episode two is the process';
    const { c, queries } = ctx();
    await capture(c, { text, kind: 'idea' });
    const row = inserted(queries, 'pages') as { title: string; content: { pipeline: { note?: string } } };
    expect(row.title).toBe('A series idea');
    expect(row.content.pipeline.note).toBe(text);
  });
});

describe('today', () => {
  it('asks about the USER’s day, not the worker’s', async () => {
    // 20:00 UTC on the 9th is 01:30 on the 10th in India: the worker's clock
    // said the 9th while the person asking was already in the 10th. Two zones,
    // chosen so that falling back to the RUNTIME's clock fails on any machine —
    // one of them always disagrees with UTC, a laptop in IST, and one in LA.
    vi.useFakeTimers({ toFake: ['Date'] });
    const cases = [
      { tz: 'Asia/Kolkata', at: '2026-09-09T20:00:00Z', day: '2026-09-10', head: 'Thursday 10 September 2026' },
      { tz: 'America/Los_Angeles', at: '2026-09-10T02:00:00Z', day: '2026-09-09', head: 'Wednesday 9 September 2026' },
    ];
    for (const { tz, at, day, head } of cases) {
      vi.setSystemTime(new Date(at));
      const { c, queries } = ctx();
      const out = await today({ ...c, tz });
      const clause = calls(queries.find((q) => q.table === 'tasks')!, 'or')[0][0] as string;
      expect(clause, tz).toContain(`scheduled_date.eq.${day}`);
      expect(out.startsWith(`${head} (${tz})`), tz).toBe(true);
    }
  });

  it('reads open work as `done = false` — the first version asked `status`', async () => {
    const { c, queries } = ctx();
    await today(c);
    const tasks = queries.find((q) => q.table === 'tasks')!;
    expect(asked(tasks, 'eq', 'done', false)).toBe(true);
    expect(mentions(tasks, 'status')).toBe(false);
  });

  it('includes the meetings — a model has no calendar open', async () => {
    const { c } = ctx({
      tasks: [{ id: 't1', title: 'Write the brief', scheduled_date: '2026-09-10', due_date: null, highlight: false, estimate_minutes: null, priority: 'low' }],
      calendar_events: [{ title: 'Kickoff', starts_at: '2026-09-10T04:30:00Z', ends_at: '2026-09-10T05:30:00Z', all_day: false, task_id: null }],
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-10T03:00:00Z'));
    const out = await today(c);
    expect(out).toContain('Today — 1 task');
    expect(out).toContain('• 10:00 – 11:00  Kickoff');
  });

  it('says so plainly when the day is empty', async () => {
    const { c } = ctx();
    expect(await today(c)).toMatch(/Nothing planned for today/);
  });
});

describe('search', () => {
  it('never reaches into archived pages — that is the trash', async () => {
    const { c, queries } = ctx();
    await search(c, { query: 'brief' });
    expect(asked(queries.find((q) => q.table === 'pages')!, 'is', 'archived_at', null)).toBe(true);
  });

  it('reports a ticked task as done from `done`, not from `status`', async () => {
    const { c, queries } = ctx({ tasks: [{ id: 't1', title: 'Send the brief', done: true }, { id: 't2', title: 'Brief v2', done: false }] });
    const out = await search(c, { query: 'brief' });
    expect(out).toContain('• Send the brief (done)');
    expect(out).toContain('• Brief v2\n');
    expect(mentions(queries.find((q) => q.table === 'tasks')!, 'status')).toBe(false);
  });

  it('files a content piece under Content and links it there, not as a stray doc', async () => {
    const { c } = ctx({ pages: [{ id: 'd1', title: 'Brand brief', type: 'doc' }, { id: 'c1', title: 'Brief reel', type: 'content' }] });
    const out = await search(c, { query: 'brief' });
    expect(out).toContain(`Documents (1)\n• Brand brief\n  ${ORIGIN}/documents?page=d1`);
    expect(out).toContain(`Content (1)\n• Brief reel\n  ${ORIGIN}/content?piece=c1`);
  });

  it('treats the user’s % and _ as characters, not wildcards', async () => {
    const { c, queries } = ctx();
    await search(c, { query: '100%_done' });
    expect(calls(queries.find((q) => q.table === 'tasks')!, 'ilike')[0][1]).toBe('%100\\%\\_done%');
  });
});

describe('list_projects', () => {
  it('states a status only when it is not the default', async () => {
    const { c } = ctx({ projects: [
      { id: 'p1', name: 'Acme rebrand', status: 'active', clients: { name: 'Acme' } },
      { id: 'p2', name: 'Old site', status: 'paused', clients: null },
    ] });
    const out = await listProjects(c);
    expect(out).toContain(`• Acme rebrand · Acme\n  ${ORIGIN}/projects/p1`);
    expect(out).toContain('• Old site — paused');
  });
});

describe('the security model — every query is the token owner’s', () => {
  it('scopes every read and every write, across every tool', async () => {
    // The service role has no RLS. This is the one property that makes a
    // bearer-token endpoint that WRITES safe, so it is asserted over every
    // query every tool makes rather than tool by tool.
    const { c, queries } = ctx({
      tasks: [{ id: 't1', title: 'A', scheduled_date: '2026-09-10', due_date: null, highlight: false, estimate_minutes: null, priority: 'low', done: false }],
      task_links: [{ task_id: 't1', blocked_by_task_id: 'b1' }],
    });
    await runTool(c, 'capture', { text: 'a task' });
    await runTool(c, 'capture', { text: 'an idea', kind: 'idea' });
    await runTool(c, 'today', {});
    await runTool(c, 'search', { query: 'a' });
    await runTool(c, 'list_projects', {});
    expect(queries.length).toBeGreaterThan(10);
    for (const q of queries) {
      const insert = calls(q, 'insert')[0]?.[0] as Record<string, unknown> | undefined;
      if (insert) expect(insert.user_id, `insert into ${q.table}`).toBe(U);
      else if (q.table === 'client_requests') expect(asked(q, 'eq', 'projects.user_id', U)).toBe(true);
      else if (q.table === 'task_links') expect(calls(q, 'in')[0][1]).toEqual(['t1']);
      else expect(asked(q, 'eq', 'user_id', U), `${q.table} read is not scoped`).toBe(true);
    }
  });

  it('an unknown tool touches nothing', async () => {
    const { c, queries } = ctx();
    expect(await runTool(c, 'drop_tables', {})).toBe('Unknown tool: drop_tables');
    expect(queries).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { groupEdges, edgeCount, recordHref, parseRecordHref, resolveRefs, resolveSummaries, type ConnectedEdge, type EntityType } from './connected';

const e = (type: EntityType, id: string, o: Partial<ConnectedEdge> = {}): ConnectedEdge => ({
  key: `${o.origin ?? 'structural'}:${type}:${id}:${o.via ?? ''}`,
  type, id, label: `${type} ${id}`, origin: 'structural', ...o,
});

describe('recordHref', () => {
  it('addresses every type that has a record-level route', () => {
    expect(recordHref('task', 'x')).toBe('/tasks?task=x');
    expect(recordHref('client', 'x')).toBe('/clients?c=x');
    expect(recordHref('doc', 'x')).toBe('/documents?page=x');
    expect(recordHref('invoice', 'x')).toBe('/money/x');
    expect(recordHref('project', 'x')).toBe('/projects/x');
    expect(recordHref('form', 'x')).toBe('/forms/x');
  });

  it('returns undefined — not a hub URL — for types with no record route', () => {
    // The Connected panel relies on this to render an unlinked row. A hub URL
    // here would silently turn "Kickoff call" into a link to the clients list.
    // `meeting` left this list when the panel moved into the URL.
    for (const t of ['goal', 'request', 'feedback'] as EntityType[]) {
      expect(recordHref(t, 'x')).toBeUndefined();
    }
  });
});

describe('groupEdges', () => {
  it('groups by target type and drops empty groups', () => {
    const groups = groupEdges([e('task', 't1'), e('task', 't2'), e('client', 'c1')]);
    expect(groups.map((g) => g.type)).toEqual(['client', 'task']);
    expect(groups.find((g) => g.type === 'task')!.items).toHaveLength(2);
  });

  it('orders containers before parts', () => {
    // A task's project/client matter more than its subtasks — the panel reads
    // top-down as "where does this live" then "what is inside it".
    const groups = groupEdges([e('doc', 'd1'), e('task', 't1'), e('project', 'p1'), e('client', 'c1')]);
    expect(groups.map((g) => g.type)).toEqual(['project', 'client', 'task', 'doc']);
  });

  it('de-duplicates an entity reached by two paths, keeping the first (structural)', () => {
    const structural = e('client', 'c1', { label: 'Meridian Studio', via: 'Acme rebrand' });
    const mentioned = e('client', 'c1', { label: 'Meridian Studio', origin: 'mention', key: 'mention:m1' });
    const groups = groupEdges([structural, mentioned]);
    expect(edgeCount(groups)).toBe(1);
    expect(groups[0].items[0].origin).toBe('structural');
    expect(groups[0].items[0].via).toBe('Acme rebrand');
  });

  it('never lists an entity as connected to itself via a mention', () => {
    const self = { type: 'doc' as const, id: 'd1' };
    const groups = groupEdges([e('doc', 'd1', { origin: 'mention', key: 'mention:m1' }), e('doc', 'd2')], self);
    expect(edgeCount(groups)).toBe(1);
    expect(groups[0].items[0].id).toBe('d2');
  });

  it('keeps a structural self-edge (payments summarise onto their own invoice)', () => {
    // invoiceEdges emits a "2 payments" row carrying the invoice's own id. That is
    // a summary line, not a self-reference, so only *mention* self-edges are cut.
    const self = { type: 'invoice' as const, id: 'i1' };
    const groups = groupEdges([e('invoice', 'i1', { label: '2 payments', via: 'received' })], self);
    expect(edgeCount(groups)).toBe(1);
  });

  it('carries tombstones through rather than hiding them', () => {
    const groups = groupEdges([e('doc', 'gone', { origin: 'mention', tombstone: true, key: 'mention:m2' })]);
    expect(groups[0].items[0].tombstone).toBe(true);
  });

  it('omits whole groups the host surface already renders', () => {
    // The task drawer lists subtasks itself; Connected must not repeat them.
    const groups = groupEdges(
      [e('task', 't1'), e('task', 't2'), e('project', 'p1'), e('client', 'c1')],
      { type: 'task', id: 't0' },
      ['task'],
    );
    expect(groups.map((g) => g.type)).toEqual(['project', 'client']);
  });

  it('omitting every present type yields no panel at all', () => {
    expect(groupEdges([e('task', 't1')], undefined, ['task'])).toEqual([]);
  });

  it('returns no groups for an entity with no edges', () => {
    expect(groupEdges([])).toEqual([]);
    expect(edgeCount([])).toBe(0);
  });
});

// ── resolveSummaries — what a reference IS ──────────────────────────────────
// `resolveRefs` answered "what is this id called". A preview card needs the
// second line too, so the label-only call is now a projection of this one —
// the point being that the app never grows a second answer to the same
// question, which is how the meta line ended up computed inline in nine
// different places in the first place.
type Call = { table: string; cols: string; ids: string[] };

/** Minimal stand-in for the Supabase client: `from(t).select(c).in('id', ids)`. */
function fakeDb(rowsByTable: Record<string, Record<string, unknown>[]>, opts: { failCols?: RegExp } = {}) {
  const calls: Call[] = [];
  const db = {
    from: (table: string) => ({
      select: (cols: string) => ({
        in: (_col: string, ids: string[]) => {
          calls.push({ table, cols, ids });
          // Simulate a column the table does not have: PostgREST rejects the
          // whole query, which `safe()` turns into zero rows.
          if (opts.failCols && opts.failCols.test(cols)) return Promise.reject(new Error('42703'));
          const want = new Set(ids);
          return Promise.resolve({ data: (rowsByTable[table] ?? []).filter((r) => want.has(r.id as string)) });
        },
      }),
    }),
  };
  return { db: db as unknown as Parameters<typeof resolveSummaries>[0], calls };
}

const TASKS = [
  { id: 't1', title: 'Send the invoice', done: false, scheduled_date: '2026-09-04' },
  { id: 't2', title: 'Archive the brief', done: true, scheduled_date: null },
];
const PROJECTS = [{ id: 'p1', name: 'Acme rebrand', status: 'active' }];

describe('resolveSummaries', () => {
  it('returns the label AND the second line, per type', async () => {
    const { db } = fakeDb({ tasks: TASKS, projects: PROJECTS });
    const out = await resolveSummaries(db, [
      { type: 'task', id: 't1' }, { type: 'task', id: 't2' }, { type: 'project', id: 'p1' },
    ]);
    expect(out.get('task:t1')).toEqual({ type: 'task', id: 't1', label: 'Send the invoice', meta: '4 Sep' });
    expect(out.get('task:t2')).toEqual({ type: 'task', id: 't2', label: 'Archive the brief', meta: 'Done' });
    expect(out.get('project:p1')?.meta).toBe('Active');
  });

  it('asks once per type, with ids de-duplicated', async () => {
    const { db, calls } = fakeDb({ tasks: TASKS });
    await resolveSummaries(db, [{ type: 'task', id: 't1' }, { type: 'task', id: 't1' }, { type: 'task', id: 't2' }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].ids).toEqual(['t1', 't2']);
  });

  it('leaves a missing id out, so the caller can tombstone it', async () => {
    const { db } = fakeDb({ tasks: TASKS });
    const out = await resolveSummaries(db, [{ type: 'task', id: 'deleted' }]);
    expect(out.has('task:deleted')).toBe(false);
  });

  it('falls back to the label when the enriched select fails', async () => {
    // THE FAILURE THIS GUARDS. The extra columns are the only new way this can
    // break, and `safe()` swallows the error — so without the retry one wrong
    // column name would turn every reference of that type into a tombstone,
    // silently and completely. Degrading to today's behaviour is the floor.
    const { db, calls } = fakeDb({ tasks: TASKS }, { failCols: /scheduled_date/ });
    const out = await resolveSummaries(db, [{ type: 'task', id: 't1' }]);
    expect(out.get('task:t1')).toEqual({ type: 'task', id: 't1', label: 'Send the invoice', meta: undefined });
    expect(calls.map((c) => c.cols)).toEqual(['id,title,done,scheduled_date', 'id,title']);
  });

  it('names an untitled record rather than showing nothing', async () => {
    const { db } = fakeDb({ pages: [{ id: 'd1', title: null, updated_at: null }] });
    expect((await resolveSummaries(db, [{ type: 'doc', id: 'd1' }])).get('doc:d1')?.label).toBe('Untitled');
  });

  it('ignores a type it has no table for', async () => {
    const { db, calls } = fakeDb({});
    expect((await resolveSummaries(db, [{ type: 'request', id: 'r1' }])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('resolveRefs is now a projection of resolveSummaries', () => {
  it('still answers with labels only, unchanged', async () => {
    const { db } = fakeDb({ tasks: TASKS, projects: PROJECTS });
    const out = await resolveRefs(db, [{ type: 'task', id: 't1' }, { type: 'project', id: 'p1' }]);
    expect(out.get('task:t1')).toBe('Send the invoice');
    expect(out.get('project:p1')).toBe('Acme rebrand');
  });
});

describe('resolveSummaries — an empty title is not a missing row', () => {
  it('names an untitled row rather than returning a blank label', async () => {
    // The defect: `str('') ?? 'Untitled'` is `''`, so a doc saved with no title
    // rendered as an empty Connected row and an unnamed /memory group.
    const db = {
      from: () => ({
        select: () => ({
          in: async () => ({ data: [{ id: 'd1', title: '' }, { id: 'd2', title: '  ' }] }),
        }),
      }),
    } as unknown as Parameters<typeof resolveSummaries>[0];

    const found = await resolveSummaries(db, [{ type: 'doc', id: 'd1' }, { type: 'doc', id: 'd2' }]);
    expect(found.get('doc:d1')?.label).toBe('Untitled');
    expect(found.get('doc:d2')?.label).toBe('Untitled');
  });

  it('still reports a row that is genuinely gone as absent, not Untitled', async () => {
    const db = {
      from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }),
    } as unknown as Parameters<typeof resolveSummaries>[0];
    const found = await resolveSummaries(db, [{ type: 'doc', id: 'missing' }]);
    // Absent from the map is what makes the caller render a TOMBSTONE.
    expect(found.has('doc:missing')).toBe(false);
  });
});

describe('content is addressable in both directions', () => {
  // The file's own warning: recordHref and parseRecordHref are ONE mapping
  // written twice, and a route added to one and not the other silently stops
  // producing backlinks — a failure with no error and no visible symptom. I
  // added the forward direction first and missed this one.
  const id = '9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d';

  it('round-trips', () => {
    const href = recordHref('content', id);
    expect(href).toBe(`/content?piece=${id}`);
    expect(parseRecordHref(href!)).toEqual({ type: 'content', id });
  });

  it('does not answer for a piece-less content URL', () => {
    expect(parseRecordHref('/content')).toBeNull();
    expect(parseRecordHref('/content?view=calendar')).toBeNull();
  });
});

describe('a meeting is addressable', () => {
  const id = '9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d';

  // Every meeting row a Connected panel drew — including the ones the
  // meeting→task edges create — rendered as text you could not click.
  it('round-trips, and carries no client id because it does not need one', () => {
    const href = recordHref('meeting', id);
    expect(href).toBe(`/clients?meeting=${id}`);
    expect(parseRecordHref(href!)).toEqual({ type: 'meeting', id });
  });

  // A plain client link must not be mistaken for a meeting link.
  it('does not swallow the client route', () => {
    expect(parseRecordHref(`/clients?c=${id}`)).toEqual({ type: 'client', id });
    expect(parseRecordHref('/clients')).toBeNull();
  });
});

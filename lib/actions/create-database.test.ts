import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, calls, type Query, type Result } from '@/test/fake-db';
import { defaultCollection } from '@/lib/collections';
import { createDatabase } from './collections';

// `createDatabase` persists a database the screen is ALREADY showing: the browser
// minted its ids and rendered its schema before asking. So the rules worth holding
// are about what it asks the database for — the ids it writes under, the order it
// writes in, and what it cleans up when a write fails. The session and the active
// space are the two things it asks the app for; both are stubbed, and the recording
// fake answers the database (test/fake-db.ts explains why it records rather than
// evaluates).
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/auth', () => ({ requireSession: async () => ({ supabase: state.db, user: { id: 'user-1' } }) }));
vi.mock('@/lib/active-space', () => ({ activeSpaceId: async () => 'space-1' }));

const COLLECTION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ROW = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PAGE = '16fd2706-8baf-433b-82eb-8c7fada847da';

/** Answers every query; optionally fails one table+method. The `pages … limit(0)`
 *  probe is the 0028 capability check — answering it cleanly means rows are pages. */
const respondWith = (fail?: { table: string; method: string }) => (q: Query): Result => {
  const has = (m: string) => q.ops.some(([op]) => op === m);
  if (fail && q.table === fail.table && has(fail.method)) return { data: null, error: { message: 'boom' } };
  if (q.table === 'pages' && has('limit')) return { data: [], error: null };
  return { data: { id: 'ignored' }, error: null };
};

const schema = () => {
  const d = defaultCollection();
  return { props: d.props, views: d.views };
};
const inserted = (q: Query) => calls(q, 'insert')[0]?.[0] as Record<string, unknown>;

describe('createDatabase — persisting a database the screen already shows', () => {
  let queries: Query[] = [];
  const use = (respond: (q: Query) => Result) => {
    const f = fakeDb(respond);
    state.db = f.db;
    queries = f.queries;
  };
  const insertInto = (table: string) => queries.find((q) => q.table === table && calls(q, 'insert').length > 0);

  beforeEach(() => use(respondWith()));

  it('refuses ids that are not UUIDs, and asks the database nothing', async () => {
    // A placeholder id reaching Postgres is the bug the user saw
    // (`invalid input syntax for type uuid: "tmp-…"`). Refuse it here too.
    for (const bad of [
      { collectionId: 'tmp-mu1ekfp3-1', firstRowId: ROW },
      { collectionId: COLLECTION, firstRowId: 'row-1' },
      { collectionId: COLLECTION, firstRowId: ROW, pageId: 'tmp-page' },
    ]) {
      const res = await createDatabase({ ...bad, ...schema() });
      expect(res, JSON.stringify(bad)).toEqual({ error: expect.any(String) });
    }
    expect(queries).toHaveLength(0);
  });

  it('inserts the database under the id the screen is using, with the schema it rendered', async () => {
    const s = schema();
    const res = await createDatabase({ collectionId: COLLECTION, firstRowId: ROW, ...s });
    expect(res).toEqual({ ok: true });
    const col = insertInto('collections');
    expect(col, 'no collection insert').toBeTruthy();
    // The property ids must be the SAME ids the screen holds, or a cell edited
    // before the server answered would point at a property the database lacks.
    expect(inserted(col!)).toMatchObject({
      id: COLLECTION, user_id: 'user-1', space_id: 'space-1', page_id: null, props: s.props, views: s.views,
    });
  });

  it('writes the first row under its final id, after the database it belongs to', async () => {
    await createDatabase({ collectionId: COLLECTION, firstRowId: ROW, ...schema() });
    const row = insertInto('pages');
    expect(row, 'no row insert').toBeTruthy();
    expect(inserted(row!)).toMatchObject({ id: ROW, database_id: COLLECTION, type: 'row', user_id: 'user-1', space_id: 'space-1' });
    expect(queries.indexOf(insertInto('collections')!)).toBeLessThan(queries.indexOf(row!));
  });

  it('attaches a full-page database to its page', async () => {
    await createDatabase({ collectionId: COLLECTION, firstRowId: ROW, pageId: PAGE, ...schema() });
    expect(inserted(insertInto('collections')!)).toMatchObject({ id: COLLECTION, page_id: PAGE });
  });

  it('removes the database it just made when the first row cannot be written, and says why', async () => {
    use(respondWith({ table: 'pages', method: 'insert' }));
    const res = await createDatabase({ collectionId: COLLECTION, firstRowId: ROW, ...schema() });
    expect(res).toEqual({ error: expect.any(String) });
    const cleanup = queries.find((q) => q.table === 'collections' && calls(q, 'delete').length > 0);
    expect(cleanup, 'no compensating delete').toBeTruthy();
    expect(calls(cleanup!, 'eq')).toContainEqual(['id', COLLECTION]);
  });

  it('writes the first row with the values the screen gave it', async () => {
    // A new board's first card starts in "Not started" on screen (T7); the server's
    // copy must agree, or the card jumps to "No Status" on the next load.
    await createDatabase({ collectionId: COLLECTION, firstRowId: ROW, firstRowData: { st: 'not_started' }, ...schema() });
    expect(inserted(insertInto('pages')!)).toMatchObject({ id: ROW, properties: { st: 'not_started' } });
  });
});

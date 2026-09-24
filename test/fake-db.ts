// A recording stand-in for the Supabase client.
//
// Every call on a query builder is recorded, in order, as `[method, ...args]`,
// and awaiting the builder asks `respond` what the database said.
//
// It deliberately does NOT evaluate filters. A fake that half-implements
// PostgREST is a second database to be wrong about — and the bugs this exists
// to catch were never in how rows were filtered, they were in which filter was
// ASKED FOR (`status` instead of `done`, the worker's date instead of the
// user's, no `archived_at` at all). So a test asserts on the recorded query,
// which is the rule, and feeds back rows as if the database had applied it.
export type Op = [method: string, ...args: unknown[]];
export type Query = { table: string; ops: Op[] };
export type Result = { data: unknown; error?: { message: string } | null };

export function fakeDb(respond: (q: Query) => Result = () => ({ data: [] })) {
  const queries: Query[] = [];
  const from = (table: string) => {
    const q: Query = { table, ops: [] };
    queries.push(q);
    const builder: object = new Proxy({}, {
      get(_target, prop) {
        // Awaiting (or Promise.all-ing) a builder is what sends a real query,
        // so `then` is where the answer comes from.
        if (prop === 'then') {
          return (ok: (v: Result) => unknown, err?: (e: unknown) => unknown) =>
            Promise.resolve().then(() => respond(q)).then(ok, err);
        }
        return (...args: unknown[]) => { q.ops.push([String(prop), ...args]); return builder; };
      },
    });
    return builder;
  };
  return { db: { from } as never, queries };
}

/** The recorded calls of one method on a query. */
export const calls = (q: Query, method: string): unknown[][] =>
  q.ops.filter(([m]) => m === method).map(([, ...args]) => args);

/** Did this query call `method` with exactly these leading arguments? */
export const asked = (q: Query, method: string, ...args: unknown[]): boolean =>
  calls(q, method).some((a) => args.every((v, i) => JSON.stringify(a[i]) === JSON.stringify(v)));

/** Was this query answered as a single row (`.single()` / `.maybeSingle()`)? */
export const isSingle = (q: Query): boolean => q.ops.some(([m]) => m === 'single' || m === 'maybeSingle');

/** Every string argument anywhere in the query — for "never mentions X" rules. */
export const mentions = (q: Query, needle: string): boolean =>
  JSON.stringify(q.ops).includes(needle);

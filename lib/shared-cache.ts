// Fetch a thing once per key, no matter how many callers ask at once.
//
// THE PROBLEM IT SOLVES, twice over. A document with the same link in three
// places must not unfurl it three times, and a paragraph with eight mentions
// must not open eight identical queries the moment it renders. Both had the
// same shape and `lib/use-link-meta.ts` had written it out once already; this is
// that mechanism, named, so the second caller did not become a second copy.
//
// `null` IS A CACHED ANSWER — "we asked, and there is nothing" — so a dead link
// or a deleted record is not re-fetched on every mount. That distinction is the
// whole reason this is not a plain `Map<string, Promise<T>>`.

export type SharedStore<T> = {
  done: Map<string, T | null>;
  inflight: Map<string, Promise<T | null>>;
};

export function createStore<T>(): SharedStore<T> {
  return { done: new Map(), inflight: new Map() };
}

/** The cached answer, or undefined if nobody has asked yet. Safe during render. */
export function peek<T>(store: SharedStore<T>, key: string): T | null | undefined {
  return store.done.has(key) ? store.done.get(key)! : undefined;
}

/**
 * Answer a key without asking anyone. For a caller that already HOLDS the value —
 * a harness with no session to fetch with — so the first render reads it rather
 * than requesting it.
 */
export function prime<T>(store: SharedStore<T>, key: string, value: T | null): void {
  store.done.set(key, value);
}

/**
 * Ask once. Concurrent callers share the same promise; a settled key resolves
 * immediately and never hits the network again.
 *
 * A rejected `run` resolves to `null` and is CACHED as such: a request that
 * failed once is overwhelmingly likely to fail again, and retrying on every
 * hover would turn one bad link into a stream of requests.
 */
export function sharedFetch<T>(
  store: SharedStore<T>,
  key: string,
  run: () => Promise<T | null>,
): Promise<T | null> {
  if (store.done.has(key)) return Promise.resolve(store.done.get(key)!);
  const running = store.inflight.get(key);
  if (running) return running;

  const p = run()
    .catch(() => null)
    .then((value) => { store.done.set(key, value ?? null); return value ?? null; })
    .finally(() => { store.inflight.delete(key); });
  store.inflight.set(key, p);
  return p;
}

/**
 * Many callers asking in the same moment, answered by ONE request.
 *
 * `sharedFetch` collapses callers asking for the SAME key; this collapses callers
 * asking for DIFFERENT keys at once. A grid of 48 cards each wanting a signed
 * image URL was 48 server round trips — to a database a sea away — for what one
 * query with an `in (...)` answers. Callers keep asking for their own key; they
 * never see the batch.
 *
 * Keys asked for within `wait` ms go out together, in chunks of at most `max`.
 * A key the run leaves out, or a run that throws, resolves to `null` — the same
 * "we asked and there is nothing" answer `sharedFetch` uses.
 */
export function createBatcher<T>(
  run: (keys: string[]) => Promise<Map<string, T>>,
  { wait = 12, max = 100 }: { wait?: number; max?: number } = {},
): (key: string) => Promise<T | null> {
  let waiting = new Map<string, Array<(value: T | null) => void>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    const batch = waiting;
    waiting = new Map();
    const keys = [...batch.keys()];
    for (let i = 0; i < keys.length; i += max) {
      const chunk = keys.slice(i, i + max);
      let answers = new Map<string, T>();
      try { answers = await run(chunk); } catch { /* every key in the chunk answers null */ }
      for (const key of chunk) {
        const value = answers.get(key);
        for (const resolve of batch.get(key) ?? []) resolve(value === undefined ? null : value);
      }
    }
  };

  return (key: string) => new Promise<T | null>((resolve) => {
    const callers = waiting.get(key);
    if (callers) callers.push(resolve); else waiting.set(key, [resolve]);
    if (!timer) timer = setTimeout(() => { void flush(); }, wait);
  });
}

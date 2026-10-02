import { describe, it, expect, vi } from 'vitest';
import { createStore, sharedFetch, peek, prime, createBatcher } from './shared-cache';

describe('sharedFetch — ask once, however many callers there are', () => {
  it('collapses concurrent callers onto one request', async () => {
    const store = createStore<string>();
    const run = vi.fn(async () => 'meta');
    const [a, b, c] = await Promise.all([
      sharedFetch(store, 'k', run),
      sharedFetch(store, 'k', run),
      sharedFetch(store, 'k', run),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(['meta', 'meta', 'meta']);
  });

  it('never asks again once settled', async () => {
    const store = createStore<string>();
    const run = vi.fn(async () => 'meta');
    await sharedFetch(store, 'k', run);
    await sharedFetch(store, 'k', run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('caches NULL — "we asked, there is nothing" is an answer', async () => {
    const store = createStore<string>();
    const run = vi.fn(async () => null);
    await sharedFetch(store, 'gone', run);
    await sharedFetch(store, 'gone', run);
    // A deleted record must not be re-queried on every hover.
    expect(run).toHaveBeenCalledTimes(1);
    expect(peek(store, 'gone')).toBeNull();
  });

  it('caches a failure as null rather than retrying forever', async () => {
    const store = createStore<string>();
    const run = vi.fn(async () => { throw new Error('offline'); });
    await expect(sharedFetch(store, 'k', run)).resolves.toBeNull();
    await sharedFetch(store, 'k', run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps keys apart', async () => {
    const store = createStore<string>();
    expect(await sharedFetch(store, 'a', async () => 'A')).toBe('A');
    expect(await sharedFetch(store, 'b', async () => 'B')).toBe('B');
  });

  it('peek is undefined before an answer and the value after — the render-safe read', async () => {
    const store = createStore<string>();
    expect(peek(store, 'k')).toBeUndefined();
    await sharedFetch(store, 'k', async () => 'v');
    expect(peek(store, 'k')).toBe('v');
  });

  it('releases the in-flight slot so a later key can be asked again', async () => {
    const store = createStore<string>();
    await sharedFetch(store, 'k', async () => 'v');
    expect(store.inflight.size).toBe(0);
  });
});

describe('prime — an answer nobody had to ask for', () => {
  it('is read back as if it had been fetched, and stops the fetch', async () => {
    const store = createStore<string>();
    prime(store, 'k', 'known');
    const run = vi.fn(async () => 'fetched');
    expect(peek(store, 'k')).toBe('known');
    expect(await sharedFetch(store, 'k', run)).toBe('known');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('createBatcher — different keys at once, one request', () => {
  it('sends every key asked for in the same moment as ONE run, each caller getting its own answer', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn(async (keys: string[]) => new Map(keys.map((k) => [k, `url:${k}`])));
      const ask = createBatcher(run);
      const answers = Promise.all([ask('a'), ask('b'), ask('a'), ask('c')]);
      await vi.runAllTimersAsync();
      expect(run).toHaveBeenCalledTimes(1);
      expect(run.mock.calls[0][0], 'a key asked twice is sent once').toEqual(['a', 'b', 'c']);
      expect(await answers).toEqual(['url:a', 'url:b', 'url:a', 'url:c']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers null for a key the run leaves out, and for every key when the run throws', async () => {
    vi.useFakeTimers();
    try {
      const partial = createBatcher(async () => new Map([['a', 'url:a']]));
      const both = Promise.all([partial('a'), partial('missing')]);
      await vi.runAllTimersAsync();
      expect(await both).toEqual(['url:a', null]);

      const broken = createBatcher<string>(async () => { throw new Error('offline'); });
      const failed = Promise.all([broken('x'), broken('y')]);
      await vi.runAllTimersAsync();
      expect(await failed).toEqual([null, null]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('splits a large moment into chunks of at most `max`', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn(async (keys: string[]) => new Map(keys.map((k) => [k, k])));
      const ask = createBatcher(run, { max: 2 });
      const all = Promise.all(['1', '2', '3', '4', '5'].map(ask));
      await vi.runAllTimersAsync();
      expect(run.mock.calls.map((c) => c[0])).toEqual([['1', '2'], ['3', '4'], ['5']]);
      expect(await all).toEqual(['1', '2', '3', '4', '5']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a later moment is a new request — nothing waits forever for a batch that already left', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn(async (keys: string[]) => new Map(keys.map((k) => [k, k])));
      const ask = createBatcher(run);
      const first = ask('a');
      await vi.runAllTimersAsync();
      const second = ask('b');
      await vi.runAllTimersAsync();
      expect(await first).toBe('a');
      expect(await second).toBe('b');
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

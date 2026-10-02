import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigateWithTransition, canViewTransition, VT_TIMEOUT_MS } from './view-transition';

// The whole helper is one promise: `startViewTransition` captures the "after" state when its
// callback settles, and `router.push` returns LONG before the new route renders. Settling too
// early snapshots the old screen twice and animates nothing; never settling freezes the page
// under a transition. Both are invisible in a screenshot, so they are tested here.

type Cb = () => Promise<void> | void;
let started: Cb[] = [];
let finishResolvers: (() => void)[] = [];

// This repo runs tests in node and hands DOM globals in as stubs (see lib/theme.test.ts) rather
// than carrying jsdom. The helper reads exactly four things; they are all here, and the fake
// `startViewTransition` is the point of the test — it lets the callback's promise be inspected.
function stubDom({ reduced = false, api = true }: { reduced?: boolean; api?: boolean } = {}) {
  const attrs = new Map<string, string>();
  const documentStub: Record<string, unknown> = {
    documentElement: {
      setAttribute: (k: string, v: string) => { attrs.set(k, v); },
      removeAttribute: (k: string) => { attrs.delete(k); },
      getAttribute: (k: string) => attrs.get(k) ?? null,
      hasAttribute: (k: string) => attrs.has(k),
    },
  };
  if (api) {
    documentStub.startViewTransition = (cb: Cb) => {
      started.push(cb);
      void cb();
      return { finished: new Promise<void>((r) => finishResolvers.push(r)) };
    };
  }
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches: reduced && q.includes('reduce') }),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16) as unknown as number,
  });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16) as unknown as number);
  return attrs;
}

const flushFrames = async (n = 8) => { for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(16); };

beforeEach(() => { started = []; finishResolvers = []; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('navigateWithTransition', () => {
  it('waits for the destination to actually be there before settling', async () => {
    stubDom();
    let arrived = false;
    let settled = false;
    const navigate = vi.fn(() => { setTimeout(() => { arrived = true; }, 120); });
    navigateWithTransition(navigate, () => arrived);
    // The callback's promise IS the transition's "after" snapshot. Settling it while the route is
    // still the old one photographs the same screen twice and animates nothing.
    void Promise.resolve(started[0]?.()).then(() => { settled = true; });
    await flushFrames(3);
    expect(navigate).toHaveBeenCalled();
    expect(settled, 'settled before the route landed').toBe(false);
    await vi.advanceTimersByTimeAsync(140);
    await flushFrames(4);
    expect(arrived).toBe(true);
    expect(settled, 'settled once the route landed').toBe(true);
  });

  it('gives up rather than freezing the page when a navigation never lands', async () => {
    const attrs = stubDom();
    let settled = false;
    navigateWithTransition(() => {}, () => false);
    void Promise.resolve(started[0]?.()).then(() => { settled = true; });
    expect(attrs.has('data-vt')).toBe(true);
    await vi.advanceTimersByTimeAsync(VT_TIMEOUT_MS + 100);
    expect(settled, 'the guard settled it').toBe(true);
    finishResolvers.forEach((r) => r());
    await vi.advanceTimersByTimeAsync(1);
    expect(attrs.has('data-vt'), 'the mark is cleared').toBe(false);
  });

  it('marks the document while it runs, so a page fade stays out of the way', async () => {
    const attrs = stubDom();
    navigateWithTransition(() => {}, () => true);
    expect(attrs.get('data-vt')).toBe('');
    await flushFrames(4);
    finishResolvers.forEach((r) => r());
    await vi.advanceTimersByTimeAsync(1);
    expect(attrs.has('data-vt')).toBe(false);
  });

  it('just navigates when the browser cannot, or the person asked for less motion', () => {
    // A browser without the API still gets where it was going.
    const noApi = stubDom({ api: false });
    const plain = vi.fn();
    navigateWithTransition(plain, () => true);
    expect(plain).toHaveBeenCalledTimes(1);
    expect(noApi.has('data-vt')).toBe(false);
    expect(started).toHaveLength(0);

    // Reduced motion: a whole-screen morph is precisely the movement that setting refuses.
    stubDom({ reduced: true });
    expect(canViewTransition()).toBe(false);
    const plain2 = vi.fn();
    navigateWithTransition(plain2, () => true);
    expect(plain2).toHaveBeenCalledTimes(1);
    expect(started).toHaveLength(0);
  });
});

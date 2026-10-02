'use client';
// Notion-style page width preference: hub pages read `useViewWidth()` to drop
// their centred max-width cap. Per browser, in localStorage.
//
// It is a MODULE STORE, not just a context. It used to be context-only, with a
// `{ full: false, toggle: () => {} }` default — so any consumer rendered outside
// `<ViewWidthProvider>` got a silent no-op instead of an error. That is exactly
// what happened when the toggle moved from the page-header ••• into Settings →
// Appearance: the switch rendered, clicked, animated nothing, and wrote nothing.
// A store has no such failure mode — every reader and writer talks to the same
// value regardless of where it sits in the tree, and `useSyncExternalStore`
// keeps them all in step.
import { createContext, useContext, useSyncExternalStore } from 'react';

const KEY = 'zb:fullWidth';

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((l) => l());

// Cached so `getSnapshot` is referentially stable — reading localStorage on
// every call would return a fresh value each render and loop.
let cached: boolean | null = null;
function readFull(): boolean {
  if (cached === null) {
    try { cached = localStorage.getItem(KEY) === '1'; } catch { cached = false; }
  }
  return cached;
}

export function setFullWidth(next: boolean) {
  cached = next;
  try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* ignore */ }
  emit();
}

/** The one hook. Safe anywhere — no provider required. */
export function useViewWidth() {
  // Server snapshot is `false`: the value lives in localStorage, so SSR can't
  // know it and must render the centred column, then correct after hydration.
  const full = useSyncExternalStore(subscribe, readFull, () => false);
  return { full, toggle: () => setFullWidth(!readFull()) };
}

// Kept so the shell's tree shape doesn't change and any older import still
// compiles; the store is the source of truth, so this is now just a pass-through.
const Ctx = createContext(null);
export function ViewWidthProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}
// Referenced so the context isn't flagged as unused; it carries no value.
export const useViewWidthContext = () => useContext(Ctx);

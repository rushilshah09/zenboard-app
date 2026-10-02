'use client';
// How a record OPENS — the preference behind <PageView>.
//
// Zenboard has one opening system, not one per module (see components/ds/ui/
// page-view.tsx). This file owns the half of it that persists: which mode the
// user prefers for each kind of thing, and how wide they last dragged the side
// peek. It deliberately does NOT decide the mode actually used — the viewport
// gets a veto, and that has to be resolved at render time where the width is
// known. `resolveMode` is the one place the two are combined.
import { useCallback, useSyncExternalStore } from 'react';

export type PageViewMode = 'side-peek' | 'center-peek' | 'full-page';

/** Every kind of thing that can be opened. One list, so nothing invents a mode. */
export type ContentType =
  | 'task' | 'document' | 'project' | 'client' | 'invoice' | 'form'
  | 'form-response'
  | 'habit' | 'goal' | 'calendar' | 'database-row' | 'meeting'
  | 'finance' | 'contact'
  /** An item of a Collection (COLLECTION_ITEM_BRIEF) — a reference, looked at in the centre. */
  | 'collection-item';

const KEY = 'zb:pageview:v1';
const DEFAULT_WIDTH = 560;
export const MIN_WIDTH = 380;
export const MAX_WIDTH = 1100;

/**
 * Per-type defaults — the mode each kind of record opens in until the user says
 * otherwise. These are not arbitrary: side peek keeps the list you came from
 * alive, which is what you want when you are working THROUGH a list; a document
 * is the thing you came to read, so it takes the whole page.
 */
const TYPE_DEFAULT: Record<ContentType, PageViewMode> = {
  task: 'side-peek',
  document: 'full-page',
  project: 'side-peek',
  client: 'side-peek',
  invoice: 'side-peek',
  form: 'full-page',
  // A SUBMISSION is not the form. You read one while working through a table of
  // them, so the table has to stay alive behind it — the opposite of the form
  // itself, which is the thing you came to build and takes the whole page.
  'form-response': 'side-peek',
  habit: 'side-peek',
  goal: 'side-peek',
  calendar: 'center-peek',
  'database-row': 'side-peek',
  // A meeting is a workspace now — your notes beside the live transcript, recorded while you talk
  // (MEETINGS_PLAN.md M1) — so, like a document, it is the thing you came to do and takes the page.
  meeting: 'full-page',
  finance: 'side-peek',
  contact: 'center-peek',
  'collection-item': 'center-peek',
};

type Stored = {
  /** Set only when the user picks "Set as default for everything". */
  global?: PageViewMode;
  byType?: Partial<Record<ContentType, PageViewMode>>;
  width?: number;
};

// Parsed once and held until something writes. `read()` is called from a
// `useSyncExternalStore` snapshot, so it runs on every render of every mounted
// panel — re-parsing JSON that often is waste, and the cache makes the cost of
// an extra reader zero.
let cache: Stored | null = null;

function read(): Stored {
  if (typeof window === 'undefined') return {};
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    // Private mode, quota, a half-written value — a preference is never worth
    // taking the panel down for.
    cache = {};
  }
  return cache;
}

function write(next: Stored) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* see read() */ }
  // Two panels can be mounted at once (a task opened from a project peek), and
  // `storage` only fires in OTHER tabs — so tell this one directly.
  window.dispatchEvent(new CustomEvent('zb:pageview-prefs'));
}

/** Another tab wrote — drop the cache so the next snapshot re-reads. */
function invalidate() { cache = null; }

function subscribe(onChange: () => void): () => void {
  const local = () => onChange();
  const cross = () => { invalidate(); onChange(); };
  window.addEventListener('zb:pageview-prefs', local);
  window.addEventListener('storage', cross);
  return () => {
    window.removeEventListener('zb:pageview-prefs', local);
    window.removeEventListener('storage', cross);
  };
}

/** The stored preference for a type, ignoring the viewport. */
export function preferredMode(type: ContentType): PageViewMode {
  const s = read();
  return s.byType?.[type] ?? s.global ?? TYPE_DEFAULT[type];
}

/**
 * The mode actually used, once the viewport has had its say.
 *
 * A side peek needs room beside the thing it is peeking at; below ~1100px there
 * isn't any, and a 45% panel on a tablet is two cramped columns instead of one
 * good one. So the preference is honoured where it fits and overridden where it
 * doesn't — the preference itself is never rewritten, so going back to a wide
 * screen restores what the user actually chose.
 */
export function resolveMode(preferred: PageViewMode, viewportWidth: number): PageViewMode {
  if (viewportWidth === 0) return preferred; // pre-measure (SSR): trust the preference
  if (viewportWidth < 768) return 'full-page';   // phone — a peek is the whole screen anyway
  if (viewportWidth < 1100) return preferred === 'side-peek' ? 'full-page' : preferred;
  return preferred;
}

/**
 * Whose choice opens a page, before the viewport has its say. Strongest first: a
 * mode the caller FORCES (a wizard, a preview); a pick for THIS opening (⌘↵, the
 * menu), cleared on close; a preference the caller OWNS — a database view's "Open
 * pages in" (`openPagesIn`, lib/collections.ts) — and last the per-type preference.
 */
export function wantedMode(c: {
  forced?: PageViewMode;
  session?: PageViewMode | null;
  owned?: PageViewMode;
  preferred: PageViewMode;
}): PageViewMode {
  return c.forced ?? c.session ?? c.owned ?? c.preferred;
}

/**
 * `[mode, setForType, setForEverything]` — the preference, not the resolved mode.
 *
 * `useSyncExternalStore` rather than read-in-an-effect: localStorage is exactly
 * an external store, and this is the hook that subscribes to one without the
 * extra render (and the cascading-render lint) that a `setState` in an effect
 * costs. The third argument is the SERVER snapshot and is not optional here —
 * without it this throws during SSR, and the default is the honest answer for a
 * machine that has no localStorage to read.
 *
 * The snapshots return a string and a number, never an object. That matters:
 * React compares snapshots with `Object.is`, so a getter that built a fresh
 * object each call would re-render forever.
 */
export function usePageViewMode(type: ContentType): [
  PageViewMode,
  (m: PageViewMode) => void,
  (m: PageViewMode) => void,
] {
  const mode = useSyncExternalStore(
    subscribe,
    () => preferredMode(type),
    () => TYPE_DEFAULT[type],
  );

  const setForType = useCallback((m: PageViewMode) => {
    const s = read();
    write({ ...s, byType: { ...s.byType, [type]: m } });
  }, [type]);

  const setForEverything = useCallback((m: PageViewMode) => {
    // Clearing byType is the point — "everything" that still has per-type
    // overrides sitting under it is not everything.
    write({ ...read(), global: m, byType: {} });
  }, []);

  return [mode, setForType, setForEverything];
}

/** `[width, setWidth]` for the side peek, remembered across sessions. */
export function usePeekWidth(): [number, (w: number) => void] {
  const width = useSyncExternalStore(
    subscribe,
    () => read().width ?? DEFAULT_WIDTH,
    () => DEFAULT_WIDTH,
  );

  const setWidth = useCallback((w: number) => {
    write({ ...read(), width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w))) });
  }, []);

  return [width, setWidth];
}

export const MODE_LABEL: Record<PageViewMode, string> = {
  'side-peek': 'Side peek',
  'center-peek': 'Center peek',
  'full-page': 'Full page',
};

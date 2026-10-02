// Shared vocabulary for the Tasks module. It lives apart from tasks-view.tsx
// because the rail is rendered by BOTH the list and the board, and those three
// files would otherwise import each other in a circle.
import { scopeKey, type Scope } from '@/lib/task-scopes';

/** The rail's working views. A layout (list/board) is NOT one of these. */
export type View = 'inbox' | 'today' | 'completed';

/** The two piles, one shape — see lib/task-scopes.ts. */
export type TaskProject = { id: string; name: string; color: string | null };
export type TaskList = { id: string; name: string; color: string | null };

/** A saved view's stored combo — the rail restores the whole thing at once. */
export type RailFilter = {
  view?: string;
  filter?: string;
  labelId?: string | null;
  /** A scope key (`project:<id>` / `list:<id>`). */
  scope?: string | null;
  /**
   * LEGACY. Saved views written before 0038 stored a bare project id here,
   * under a field named `listId` because the rail's only section was headed
   * "List" and every row in it was a project. Those rows are in the database
   * and cannot be rewritten from the client, so this is read forever and
   * normalised to `project:<id>` — see `railHref`. Never written any more.
   */
  listId?: string | null;
};

export type SavedViewDef = { id: string; name: string; filter: RailFilter };

/**
 * THE empty saved-views list, as one frozen reference.
 *
 * Both parents used to default the prop with `savedViews = []`, which is a NEW
 * array on every render. That was harmless only while the rail seeded its state
 * once with `useState`; the moment it follows the server with `useServerState`
 * (which compares by reference), a fresh `[]` each render snaps state back each
 * render — the loop recorded in zenboard-task-scopes. `week-view` already
 * defaults its other props this way (`NO_COUNTS`, `NO_SCOPES`, `NO_KEYS`).
 */
export const NO_SAVED_VIEWS: readonly SavedViewDef[] = Object.freeze([]);

/** The three numbers the rail prints across the top and bottom. */
export type RailCounts = Record<View, number>;

/** Open-task count per scope key, for the number beside each pile. */
export type ScopeCounts = Record<string, number>;

/** Which rail row is lit. `'board'` lights none of the views — it is a layout. */
export type RailActive = { view: View | 'board'; scope: string | null };

// ── The rail's URL contract ─────────────────────────────────────────────────
// Rail selection lives in the query string, not in component state, because the
// rail is rendered by two different pages: clicking "Today" from the board has
// to be able to land you in the list. One writer, one reader, linkable.
//
//   /tasks                          → list · inbox
//   /tasks?view=today               → list · today
//   /tasks?view=completed           → list · completed
//   /tasks?scope=project:<id>       → list · that project
//   /tasks?scope=list:<id>          → list · that list
//   /tasks?view=board               → board, columns of piles
//   /tasks?view=board&group=week    → board, columns of days (the old ?view=week)
//
// A saved view adds `filter` and `label` on top, which is the whole combo.
export function railHref(f: RailFilter): string {
  const q = new URLSearchParams();
  if (f.view && f.view !== 'inbox') q.set('view', f.view);
  if (f.filter && f.filter !== 'all') q.set('filter', f.filter);
  if (f.labelId) q.set('label', f.labelId);
  // A pre-0038 saved view's bare id meant a project. Normalising here rather
  // than at each call site is what keeps those rows working untouched.
  const scope = f.scope ?? (f.listId ? scopeKey('project', f.listId) : null);
  if (scope) q.set('scope', scope);
  const s = q.toString();
  return s ? `/tasks?${s}` : '/tasks';
}

/** The whole combo, as the client holds it. */
export type RailState = {
  view: View;
  scope: string | null;
  filter: string;
  labelId: string | null;
  /** `list` · `board` (columns of piles) · `week` (columns of days). */
  layout: 'list' | 'board' | 'week';
};

/**
 * Read the combo out of a live `URLSearchParams`.
 *
 * The URL is the single source of truth for what Tasks is showing, and since
 * the rail changes it with `pushState` (lib/use-url-state.ts) rather than a
 * navigation, this parser now runs on every rail click — in the browser, for
 * free. Same function the server uses, so the two cannot disagree.
 */
export function readRailState(params: URLSearchParams): RailState {
  const raw = readRailParams({
    view: params.get('view') ?? undefined,
    scope: params.get('scope') ?? undefined,
    list: params.get('list') ?? undefined,
    filter: params.get('filter') ?? undefined,
    label: params.get('label') ?? undefined,
  });
  const v = params.get('view');
  return { ...raw, layout: v === 'week' ? 'week' : v === 'board' ? 'board' : 'list' };
}

/** Build the href for a whole combo — the inverse of `readRailState`. */
export function railStateHref(s: RailState): string {
  const q = new URLSearchParams();
  if (s.layout === 'week') q.set('view', 'week');
  else if (s.layout === 'board') q.set('view', 'board');
  else if (s.view !== 'inbox') q.set('view', s.view);
  if (s.filter && s.filter !== 'all') q.set('filter', s.filter);
  if (s.labelId) q.set('label', s.labelId);
  if (s.scope) q.set('scope', s.scope);
  const qs = q.toString();
  return qs ? `/tasks?${qs}` : '/tasks';
}

/** Read the contract back. The single parser, so the two layouts can't disagree. */
export function readRailParams(sp: { view?: string; scope?: string; list?: string; filter?: string; label?: string }) {
  const view: View = sp.view === 'today' || sp.view === 'completed' ? sp.view : 'inbox';
  return {
    view,
    // `?list=` is the pre-0038 link shape, still arriving from bookmarks and
    // from saved views. It always meant a project.
    scope: sp.scope ?? (sp.list ? scopeKey('project', sp.list) : null),
    filter: sp.filter ?? 'all',
    labelId: sp.label ?? null,
  };
}

/** The scope a rail selection points at, or null. Used to title and to file. */
export function findScope(scopes: Scope[], key: string | null): Scope | null {
  if (!key) return null;
  return scopes.find((s) => scopeKey(s.kind, s.id) === key) ?? null;
}

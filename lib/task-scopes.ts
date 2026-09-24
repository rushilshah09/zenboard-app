// THE one vocabulary for "which pile is this task in?".
//
// Tasks has two kinds of pile and they are not the same kind of thing:
//
//   PROJECT — a piece of client work. Has a client, a budget, milestones, a
//             close-out, a portal. Lives in the Projects module; Tasks only
//             borrows it.
//   LIST    — a bucket you keep your own work in. "Priority", "Extra work".
//             Owned by Tasks, belongs to nobody else, costs nothing to make.
//
// They used to be one section in the rail headed "List" whose rows were all
// projects, which meant the only way to have a pile was to invent a project —
// and a project shows up in Finance, in the client portal, and in the projects
// gallery. Migration 0038 gives lists their own table. This file is the shared
// vocabulary so the rail, the board, the visibility toggles and the counts all
// agree about what a pile is and which one a task is in.
//
// THREE RULES LIVE HERE, and they are deliberately different from each other:
//
//   1. MEMBERSHIP (`taskScopes`) — every pile a task is in. A task can be in a
//      project AND a list at once; that is not a conflict, they answer different
//      questions. The rail filters on membership, so clicking "Life studio"
//      shows all of its work no matter which list each task sits in.
//
//   2. COLUMN (`columnKey`) — the ONE pile a board card is drawn in. A card in
//      two columns is a card you cannot drag, so precedence decides: the list
//      wins, then the project, then "No list". This is Trello's, Linear's and
//      Google Tasks' rule and it is the only one that makes a drop unambiguous.
//
//   3. VISIBILITY (`isHidden`) — a task is hidden when ANY pile it belongs to is
//      switched off. Not "its column is off": the user asked for "when turned
//      OFF, its tasks should not appear", and a Life-studio task filed under
//      Priority is still a Life-studio task. Turning a project off has to
//      actually silence that project.

/**
 * The colours a pile can be given.
 *
 * A DATA-LAYER palette: these hexes are persisted on the row (`projects.color`,
 * `task_lists.color`) and rendered as an inline dot, so they are a token SOURCE
 * rather than a violation of "no raw hex in a component" — the rule exists to
 * stop components inventing colour, and this array is the one place that does.
 * It was already declared twice inside the Projects module; lists would have
 * made three copies, so the copies now import this.
 */
// Re-exported from the one place these are decided. This array was a token
// SOURCE of RAW HEXES, which is why they could not know their theme — a
// stored `#9A1B6F` measured 1.86:1 on a dark rail. lib/entity-color.ts
// holds names now, resolving through per-theme tokens; the legacy hexes
// still read back correctly, so no row had to change.
export { SCOPE_COLORS, scopeFill, scopeOn, scopeColorName, DEFAULT_SCOPE_COLOR } from './entity-color';
export type { ScopeColorName } from './entity-color';

/** Which kind of pile. */
export type ScopeKind = 'project' | 'list';

/** A pile — one shape for both kinds, so one row component draws either. */
export type Scope = {
  kind: ScopeKind;
  id: string;
  name: string;
  color: string | null;
};

/** What the rules below need from a task. Structural, so every caller's own
 *  task type satisfies it without a cast. */
export type ScopedTask = {
  project_id?: string | null;
  list_id?: string | null;
};

/**
 * A scope's stable address. Projects and lists have separate id spaces, so an
 * id alone is ambiguous the moment both sections exist — a hidden-set holding
 * bare uuids would silently hide a list because a project shared its id.
 */
export const scopeKey = (kind: ScopeKind, id: string): string => `${kind}:${id}`;
export const keyOf = (s: Scope): string => scopeKey(s.kind, s.id);

/** The key for the column that holds tasks belonging to no pile at all. */
export const NO_SCOPE = 'none';

/** RULE 1 — every pile this task belongs to. Order is stable: list, then project. */
export function taskScopes(t: ScopedTask): string[] {
  const keys: string[] = [];
  if (t.list_id) keys.push(scopeKey('list', t.list_id));
  if (t.project_id) keys.push(scopeKey('project', t.project_id));
  return keys;
}

/**
 * RULE 2 — the single column this task is drawn in.
 *
 * The list wins over the project because the list is the finer, more personal
 * choice: filing "Send the invoice" under Priority is a statement about how you
 * intend to work today, and the project is still visible on the card as a tag.
 * Precedence has to be a rule and not a preference — swap it and every card in
 * the app moves at once, which is exactly why it lives in one function.
 */
export function columnKey(t: ScopedTask): string {
  if (t.list_id) return scopeKey('list', t.list_id);
  if (t.project_id) return scopeKey('project', t.project_id);
  return NO_SCOPE;
}

/**
 * RULE 3 — is this task silenced by the sidebar toggles?
 *
 * Any pile off hides the task. A task in no pile at all is never hidden by a
 * scope toggle: there is no switch that owns it, so hiding it would make work
 * unreachable with no way to get it back.
 */
export function isHidden(t: ScopedTask, hidden: ReadonlySet<string>): boolean {
  if (hidden.size === 0) return false;
  const keys = taskScopes(t);
  if (keys.length === 0) return false;
  return keys.some((k) => hidden.has(k));
}

/** The visible half of a list, by rule 3. One call site for the whole module. */
export function visibleTasks<T extends ScopedTask>(tasks: T[], hidden: ReadonlySet<string>): T[] {
  return hidden.size === 0 ? tasks : tasks.filter((t) => !isHidden(t, hidden));
}

// ── Which piles are switched off ────────────────────────────────────────────
// Stored in `profiles.preferences`, not in localStorage, for three reasons that
// all matter: it follows you between machines the way Google Tasks' list
// checkboxes do; the route can read it server-side so the first paint is
// already correct; and reading localStorage during render is the exact shape of
// the hydration mismatch this codebase has been bitten by before (a server
// render that says "nothing hidden" against a client render that says otherwise).
export const HIDDEN_SCOPES_KEY = 'hiddenTaskScopes';

/**
 * Read the switched-off piles back out of the preferences jsonb.
 *
 * Defensive because the value is JSON someone could have half-written: anything
 * that is not an array of `kind:id` strings is read as "nothing hidden", which
 * is the safe failure — work stays visible. Silently hiding tasks because a
 * preference row got mangled is the one outcome worth engineering against.
 */
export function readHiddenScopes(preferences: unknown): Set<string> {
  const p = (preferences ?? {}) as Record<string, unknown>;
  const raw = p[HIDDEN_SCOPES_KEY];
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((v): v is string => typeof v === 'string' && /^(project|list):.+/.test(v)));
}

/** A board column: the pile, and the tasks whose `columnKey` is it. */
export type ScopeColumn<T> = { key: string; scope: Scope | null; tasks: T[] };

/**
 * Group tasks into board columns by rule 2.
 *
 * Every visible scope gets a column even when empty — an empty list you can
 * still drag into is the whole point of a board, and a column that appears only
 * once something is in it can never receive the first card. The "No list"
 * column is the exception: it appears only when something is actually in it,
 * because a permanent empty column headed "No list" is just noise.
 */
export function groupIntoColumns<T extends ScopedTask>(tasks: T[], scopes: Scope[]): ScopeColumn<T>[] {
  const byKey = new Map<string, T[]>();
  for (const s of scopes) byKey.set(keyOf(s), []);

  const loose: T[] = [];
  for (const t of tasks) {
    const k = columnKey(t);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(t);
    // A task whose pile is switched off (or was deleted out from under it)
    // must not silently become a loose task — it would appear under "No list"
    // as if it had never been filed. It simply isn't drawn.
    else if (k === NO_SCOPE) loose.push(t);
  }

  const columns: ScopeColumn<T>[] = scopes.map((s) => ({ key: keyOf(s), scope: s, tasks: byKey.get(keyOf(s)) ?? [] }));
  if (loose.length) columns.push({ key: NO_SCOPE, scope: null, tasks: loose });
  return columns;
}

/**
 * Where a task is filed once its PROJECT changes — the one rule behind every way of changing it: the task's
 * panel, a row's menu, the `p` key and a board drop. Null when the project is the one it already has, so a
 * reorder inside its own column is not a move.
 *
 * - Leaving a project leaves its workstream: a workstream (`sections`) belongs to one project, and a task in
 *   project B filed under project A's workstream is a row that can never be drawn correctly again.
 * - Joining a project takes a task out of the Inbox, as filing always has (`moveTaskToProject`).
 * - A task that loses its project with no day and no list goes back to the Inbox. Otherwise it would live
 *   nowhere the rail shows — the unreachable-task hole this module already warns about for dated tasks.
 */
export function afterProjectChange(
  t: { project_id: string | null; list_id?: string | null; scheduled_date: string | null; is_inbox: boolean },
  projectId: string | null,
): { project_id: string | null; is_inbox: boolean; section_id: null } | null {
  if ((t.project_id ?? null) === projectId) return null;
  if (projectId) return { project_id: projectId, is_inbox: false, section_id: null };
  const elsewhere = !!t.scheduled_date || !!t.list_id;
  return { project_id: null, is_inbox: elsewhere ? t.is_inbox : true, section_id: null };
}

/**
 * Where a task is filed once its DAY changes: a day takes it out of the Inbox and 'inbox' takes its day away,
 * as `rescheduleTask` always has. No day at all (the date picker's "No date") keeps it in its project or list —
 * un-scheduling client work must not throw it back into triage — and only a task with neither goes to the
 * Inbox, because a task must live somewhere the rail shows.
 */
export function afterDayChange(
  t: { project_id: string | null; list_id?: string | null },
  day: string | 'inbox' | null,
): { scheduled_date: string | null; is_inbox: boolean } {
  if (day === 'inbox') return { scheduled_date: null, is_inbox: true };
  if (day) return { scheduled_date: day, is_inbox: false };
  return { scheduled_date: null, is_inbox: !t.project_id && !t.list_id };
}

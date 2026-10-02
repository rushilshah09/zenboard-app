// THE one projection for Project → Workstream → Task → Subtask.
//
// ── THE NAME ────────────────────────────────────────────────────────────────
// Called a WORKSTREAM, not a subproject, and the choice is deliberate because
// the client reads it. "Subproject" tells a client their project has been split
// into projects, and it invites the question the product should never have to
// answer — can a subproject have a subproject? A workstream is bounded by its
// own name: one level, inside a project, holding work. (It is one label
// constant if you want the other word.)
//
// In the database it is still `sections`, because that table already WAS this
// level — project_id, name, order, and `tasks.section_id` pointing at it. 0040
// gave it status, a deadline and client visibility. See that migration for why
// a new table and self-referencing projects were both rejected.
//
// ── WHAT THIS FILE OWNS ─────────────────────────────────────────────────────
// Grouping and rollup, in one place, because four surfaces need the same
// answers and would otherwise each invent them: the project Tasks tab, the
// project Overview, the client portal, and the Tasks module's project scope.
//
// The rollup rules that matter:
//   · progress counts TOP-LEVEL tasks only. Counting subtasks would let a
//     stream with one fiddly ten-subtask task read as more work than a stream
//     with nine real ones.
//   · a stream with no tasks is 0%, never 100%. "Nothing to do" and "everything
//     done" are different states and an empty stream showing a full bar is the
//     kind of wrong that gets quoted back at you in a client meeting.
//   · unfiled tasks are a REAL group, not an error. Most projects have work
//     that belongs to no stream, and hiding it would lose it.
import { isClientVisible, type ShareChannels } from '@/lib/visibility';

/** A workstream, as every surface sees it. `sections` row + 0040's columns. */
export type Workstream = {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  /** Same vocabulary as a project's. `null` = just a grouping. */
  status?: string | null;
  due_date?: string | null;
  /** 0040. Absent (migration not applied) reads as internal. */
  client_visible?: boolean | null;
};

/** What this file needs from a task. Structural, so callers' types satisfy it. */
export type StreamTask = {
  id: string;
  done: boolean;
  section_id?: string | null;
  parent_task_id?: string | null;
};

/** The id used for work that belongs to no stream. */
export const NO_STREAM = 'unfiled';

export type StreamGroup<T> = {
  /** The workstream, or null for the unfiled group. */
  stream: Workstream | null;
  key: string;
  tasks: T[];
  progress: StreamProgress;
};

export type StreamProgress = { done: number; total: number; pct: number };

/**
 * Progress for a set of tasks.
 *
 * Subtasks are excluded — a stream's shape should not change because one task
 * happens to be broken down further than its neighbours.
 */
export function progressOf(tasks: StreamTask[]): StreamProgress {
  let done = 0, total = 0;
  for (const t of tasks) {
    if (t.parent_task_id) continue;
    total++;
    if (t.done) done++;
  }
  // An empty stream is 0%, not 100%. Dividing by zero the other way would
  // report "nothing to do" as "all finished".
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * Group a project's tasks into its workstreams.
 *
 * Every stream appears even when empty — you cannot drag the first task into a
 * group that only exists once it has something in it. The unfiled group is the
 * exception and appears only when something is actually unfiled, because a
 * permanent empty "Unfiled" heading is noise on the many projects that use no
 * streams at all.
 */
export function groupByStream<T extends StreamTask>(tasks: T[], streams: Workstream[]): StreamGroup<T>[] {
  const ordered = [...streams].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const byId = new Map<string, T[]>(ordered.map((s) => [s.id, []]));
  const unfiled: T[] = [];

  for (const t of tasks) {
    if (t.parent_task_id) continue;             // subtasks travel with their parent
    const bucket = t.section_id ? byId.get(t.section_id) : undefined;
    if (bucket) bucket.push(t);
    // A task pointing at a stream that no longer exists is unfiled, not lost.
    else unfiled.push(t);
  }

  const groups: StreamGroup<T>[] = ordered.map((s) => {
    const list = byId.get(s.id) ?? [];
    return { stream: s, key: s.id, tasks: list, progress: progressOf(list) };
  });
  if (unfiled.length) groups.push({ stream: null, key: NO_STREAM, tasks: unfiled, progress: progressOf(unfiled) });
  return groups;
}

/**
 * The project Board's columns: every stream in its order, then "No workstream"
 * — ALWAYS, even empty.
 *
 * The one place the Board departs from the List's grouping, and deliberately.
 * The List names the unfiled group only when something is in it, because a
 * permanent empty heading is noise. On a Board that group is also the only way
 * to take a card OUT of a stream by dragging, and a drop target that appears
 * only once something is already there is no drop target at all.
 */
export function boardGroups<T extends StreamTask>(tasks: T[], streams: Workstream[]): StreamGroup<T>[] {
  const groups = groupByStream(tasks, streams);
  if (!groups.some((g) => g.stream === null)) {
    groups.push({ stream: null, key: NO_STREAM, tasks: [], progress: progressOf([]) });
  }
  return groups;
}

/**
 * A column's order after a card lands at `index` among the cards as they
 * stood. The card is taken out first, so a move within one column and a move
 * into it read the same index the same way; past the end means the end.
 */
export function landAt(ids: string[], id: string, index: number): string[] {
  const rest = ids.filter((x) => x !== id);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id);
  return rest;
}

/**
 * The project's progress, rolled up from its streams.
 *
 * Deliberately the same arithmetic as one stream over ALL the tasks, rather
 * than an average of the stream percentages. Averaging would give a stream with
 * two tasks the same weight as one with forty, so finishing the small stream
 * would move the project bar further than finishing half the big one.
 */
export function rollUp(groups: StreamGroup<StreamTask>[]): StreamProgress {
  let done = 0, total = 0;
  for (const g of groups) { done += g.progress.done; total += g.progress.total; }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * The streams a client may see.
 *
 * Uses the SAME two-gate rule as everything else the client can reach
 * (lib/visibility.ts): the project must share tasks at all, and this stream
 * must be marked. A workstream is not a special case — it is the fourth thing
 * that rule covers, which is the whole reason that rule exists.
 */
export function clientStreams(streams: Workstream[], channels: ShareChannels): Workstream[] {
  return streams.filter((s) => isClientVisible('task', { client_visible: s.client_visible, done: false }, channels));
}

/**
 * What the CLIENT sees: visible streams, each holding only visible tasks.
 *
 * Both gates, at both levels, and the stream gate is checked first — hiding a
 * workstream hides everything in it, whatever the individual tasks say. That is
 * the point of "keep this stream entirely internal": you should not have to
 * also un-mark forty tasks, and forgetting one should not leak the stream's
 * existence.
 */
export function clientGroups<T extends StreamTask & { client_visible?: boolean | null }>(
  tasks: T[],
  streams: Workstream[],
  channels: ShareChannels,
): StreamGroup<T>[] {
  const visible = clientStreams(streams, channels);
  const allowed = new Set(visible.map((s) => s.id));
  const shown = tasks.filter((t) => {
    if (!t.section_id || !allowed.has(t.section_id)) return false;
    return isClientVisible('task', { client_visible: t.client_visible, done: t.done }, channels);
  });
  // No unfiled group for the client: work that belongs to no stream has not
  // been placed in anything they were shown, so presenting it under a heading
  // called "Unfiled" would expose our filing rather than their project.
  //
  // And no EMPTY groups either — the opposite of the owner's rule above, on
  // purpose. An owner needs an empty stream to exist so the first task has
  // somewhere to go; a client shown "Brand guidelines" with nothing under it
  // learns only that work is happening they are not allowed to see, which is
  // worse than not naming it at all.
  return groupByStream(shown, visible).filter((g) => g.stream !== null && g.tasks.length > 0);
}

/**
 * A stream's status when nobody set one.
 *
 * Derived, not stored, so it cannot go stale: a stream every task of which is
 * finished reads as done whether or not anyone remembered to say so. An
 * explicit status always wins — "paused" is a fact about intent that progress
 * cannot know.
 */
export function statusOf(stream: Workstream, progress: StreamProgress): string | null {
  if (stream.status) return stream.status;
  if (progress.total === 0) return null;
  if (progress.done === progress.total) return 'completed';
  return progress.done > 0 ? 'active' : null;
}

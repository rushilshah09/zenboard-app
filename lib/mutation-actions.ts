'use client';
// The registry: which server action a queued op names.
//
// A queued op has to survive being written to disk and read back by a later
// version of the app, so it cannot hold a function — it holds a STRING, and
// this file is the only place that string means anything.
//
// ── WHAT MAY GO IN HERE ─────────────────────────────────────────────────────
// Only actions that are ABSOLUTE and IDEMPOTENT. The queue retries, and it
// collapses two edits to the same field into one, and both are only safe if
// the op says "set done to true" rather than "flip done". `toggleTask(id, done)`
// qualifies because it takes the value. Anything shaped like a delta — an
// increment, an append, a toggle-with-no-argument — must not be registered:
// it would double-apply on the first retry and nothing would ever explain why.
//
// Creates and deletes are also deliberately absent for now. A create has to
// reconcile a temporary id with the real one the server mints, and a delete has
// no field patch to lay back over server data — both need more than a field
// map, and getting field edits trustworthy first is worth more than covering
// everything at once.
import { toggleTask, setHighlight, rescheduleTask, updateTask, moveTaskToProject } from '@/lib/actions/tasks';
import { setTaskList } from '@/lib/actions/task-lists';

type Result = { error: string } | { ok: true };

/** Each entry takes the op's serialised args and returns the action's result. */
export const ACTIONS: Record<string, (args: unknown[]) => Promise<Result>> = {
  'task.toggle': (a) => toggleTask(a[0] as string, a[1] as boolean),
  'task.highlight': (a) => setHighlight(a[0] as string, a[1] as boolean),
  'task.reschedule': (a) => rescheduleTask(a[0] as string, a[1] as string | null),
  'task.priority': (a) => updateTask(a[0] as string, { priority: a[1] as 'low' | 'med' | 'high' }),
  'task.setList': (a) => setTaskList(a[0] as string, a[1] as string | null),
  'task.setProject': (a) => moveTaskToProject(a[0] as string, a[1] as string | null),
};

/** The kinds a stored queue is allowed to contain. Anything else is dropped on
 *  load — see `readQueue`, and the note there about why a queue that cannot
 *  drain is worse than a lost op. */
export const KINDS: ReadonlySet<string> = new Set(Object.keys(ACTIONS));

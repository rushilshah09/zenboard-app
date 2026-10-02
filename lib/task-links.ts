// THE dependency rules — master plan §7B, migration 0032. Pure: no React, no
// Supabase, so the drawer, the list views and the server action all decide
// "is this blocked?" the same way, and none of them owns the answer.
//
// The whole feature rests on one sentence: **a task is blocked while any task
// it waits for is not done.** Everything below is that sentence, plus the two
// things it does not say out loud — that the relation is transitive for free,
// and that it must never form a loop.

/** One edge: `task_id` waits for `blocked_by_task_id`. */
export type TaskLink = { task_id: string; blocked_by_task_id: string };

/** Whether a task is complete. `done` is the authoritative bit (§7B). */
export type DonePredicate = (taskId: string) => boolean;

/**
 * A ceiling on how many things one task may wait for.
 *
 * Not a database constraint, because it is a judgement rather than an
 * invariant: a task with fifteen prerequisites is a project someone has not
 * broken up, and the honest response is to say so rather than to render a
 * fifteen-row list inside a drawer. Asana and Linear both allow unlimited and
 * both have screenshots of the result.
 */
export const MAX_BLOCKERS = 10;

/** The tasks `taskId` is waiting for. */
export function blockersOf(links: TaskLink[], taskId: string): string[] {
  return links.filter((l) => l.task_id === taskId).map((l) => l.blocked_by_task_id);
}

/** The tasks waiting for `taskId` — the same edges, read from the other end. */
export function blockingFrom(links: TaskLink[], taskId: string): string[] {
  return links.filter((l) => l.blocked_by_task_id === taskId).map((l) => l.task_id);
}

/**
 * Is this task waiting on something unfinished?
 *
 * TRANSITIVITY IS FREE and deliberately not computed: if A waits for B and B
 * waits for C, then B is not done, so A is blocked — without walking anything.
 * Computing the transitive closure would give the same answer more slowly, and
 * would also let a task be "blocked" by something two hops away that the user
 * cannot see in the drawer, which is worse than useless.
 */
export function isBlocked(links: TaskLink[], taskId: string, done: DonePredicate): boolean {
  return links.some((l) => l.task_id === taskId && !done(l.blocked_by_task_id));
}

/**
 * Every blocked task, in one pass.
 *
 * The list views need this for hundreds of rows at once; calling `isBlocked`
 * per row is O(rows × links) and turns a long Today list into a scan per
 * checkbox.
 */
export function blockedSet(links: TaskLink[], done: DonePredicate): Set<string> {
  const out = new Set<string>();
  for (const l of links) if (!done(l.blocked_by_task_id)) out.add(l.task_id);
  return out;
}

/**
 * Would adding "`taskId` waits for `blockerId`" create a loop?
 *
 * A loop is not a curiosity — it is two tasks that can never be started, with
 * no error message and nothing on screen to explain why. The database catches
 * the one-hop case (`task_links_no_self`); this catches A→B→C→A, by asking
 * whether the proposed blocker is already waiting, however indirectly, on the
 * task that would now block it.
 *
 * The `seen` set is not just an optimisation: if bad data ever contains a loop
 * already, this must still terminate rather than hang the request that was
 * trying to prevent one.
 */
export function wouldCycle(links: TaskLink[], taskId: string, blockerId: string): boolean {
  if (taskId === blockerId) return true;
  const seen = new Set<string>([blockerId]);
  const queue = [blockerId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of blockersOf(links, current)) {
      if (next === taskId) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

/** Why a proposed dependency was refused, in the words the user will read. */
export type LinkRefusal = 'self' | 'cycle' | 'duplicate' | 'too-many';

export const REFUSAL_TEXT: Record<LinkRefusal, string> = {
  self: 'A task cannot wait for itself.',
  cycle: 'That would make the two tasks wait for each other.',
  duplicate: 'This task is already waiting for that one.',
  'too-many': `A task can wait for up to ${MAX_BLOCKERS} others. Consider splitting it up.`,
};

/**
 * Can this dependency be added? One function, so the server action and the
 * picker refuse for the same reasons — a picker that offers a choice the server
 * then rejects is worse than one that never offered it.
 */
export function checkLink(links: TaskLink[], taskId: string, blockerId: string): LinkRefusal | null {
  if (taskId === blockerId) return 'self';
  const existing = blockersOf(links, taskId);
  if (existing.includes(blockerId)) return 'duplicate';
  if (existing.length >= MAX_BLOCKERS) return 'too-many';
  if (wouldCycle(links, taskId, blockerId)) return 'cycle';
  return null;
}

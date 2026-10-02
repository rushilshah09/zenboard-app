// The durable mutation queue — the rules, as pure functions.
//
// ── WHAT THIS IS ACTUALLY FOR ───────────────────────────────────────────────
// Not speed. Edits in this app are ALREADY instant: every view applies an
// optimistic patch before it calls the server. What they are not is DURABLE.
//
// Today, ticking a task does this:
//
//     setTasks(patch)        // instant, on screen
//     await toggleTask(id)   // ~300ms
//     if (error) rollback
//
// Close the tab inside that 300ms — or lose signal, or sleep the laptop — and
// the write is gone. The interface told you it was saved. It said so
// immediately and confidently, and it was wrong. That is data loss dressed as
// responsiveness, and it is the honest reason to build this.
//
// A queue changes the shape to: apply locally, WRITE THE INTENT DOWN, and let a
// worker deliver it — this tab, or the next one you open. This is what Notion
// does with its transaction queue, and the durability is the point; the
// instant paint was never the hard part.
//
// ── THE CONTRACT EVERY OP MUST KEEP ─────────────────────────────────────────
// An op may be retried, and it may be collapsed with a later op on the same
// record. Both are only safe if ops are **absolute and idempotent** — "set done
// to true", never "flip done". `toggleTask(id, done)` already takes the value
// rather than toggling, which is what makes it queueable at all. A delta-shaped
// action must NOT be registered here; it would double-apply on the first retry
// and nobody would ever see why.
//
// ── WHY THE PATCH IS STORED ALONGSIDE THE ARGUMENTS ─────────────────────────
// Because a server payload can arrive while an op is still queued. `useServerState`
// snaps local state to whatever the server last said — so a tick that has not
// been delivered yet would silently vanish from the screen the moment anything
// refreshed. `applyPending` re-lays every undelivered patch on top of the
// server's rows, which is the difference between a queue and a bug.

/** One intent, written down. Serialisable — it has to survive a reload. */
export type QueuedOp = {
  /** This op's own id, for dedupe and removal. */
  id: string;
  /** Registry key naming the server action, e.g. `task.toggle`. */
  kind: string;
  /** The row it changes. Collapsing and patch overlay both key on this. */
  recordId: string;
  /** Arguments for the action. Must be JSON. */
  args: unknown[];
  /** The optimistic field changes, re-applied over server data until delivered. */
  patch: Record<string, unknown>;
  /**
   * The values these fields had BEFORE the op — what to put back if delivery
   * is finally refused.
   *
   * Carried on the op rather than held in a closure because an op has to
   * survive a reload, and a closure does not. It is also the only way a tab
   * that did not make the edit can undo it: the queue drains in whichever tab
   * is open, so the tab that reports the failure may not be the one that
   * caused it.
   */
  revert?: Record<string, unknown>;
  /** When it was enqueued (ms). */
  at: number;
  /** Delivery attempts so far. */
  tries: number;
  /** True while a worker is mid-flight with it — never collapse into this. */
  sending?: boolean;
};

/** Give up after this many attempts and roll the patch back. */
export const MAX_TRIES = 5;

/** Where the queue is persisted. Versioned: a shape change starts a new key
 *  rather than trying to migrate ops that are, at most, seconds old. */
export const QUEUE_KEY = 'zb:mutations:v1';

/**
 * Backoff between attempts: 400ms, 800ms, 1.6s, 3.2s, capped at 5s.
 *
 * Capped low on purpose. These are one-row writes a person is waiting on, not
 * a batch job — a minute-long backoff would mean a task you ticked stays
 * undelivered long after the network came back, which is exactly the failure
 * this queue exists to prevent.
 */
export function backoffMs(tries: number): number {
  return Math.min(5000, 400 * 2 ** Math.max(0, tries - 1));
}

/**
 * Add an op, collapsing it with an earlier undelivered op on the same record.
 *
 * Collapsing matters more than it looks. Ticking a task and un-ticking it
 * inside the three-second settle beat is a normal thing to do, and without
 * this it would send two writes in an order the server has to be trusted to
 * respect. With it, the queue holds one op saying what you actually meant.
 *
 * Only ops of the SAME KIND on the SAME RECORD collapse. "Set done" and "move
 * to list" are independent facts about one task and both have to be delivered.
 */
export function enqueue(queue: QueuedOp[], op: QueuedOp): QueuedOp[] {
  const i = queue.findIndex((q) => !q.sending && q.kind === op.kind && q.recordId === op.recordId);
  if (i < 0) return [...queue, op];
  // Keep the earlier op's POSITION — its place in line was earned — but take
  // the newer intent wholesale.
  const next = [...queue];
  next[i] = { ...op, id: queue[i].id, at: queue[i].at };
  return next;
}

/** The op a worker should attempt next: the first that isn't already in flight. */
export function nextOp(queue: QueuedOp[]): QueuedOp | null {
  return queue.find((q) => !q.sending) ?? null;
}

/**
 * Lay every undelivered patch back over rows the server just sent.
 *
 * Order matters: later ops win, because they are later. Rows the queue does not
 * mention are returned untouched, and an op for a row that is not present is
 * ignored rather than inventing one — a task deleted on another device should
 * stay deleted, not be resurrected by a pending edit.
 */
export function applyPending<T extends { id: string }>(rows: T[], queue: QueuedOp[]): T[] {
  if (queue.length === 0) return rows;
  const byRecord = new Map<string, Record<string, unknown>>();
  for (const op of queue) {
    byRecord.set(op.recordId, { ...(byRecord.get(op.recordId) ?? {}), ...op.patch });
  }
  if (byRecord.size === 0) return rows;
  let changed = false;
  const out = rows.map((r) => {
    const patch = byRecord.get(r.id);
    if (!patch) return r;
    changed = true;
    return { ...r, ...patch } as T;
  });
  return changed ? out : rows;
}

/**
 * Read the queue back off disk.
 *
 * Defensive to the point of paranoia, because this runs on every cold start and
 * the input is JSON that a previous version of the app wrote. An op whose
 * `kind` no longer exists — renamed or removed in a deploy — is DROPPED rather
 * than kept forever failing: it can never be delivered, and a queue that cannot
 * drain blocks every op behind it.
 */
export function readQueue(raw: string | null, knownKinds: ReadonlySet<string>): QueuedOp[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const out: QueuedOp[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Partial<QueuedOp>;
    if (typeof o.id !== 'string' || typeof o.kind !== 'string' || typeof o.recordId !== 'string') continue;
    if (!knownKinds.has(o.kind)) continue;
    if (!Array.isArray(o.args)) continue;
    if (!o.patch || typeof o.patch !== 'object' || Array.isArray(o.patch)) continue;
    out.push({
      id: o.id, kind: o.kind, recordId: o.recordId,
      args: o.args, patch: o.patch as Record<string, unknown>,
      // Without this a reload would deliver the op but forget how to undo it,
      // so a refusal after a restart would leave the screen showing an edit the
      // server never accepted.
      revert: o.revert && typeof o.revert === 'object' && !Array.isArray(o.revert)
        ? (o.revert as Record<string, unknown>) : undefined,
      at: typeof o.at === 'number' ? o.at : Date.now(),
      tries: typeof o.tries === 'number' ? o.tries : 0,
      // `sending` never survives a reload: whatever was in flight when the tab
      // closed did not finish, and must be attempted again rather than sitting
      // in the queue marked busy forever.
      sending: false,
    });
  }
  return out;
}

/** What to do after an attempt. Split out so the policy is testable without a
 *  network, a timer, or a store. */
export type Outcome =
  | { kind: 'done' }              // delivered; drop it
  | { kind: 'retry'; inMs: number }
  | { kind: 'give-up'; reason: string };

/**
 * THE RULE THAT MATTERS: a server action that RETURNS an error has decided
 * something — the row is gone, RLS refused, the value was invalid — and
 * retrying will get the same answer forever. One that THREW did not get to
 * decide: that is a network or a runtime problem, and it is exactly what a
 * queue is for.
 */
export function outcomeFor(result: { error?: string } | { ok: true } | { thrown: true }, tries: number): Outcome {
  if ('thrown' in result) {
    return tries >= MAX_TRIES
      ? { kind: 'give-up', reason: 'Could not reach the server.' }
      : { kind: 'retry', inMs: backoffMs(tries) };
  }
  if ('error' in result && result.error) return { kind: 'give-up', reason: result.error };
  return { kind: 'done' };
}

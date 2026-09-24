'use client';
// The worker that drains the queue. One per tab, module-level — the same shape
// as the toast store and the reminder scheduler, and for the same reason: two
// of these racing would deliver every op twice.
//
// The pure rules live in lib/mutation-queue.ts; this file owns the three things
// that cannot be pure — persistence, timers, and the network.
//
// ── WHAT IT GUARANTEES ──────────────────────────────────────────────────────
// An edit that reached `push()` is on disk before the function returns. From
// that point it is delivered: by this tab, or by the next one you open, or —
// if the server finally refuses it — visibly undone with a reason. What it will
// never do is quietly disappear, which is what happens today when you close a
// tab inside the 300ms an `await` was taking.
//
// ── WHY THE VIEW STILL WRITES ITS OWN OPTIMISTIC PATCH ──────────────────────
// It would be tidier for the queue to be the only source of the optimistic
// state — display = server rows + pending patches — and that is where this
// should end up. It is not where it starts, because that would mean rewriting
// every optimistic call site in the app at the same time as introducing a
// queue, and one of those two things has to be trustworthy first. So for now
// the view patches as it always did, and the queue adds durability and the
// snap-back fix on top. `applyPending` is the seam that lets the second half
// happen later without touching the first.
import { readQueue, enqueue, nextOp, outcomeFor, QUEUE_KEY, type QueuedOp } from '@/lib/mutation-queue';
import { ACTIONS, KINDS } from '@/lib/mutation-actions';
import { tempId } from '@/lib/temp-id';

/** Fired when an op is finally refused, carrying what to put back. */
export const MUTATION_REVERTED = 'zb:mutation-reverted';
export type RevertedDetail = { recordId: string; revert: Record<string, unknown>; reason: string };

let queue: QueuedOp[] = [];
let loaded = false;
let draining = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function persist() {
  try {
    if (queue.length === 0) window.localStorage.removeItem(QUEUE_KEY);
    else window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Private mode, or the quota is full. The queue still works in memory for
    // this tab — losing durability is bad, but throwing here would lose the
    // edit itself, which is worse.
  }
}

function emit() { for (const l of listeners) l(); }

function setQueue(next: QueuedOp[]) {
  queue = next;
  persist();
  emit();
}

/** Read whatever the last tab left behind. Safe to call repeatedly. */
export function loadQueue(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { queue = readQueue(window.localStorage.getItem(QUEUE_KEY), KINDS); } catch { queue = []; }
  if (queue.length) emit();
  void drain();
}

export function getPending(): QueuedOp[] { return queue; }

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Write an intent down and start delivering it.
 *
 * Returns immediately — the caller has already painted the change and must not
 * wait on this. That is the whole point.
 */
export function push(op: Omit<QueuedOp, 'id' | 'at' | 'tries'>): void {
  if (typeof window === 'undefined') return;
  loadQueue();
  setQueue(enqueue(queue, { ...op, id: tempId(), at: Date.now(), tries: 0 }));
  void drain();
}

async function drain(): Promise<void> {
  if (draining || typeof window === 'undefined') return;
  const op = nextOp(queue);
  if (!op) return;
  draining = true;

  setQueue(queue.map((q) => (q.id === op.id ? { ...q, sending: true, tries: q.tries + 1 } : q)));

  const run = ACTIONS[op.kind];
  let result: { error?: string } | { ok: true } | { thrown: true };
  try {
    // A missing action can never succeed, so it is refused rather than retried
    // — `readQueue` drops unknown kinds on load, and this covers the same case
    // for an op enqueued against a registry that changed under it.
    result = run ? await run(op.args) : { error: 'This change is no longer supported.' };
  } catch {
    result = { thrown: true };
  }

  const current = queue.find((q) => q.id === op.id);
  const tries = current?.tries ?? op.tries + 1;
  const outcome = outcomeFor(result, tries);
  draining = false;

  if (outcome.kind === 'done') {
    setQueue(queue.filter((q) => q.id !== op.id));
    void drain();
    return;
  }

  if (outcome.kind === 'give-up') {
    setQueue(queue.filter((q) => q.id !== op.id));
    if (op.revert) {
      window.dispatchEvent(new CustomEvent<RevertedDetail>(MUTATION_REVERTED, {
        detail: { recordId: op.recordId, revert: op.revert, reason: outcome.reason },
      }));
    }
    void drain();
    return;
  }

  // Retry: put it back at the head, not in flight, and try again after the
  // backoff. It keeps its position so ops on other records do not overtake it
  // while the network is down and then land out of order behind it.
  setQueue(queue.map((q) => (q.id === op.id ? { ...q, sending: false } : q)));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void drain(); }, outcome.inMs);
}

/** Nudge the worker — used when the browser says the network came back. */
export function kick(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  void drain();
}

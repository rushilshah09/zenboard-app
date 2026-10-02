'use client';
// "Ticking a task off should not make it vanish under your finger."
//
// THE PROBLEM. A completed task has to leave the active list — that is the
// whole reward for finishing it — but it must not leave INSTANTLY. If it does,
// three things break at once: you lose the half-second of satisfaction at
// seeing it struck through, you cannot undo a misclick without hunting for it,
// and the rows below jump up under a finger that is already moving toward the
// next one.
//
// THE ANSWER, and it is Google Tasks': the row stays exactly where it is,
// struck through, for a beat. Then it settles into a collapsed "Completed"
// section. Tick it back within the beat and nothing ever moved.
//
// BENCHMARK (rule 7). Google Tasks waits ~2s and then animates the row out to a
// collapsed group — the behaviour this copies deliberately. Things 3 waits
// about a second and uses a "magic sort" that only reorders when you leave the
// list, which is calmer but means a completed task can sit in place for
// minutes. Todoist removes it immediately and offers a toast to undo, which is
// the version that loses the row under your finger. We take Google's timing
// (3s, per the request) and Things' refusal to shout about it: no toast, no
// confetti, just the row quietly finding its place.
//
// WHY A HOOK AND NOT A FLAG PER LIST. `TaskRow` is the one row used by Home,
// Tasks, the project tabs and the portal. If each of those decided separately
// when a completed task disappears, they would disagree within a week — and
// this behaviour is the kind a person learns once and then expects everywhere.
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a finished task stays in place before it settles.
 *
 * Long enough to see the strike-through land and change your mind; short enough
 * that a list you are working down does not fill with things you have finished.
 */
export const SETTLE_MS = 3000;

export type Settling = {
  /** Ids that are done but should still be drawn in the ACTIVE list. */
  ids: ReadonlySet<string>;
  /** Call when a task is ticked off — starts its beat. */
  hold: (id: string) => void;
  /** Call when a task is un-ticked — cancels the beat if it is still running. */
  release: (id: string) => void;
};

/**
 * Holds just-completed task ids for a beat.
 *
 * Deliberately knows nothing about tasks: it is a set of ids and some timers,
 * so the same hook serves a project list, Home, and anything else with a row
 * that can be ticked off.
 */
export function useSettling(delayMs: number = SETTLE_MS): Settling {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Every pending timer is cleared on unmount. Without this, navigating away
  // inside the beat leaves a timer that fires into an unmounted component —
  // which React warns about, and which would keep the whole list closure alive.
  useEffect(() => {
    const map = timers.current;
    return () => { for (const t of map.values()) clearTimeout(t); map.clear(); };
  }, []);

  const drop = useCallback((id: string) => {
    setIds((prev) => {
      if (!prev.has(id)) return prev;      // identity is stable when nothing changes
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const hold = useCallback((id: string) => {
    // Re-ticking a task already in its beat restarts the beat rather than
    // stacking a second timer that would fire early.
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    setIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    timers.current.set(id, setTimeout(() => { timers.current.delete(id); drop(id); }, delayMs));
  }, [delayMs, drop]);

  const release = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    drop(id);
  }, [drop]);

  return { ids, hold, release };
}

/**
 * Split a list into what the active section shows and what the Completed
 * section shows, given the ids still in their beat.
 *
 * One function so the two sections can never disagree about who owns a row —
 * the bug this shape prevents is a task briefly appearing in both, or in
 * neither, which is exactly what two independent `.filter()` calls drift into.
 */
export function splitSettled<T extends { id: string; done: boolean }>(
  items: T[],
  settling: ReadonlySet<string>,
): { active: T[]; completed: T[] } {
  const active: T[] = [];
  const completed: T[] = [];
  for (const item of items) {
    if (!item.done || settling.has(item.id)) active.push(item);
    else completed.push(item);
  }
  return { active, completed };
}

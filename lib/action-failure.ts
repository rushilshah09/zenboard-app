// What an unhandled rejection means, when it means a write did not save.
//
// ── THE THREE WAYS AN ACTION FAILS WITHOUT RETURNING `{ error }` ────────────
// Every server action here declares `Promise<{ error } | { ok }>` and every call
// site reads `if ('error' in res)`. That handles the failures the action DECIDED
// on. It cannot handle the ones where the promise rejects instead, and there are
// three, each needing a different remedy — which is why this is a classifier and
// not a boolean:
//
//  server       The action ran and threw — `requireSession()` on an expired
//               session (161 of 211 actions open with it), or any unexpected
//               exception. Next stamps a string `digest` on errors leaving the
//               server; it survives into production, where the message is
//               redacted. Server truth is reachable, so the remedy is a
//               REFRESH: every view on `useServerState` snaps back to what the
//               server holds, and the unsaved edit visibly goes away.
//
//  stale        This tab's JavaScript is from an older deployment than the
//               server, so the action's ID no longer exists. Next throws
//               `UnrecognizedActionError` — with NO digest, which is why the
//               first version of the net never saw it. We deploy several times
//               a day, so any tab left open across a deploy hit this on its next
//               edit, silently. The remedy is a RELOAD, and specifically not a
//               refresh: a refresh would fetch a React payload built by a
//               different deployment than the code rendering it. Detected with
//               Next's own `unstable_isUnrecognizedActionError`, passed in, so
//               this module stays free of client-runtime imports and testable.
//
//  unreachable  The request never arrived — offline, or the network dropped.
//               `fetch` rejects with a TypeError whose wording is per-browser.
//               A refresh now would fail the same way, so the remedy is to say
//               so and refresh once the connection returns.
//
// Anything else is not a failed write, and the net must stay silent for it: a
// bug's TypeError ("cannot read properties of undefined") is not a network
// failure, and saying "that didn't save" about it would be a lie of its own.
export type ActionFailure = 'server' | 'stale' | 'unreachable';

/**
 * Fired on `window` when a write failed and what a component loaded FOR ITSELF
 * may now be wrong.
 *
 * The net's refresh reaches every view fed by server props. It cannot reach a
 * component that fetched its own rows on the client — the task drawer's tree,
 * the focus timer's list — and those would go on showing the failed edit as
 * saved. They listen here (`lib/use-resync.ts`) and re-run the loader they
 * already have.
 *
 * DELIBERATELY NOT `zb:realtime`. That event fires on every row change from
 * every device, and `realtime-sync.tsx` documents what reacting to it costs; the
 * drawer's loader is six queries. This fires only when a write of ours fails,
 * which is rare, so the same reload costs nothing in practice. Whether those
 * surfaces should also follow other devices live is its own decision, with its
 * own cost, and is recorded rather than smuggled in here.
 */
export const RESYNC_EVENT = 'zb:resync';

/**
 * `fetch`'s network-failure wording, per engine. Chrome says "Failed to fetch",
 * Firefox "NetworkError when attempting to fetch resource.", Safari "Load
 * failed" or "The network connection was lost." Matched on the message because
 * the TypeError class alone is shared with every ordinary bug.
 */
const FETCH_FAILED = /failed to fetch|networkerror when attempting to fetch|^load failed$|network connection was lost/i;

export function classifyRejection(
  reason: unknown,
  deps: { isStaleDeployment: (error: unknown) => boolean },
): ActionFailure | null {
  // First: a stale-deployment error is an Error with no digest, and it must not
  // fall through to "not ours".
  if (deps.isStaleDeployment(reason)) return 'stale';
  // A STRING digest, not merely a `digest` key, so an unrelated object carrying
  // one cannot trip it.
  if (reason instanceof Error && typeof (reason as { digest?: unknown }).digest === 'string') return 'server';
  if (reason instanceof TypeError && FETCH_FAILED.test(reason.message)) return 'unreachable';
  return null;
}

/**
 * What each one says. Sentence case, one line, and each true in the case it is
 * used for — the net has no idea which edit failed, so none of them names one.
 *
 * `server` can say the page "now shows what's saved" only because of what fires
 * with it: a refresh for every view fed by server props, and `RESYNC_EVENT` for
 * every view that loaded its own. Before both existed, that sentence was false
 * on four surfaces — which is how it was caught.
 */
export const FAILURE_COPY: Record<ActionFailure, string> = {
  server: 'That didn’t save. The page now shows what’s saved.',
  stale: 'That didn’t save. Zenboard has been updated.',
  unreachable: 'Couldn’t reach Zenboard. That change didn’t save.',
};

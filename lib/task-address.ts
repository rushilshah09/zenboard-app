// Where a task opens: OVER the page you are on, never instead of it.
//
// A task is a record that opens in a panel above whatever page opened it (`?task=<id>`, read by the panel the app
// shell mounts). Every opener used to write `${pathname}?task=${id}`, and the panel closed to the bare
// `pathname` — so the page's own settings went both ways: open a task from the Ridgeline project, close it, and
// the list behind was the Inbox (found 2026-09-21, proving task editing). Only `task` is this file's; every
// other parameter belongs to the page and passes through untouched.
//
// Pure, so it is tested without a router; the openers pass `window.location.search` or `useSearchParams()`.

/** This page's address with a task open over it — every other setting of the page kept. */
export function taskOpenHref(pathname: string, search: string, taskId: string): string {
  const q = new URLSearchParams(search);
  q.set('task', taskId);
  return `${pathname}?${q}`;
}

/** The same page with the task closed: only `task` goes. */
export function taskClosedHref(pathname: string, search: string): string {
  const q = new URLSearchParams(search);
  q.delete('task');
  const qs = q.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

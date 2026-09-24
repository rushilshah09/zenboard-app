// Optimistic marking that is allowed to fail in only one direction.
//
// Every optimistic write in the app applies locally and reverts on a returned
// error. Server actions can also THROW — `requireSession()` throws on an
// expired session, and a dropped connection rejects the promise — and a bare
// `await` leaves the optimistic state applied when that happens.
//
// For most writes that is cosmetic: a task looks done for a moment, and you
// notice on the next load. For a client-facing mark it is not. A chip left
// reading "Client" after a failed write tells you a client can see something
// nobody ever marked, and you would act on that — send the link, say it is
// shared. Showing something as private that is actually private costs nothing;
// showing something as shared when it is not is how the wrong thing gets
// promised to a client.
//
// So: any failure, returned or thrown, reverts. One helper rather than five
// try/catch blocks, because the moment they differ one of them is the wrong one.

type ActionResult = { error: string } | { ok: true };

const OFFLINE = 'Could not save that — check your connection and try again.';

export async function applyShare(
  run: () => Promise<ActionResult>,
  revert: () => void,
  onError: (message: string) => void,
): Promise<boolean> {
  try {
    const res = await run();
    if ('error' in res) { revert(); onError(res.error); return false; }
    return true;
  } catch {
    revert();
    onError(OFFLINE);
    return false;
  }
}

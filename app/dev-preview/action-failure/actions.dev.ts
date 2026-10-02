'use server';
// A server action that fails the way the real ones do.
//
// Dev-preview only — `.dev.ts` is imported solely by `page.dev.tsx`, which a
// production build never compiles (next.config.ts `pageExtensions`), so none of
// this reaches the worker.
//
// It holds its rows in module memory rather than Supabase because the point is
// the MECHANISM — a real server component, a real server action, a real
// `router.refresh()` round trip — and a harness that needs a session to run is a
// harness nobody runs.

export type HarnessRow = { id: string; title: string; done: boolean };

let rows: HarnessRow[] = [
  { id: 'r1', title: 'Send the Ridgeline invoice', done: false },
  { id: 'r2', title: 'Book the studio for Thursday', done: false },
  { id: 'r3', title: 'Reply to the portal request', done: false },
];
let failure: 'none' | 'throw' = 'none';

export async function readRows(): Promise<HarnessRow[]> {
  return rows;
}

/**
 * Throws exactly as `requireSession()` does on an expired session — BEFORE the
 * write, so the server's truth is untouched and a refresh must bring the old
 * value back. Returning `{ error }` here would test the path that already worked.
 */
export async function setRowDone(id: string, done: boolean): Promise<{ ok: true } | { error: string }> {
  if (failure === 'throw') {
    failure = 'none';
    throw new Error('Not authenticated');
  }
  rows = rows.map((r) => (r.id === id ? { ...r, done } : r));
  return { ok: true };
}

/** Arm the next save to fail. */
export async function failNextSave(): Promise<{ ok: true }> {
  failure = 'throw';
  return { ok: true };
}

/** Put the rows back, so a run starts from a known state. */
export async function resetRows(): Promise<{ ok: true }> {
  rows = rows.map((r) => ({ ...r, done: false }));
  failure = 'none';
  return { ok: true };
}

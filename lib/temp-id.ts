// The id an optimistic row carries until the server gives it a real one.
//
// Two conventions lived here unwritten, each copied across a dozen files:
// minting the placeholder (`'tmp-' + Date.now()`, in 24 places) and asking
// whether a row is still local (`id.startsWith('tmp-')`, in 12). The prefix is
// load-bearing — it is how the app knows not to send an id the server has never
// seen — so it deserved a name rather than a string literal at every call site.
//
// THE BUG IN THE OLD FORM: `Date.now()` alone is only unique per millisecond.
// Two optimistic rows created in the same tick — a loop, a fast double-click,
// two composers submitted together — got the SAME id. These ids are React keys,
// so a collision means React reconciles one row onto the other's DOM node and
// the wrong item animates, or the server's reply replaces the wrong row. The
// counter makes it unique by construction; the timestamp is kept only because
// it makes the ids readable while debugging.
//
// It is also why the React Compiler flagged those call sites: `Date.now()` is
// impure, and the compiler cannot prove a nested handler never runs during
// render. Calling it behind this module boundary is both honest and quiet.

const PREFIX = 'tmp-';

let seq = 0;

/** A placeholder id for a row the server has not seen yet. Unique per call. */
export function tempId(): string {
  seq += 1;
  return `${PREFIX}${Date.now().toString(36)}-${seq.toString(36)}`;
}

/**
 * True while a row is still local-only.
 *
 * Guards every call that would hand an id to the server — deleting, opening,
 * linking, uploading against it. A temp id in any of those is a request for a
 * row that does not exist.
 */
export function isTempId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PREFIX);
}

/**
 * A FINAL id minted on this device — the opposite of `tempId`. For a record the
 * server stores under the id it is given (a uuid primary key with a default), so
 * nothing ever has to be renamed: whatever captured the id while the write was in
 * flight — a block's `colId`, a queued edit, a React key — stays correct.
 *
 * `crypto.randomUUID` exists only in secure contexts, so over plain http on a LAN
 * address it is undefined; the fallback builds the same version-4 shape from
 * `getRandomValues`, which exists everywhere.
 */
export function mintUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

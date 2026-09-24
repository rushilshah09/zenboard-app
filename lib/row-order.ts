// Where a database row sits among its siblings — a TEXT fractional index.
//
// Why not a number. `collection_rows.sort_index` was a double holding
// `Date.now()`, which worked only because rows were append-only: the moment you
// need to drop a row BETWEEN two others you start bisecting, and a double runs
// out of mantissa after ~50 midpoints. Migration 0028 saw this and gave
// `pages.row_order` a text column instead — a string can always be bisected,
// because you can always add another digit.
//
// It also sidesteps a live hazard. `pages.sort_index` is `int` (0007) while
// `collection_rows.sort_index` was `double precision` (0013), and epoch millis
// (~1.75e12) do not fit in an int4. Anything that kept writing `Date.now()` into
// the new column would fail at ~2.1e9. Ordering had to change with the repoint;
// this is the column 0028 created for it.
//
// Base 36, lowercase — a superset of the zero-padded hex 0028 seeded
// (`lpad(to_hex(n * 1000), 12, '0')`), so existing keys sort identically here.
// Keys are compared with plain `<`, so every consumer is just string ordering.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

const idx = (ch: string) => DIGITS.indexOf(ch);

/** The key a first-ever row gets. Mid-alphabet, so there is room on both sides. */
export const FIRST_ORDER = 'i';

/**
 * A key strictly between `a` and `b`, both of which must already be ordered.
 *
 * `null` means "no neighbour on that side": `orderBetween(last, null)` appends,
 * `orderBetween(null, first)` prepends, and `orderBetween(null, null)` is the
 * first row of an empty database.
 */
export function orderBetween(a: string | null, b: string | null): string {
  if (!a && !b) return FIRST_ORDER;
  if (!a) return orderBefore(b!);
  if (!b) return orderAfter(a);
  // Callers sometimes hand these over in whatever order a list happened to be
  // in. Ordering them here is cheaper than every call site remembering to.
  const [lo, hi] = a < b ? [a, b] : [b, a];
  if (lo === hi) return lo + FIRST_ORDER; // degenerate: no gap to bisect, extend

  let prefix = '';
  // Once we place a digit strictly below `hi`'s, `hi` stops bounding us — every
  // string with this prefix is already less than it, so the rest is open.
  let free = false;
  for (let i = 0; ; i++) {
    // `lo` running out reads as trailing zeros: "a" behaves as "a000…".
    const da = i < lo.length ? idx(lo[i]) : 0;
    // `hi` can only run out once we are already free — if it ran out while we
    // were still level with it, `hi` would be a prefix of `lo`, i.e. lo >= hi.
    const db = free ? BASE : idx(hi[i]);
    if (db - da > 1) return prefix + DIGITS[Math.floor((da + db) / 2)];
    prefix += DIGITS[da];
    if (da < db) free = true;
  }
}

/** A key greater than `a`. Bumps the last digit where it can, so appending in a
 *  loop does not grow the key by a character every time. */
export function orderAfter(a: string): string {
  for (let i = a.length - 1; i >= 0; i--) {
    const d = idx(a[i]);
    if (d < BASE - 1) return a.slice(0, i) + DIGITS[d + 1];
  }
  // All 'z': nothing to carry into, so extend instead. Any proper extension of
  // a string sorts after it.
  return a + FIRST_ORDER;
}

/**
 * A key less than `a`.
 *
 * Halves the last digit that can go lower — except that a 1 becomes 0 followed by the
 * middle digit, never a bare 0. A key ENDING in 0 has nothing below it but its own
 * prefix, so rows put on top one after another walked 'i' → '9' → '4' → '2' → '1' →
 * '0', and the sixth row dropped at the top of a table tied with the fifth (found
 * 2026-09-15). Now a key grows by a character every few prepends and always has room
 * below.
 *
 * Truncation is the escape hatch for a key of zeros: '000' has no smaller digit to
 * reach for, but '00' is a prefix of it and therefore sorts before it. A lone '0' is
 * the floor — it returns itself, and the caller ends up with a tie rather than a wrong
 * order. Keys made before the fix above can be '0'; none made since can.
 */
export function orderBefore(a: string): string {
  for (let i = a.length - 1; i >= 0; i--) {
    const d = idx(a[i]);
    if (d > 1) return a.slice(0, i) + DIGITS[Math.floor(d / 2)];
    if (d === 1) return a.slice(0, i) + DIGITS[0] + FIRST_ORDER;
  }
  return a.length > 1 ? a.slice(0, -1) : a;
}

/** Append after the highest key in `rows`. The only ordering the UI performs
 *  today — every "New" button lands at the end. */
export function orderAppend(rows: { order: string }[]): string {
  let max: string | null = null;
  for (const r of rows) if (r.order && (max === null || r.order > max)) max = r.order;
  return orderBetween(max, null);
}


/**
 * The order keys that put `movedId` at `index` among the other rows it is dropped
 * between — a board's column, a table's rows.
 *
 * Usually one key, between its new neighbours. Keys are shared by every view, and
 * rows written before ordering existed can share one (or have none), so when the
 * neighbours leave no gap the list is keyed again by `orderFor` — which rewrites as
 * few rows as it can and still makes the drop land where it was aimed.
 */
export function reorderKeys(others: { id: string; order: string }[], movedId: string, index: number): Map<string, string> {
  const at = Math.max(0, Math.min(index, others.length));
  const before = at > 0 ? others[at - 1].order : null;
  const after = at < others.length ? others[at].order : null;
  // A neighbour that exists but has no key cannot be placed against.
  const keyed = before !== '' && after !== '';
  if (keyed && (before === null || after === null || before < after)) {
    return new Map([[movedId, orderBetween(before, after)]]);
  }
  // No gap to bisect: key the sequence again, the moved row (no key yet) in its place.
  return orderFor([...others.slice(0, at), { id: movedId, order: '' }, ...others.slice(at)]);
}

/**
 * The fewest new keys that make `sequence` read in order — for a list whose keys no
 * longer agree with the order it should have: rows that share a key, rows with no
 * key, or a sorted view frozen into the order it shows.
 *
 * The longest run of keys that already increase along the sequence stays as it is;
 * every other row gets a key between the kept neighbours around it. One save per
 * changed row is the cost of a reorder, so "fewest" is the point: a list that is
 * nearly in order again costs a write or two, not one per row.
 *
 * Returns only the rows whose key changes.
 */
export function orderFor(sequence: { id: string; order: string }[]): Map<string, string> {
  const n = sequence.length;
  // Patience sort over the keys: `tails[k]` is the index ending the best increasing
  // run of length k + 1 found so far, `prev` threads each run back to its start.
  const tails: number[] = [];
  const prev = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const key = sequence[i].order;
    if (!key) continue; // a row with no key is always given one
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sequence[tails[mid]].order < key) lo = mid + 1; else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const kept = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) kept.add(i);

  const out = new Map<string, string>();
  for (let i = 0; i < n;) {
    if (kept.has(i)) { i++; continue; }
    let j = i;
    while (j < n && !kept.has(j)) j++;
    // Rows i..j-1 go between the kept rows either side of them.
    const keys = keysBetween(i > 0 ? sequence[i - 1].order : null, j < n ? sequence[j].order : null, j - i);
    for (let k = i; k < j; k++) out.set(sequence[k].id, keys[k - i]);
    i = j;
  }
  return out;
}

/**
 * `count` increasing keys strictly between `lo` and `hi` (either open). Bisected from
 * the middle rather than one after another, so twenty rows squeezed into one gap
 * add a couple of characters to their keys, not twenty.
 */
function keysBetween(lo: string | null, hi: string | null, count: number): string[] {
  if (count <= 0) return [];
  if (hi === null) {
    // Open above: step upwards, which keeps the keys short.
    const out: string[] = [];
    let last = lo;
    for (let i = 0; i < count; i++) { last = orderBetween(last, null); out.push(last); }
    return out;
  }
  const half = Math.floor(count / 2);
  const middle = orderBetween(lo, hi);
  return [...keysBetween(lo, middle, half), middle, ...keysBetween(middle, hi, count - half - 1)];
}

// When a document earns a version snapshot.
//
// The naive answer — snapshot on every autosave — produces a history nobody can
// read: 400 entries for one afternoon of typing, each one character apart. The
// useful answer is a COALESCING WINDOW: while you keep editing, the same session
// keeps one entry; once you stop for a while, the next edit starts a new one.
// That is what makes the list read like "the versions of this doc" rather than
// "the keystrokes of this doc".
//
// Pure and dependency-free so the rule is testable without a database.

/** Minutes of continuous editing that share one version entry. */
export const SNAPSHOT_WINDOW_MIN = 10;

/** How many versions a page keeps. Older ones are pruned oldest-first. */
export const MAX_VERSIONS = 50;

export type SnapshotDecision =
  | { snapshot: false; reason: 'unchanged' | 'within-window' }
  | { snapshot: true; reason: 'first-version' | 'window-elapsed' };

/**
 * `lastVersionAt` is the newest existing snapshot's timestamp (null when the page
 * has none). `changed` is whether the content differs from that snapshot — the
 * caller compares, because it already holds both blobs and equality on a document
 * is its business, not this rule's.
 */
export function decideSnapshot(input: {
  lastVersionAt: string | null;
  changed: boolean;
  now?: Date;
}): SnapshotDecision {
  // Nothing to record. Checked FIRST: a page that has not changed must never
  // accumulate an entry per window just because time passed.
  if (!input.changed) return { snapshot: false, reason: 'unchanged' };
  if (!input.lastVersionAt) return { snapshot: true, reason: 'first-version' };

  const now = input.now ?? new Date();
  const last = new Date(input.lastVersionAt).getTime();
  // An unparseable stamp must not wedge history shut — treat it as due.
  if (Number.isNaN(last)) return { snapshot: true, reason: 'window-elapsed' };

  const elapsedMin = (now.getTime() - last) / 60000;
  return elapsedMin >= SNAPSHOT_WINDOW_MIN
    ? { snapshot: true, reason: 'window-elapsed' }
    : { snapshot: false, reason: 'within-window' };
}

/** Ids to delete so a page keeps at most `MAX_VERSIONS`, newest kept. */
export function versionsToPrune(
  versions: { id: string; created_at: string }[],
  max = MAX_VERSIONS,
): string[] {
  if (versions.length <= max) return [];
  const newestFirst = [...versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return newestFirst.slice(max).map((v) => v.id);
}

/**
 * Group versions the way the panel lists them. Same vocabulary as the rest of the
 * app's date language (see lib/date.ts) — Today / Yesterday / then the date.
 */
export function versionBucket(iso: string, now = new Date()): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return sameDay(d, yesterday) ? 'Yesterday' : 'Earlier';
}

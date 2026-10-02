// THE one answer to "can the client see this?".
//
// ── THE PROBLEM ─────────────────────────────────────────────────────────────
// Four kinds of thing can reach a client, and they obeyed four different rules:
//
//     tasks    per-item `client_visible`        ✔
//     docs     per-item `client_visible`        ✔
//     files    project-level `share_files` flag  ← all or nothing
//     updates  not shareable at all              ← inferred from task titles
//
// So you could share one task but not one file, and a person who learned the
// task rule found it did not transfer. Worse, the per-item ticking lived in a
// share panel — a different surface from the one you were working in — which
// made sharing a SECOND PASS over work you had already finished rather than
// something you said at the moment you meant it.
//
// This file is the vocabulary that makes the four the same, and it is
// deliberately small: a projection is only trustworthy if the rule behind it
// fits on one screen.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// Two gates, and BOTH must open:
//
//   1. THE CHANNEL is on — the project shares this KIND of thing at all
//      (`share_open_tasks`, `share_files`, …). This is the setup decision,
//      made once.
//   2. THE ITEM is marked — this particular row was intended for the client.
//      This is the daily decision, made where the work is.
//
// Two gates rather than one because they answer different questions and fail
// differently. Turning a channel off is "not this project, not this client" and
// must silence everything of that kind instantly, without touching a single
// row. Marking an item is "this one, on purpose". Collapsing them into one flag
// would mean turning a channel back on could re-expose items nobody re-checked.
//
// ── THE DEFAULT IS HIDDEN, ALWAYS ───────────────────────────────────────────
// Every function here is written so that missing data reads as PRIVATE. A row
// whose `client_visible` column does not exist yet (the migration is not
// applied), a project whose share flags failed to load, an unknown kind — all
// of them resolve to "the client cannot see it". The cost of a false negative
// is a client asking where something is. The cost of a false positive is
// showing someone else's work to a client, and there is no undoing that.

/** The kinds of thing that can be shared. One name each, used everywhere. */
export type ShareKind = 'task' | 'doc' | 'file' | 'update';

/**
 * The project's channel switches — which KINDS this project shares at all.
 *
 * Named for the columns they come from (`projects.share_*`) so the mapping is
 * checkable by eye. Optional and defaulting to false: a project row that failed
 * to load, or predates a column, shares nothing.
 */
export type ShareChannels = {
  openTasks?: boolean;
  completedTasks?: boolean;
  files?: boolean;
  invoices?: boolean;
  timeline?: boolean;
  progress?: boolean;
};

/** What any shareable row must tell us. Structural, so callers' own row types
 *  satisfy it without a cast. */
export type ShareableItem = {
  /** `false`/absent = private. Absent covers "the migration is not applied". */
  client_visible?: boolean | null;
  /** Tasks only: a completed task is shared through a different channel from
   *  an open one, because agencies commonly show progress without showing the
   *  work still in flight. */
  done?: boolean | null;
};

/** Which channel a kind of item flows through. Tasks are the one kind whose
 *  channel depends on the row, which is why this takes the item. */
export function channelFor(kind: ShareKind, item: ShareableItem): keyof ShareChannels {
  if (kind === 'task') return item.done ? 'completedTasks' : 'openTasks';
  if (kind === 'doc') return 'files';
  if (kind === 'file') return 'files';
  // Updates ride the TIMELINE switch rather than one of their own. That switch
  // already means "tell the client what has been happening", and an authored
  // update is the better answer to it than the derived task events it replaces
  // — so a project that had turned Timeline on gets the improvement, and one
  // that had turned it off is not opted into a new kind of publishing by a
  // sprint it did not ask for. A `share_updates` column would also have been a
  // migration to add a switch nobody would have set differently.
  return 'timeline';
}

/**
 * THE question. Both gates, in one place.
 *
 * Read it as: "is this KIND shared on this project, and was THIS ONE meant for
 * the client?"
 */
export function isClientVisible(kind: ShareKind, item: ShareableItem, channels: ShareChannels): boolean {
  if (item.client_visible !== true) return false;          // gate 2, strict
  return channels[channelFor(kind, item)] === true;        // gate 1, strict
}

/** The visible subset. The one call sites should reach for — filtering by hand
 *  is how one surface ends up checking a different pair of conditions. */
export function clientVisible<T extends ShareableItem>(kind: ShareKind, items: T[], channels: ShareChannels): T[] {
  return items.filter((i) => isClientVisible(kind, i, channels));
}

/**
 * Why a given item is not visible — for the OWNER's surfaces only.
 *
 * The point is to make the two gates legible at the moment they bite. "Marked
 * for the client, but Files are switched off for this project" is a sentence
 * that tells you which switch to go and find; a silently missing row is not.
 * Never shown to a client.
 */
export type HiddenReason = 'channel-off' | 'not-marked' | null;

export function hiddenReason(kind: ShareKind, item: ShareableItem, channels: ShareChannels): HiddenReason {
  if (isClientVisible(kind, item, channels)) return null;
  // Order matters: if the item was never marked, that is the thing to say,
  // even when the channel also happens to be off. Telling someone to flip a
  // project switch when they have not ticked the item would send them to the
  // wrong place.
  if (item.client_visible !== true) return 'not-marked';
  return 'channel-off';
}

/** One sentence per reason. Owner-facing copy lives with the rule so two
 *  surfaces cannot word the same state differently. */
export function hiddenLabel(reason: HiddenReason, kind: ShareKind): string | null {
  if (reason === null) return null;
  if (reason === 'not-marked') return 'Internal';
  const channel: Record<ShareKind, string> = {
    task: 'Tasks are',
    doc: 'Files are',
    file: 'Files are',
    update: 'Updates are',
  };
  return `${channel[kind]} switched off for this project`;
}

/**
 * Read the project row's `share_*` columns into channels.
 *
 * A read-time normaliser, for the same reason every other jsonb/enum in this
 * codebase has one: the input is a database row that may predate a column, and
 * `undefined` must not accidentally read as permission. `=== true` everywhere,
 * never truthiness.
 */
export function readChannels(project: Record<string, unknown> | null | undefined): ShareChannels {
  const p = project ?? {};
  return {
    openTasks: p.share_open_tasks === true,
    completedTasks: p.share_completed_tasks === true,
    files: p.share_files === true,
    invoices: p.share_invoices === true,
    timeline: p.share_timeline === true,
    progress: p.share_progress === true,
  };
}

/**
 * Is this project sharing anything at all with the client?
 *
 * Used to tell an owner that a portal link they are about to send leads to an
 * empty room — the most embarrassing failure this feature has, and the easiest
 * to catch.
 */
export function sharesAnything(channels: ShareChannels): boolean {
  return Object.values(channels).some((v) => v === true);
}

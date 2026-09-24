// THE one answer to "what is a project update, and who is it for?".
//
// ── THE GAP THIS CLOSES (AGENCY_WORKFLOW_PLAN §2, gap 5) ────────────────────
// The portal's "Recent updates" was derived from COMPLETED TASK TITLES. Safe,
// and also why the portal read like a project manager: the client got a
// changelog of our to-do list instead of a sentence from us. Nothing in the
// system existed whose purpose was "something I want to tell the client".
//
// ── WHY THERE IS NO `updates` TABLE ─────────────────────────────────────────
// Because the object already exists. The project Overview has had an "Update"
// composer since §7E — it writes a `project_activity` row of `type = 'note'`
// and shows the newest one as the project's written status. That IS the update.
// It simply had no way to be addressed to anybody.
//
// So a client update is the SAME row with a different type. One object, two
// audiences — which is the plan's own rule ("no duplicate objects; there is one
// thing with a visibility, and the portal reads the visible ones"). A parallel
// `client_updates` table would have meant writing your status twice and
// watching the two drift.
//
// ── WHY THE TYPE, RATHER THAN A `client_visible` COLUMN ─────────────────────
// `project_activity.type` is already the vocabulary of what KIND of thing
// happened — `note`, `status_change`, `accepted`, `invoiced` — and "a note I
// wrote for the client" is a genuinely different kind of event from a private
// one, not a flag smuggled into the wrong column. It also needs no migration:
// the column is plain `text` with no CHECK, and shipped code already writes
// values outside the DDL comment's list.
//
// The consequence, and it is the right one: promoting an update to the client
// is a one-column write, and the internal activity log shows "you told the
// client X" for free, because it is the same row it was always reading.
import { isClientVisible, type ShareChannels } from '@/lib/visibility';

/** A private note to yourself. The default, and what the composer has written
 *  since long before the client could see anything. */
export const NOTE = 'note';
/** A note addressed to the client. */
export const CLIENT_UPDATE = 'client_update';

/** What this file needs from a `project_activity` row. Structural, so callers'
 *  own row types satisfy it without a cast. */
export type UpdateRow = {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
};

/** Is this row an update someone WROTE, as opposed to a derived event? */
export function isUpdate(row: UpdateRow): boolean {
  return (row.type === NOTE || row.type === CLIENT_UPDATE) && !!row.body?.trim();
}

/** Was it addressed to the client? The per-item gate, read from the type. */
export function isAddressedToClient(row: UpdateRow): boolean {
  return row.type === CLIENT_UPDATE;
}

/** The type a row should have for a given intent. The ONE place the two names
 *  are chosen, so no surface invents a third. */
export const typeFor = (toClient: boolean): string => (toClient ? CLIENT_UPDATE : NOTE);

/**
 * The updates the CLIENT may see.
 *
 * Both gates, through the same rule as everything else: the project must share
 * this kind of thing at all, and this row must have been addressed. Newest
 * first, because an update is news.
 */
export function clientUpdates<T extends UpdateRow>(rows: T[], channels: ShareChannels): T[] {
  return rows
    .filter((r) => isUpdate(r) && isClientVisible('update', { client_visible: isAddressedToClient(r) }, channels))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/**
 * Every written update, newest first — the owner's list.
 *
 * Includes both audiences: you should see what you told the client and what you
 * kept to yourself in one column, in the order you wrote them. Splitting them
 * into two lists would make "what did I last say about this project?" a
 * question with two answers.
 */
export function allUpdates<T extends UpdateRow>(rows: T[]): T[] {
  return rows.filter(isUpdate).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

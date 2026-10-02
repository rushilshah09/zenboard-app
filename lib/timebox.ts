// The timebox twin — master plan §7C/§7D. Pure rules; the writes live in
// lib/actions/timebox.ts.
//
// THE IDEA, in one line from the plan: "a timeboxed task is one object with two
// projections." Not a copy of the task on the calendar — the same task, given a
// place in the day. Everything below follows from refusing to duplicate state:
//
//   · the event has no completion of its own. A twin block renders the TASK's
//     `done` and its checkbox calls the same `toggleTask` a list row calls, so
//     "completing either side completes both" is not a sync rule that could
//     drift — there is only ever one flag;
//   · moving the block moves the task's `scheduled_date`, because the block IS
//     when the task is happening;
//   · deleting the block un-timeboxes the task rather than deleting it (§7D),
//     which the schema itself enforces with ON DELETE SET NULL.
import { isoDateIn } from '@/lib/date';

/**
 * How long a block is when the task carries no estimate.
 *
 * 30 minutes, matching Akiflow's default and Sunsama's smallest offered block.
 * Deliberately NOT an hour: an hour-shaped default makes a day of five small
 * tasks look full, and the capacity line (§7C) then lies about the day. A block
 * you have to lengthen is a smaller mistake than a day you cannot fit.
 */
export const DEFAULT_TIMEBOX_MINUTES = 30;

/** Shortest block worth drawing — below this the label does not fit its box. */
export const MIN_TIMEBOX_MINUTES = 15;
/**
 * Longest block a single task may claim. A task estimated at three days is a
 * project someone has not broken up yet, and letting it paint over a whole week
 * of calendar makes the calendar useless rather than making the point.
 */
export const MAX_TIMEBOX_MINUTES = 8 * 60;

/**
 * The block's length for a task. Clamped, so a junk estimate — a negative
 * number from an import, a typo of 6000 — cannot produce an event that breaks
 * the grid's layout maths.
 */
export function timeboxMinutes(estimateMinutes: number | null | undefined): number {
  const raw = typeof estimateMinutes === 'number' && Number.isFinite(estimateMinutes) && estimateMinutes > 0
    ? Math.round(estimateMinutes)
    : DEFAULT_TIMEBOX_MINUTES;
  return Math.min(MAX_TIMEBOX_MINUTES, Math.max(MIN_TIMEBOX_MINUTES, raw));
}

export type TimeboxRange = { startsAt: string; endsAt: string };

/**
 * The event a task becomes when it is given a slot.
 *
 * Instants, not dates: an event is an absolute moment (the calendar stores and
 * renders ISO instants), which is the opposite of `scheduled_date` — see
 * `timeboxDay` below for the seam between the two.
 */
export function timeboxRange(startsAtISO: string, estimateMinutes: number | null | undefined): TimeboxRange | null {
  const start = new Date(startsAtISO);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + timeboxMinutes(estimateMinutes) * 60_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/**
 * The calendar day a block belongs to, as a `scheduled_date`.
 *
 * This is the one conversion in the feature that can silently produce
 * yesterday's date: `scheduled_date` is a CALENDAR date in the user's zone
 * while the event is an absolute instant, so this must never be
 * `toISOString().slice(0, 10)`. Goes through `isoDateIn`, which is the app's
 * one answer to "what day is this instant, where the user is".
 */
export function timeboxDay(startsAtISO: string, tz?: string): string | undefined {
  return isoDateIn(startsAtISO, tz);
}

/** The minimal shape this module needs of an event — a doc, a row, or a draft. */
export type TwinEvent = { task_id?: string | null; task_done?: boolean | null };

/** Is this calendar block a task's twin rather than an ordinary event? */
export const isTwin = (e: TwinEvent | null | undefined): boolean => !!e?.task_id;

/**
 * Whether a block should render struck through. Only twins can be complete —
 * an ordinary event has no completion, and pretending otherwise would invent a
 * state the schema does not have.
 */
export const isTwinDone = (e: TwinEvent | null | undefined): boolean => isTwin(e) && !!e?.task_done;

/**
 * Twins never consume Google. A timebox is a private planning artefact, not a
 * commitment to anyone else, and pushing "Write the brief · 30m" to a shared
 * work calendar broadcasts your to-do list to your colleagues. §7D's sync
 * contract is about EVENTS; this is the line where a twin stops being one.
 */
export const TWIN_SOURCE = 'timebox';

/**
 * Does this event participate in Google write-back? Everything except twins.
 * Kept here rather than inlined at each call site so the answer cannot differ
 * between create, update and delete.
 */
export const syncsToGoogle = (source: string | null | undefined): boolean => source !== TWIN_SOURCE;

/**
 * The times a task can be dropped into from a menu, 07:00–21:00 in half hours.
 *
 * Why this window and not 24 hours: a full day is 96 rows of mostly-3am, and
 * the point of a slot menu is to be faster than opening the calendar. Anything
 * outside a working day is still reachable by dragging onto the grid, which has
 * all 24 hours — the menu is the shortcut, not the only door.
 *
 * Lives here rather than in a component because two surfaces offer it (the task
 * drawer's Timebox chip and the calendar's task rail) and a menu that disagreed
 * with itself about which half-hours exist would be its own small madness.
 */
export const TIMEBOX_SLOTS: number[] = Array.from({ length: 29 }, (_, i) => 7 * 60 + i * 30);

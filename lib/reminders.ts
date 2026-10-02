// THE reminder vocabulary — master plan §7B ("remind_at (one)") and §7O
// channel 3. Pure: no React, no Supabase, no icons, so the server action, the
// picker and the scheduler all read the same rules and none of them owns them.
// The writes live in lib/actions/reminders.ts; the delivery loop in
// components/reminders/reminder-scheduler.tsx.
//
// TIMEZONES. Everything here works in the RUNTIME's local zone, and every
// caller is a browser — the picker and the scheduler are both client
// components. That is deliberate rather than lazy: a reminder is the one place
// in the product where "6:00 PM" means the clock on the wall *in front of the
// person*, so the browser is the only correct authority. Contrast
// `scheduled_date`, which is a calendar date a server must be told the zone for
// (lib/date.ts). The stored value is an absolute instant, so a user who flies
// to another timezone gets the reminder at the moment they chose, not at the
// local re-reading of the clock face — which is what every calendar does with a
// timed event, and what people expect.
import { formatClock, formatRelativeDay } from '@/lib/date';
import { isoFromLocal, localISODate } from '@/lib/calendar';

// ── The offered times ──────────────────────────────────────────────────────
//
// BENCHMARK (rule 7). Linear's "Remind me" offers In 30 minutes / In 1 hour /
// In 3 hours / Tomorrow / Next week / Custom — pure elapsed time, because a
// Linear issue has no hour of its own. Todoist offers presets *plus* relative
// ones ("10 minutes before due"), which needs its own modal to hold. Things
// pins the reminder to the task's day and gives you a time wheel.
//
// Ours is Linear's list with Things' insight added: when the task already has
// an hour — a calendar block from the timebox twin (0030), or a day it is
// scheduled for — that hour is the most useful anchor there is, and it goes
// FIRST under its own label. Everything else is elapsed time from now. A
// preset is never offered in the past, so the list shortens as the day wears
// on rather than showing options that would fire immediately.

/** Morning presets ("Tomorrow", "On the day") land at 9:00 local. */
export const MORNING_HOUR = 9;
/** "Later today" lands at 18:00 local — the end of a working day, not midnight. */
export const EVENING_HOUR = 18;
/**
 * How far ahead of a calendar block we speak. Ten minutes is the smallest
 * useful warning: long enough to close what you are doing, short enough that
 * you do not have to remember it a second time. Google Calendar defaults to
 * 10, Outlook to 15, and Sunsama's "time to start" nudge is 5.
 */
export const BLOCK_LEAD_MINUTES = 10;
/**
 * A preset must be at least this far out to be offered. Without it, "Later
 * today · 6:00 PM" is still in the list at 17:59:30 and fires before the
 * popover has finished closing.
 */
export const MIN_LEAD_MS = 60_000;

export type ReminderGroup = 'task' | 'soon';

export type ReminderPreset = {
  /** Stable id — the key for a list row and for tests. */
  id: string;
  group: ReminderGroup;
  /** "Tomorrow" — what the choice means. */
  label: string;
  /** "9:00 AM" — when that lands, always shown so nothing is a guess. */
  detail: string;
  /** The absolute instant, ISO. */
  at: string;
};

/** What the task brings to the picker. Both fields are optional; both narrow it. */
export type ReminderContext = {
  /** `tasks.scheduled_date` — a calendar date, or null. */
  scheduledDate?: string | null;
  /** The twin calendar block's start instant (0030), or null. */
  blockStart?: string | null;
};

const atLocal = (dayISO: string, hour: number, minute = 0): string =>
  isoFromLocal(dayISO, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);

const plusDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Days until the next Monday, always ≥ 1 (Monday itself means "in 7 days"). */
function daysToNextMonday(from: Date): number {
  const dow = from.getDay(); // 0 = Sun … 6 = Sat
  return dow === 1 ? 7 : (8 - dow) % 7 || 7;
}

/**
 * The times to offer, in a stable order, for a task at a moment.
 *
 * Stable is the point: a list that reorders itself by relevance destroys the
 * muscle memory that makes a preset faster than a date picker. Options drop
 * out when they would fire in the past, but the survivors never swap places.
 */
export function reminderPresets(now: Date, ctx: ReminderContext = {}): ReminderPreset[] {
  const out: ReminderPreset[] = [];
  const floor = now.getTime() + MIN_LEAD_MS;
  const push = (p: Omit<ReminderPreset, 'detail'> & { detail?: string }) => {
    if (Date.parse(p.at) < floor) return;
    out.push({ ...p, detail: p.detail ?? formatClock(p.at) ?? '' });
  };

  // ── The task's own hour, when it has one ──
  if (ctx.blockStart) {
    const start = Date.parse(ctx.blockStart);
    if (!Number.isNaN(start)) {
      push({
        id: 'block',
        group: 'task',
        // "Timebox" is the product's name for the block (the chip beside this
        // one says so) — the glossary rule, one name per concept.
        label: 'Before the timebox',
        at: new Date(start - BLOCK_LEAD_MINUTES * 60_000).toISOString(),
      });
    }
  }
  if (ctx.scheduledDate) {
    const at = atLocal(ctx.scheduledDate, MORNING_HOUR);
    push({
      id: 'day',
      group: 'task',
      label: 'On the day',
      at,
      // The day is the information here — "9:00 AM" alone would not say which
      // morning, and this is the one preset that can be more than a week out.
      detail: [formatRelativeDay(ctx.scheduledDate, { now }), formatClock(at)].filter(Boolean).join(', '),
    });
  }

  // ── Elapsed time from now ──
  push({ id: '30m', group: 'soon', label: 'In 30 minutes', at: new Date(now.getTime() + 30 * 60_000).toISOString() });
  push({ id: '1h', group: 'soon', label: 'In an hour', at: new Date(now.getTime() + 60 * 60_000).toISOString() });
  push({ id: 'evening', group: 'soon', label: 'Later today', at: atLocal(localISODate(now), EVENING_HOUR) });
  push({ id: 'tomorrow', group: 'soon', label: 'Tomorrow', at: atLocal(localISODate(plusDays(now, 1)), MORNING_HOUR) });
  {
    const mon = plusDays(now, daysToNextMonday(now));
    const at = atLocal(localISODate(mon), MORNING_HOUR);
    push({
      id: 'nextweek',
      group: 'soon',
      label: 'Next week',
      at,
      detail: [formatRelativeDay(at, { now }), formatClock(at)].filter(Boolean).join(', '),
    });
  }
  return out;
}

// ── Reading a reminder back ────────────────────────────────────────────────

/** The minimal shape of a task this module reads. */
export type ReminderRow = {
  remind_at?: string | null;
  reminded_at?: string | null;
  done?: boolean | null;
};

export type ReminderStatus =
  /** No reminder set. */
  | 'none'
  /** Set, in the future, not yet delivered. */
  | 'scheduled'
  /** Set, its moment has passed, and nothing has delivered it yet. */
  | 'due'
  /** Delivered. Stays visible on the task — you set it, you should see it happened. */
  | 'delivered';

export function reminderStatus(row: ReminderRow, now: Date = new Date()): ReminderStatus {
  if (!row.remind_at) return 'none';
  if (row.reminded_at) return 'delivered';
  return Date.parse(row.remind_at) <= now.getTime() ? 'due' : 'scheduled';
}

/**
 * The chip's text. "6:00 PM" today, "Tomorrow, 9:00 AM", "12 Aug, 9:00 AM".
 *
 * The day is dropped when the reminder is today because the chip lives inside a
 * task the user is already looking at on that day — "Today, 6:00 PM" spends a
 * word on something nothing else in the row bothers to say.
 */
export function reminderLabel(remindAt: string | null | undefined, now: Date = new Date()): string | undefined {
  if (!remindAt) return undefined;
  const clock = formatClock(remindAt);
  if (!clock) return undefined;
  const day = formatRelativeDay(remindAt, { now });
  return day === 'Today' ? clock : `${day}, ${clock}`;
}

// ── The delivery loop's arithmetic ─────────────────────────────────────────

/**
 * A reminder is "fresh" if its moment was within this window. Fresher than
 * this interrupts with a toast; older than this goes quietly to the bell.
 *
 * The reason is the laptop lid: come back after a weekend and there may be
 * eleven undelivered reminders, none of which is news any more. Every one of
 * them still becomes a notification — nothing is dropped — but a stack of
 * toasts for Friday afternoon is noise, and §7O's whole argument is that
 * notifications are how calm products become anxious ones.
 */
export const FRESH_WINDOW_MS = 60 * 60_000;

/** Longest a single timer may sleep before we re-plan. */
export const HEARTBEAT_MS = 5 * 60_000;

/**
 * Fired on `window` when this tab changes a reminder, so the scheduler re-plans
 * immediately instead of waiting out a heartbeat. Setting a reminder for two
 * minutes' time and having it arrive in two minutes is the whole product; a
 * five-minute lag on your own action would read as broken.
 */
export const REMINDERS_CHANGED = 'zb:reminders-changed';

/** Announce a local reminder change. No-op on the server. */
export function announceReminderChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REMINDERS_CHANGED));
}

export function isFresh(remindAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(remindAt);
  return !Number.isNaN(t) && now.getTime() - t <= FRESH_WINDOW_MS;
}

/**
 * Split pending reminders into the ones to deliver now and the ones to wait
 * for. Rows are assumed already filtered to "has a reminder, not delivered,
 * not done" by the query — this is only the clock's half of the decision.
 */
export function partitionDue<T extends { remind_at?: string | null }>(
  rows: T[],
  now: Date = new Date(),
): { due: T[]; upcoming: T[] } {
  const t = now.getTime();
  const due: T[] = [];
  const upcoming: T[] = [];
  for (const r of rows) {
    const at = r.remind_at ? Date.parse(r.remind_at) : NaN;
    if (Number.isNaN(at)) continue;
    (at <= t ? due : upcoming).push(r);
  }
  return { due, upcoming };
}

/**
 * How long to sleep before looking again.
 *
 * One timer does both jobs — waking for the next reminder and re-checking
 * periodically — because two timers would be two things to get wrong. Capped
 * at `HEARTBEAT_MS` so that a reminder set on another device is picked up
 * within five minutes even if realtime never delivers, and so the delay never
 * approaches setTimeout's 32-bit ceiling (~24.9 days), past which it fires
 * immediately and would spin.
 */
export function nextWakeMs(nextRemindAt: string | null | undefined, now: Date = new Date()): number {
  if (!nextRemindAt) return HEARTBEAT_MS;
  const at = Date.parse(nextRemindAt);
  if (Number.isNaN(at)) return HEARTBEAT_MS;
  return Math.max(0, Math.min(HEARTBEAT_MS, at - now.getTime()));
}

// ── The out-of-app delivery channel (§7O) ──────────────────────────────────
//
// The in-app scheduler only speaks while a tab is open. A reminder set for
// 07:00 that you only hear about when you next open the laptop is not a
// reminder. The worker (app/api/cron/reminders) is the other channel, and it
// runs the SAME claim — which is the whole reason 0031 stored `reminded_at`
// rather than a boolean: two independent deliverers, one winner, no schema
// change (see the migration's header).

/**
 * How late a reminder may be and still be worth emailing about.
 *
 * Two hours. The problem this solves is the returning user: come back from a
 * week away and a naive worker sends forty emails at once for moments that
 * stopped mattering days ago. Anything older than this is left ALONE by the
 * worker — not claimed, not silently swallowed — so the in-app scheduler still
 * puts it in the bell the next time the app is opened. Nothing is lost; it just
 * does not arrive by email long after the fact.
 */
export const WORKER_MAX_LATE_MS = 2 * 60 * 60_000;

/** A reminder as the worker needs it to write an email. */
export type ReminderDigestItem = { id: string; title: string; remind_at: string };

/**
 * Which of a batch the worker should deliver now.
 *
 * `due` is what to claim and email; everything else is deliberately untouched.
 */
export function workerDeliverable<T extends { remind_at?: string | null }>(
  rows: T[],
  now: Date = new Date(),
): T[] {
  const floor = now.getTime() - WORKER_MAX_LATE_MS;
  return rows.filter((r) => {
    const at = r.remind_at ? Date.parse(r.remind_at) : NaN;
    return !Number.isNaN(at) && at <= now.getTime() && at >= floor;
  });
}

/**
 * ONE email per user per run, never one per reminder.
 *
 * Three reminders coming due in the same minute is one moment, not three, and
 * §7O's entire argument is that notifications are how calm products become
 * anxious ones. The subject names the single task when there is one and counts
 * them when there are more, because "Reminder" alone is a subject line you have
 * to open to understand.
 *
 * No times in the body: this runs on a server whose zone is UTC and whose
 * locale is not the reader's, the same reason `claimReminder` writes no clock
 * into the notification row.
 */
export function reminderEmail(
  items: ReminderDigestItem[],
  origin: string,
): { subject: string; text: string } | null {
  if (!items.length) return null;
  const subject = items.length === 1 ? `Reminder: ${items[0].title}` : `${items.length} reminders`;
  const lines = items.map((i) => `• ${i.title}\n  ${origin}/tasks?task=${i.id}`);
  return {
    subject,
    text: `${items.length === 1 ? 'A reminder you set:' : 'Reminders you set:'}\n\n${lines.join('\n\n')}\n`,
  };
}

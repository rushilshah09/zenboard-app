// The recurrence contract — the single source of truth for what "repeats"
// means in Zenboard (MASTER_PRODUCT_PLAN §7B). Pure date math, no I/O, fully
// unit-tested in lib/recurrence.test.ts. The write side (toggleTask) and the
// parse side (lib/task-parse.ts) both depend on this module, never on their
// own arithmetic.
//
// The contract, in prose (also rendered on the Automations page):
// 1. Completing a recurring task spawns the NEXT occurrence — exactly once
//    (the completed row is stamped `spawned: true`).
// 2. `every` = fixed cadence: occurrences sit on a grid anchored at the
//    task's scheduled date ("every friday" stays on Fridays even if you
//    completed late). `every!` = after completion: the cadence restarts from
//    the day you actually did it ("water plants every! 3 days").
// 3. One live instance max: the next occurrence is always strictly AFTER
//    both the anchor and the completion day — completing an overdue daily
//    task never back-fills missed days.
// 4. Recurrence governs scheduled_date only. due_date does not repeat;
//    subtasks and the ★ highlight do not carry over. Notes, project,
//    section, goal and labels do.
// 5. Un-completing a task does not retract the occurrence it spawned.

export type RecurrenceFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export type Recurrence = {
  freq: RecurrenceFreq;
  /** Every N units (default 1). Ignored for `weekdays`. */
  interval?: number;
  /** Weekly only: anchor weekday, 0–6 Sun–Sat ("every friday" → 5). */
  byday?: number;
  /** Monthly only: anchor day-of-month 1–31, clamped to short months. */
  bymonthday?: number;
  /** true = `every!` — cadence restarts from the completion day. */
  afterCompletion?: boolean;
  /** Stamped on a completed instance once its successor row exists. */
  spawned?: boolean;
};

const FREQS: RecurrenceFreq[] = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'];

/** Validate a recurrence jsonb from the DB. Legacy `{ freq: 'weekly' }` rows
 *  (and rows with a stray `spawned` flag) pass through unchanged. */
export function parseRecurrence(raw: unknown): Recurrence | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.freq !== 'string' || !FREQS.includes(r.freq as RecurrenceFreq)) return null;
  const out: Recurrence = { freq: r.freq as RecurrenceFreq };
  if (typeof r.interval === 'number' && Number.isInteger(r.interval) && r.interval >= 2) out.interval = r.interval;
  if (typeof r.byday === 'number' && r.byday >= 0 && r.byday <= 6) out.byday = r.byday;
  if (typeof r.bymonthday === 'number' && r.bymonthday >= 1 && r.bymonthday <= 31) out.bymonthday = r.bymonthday;
  if (r.afterCompletion === true) out.afterCompletion = true;
  if (r.spawned === true) out.spawned = true;
  return out;
}

// ---- date helpers (ISO date strings, UTC-anchored — dates are dates, no TZ math) ----

type Ymd = { y: number; m: number; d: number };
const toYmd = (iso: string): Ymd => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const utc = ({ y, m, d }: Ymd) => new Date(Date.UTC(y, m - 1, d));
const iso = (dt: Date) => dt.toISOString().slice(0, 10);
const addDays = (dt: Date, n: number) => { const c = new Date(dt); c.setUTCDate(c.getUTCDate() + n); return c; };
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

/** y/m advanced by n months, day clamped to the target month's length. */
function addMonthsClamped(base: Ymd, n: number, anchorDay: number): Ymd {
  const total = base.y * 12 + (base.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(anchorDay, daysInMonth(y, m)) };
}

export type SpawnResult = {
  /** scheduled_date for the next occurrence. */
  dateISO: string;
  /** Normalized recurrence to store on the next occurrence (anchors like
   *  byday/bymonthday are backfilled from the base date so they stick). */
  recurrence: Recurrence;
};

/**
 * Compute the next occurrence after completing a recurring task.
 *
 * @param rec          the task's recurrence (already validated)
 * @param baseISO      the completed task's scheduled_date (null = inbox task)
 * @param completedISO the day the task was completed (user-local date)
 *
 * Fixed cadence (`every`): the next grid point strictly after
 * max(base, completed). After-completion (`every!`): completion + cadence.
 * Either way the result is always strictly in the future relative to the
 * completion day — occurrences never stack.
 */
export function nextOccurrence(rec: Recurrence, baseISO: string | null, completedISO: string): SpawnResult | null {
  if (rec.spawned) return null;
  const interval = rec.interval ?? 1;
  const completed = utc(toYmd(completedISO));
  // An inbox/unscheduled recurring task has no grid — anchor on completion.
  const anchor = utc(toYmd(rec.afterCompletion ? completedISO : (baseISO ?? completedISO)));
  const floor = rec.afterCompletion ? completed : new Date(Math.max(anchor.getTime(), completed.getTime()));
  const next: Recurrence = { ...rec };
  delete next.spawned;

  let result: Date;
  switch (rec.freq) {
    case 'daily': {
      const step = interval;
      // First grid point (anchor + k·step) strictly after floor.
      const gap = Math.floor((floor.getTime() - anchor.getTime()) / 86400000);
      result = addDays(anchor, (Math.floor(gap / step) + 1) * step);
      break;
    }
    case 'weekdays': {
      result = addDays(floor, 1);
      const dow = result.getUTCDay();
      if (dow === 6) result = addDays(result, 2); // Sat → Mon
      else if (dow === 0) result = addDays(result, 1); // Sun → Mon
      break;
    }
    case 'weekly': {
      const byday = rec.byday ?? anchor.getUTCDay();
      next.byday = byday;
      // Snap the anchor forward to its weekday, then walk the weekly grid.
      let start = anchor;
      if (start.getUTCDay() !== byday) start = addDays(start, (byday - start.getUTCDay() + 7) % 7);
      const step = 7 * interval;
      const gap = Math.floor((floor.getTime() - start.getTime()) / 86400000);
      const k = gap < 0 ? 0 : Math.floor(gap / step) + 1;
      result = addDays(start, k * step);
      if (result.getTime() <= floor.getTime()) result = addDays(result, step);
      break;
    }
    case 'monthly': {
      const anchorYmd = toYmd(iso(anchor));
      const anchorDay = rec.bymonthday ?? anchorYmd.d;
      next.bymonthday = anchorDay;
      let n = interval;
      let cand = addMonthsClamped(anchorYmd, n, anchorDay);
      while (utc(cand).getTime() <= floor.getTime()) { n += interval; cand = addMonthsClamped(anchorYmd, n, anchorDay); }
      result = utc(cand);
      break;
    }
    case 'yearly': {
      const a = toYmd(iso(anchor));
      let n = interval;
      const cand = (k: number): Ymd => ({ y: a.y + k, m: a.m, d: Math.min(a.d, daysInMonth(a.y + k, a.m)) });
      let c = cand(n);
      while (utc(c).getTime() <= floor.getTime()) { n += interval; c = cand(n); }
      result = utc(c);
      break;
    }
  }
  return { dateISO: iso(result), recurrence: next };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Human label for a recurrence — chip text and detail views. Sentence case. */
export function describeRecurrence(rec: Recurrence): string {
  const interval = rec.interval ?? 1;
  let s: string;
  switch (rec.freq) {
    case 'daily': s = interval === 1 ? 'Every day' : `Every ${interval} days`; break;
    case 'weekdays': s = 'Weekdays'; break;
    case 'weekly':
      if (rec.byday != null) s = interval === 1 ? `Every ${DAY_NAMES[rec.byday]}` : `Every ${interval} weeks on ${DAY_NAMES[rec.byday]}`;
      else s = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
      break;
    case 'monthly': s = interval === 1 ? 'Every month' : `Every ${interval} months`; break;
    case 'yearly': s = interval === 1 ? 'Every year' : `Every ${interval} years`; break;
  }
  return rec.afterCompletion ? `${s} after done` : s;
}

// THE capacity rule — master plan §7C, "does the plan fit the day?"
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// It did not, and three surfaces answered the question anyway, differently:
//
//   today-view.tsx   DAY_BUDGET = 8 * 60      "a manageable day" / "runs past"
//   week-view.tsx    DAY_CAP    = 360         a green bar that turns red at 6h
//   ritual-flow.tsx  no budget at all         "4h 30m committed" — against what?
//
// So Home called a 7-hour plan comfortable while the Week column beside it drew
// the same day in red. And onboarding asks, in as many words, "When does your
// day end?" — storing the answer in `preferences.dayEnd`, which until now was
// read by NOTHING. The app collected the one number that settles the argument
// and then hardcoded two different guesses instead.
//
// This module is that number, applied once.
//
// ── THE COORDINATE SYSTEM: minutes from midnight ────────────────────────────
// Everything here is minutes-from-local-midnight (14:30 → 870), never an
// instant and never a Date. Work hours are stored as wall-clock strings, so
// comparing an event against them in any other unit means timezone arithmetic
// at every call site — and all three consumers are `'use client'`, which means
// they are SERVER-rendered first, where `getHours()` answers in UTC. That is a
// hydration mismatch for every user outside UTC. Callers convert once, at the
// edge, with `minutesOfDayIn(iso, tz)`; this file then has no timezone at all
// and is exhaustively testable as plain arithmetic.
import { formatMinutes, parseClock, toClock } from '@/lib/date';

/** Work hours as minutes from midnight. `end <= start` means an overnight day. */
export type WorkHours = { start: number; end: number };

/**
 * 9:00–17:00. The end matches onboarding's own default, so a user who accepted
 * the suggested answer and a user who never saw the question get the same day.
 */
export const DEFAULT_WORK_HOURS: WorkHours = { start: 9 * 60, end: 17 * 60 };

/** Where the two halves live in `profiles.preferences`. `dayEnd` predates this. */
export const WORK_HOURS_KEYS = { start: 'dayStart', end: 'dayEnd' } as const;

/**
 * Work hours out of the preferences jsonb, falling back per FIELD.
 *
 * Per field and not per object because onboarding only ever wrote `dayEnd`:
 * someone who set 18:00 there has a stored end and no stored start, and an
 * all-or-nothing fallback would throw their answer away.
 */
export function readWorkHours(preferences: unknown): WorkHours {
  const p = (preferences ?? {}) as Record<string, unknown>;
  return {
    start: parseClock(p[WORK_HOURS_KEYS.start]) ?? DEFAULT_WORK_HOURS.start,
    end: parseClock(p[WORK_HOURS_KEYS.end]) ?? DEFAULT_WORK_HOURS.end,
  };
}

/** Back to the `HH:MM` pair a time input and `updatePreferences` want. */
export function writeWorkHours(h: WorkHours): { dayStart: string; dayEnd: string } {
  return { dayStart: toClock(h.start), dayEnd: toClock(h.end) };
}

/**
 * How long the working day is.
 *
 * An end at or before the start is read as crossing midnight (22:00–06:00 is a
 * real freelance shift) rather than as an error — the alternative is telling a
 * night worker their day is negative, or silently swapping their answer.
 */
export function workMinutes({ start, end }: WorkHours): number {
  return end > start ? end - start : 1440 - start + end;
}

/** The working day as concrete [from, to) spans — two of them when it wraps. */
export function workSpans({ start, end }: WorkHours): [number, number][] {
  return end > start ? [[start, end]] : [[start, 1440], [0, end]];
}

/** An interval on the day, in minutes from midnight. */
export type Span = { start: number; end: number };

export type CapacityTask = {
  id: string;
  title: string;
  estimate_minutes: number | null;
  priority?: 'low' | 'med' | 'high';
  /** The one task that makes today a win — never suggested for deferral. */
  highlight?: boolean;
};

export type Capacity = {
  /** The working day itself. */
  dayMinutes: number;
  /** Meetings, overlaps merged and clipped to the working day. */
  meetingMinutes: number;
  /** Σ estimates of the open tasks that have one. */
  taskMinutes: number;
  /** meetings + tasks. */
  plannedMinutes: number;
  /** What is left of the day. Zero, never negative — see `overMinutes`. */
  freeMinutes: number;
  /** How far past the day the plan runs. Zero when it fits. */
  overMinutes: number;
  /** Open tasks carrying an estimate. */
  estimated: number;
  /** Open tasks carrying none. Counted, never guessed at. */
  unestimated: number;
  fits: boolean;
};

/**
 * Merge overlapping spans and total them, clipped to the working day.
 *
 * TWO deliberate rules live here.
 *
 * MERGED, not summed: two meetings at 10:00–11:00 cost one hour between them,
 * not two. You can only be in one of them. Double-booking is a calendar problem
 * and reporting it as two hours of load would make the capacity line wrong in
 * exactly the situation where a person most needs it to be right.
 *
 * CLIPPED to the working day: a 07:00–10:00 appointment in a 09:00–17:00 day
 * costs one hour of that day, not three. Capacity is measured against hours the
 * user said they work; charging them for the hours they said they don't is how
 * a "your day is impossible" message gets shown to someone whose day is fine.
 */
export function busyMinutes(spans: Span[], hours: WorkHours): number {
  const work = workSpans(hours);
  const clipped: [number, number][] = [];
  for (const s of spans) {
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start) continue;
    for (const [ws, we] of work) {
      const from = Math.max(s.start, ws);
      const to = Math.min(s.end, we);
      if (to > from) clipped.push([from, to]);
    }
  }
  clipped.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const span of clipped) {
    if (cur && span[0] <= cur[1]) cur[1] = Math.max(cur[1], span[1]);
    else { if (cur) total += cur[1] - cur[0]; cur = [span[0], span[1]]; }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

/**
 * The whole answer: what today asks of you, against the day you said you have.
 *
 * MEASURED AGAINST THE WHOLE WORKING DAY, not the part of it that is left.
 * A line that shrinks all afternoon is a countdown clock, and by 16:00 it
 * reports every ordinary day as a catastrophe. A plan is a claim about the
 * whole day, so it is judged against the whole day. "How much time is left
 * right now" is a genuinely different question and belongs to Focus.
 */
export function capacity({ tasks, meetings, hours }: {
  /** OPEN tasks only — a finished task is not asking for time. */
  tasks: CapacityTask[];
  /** Meetings as spans. Timebox twins must already be excluded — see `isTwin`. */
  meetings: Span[];
  hours: WorkHours;
}): Capacity {
  const dayMinutes = workMinutes(hours);
  const meetingMinutes = busyMinutes(meetings, hours);

  let taskMinutes = 0;
  let estimated = 0;
  let unestimated = 0;
  for (const t of tasks) {
    const m = t.estimate_minutes;
    // NEVER invent a default estimate for an unestimated task. That is Motion's
    // mistake — the machine decides your work takes 30 minutes and then judges
    // your day against its own guess. An unestimated task is a fact about the
    // plan ("you have not decided how long this takes"), and it is reported as
    // one.
    if (typeof m === 'number' && Number.isFinite(m) && m > 0) { taskMinutes += m; estimated += 1; }
    else unestimated += 1;
  }

  const plannedMinutes = meetingMinutes + taskMinutes;
  return {
    dayMinutes,
    meetingMinutes,
    taskMinutes,
    plannedMinutes,
    freeMinutes: Math.max(0, dayMinutes - plannedMinutes),
    overMinutes: Math.max(0, plannedMinutes - dayMinutes),
    estimated,
    unestimated,
    fits: plannedMinutes <= dayMinutes,
  };
}

/**
 * What to move, when the plan does not fit. A SUGGESTION — nothing is moved.
 *
 * §7C is explicit that an overloaded day "suggests moving lowest-priority —
 * never auto-moves", and that is the whole difference between this and Motion.
 * Rearranging someone's day for them is the feature people cancel over.
 *
 * THE RULE, in one sentence: the lowest priority tier that has anything
 * movable, longest first, until the overage is covered — and it never crosses
 * into a higher tier.
 *
 * That last clause is the interesting one. A plain greedy "keep taking until it
 * fits" reaches past three low-priority tasks to offer a five-hour high-priority
 * one because the arithmetic was twenty minutes short, which is worse advice
 * than saying nothing. Stopping at the tier boundary can leave the day still
 * over, and that is the honest outcome: the suggestion is a place to start, not
 * a solved equation, and the caller still shows what is left over.
 *
 * The highlight is never offered — it is by definition the one thing that makes
 * today a win, and suggesting it would be the tool arguing with the decision it
 * asked for two steps earlier.
 */
export function deferSuggestion(tasks: CapacityTask[], c: Capacity): CapacityTask[] {
  if (c.fits || c.overMinutes <= 0) return [];
  const RANK = { low: 0, med: 1, high: 2 } as const;
  const rank = (t: CapacityTask) => RANK[t.priority ?? 'med'];
  const movable = tasks
    .filter((t) => !t.highlight && typeof t.estimate_minutes === 'number' && t.estimate_minutes! > 0)
    .sort((a, b) => rank(a) - rank(b) || (b.estimate_minutes ?? 0) - (a.estimate_minutes ?? 0));
  if (movable.length === 0) return [];

  const tier = rank(movable[0]);
  const picked: CapacityTask[] = [];
  let shed = 0;
  for (const t of movable) {
    if (shed >= c.overMinutes || rank(t) !== tier) break;
    picked.push(t);
    shed += t.estimate_minutes ?? 0;
  }
  return picked;
}

/**
 * The line itself — "6h 30m planned in an 8h day".
 *
 * One sentence, stating both numbers, in that order. §7C's own example ("your
 * plan is 9.5h; your day is 7h") reads as a scolding when the day fits, so the
 * shape is kept and the verdict is left to `capacityTone` + the caller's copy.
 */
export function capacityHeadline(c: Capacity): string {
  const day = formatMinutes(c.dayMinutes);
  return `${formatMinutes(c.plannedMinutes)} planned in ${article(day)} ${day} day`;
}

/**
 * "an 8h day", "a 7h day". By SOUND, not by letter — every duration here starts
 * with a digit, so the vowel test that works for words gets this wrong every
 * time. 8, 11 and 18 are the ones that open with a vowel sound.
 */
function article(duration: string): 'a' | 'an' {
  const n = parseInt(duration, 10);
  return n === 8 || n === 11 || n === 18 ? 'an' : 'a';
}

/**
 * How hard the plan is pushing, as a tone rather than a boolean.
 *
 * `full` exists so the calm case and the just-about case are not the same
 * colour: a day planned to 96% is not over, but telling someone it is
 * "manageable" is not true either. Nothing here is ever `danger` — an
 * overloaded day is a planning signal, not an error, and §7O's whole diet
 * argument is that a product which alarms about ordinary days trains people to
 * ignore it.
 */
export type CapacityTone = 'empty' | 'ok' | 'full' | 'over';

export function capacityTone(c: Capacity): CapacityTone {
  if (c.plannedMinutes === 0) return 'empty';
  if (c.overMinutes > 0) return 'over';
  return c.plannedMinutes / Math.max(1, c.dayMinutes) >= 0.9 ? 'full' : 'ok';
}

/** The unestimated tail, as a clause to append — or nothing when there is none. */
export function unestimatedNote(c: Capacity): string | null {
  if (c.unestimated === 0) return null;
  return `${c.unestimated} ${c.unestimated === 1 ? 'task has' : 'tasks have'} no estimate`;
}

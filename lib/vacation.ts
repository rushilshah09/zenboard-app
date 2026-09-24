// Vacation mode — the one rule, master plan §7C and §7O.
//
// Both sections promise it and neither owns it: §7O says "vacation mode
// silences all", §7C says it "pause[s] rituals + habit streaks WITHOUT LOSS".
// Those are three different surfaces reading one fact, so the fact lives here
// rather than in whichever of them was built first.
//
// ── IT IS A DATE, NOT A TOGGLE ──────────────────────────────────────────────
// A vacation switch is the thing you forget to switch back, and a product that
// has been silent for three weeks because of a boolean nobody remembers is
// broken in the way that looks most like working. A date expires by itself.
//
// ── "WITHOUT LOSS" IS THE HARD HALF ─────────────────────────────────────────
// Silencing is easy. The promise that matters is that a week away does not cost
// you a 90-day streak — and, just as importantly, does not *credit* you with
// days you did not do. A vacation day is neither kept nor broken: it is not
// judged at all, which is exactly what `lib/habit-schedule.ts`'s `skipped` set
// already means. That parameter has existed since habits v2 and nothing has
// ever passed anything into it; this is its first real caller.
import { addDaysISO, isoDateIn } from '@/lib/date';

/** Where it lives. Under `digest` because that is where it was first stored. */
export const VACATION_PATH = ['digest', 'vacationUntil'] as const;

/** The last day of the vacation, inclusive — or null when not away. */
export function readVacationUntil(preferences: unknown): string | null {
  const root = (preferences ?? {}) as Record<string, unknown>;
  const d = (root[VACATION_PATH[0]] ?? {}) as Record<string, unknown>;
  const v = d[VACATION_PATH[1]];
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * Is this day inside the vacation?
 *
 * Inclusive of the last day: someone who says "back on the 12th" means the 11th
 * is still theirs. Off-by-one here is a nagging notification on a holiday.
 */
export function onVacation(dayISO: string, until: string | null): boolean {
  return !!until && dayISO <= until;
}

/** The last day covered by `days` days off starting today. Null for nonsense. */
export function vacationThrough(today: string, days: number): string | null {
  if (!Number.isFinite(days) || days < 1) return null;
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() + Math.floor(days) - 1);
  return isoDateIn(d)!;
}

/**
 * Every vacation day inside a window, as the day ids the streak walk skips.
 *
 * Bounded by the window the caller already has (habits fetch 120 days), so a
 * mis-set vacation five years out cannot make this loop forever — the guard is
 * the window, not a trusted date.
 */
export function vacationDaysIn(fromISO: string, toISO: string, until: string | null): string[] {
  if (!until || toISO < fromISO) return [];
  const out: string[] = [];
  let cursor = fromISO;
  while (cursor <= toISO) {
    if (cursor <= until) out.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return out;
}

/**
 * Should a ritual prompt appear today?
 *
 * §7C: rituals are "skippable (we're calm, not Sunsama-strict)" but Home still
 * shows one quiet prompt on an unplanned day. On vacation there is no unplanned
 * day to be quiet about — the whole point is that today is not a work day, and
 * a "plan your day?" nudge on a beach is the product failing to hear its own
 * setting. The RITUAL ITSELF stays reachable: someone who wants to plan a day
 * mid-holiday is not stopped, they are simply not asked.
 */
export function ritualPromptsAllowed(dayISO: string, until: string | null): boolean {
  return !onVacation(dayISO, until);
}

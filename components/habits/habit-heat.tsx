'use client';
// The habit heat grid — §7G's "calendar heat", in the app's monochrome language.
//
// The rule that shapes it: **a missed day is a gray dot, not a broken chain.**
// So there is no red, no fire, no "you lost your streak". Five states, and only
// one of them is loud:
//   done      → ink fill        (the only thing that draws the eye)
//   skipped   → hollow ring     (deliberate, not a failure)
//   missed    → faint fill      (quiet — present, unjudged)
//   off       → nothing at all  (the habit wasn't DUE — a Mon/Wed/Fri habit has
//                                no Tuesday to miss; see lib/habit-schedule.ts)
//   before    → nothing at all  (a habit created on Tuesday has no Monday miss)
//
// `off` is the state this grid was missing. Without it every schedule looked
// daily, so a weekday habit drew two "missed" cells every single week of a
// perfect record — the grid was inventing failures.
//
// Weeks run left→right, days top→bottom (Sun…Sat), the way a calendar reads.
import { cn } from '@/lib/cn';
import { formatDay, startOfWeek } from '@/lib/date';
import { isDue, DAILY, type HabitSchedule } from '@/lib/habit-schedule';

export type HeatDay = 'done' | 'skipped' | 'missed' | 'off' | 'before';

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Build the grid: `weeks` columns of 7, ending on `endISO` (inclusive). */
export function buildHeat(opts: {
  endISO: string;
  weeks: number;
  doneDates: string[];
  skippedDates: string[];
  createdAt: string | null;
  /** Defaults to daily, so callers that predate schedules keep working. */
  schedule?: HabitSchedule;
}): { date: string; state: HeatDay }[][] {
  const done = new Set(opts.doneDates);
  const skipped = new Set(opts.skippedDates);
  const born = opts.createdAt ? opts.createdAt.slice(0, 10) : null;
  const schedule = opts.schedule ?? DAILY;

  // Walk forward to the END of the last visible week, so columns are real
  // calendar weeks rather than an arbitrary 7-day slice. The week boundary is
  // the app's (lib/date.ts), not Sunday — the heat map sits beside a Monday-
  // first calendar, and two week starts on one screen is the bug this fixes.
  const end = new Date(`${opts.endISO}T00:00:00`);
  const endOfWeek = new Date(startOfWeek(end));
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const start = new Date(endOfWeek);
  start.setDate(start.getDate() - (opts.weeks * 7 - 1));

  const cols: { date: string; state: HeatDay }[][] = [];
  for (let w = 0; w < opts.weeks; w++) {
    const col: { date: string; state: HeatDay }[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(cur.getDate() + w * 7 + d);
      const key = iso(cur);
      let state: HeatDay;
      if (key > opts.endISO || (born && key < born)) state = 'before';
      else if (done.has(key)) state = 'done';
      else if (skipped.has(key)) state = 'skipped';
      // Not due, or judged by the week rather than the day: not a miss.
      else if (!isDue(schedule, key) || schedule.kind === 'weekly') state = 'off';
      else state = 'missed';
      col.push({ date: key, state });
    }
    cols.push(col);
  }
  return cols;
}

const CELL: Record<HeatDay, string> = {
  done: 'bg-ink-700',
  skipped: 'border border-line-strong',
  missed: 'bg-surface-fill',
  off: 'bg-transparent',
  before: 'bg-transparent',
};
const WORD: Record<HeatDay, string> = {
  done: 'done', skipped: 'skipped', missed: 'not done', off: 'not scheduled', before: '',
};

export function HabitHeat({ weeks, className }: {
  weeks: { date: string; state: HeatDay }[][];
  className?: string;
}) {
  const done = weeks.flat().filter((d) => d.state === 'done').length;
  return (
    <div className={cn('flex gap-[3px]', className)} role="img"
      aria-label={`Activity over the last ${weeks.length} weeks: ${done} days done`}>
      {weeks.map((col, w) => (
        <div key={w} className="flex flex-col gap-[3px]">
          {col.map((cell) => (
            <span
              key={cell.date}
              // `title` is the whole tooltip: the grid is decorative in
              // aggregate (one aria-label above) and precise on hover.
              title={cell.state === 'before' ? undefined : `${formatDay(cell.date)} — ${WORD[cell.state]}`}
              className={cn('size-2 shrink-0 rounded-[2px]', CELL[cell.state])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

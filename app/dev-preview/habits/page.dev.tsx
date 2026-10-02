'use client';
// Dev-only harness for the Habits module — staged habits across times of day,
// REPEAT SCHEDULES and goals, plus a skipped one, so the grouping, the
// complete/skip/count controls, the "not scheduled today" disclosure, the
// schedule labels and the add/edit forms can all be verified without a session.
//
// Every number here comes from lib/habit-schedule.ts, the same module the loader
// uses, so the harness cannot drift from production behaviour — and the weekday
// habit is the case that proves the point: a perfect Mon/Wed/Fri record must read
// 100% and an unbroken streak, not 43% and a broken one.
//
// Server actions error on persist here; optimistic UI is what's under test.
// 404s in prod.
import { notFound } from 'next/navigation';
import { HabitsJournal } from '@/components/habits/habits-board';
import type { HabitsBoard, BoardHabit, HabitStatus, TrailDay } from '@/lib/habits-data';
import {
  isDue, currentStreak, bestStreak, consistency, weekdayOf, type HabitSchedule,
} from '@/lib/habit-schedule';
import { todayISO, addDaysISO } from '@/lib/date';

const TODAY = todayISO();
const BORN = addDaysISO(TODAY, -118);

// A deterministic pseudo-random history: `rate` is the rough hit rate on the days
// the habit is actually DUE, and `seed` keeps each grid stable across renders (a
// random one would reshuffle on every keystroke and make the heat map impossible
// to eyeball).
function history(schedule: HabitSchedule, seed: number, rate: number, days = 120) {
  const doneDates: string[] = [];
  const skippedDates: string[] = [];
  let x = seed * 9301 + 49297;
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  for (let i = days - 1; i >= 1; i--) {
    const day = addDaysISO(TODAY, -i);
    if (day < BORN) continue;
    if (!isDue(schedule, day)) continue;
    const r = rnd();
    if (r < rate) doneDates.push(day);
    else if (r < rate + 0.06) skippedDates.push(day);
  }
  return { doneDates, skippedDates };
}

/** Today's seven-day trail, derived rather than hand-written — a hand-written
 *  one drifts from the schedule the moment either changes. */
function trail(schedule: HabitSchedule, done: Set<string>, skipped: Set<string>): TrailDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDaysISO(TODAY, i - 6);
    if (done.has(d)) return 'done';
    if (skipped.has(d)) return 'skipped';
    if (d < BORN) return 'off';
    if (!isDue(schedule, d) || schedule.kind === 'weekly') return 'off';
    return 'missed';
  });
}

function habit(
  id: string, title: string, timeOfDay: BoardHabit['timeOfDay'],
  status: HabitStatus, seed: number, rate: number,
  schedule: HabitSchedule = { kind: 'daily' },
  goalTarget = 1,
  count = status === 'done' ? goalTarget : 0,
): BoardHabit {
  const h = history(schedule, seed, rate);
  const done = new Set(h.doneDates);
  const skipped = new Set(h.skippedDates);
  if (status === 'done') done.add(TODAY);
  if (status === 'skipped') skipped.add(TODAY);

  const streak = currentStreak(schedule, TODAY, done, skipped, BORN);
  const best = bestStreak(schedule, TODAY, done, skipped, BORN);
  const weekStartISO = addDaysISO(TODAY, -weekdayOf(TODAY));
  let weekDone = 0;
  for (let i = 0; i < 7; i++) if (done.has(addDaysISO(weekStartISO, i))) weekDone++;

  return {
    id, title, timeOfDay, schedule, goalTarget, color: null,
    status, count, due: isDue(schedule, TODAY),
    streak: streak.value, streakUnit: streak.unit,
    last7: trail(schedule, done, skipped),
    doneDates: [...done], skippedDates: [...skipped],
    bestStreak: best.value,
    consistency30: consistency(schedule, TODAY, done, skipped, BORN).pct,
    createdAt: new Date(`${BORN}T09:00:00`).toISOString(),
    weekDone, weekTarget: schedule.kind === 'weekly' ? schedule.count : 0,
  };
}

const BOARD: HabitsBoard = {
  date: TODAY,
  today: TODAY,
  supported: true,
  error: false,
  habits: [
    habit('h1', 'Morning walk', 'morning', 'done', 3, 0.72),
    habit('h2', 'Meditate', 'morning', 'none', 11, 0.85),
    // The counted goal: 8 glasses, 3 logged so far — the case a checkbox could
    // never express.
    habit('h3', 'Drink water', 'afternoon', 'partial', 7, 0.55, { kind: 'daily' }, 8, 3),
    // THE case this pass exists for. Kept perfectly on its own days; before the
    // schedule was real this showed two invented misses every week.
    habit('h4', 'Strength training', 'afternoon', 'none', 31, 0.95, { kind: 'days', days: [1, 3, 5] }),
    habit('h5', 'No screens after 10pm', 'evening', 'skipped', 19, 0.31),
    habit('h6', 'Read 20 minutes', 'evening', 'done', 5, 0.93),
    // Judged by the week, so no single day of it can be a miss.
    habit('h7', 'Long run', 'any', 'none', 23, 0.6, { kind: 'weekly', count: 3 }),
    // Weekend-only, so on a weekday it lands in "not scheduled today".
    habit('h8', 'Call family', 'any', 'none', 41, 0.8, { kind: 'days', days: [0, 6] }),
  ],
};

export default function HabitsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)', overflowY: 'auto' }}>
      <HabitsJournal board={BOARD} />
    </div>
  );
}

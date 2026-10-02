'use client';
// Habits: the product's own Habits journal. Every number is computed by lib/habit-schedule.ts, the module
// the app's loader uses, from a steady pseudo-random history (the same seed every visit, so the grid is
// the same picture every time).
import * as React from 'react';
import { HabitsJournal } from '@/components/habits/habits-board';
import type { BoardHabit, HabitStatus, HabitsBoard, TrailDay } from '@/lib/habits-data';
import { bestStreak, consistency, currentStreak, isDue, weekdayOf, type HabitSchedule } from '@/lib/habit-schedule';
import { addDaysISO, todayISO } from '@/lib/date';

function board(): HabitsBoard {
  const TODAY = todayISO();
  const BORN = addDaysISO(TODAY, -118);
  const history = (schedule: HabitSchedule, seed: number, rate: number) => {
    const doneDates: string[] = [];
    const skippedDates: string[] = [];
    let x = seed * 9301 + 49297;
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    for (let i = 119; i >= 1; i--) {
      const day = addDaysISO(TODAY, -i);
      if (day < BORN || !isDue(schedule, day)) continue;
      const r = rnd();
      if (r < rate) doneDates.push(day);
      else if (r < rate + 0.06) skippedDates.push(day);
    }
    return { doneDates, skippedDates };
  };
  const trail = (schedule: HabitSchedule, done: Set<string>, skipped: Set<string>): TrailDay[] =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDaysISO(TODAY, i - 6);
      if (done.has(d)) return 'done';
      if (skipped.has(d)) return 'skipped';
      if (d < BORN || !isDue(schedule, d) || schedule.kind === 'weekly') return 'off';
      return 'missed';
    });
  const habit = (
    id: string, title: string, timeOfDay: BoardHabit['timeOfDay'], status: HabitStatus, seed: number, rate: number,
    schedule: HabitSchedule = { kind: 'daily' }, goalTarget = 1, count = status === 'done' ? goalTarget : 0,
  ): BoardHabit => {
    const h = history(schedule, seed, rate);
    const done = new Set(h.doneDates);
    const skipped = new Set(h.skippedDates);
    if (status === 'done') done.add(TODAY);
    if (status === 'skipped') skipped.add(TODAY);
    const streak = currentStreak(schedule, TODAY, done, skipped, BORN);
    const weekStart = addDaysISO(TODAY, -weekdayOf(TODAY));
    let weekDone = 0;
    for (let i = 0; i < 7; i++) if (done.has(addDaysISO(weekStart, i))) weekDone++;
    return {
      id, title, timeOfDay, schedule, goalTarget, color: null, status, count, due: isDue(schedule, TODAY),
      streak: streak.value, streakUnit: streak.unit, last7: trail(schedule, done, skipped),
      doneDates: [...done], skippedDates: [...skipped], bestStreak: bestStreak(schedule, TODAY, done, skipped, BORN).value,
      consistency30: consistency(schedule, TODAY, done, skipped, BORN).pct,
      createdAt: new Date(`${BORN}T09:00:00`).toISOString(),
      weekDone, weekTarget: schedule.kind === 'weekly' ? schedule.count : 0,
    };
  };
  return {
    date: TODAY, today: TODAY, supported: true, error: false,
    habits: [
      habit('h-walk', 'Morning walk', 'morning', 'done', 3, 0.72),
      habit('h-inbox', 'Inbox to zero', 'morning', 'none', 11, 0.7),
      habit('h-water', 'Drink water', 'afternoon', 'partial', 7, 0.55, { kind: 'daily' }, 8, 3),
      habit('h-strength', 'Strength training', 'afternoon', 'none', 31, 0.95, { kind: 'days', days: [1, 3, 5] }),
      habit('h-screens', 'No screens after 10pm', 'evening', 'none', 19, 0.4),
      habit('h-read', 'Read 20 minutes', 'evening', 'none', 5, 0.8),
      habit('h-run', 'Long run', 'any', 'none', 23, 0.6, { kind: 'weekly', count: 3 }),
    ],
  };
}

export default function HabitsDemo() {
  const b = React.useMemo(() => board(), []);
  return <HabitsJournal board={b} />;
}

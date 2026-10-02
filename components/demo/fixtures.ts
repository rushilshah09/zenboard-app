// ── THE DEMO'S STUDIO ───────────────────────────────────────────────────────
//
// One sample business the whole demo is about, so every view agrees with every other: Alex Moreau runs
// Northlight Studio, a small design studio, for three clients — Ridgeline (Priya Nair), Beacon Health
// (Daniel Okafor) and Copper Row (Maya Chen) — and keeps a project for their own life beside the work.
// The names are made up; none is a real client (site.test.ts holds the list of names never to use).
//
// Every row is in the TYPE the real view takes, built by the same projections the app's loaders run
// (`waitingOn`, `contentToday`, the meeting spans), so a view here is fed exactly what it is fed in the
// product. Dates are relative to the visitor's today, computed in their browser: the demo renders on
// the client only (demo-entry.tsx), so there is no server clock to disagree with.

import type { TodayEvent, TodayHabit, TodayTask, ProjectChip } from '@/components/today/today-view';
import type { Span } from '@/lib/capacity';
import { contentToday, type Piece } from '@/lib/content';
import { minutesOfDayIn, todayISO } from '@/lib/date';
import { isTwin } from '@/lib/timebox';
import { waitingOn } from '@/lib/waiting';

export const PERSON = { name: 'Alex Moreau', first: 'Alex', email: 'alex@northlight.studio', studio: 'Northlight Studio' } as const;

/** The projects, with the product's own scope colours (lib/entity-color.ts). */
export const PROJECTS: Record<string, ProjectChip> = {
  'p-ridgeline': { id: 'p-ridgeline', name: 'Ridgeline rebrand', color: 'plum' },
  'p-beacon': { id: 'p-beacon', name: 'Beacon Health site', color: 'blue' },
  'p-copper': { id: 'p-copper', name: 'Copper Row menus', color: 'amber' },
  'p-life': { id: 'p-life', name: 'Life', color: 'sage' },
};
export const CLIENT_OF: Record<string, string | null> = {
  'p-ridgeline': 'Ridgeline', 'p-beacon': 'Beacon Health', 'p-copper': 'Copper Row', 'p-life': null,
};

/** A time today, in the visitor's own zone, as the ISO string a row carries. */
function at(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
/** A calendar date n days from today, from LOCAL parts (never `toISOString().slice(0, 10)`). */
export function dayFromToday(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Home, as Alex opens it: a real day, full but not overloaded, with one thing clearly first. */
export function homeDay() {
  const today = todayISO();
  const tasks: TodayTask[] = [
    { id: 't-invoice', title: 'Send the Ridgeline invoice', done: false, priority: 'high', highlight: true, estimate_minutes: 15, elapsed_minutes: 0, scheduled_date: today, project_id: 'p-ridgeline', parent_task_id: null, completed_at: null, created_at: at(8), sort_order: 0 },
    { id: 't-logo', title: 'Finish the logo presentation', done: false, priority: 'med', highlight: false, estimate_minutes: 120, elapsed_minutes: 35, scheduled_date: today, project_id: 'p-ridgeline', parent_task_id: null, completed_at: null, created_at: at(8, 5), sort_order: 1 },
    { id: 't-scope', title: 'Reply to Beacon about scope', done: false, priority: 'low', highlight: false, estimate_minutes: 20, elapsed_minutes: 0, scheduled_date: today, project_id: 'p-beacon', parent_task_id: null, completed_at: null, created_at: at(8, 10), sort_order: 2 },
    { id: 't-menu', title: 'Shot list for the new menu', done: false, priority: 'low', highlight: false, estimate_minutes: 30, elapsed_minutes: 0, scheduled_date: today, project_id: 'p-copper', parent_task_id: null, completed_at: null, created_at: at(8, 15), sort_order: 3 },
    { id: 't-review', title: 'Weekly review', done: true, priority: 'low', highlight: false, estimate_minutes: 30, elapsed_minutes: 30, scheduled_date: today, project_id: 'p-life', parent_task_id: null, completed_at: at(8, 40), created_at: at(7), sort_order: 4 },
  ];
  const events: TodayEvent[] = [
    { id: 'e-standup', title: 'Standup with the studio', starts_at: at(9), ends_at: at(9, 25), all_day: false, source: 'google' },
    { id: 'e-ridgeline', title: 'Ridgeline call', starts_at: at(11, 30), ends_at: at(12, 15), all_day: false, source: 'google' },
    { id: 'e-beacon', title: 'Beacon Health, sitemap review', starts_at: at(14), ends_at: at(15), all_day: false, source: 'manual' },
  ];
  // The same projection the loader runs (lib/today-data.ts): what counts as a meeting.
  const meetings: Span[] = events
    .filter((e) => !e.all_day && !!e.ends_at && !isTwin(e))
    .map((e) => ({ start: minutesOfDayIn(e.starts_at), end: minutesOfDayIn(e.ends_at) }))
    .filter((s): s is Span => s.start !== undefined && s.end !== undefined);
  const habits: TodayHabit[] = [
    { id: 'h-walk', title: 'Morning walk', doneToday: true, streak: 12 },
    { id: 'h-inbox', title: 'Inbox to zero', doneToday: false, streak: 4 },
    { id: 'h-read', title: 'Read 20 minutes', doneToday: false, streak: 0 },
  ];
  const waiting = waitingOn({
    approvals: [{ id: 'ap-logo', title: 'Logo, final direction', status: 'awaiting', created_at: daysAgo(2), project_id: 'p-ridgeline' }],
    requests: [{ id: 'rq-sitemap', title: 'Sign-off on the sitemap', body: '', status: 'needs_info', created_at: daysAgo(1), project_id: 'p-beacon' }],
    invoices: [{ id: 'in-018', number: 'INV-018', status: 'sent', due_date: dayFromToday(-3), issue_date: dayFromToday(-33), client_name: 'Copper Row' }],
    clientOf: CLIENT_OF,
  }, today);
  const pieces: Piece[] = [
    { id: 'c-tour', title: 'Studio tour, part one', meta: { stage: 'shoot', bucket: 'piece', shootAt: today, callTime: '16:00', location: 'Studio' } },
  ];
  return { tasks, events, meetings, habits, waiting, content: contentToday(pieces, today) };
}

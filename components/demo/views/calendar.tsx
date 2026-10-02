'use client';
// Calendar: the product's own Calendar in its demo mode (`demoEvents` bypasses fetch and persistence),
// on the studio's week — the same meetings Home counts, the tasks to place, the projects' checkpoints.
import * as React from 'react';
import { CalendarView } from '@/components/calendar/calendar-view';
import type { RailTask } from '@/components/calendar/task-rail';
import type { CalEvent } from '@/lib/calendar';
import type { CalendarMilestone } from '@/lib/milestones';
import { dayFromToday } from '../fixtures';

function at(day: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const ev = (id: string, title: string, day: number, sh: number, sm: number, eh: number, em: number, source: string | null = null): CalEvent =>
  ({ id, title, starts_at: at(day, sh, sm), ends_at: at(day, eh, em), all_day: false, source });
/** The rail's projects: the studio's own, in their scope colours. Module scope, so the calendar's
 *  effect that reads them runs once. */
const PROJECT_RAIL = [
  { id: 'p-ridgeline', name: 'Ridgeline rebrand', color: 'plum' },
  { id: 'p-beacon', name: 'Beacon Health site', color: 'blue' },
  { id: 'p-copper', name: 'Copper Row menus', color: 'amber' },
];
const allDay = (id: string, title: string, day: number): CalEvent => ({ id, title, starts_at: at(day, 0, 0), ends_at: null, all_day: true, source: null });

export default function CalendarDemo() {
  const { events, tasks, milestones } = React.useMemo(() => {
    const events: CalEvent[] = [
      ev('e-standup', 'Standup with the studio', 0, 9, 0, 9, 25, 'google'),
      ev('e-ridgeline', 'Ridgeline call', 0, 11, 30, 12, 15, 'google'),
      ev('e-beacon', 'Beacon Health, sitemap review', 0, 14, 0, 15, 0),
      { ...ev('e-logo', 'Finish the logo presentation', 0, 15, 15, 17, 0, 'timebox'), task_id: 't-logo', task_done: false },
      ev('e-invoice-sweep', 'Invoice sweep', 1, 9, 0, 9, 30),
      ev('e-tasting', 'Copper Row menu tasting', 1, 12, 30, 13, 30, 'google'),
      ev('e-gym', 'Gym', 1, 7, 0, 8, 0, 'google'),
      { ...ev('e-portfolio', 'Portfolio pass', 2, 16, 0, 18, 0), color: 'yellow' },
      ev('e-review', 'Weekly review', 3, 17, 0, 17, 30),
      ev('e-dentist', 'Dentist', 4, 8, 30, 9, 15, 'google'),
      allDay('e-launch', 'Beacon Health beta', 5),
      ev('e-planning', 'Planning, next month', 7, 14, 0, 15, 0),
      ev('e-taxes', 'Quarterly taxes', 10, 9, 0, 10, 0),
    ];
    const tasks: RailTask[] = [
      { id: 't-sitemap', title: 'Sitemap v3 for Beacon Health', estimate_minutes: 90, scheduled_date: dayFromToday(0), is_inbox: false },
      { id: 't-scope', title: 'Reply to Beacon about scope', estimate_minutes: 20, scheduled_date: dayFromToday(0), is_inbox: false },
      { id: 't-brief', title: 'Draft the Copper Row brief', estimate_minutes: null, scheduled_date: null, is_inbox: true },
      { id: 't-receipts', title: 'File September receipts', estimate_minutes: 15, scheduled_date: null, is_inbox: true },
    ];
    const milestones: CalendarMilestone[] = [
      { id: 'ms-signoff', title: 'Design sign-off', done: false, due_date: dayFromToday(2), sort_order: 0, projectId: 'p-ridgeline', projectName: 'Ridgeline rebrand', projectColor: 'plum' },
      { id: 'ms-beta', title: 'Beta to client', done: false, due_date: dayFromToday(5), sort_order: 1, projectId: 'p-beacon', projectName: 'Beacon Health site', projectColor: 'blue' },
      { id: 'ms-kickoff', title: 'Kickoff call', done: true, due_date: dayFromToday(-4), sort_order: 2, projectId: 'p-copper', projectName: 'Copper Row menus', projectColor: 'amber' },
    ];
    return { events, tasks, milestones };
  }, []);
  return <CalendarView demoEvents={events} demoTasks={tasks} demoMilestones={milestones} demoProjects={PROJECT_RAIL} />;
}

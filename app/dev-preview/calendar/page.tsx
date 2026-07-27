'use client';
// Dev-only design playground for the Calendar — renders CalendarView with rich
// staged data (overlaps, all-day, synced/manual mix) so visual work can be
// verified without a session. 404s outside development.
import { notFound } from 'next/navigation';
import { CalendarView } from '@/components/calendar/calendar-view';
import type { CalEvent } from '@/lib/calendar';

function at(dayOffset: number, h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const ev = (id: string, title: string, day: number, sh: number, sm: number, eh: number, em: number, source: string | null = null): CalEvent =>
  ({ id, title, starts_at: at(day, sh, sm), ends_at: at(day, eh, em), all_day: false, source });
const allDay = (id: string, title: string, day: number, source: string | null = null): CalEvent =>
  ({ id, title, starts_at: at(day, 0, 0), ends_at: null, all_day: true, source });

const DEMO: CalEvent[] = [
  // Today — overlap cluster + a long block
  ev('d1', 'Design review', 0, 9, 30, 10, 30),
  ev('d2', 'Standup', 0, 10, 0, 10, 15, 'google'),
  ev('d3', 'Deep work — portal polish', 0, 11, 0, 13, 0),
  ev('d4', 'Coffee with Mira', 0, 15, 0, 15, 45, 'google'),
  allDay('d5', 'Kishu birthday', 0, 'google'),
  // Tomorrow
  ev('t1', 'Client call — Life Studio', 1, 10, 0, 10, 45),
  ev('t2', 'Invoice sweep', 1, 9, 0, 9, 30),
  ev('t3', 'Gym', 1, 7, 0, 8, 0, 'google'),
  // Rest of week
  allDay('w0', 'Ship v0.9', 2),
  ev('w1', 'Portfolio pass', 2, 16, 0, 18, 0),
  ev('w2', 'Weekly review', 3, 17, 0, 17, 30),
  ev('w3', 'Dentist', 4, 8, 30, 9, 15, 'google'),
  ev('w4', 'Hike + brunch', 5, 8, 0, 11, 0),
  // Month spread
  ev('m1', 'Planning — next sprint', 7, 14, 0, 15, 0),
  ev('m2', 'Tax filing', 10, 9, 0, 10, 0),
  allDay('m3', 'Offsite', 12),
  ev('m4', 'Retro', 14, 16, 0, 16, 45, 'google'),
  ev('m5', 'Book club', -3, 19, 0, 20, 0),
  ev('m6', 'Quarterly close', 18, 11, 0, 12, 30),
];

export default function CalendarPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // Mirror the app shell's content container so proportions match the real app.
  return (
    <div style={{ height: '100dvh', display: 'flex', padding: 8, background: 'var(--canvas)' }}>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
        <CalendarView demoEvents={DEMO} />
      </div>
    </div>
  );
}

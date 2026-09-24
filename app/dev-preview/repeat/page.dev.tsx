'use client';
// Dev-only harness for the Repeat editor (§7B's recurrence contract). The chip
// lives in the task drawer, which needs a session; this drives it with props.
//
// The point of this page is the round trip the drawer could not do before: a
// recurrence the PARSER can create ("every! 3 days", "every other friday") has
// to open in the editor showing what it actually is, survive an unrelated edit,
// and read back through the same `describeRecurrence` the export and the parser
// use. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { RepeatChip } from '@/components/task-detail/repeat-chip';
import { describeRecurrence, type Recurrence } from '@/lib/recurrence';

function Case({ title, note, initial, weekdayHint }: {
  title: string; note: string; initial: Recurrence | null; weekdayHint?: number;
}) {
  const [rec, setRec] = useState<Recurrence | null>(initial);
  return (
    <div style={{ display: 'grid', gap: 6, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)' }}>
      <div style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{note}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
        <RepeatChip value={rec} weekdayHint={weekdayHint} onChange={setRec} />
        {/* The stored shape, so a flattening regression is visible rather than
            something you have to open a database to notice. */}
        <code data-shape style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
          {rec ? JSON.stringify(rec) : 'null'}
        </code>
      </div>
      <div data-label style={{ fontSize: 'var(--text-label-size)', color: 'var(--ink-2)' }}>
        {rec ? describeRecurrence(rec) : '—'}
      </div>
    </div>
  );
}

export default function RepeatPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)', padding: 24 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 'var(--text-stat-size)', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)' }}>Repeat</h1>

        <Case title="Nothing set" note="Quiet chip reading “Repeat”. The menu opens on frequency." initial={null} weekdayHint={5} />

        <Case
          title="every! 3 days — what the parser can make"
          note="This is the case the old chip displayed as “Daily”. It must read “Every 3 days after done”, and stay that way after an unrelated edit."
          initial={{ freq: 'daily', interval: 3, afterCompletion: true }}
        />

        <Case
          title="every other friday"
          note="Interval AND weekday together. Changing one must never drop the other."
          initial={{ freq: 'weekly', interval: 2, byday: 5 }}
        />

        <Case
          title="Weekly with no weekday yet"
          note="Switching to Week anchors on the task’s own day (Wednesday here), so “Every week” means something concrete straight away."
          initial={null}
          weekdayHint={3}
        />

        <Case
          title="Weekdays"
          note="No interval to multiply — the interval row is absent, not disabled."
          initial={{ freq: 'weekdays' }}
        />
      </div>
    </div>
  );
}

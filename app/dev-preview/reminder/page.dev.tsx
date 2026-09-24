'use client';
// Dev-only harness for the Remind chip (§7B, migration 0031). The chip lives in
// the task drawer, which reads through the browser client and shows nothing
// without a session — so this drives <ReminderChip> directly with props and
// exercises every state it can be in: nothing set, scheduled, already
// delivered, and the two anchored presets that only appear when the task has a
// timebox block or a future scheduled day.
//
// Delivery itself (claim → toast → bell) is not verifiable here: it needs real
// rows and a real clock. What this page verifies is the surface — the panel's
// grouping, density, the natural-language field, and the keyboard grammar
// Pop now provides. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { ReminderChip } from '@/components/reminders/reminder-chip';
import { reminderPresets } from '@/lib/reminders';
import { formatClock } from '@/lib/date';

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => iso(new Date(Date.now() + n * 86400_000));

function Case({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)' }}>
      <div style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{note}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>{children}</div>
    </div>
  );
}

export default function ReminderPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ReminderPreview />;
}

function ReminderPreview() {
  const [empty, setEmpty] = useState<string | null>(null);
  const [set, setSet] = useState<string | null>(inHours(5));
  const [anchored, setAnchored] = useState<string | null>(null);
  const blockStart = inHours(3);
  const scheduled = inDays(2);
  // Shown as text so the panel's rows can be checked against the rule that
  // produced them without opening a popover.
  const presets = reminderPresets(new Date(), { blockStart, scheduledDate: scheduled });

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 'var(--text-stat-size)', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)' }}>Remind chip</h1>

        <Case title="Nothing set" note="Reads &ldquo;Remind&rdquo;, quiet chip. Panel offers elapsed-time presets only.">
          <ReminderChip remindAt={empty} onSet={setEmpty} onClear={() => setEmpty(null)} />
        </Case>

        <Case title="Scheduled" note="Carries a value, so the chip is active and shows the time. Panel gains &ldquo;Remove reminder&rdquo;.">
          <ReminderChip remindAt={set} onSet={setSet} onClear={() => setSet(null)} />
        </Case>

        <Case title="Delivered" note="Same time, plus a tick — it already spoke. Not a colour, so it reads the same in either theme.">
          <ReminderChip remindAt={inHours(-2)} remindedAt={inHours(-2)} onSet={() => {}} onClear={() => {}} />
        </Case>

        <Case
          title="Anchored to the task"
          note={`Has a timebox at ${formatClock(blockStart)} and is scheduled for ${scheduled}, so the panel leads with a “This task” group.`}
        >
          <ReminderChip
            remindAt={anchored}
            context={{ blockStart, scheduledDate: scheduled }}
            onSet={setAnchored}
            onClear={() => setAnchored(null)}
          />
        </Case>

        <Case title="Tomorrow, far out" note="A reminder that is not today leads with its day.">
          <ReminderChip remindAt={inHours(26)} onSet={() => {}} onClear={() => {}} />
        </Case>

        <div style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)' }}>
          <div style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            What lib/reminders.ts offers right now
          </div>
          <table style={{ width: '100%', fontSize: 'var(--text-small-size)', color: 'var(--ink-2)', borderCollapse: 'collapse' }}>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id} data-preset={p.id}>
                  <td style={{ padding: '3px 8px 3px 0', color: 'var(--text-secondary)' }}>{p.group}</td>
                  <td style={{ padding: '3px 8px 3px 0' }}>{p.label}</td>
                  <td style={{ padding: '3px 0', textAlign: 'right' }} className="num">{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

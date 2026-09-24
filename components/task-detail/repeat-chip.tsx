'use client';
// The Repeat editor — master plan §7B's recurrence contract, made reachable.
//
// THE PROBLEM THIS FIXES. Zenboard already had two thirds of a very good
// recurrence feature and no way to see it:
//
//   · `lib/task-parse.ts` parses the rich forms — "every! 3 days",
//     "every other friday", "every 2 weeks";
//   · `lib/recurrence.ts` honours every one of them, and `describeRecurrence`
//     is THE label for what a recurrence means;
//   · the drawer's chip offered five bare frequencies and rendered them through
//     its own private map.
//
// So a task set to "every 3 days after done" **displayed as "Daily"** — the
// chip said something the task did not do — and picking anything from that chip
// silently flattened interval, weekday and the `every!` flag back to `{ freq }`.
// Rich data you can create and cannot edit is worse than not having it.
//
// BENCHMARK (rule 7). Todoist's recurrence is natural language plus a preset
// list; `every!` is typed syntax with no UI control, so its own power feature is
// invisible in its own editor. Things 3 has the best editor of the three —
// frequency, an interval stepper, a weekday picker, and "after completion" as
// an explicit mode — but no typing path at all. Notion offers frequency +
// interval on a date property. We already had Todoist's parser and a superset of
// Things' engine; this is Things' editor on top, so the two paths produce and
// display exactly the same thing. Where we deliberately differ from all three:
// no end date / occurrence count. §7B freezes the anatomy, and "ends after 12
// times" is a project plan, not a habit.
import * as React from 'react';
import { Repeat } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { Pop, SelectMark, chipClass, popRow, popLabel, POP_ROW_CLASS } from '@/components/task-detail/chip-ui';
import { describeRecurrence, type Recurrence, type RecurrenceFreq } from '@/lib/recurrence';

const FREQS: { id: RecurrenceFreq; label: string; unit: string }[] = [
  { id: 'daily', label: 'Day', unit: 'days' },
  { id: 'weekdays', label: 'Weekday', unit: '' },
  { id: 'weekly', label: 'Week', unit: 'weeks' },
  { id: 'monthly', label: 'Month', unit: 'months' },
  { id: 'yearly', label: 'Year', unit: 'years' },
];

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Intervals worth one tap. Beyond these, the quick-add parser takes any number. */
const INTERVALS = [1, 2, 3, 4];

export function RepeatChip({
  value, weekdayHint, onChange,
}: {
  value: Recurrence | null;
  /** The task's own weekday (from its scheduled date), used when switching to weekly. */
  weekdayHint?: number;
  onChange: (next: Recurrence | null) => void;
}) {
  return (
    <Pop
      width={244}
      label="Repeat"
      trigger={(_o, p) => (
        <button {...p} className={chipClass(!!value)} aria-label={value ? `Repeats: ${describeRecurrence(value)}` : 'Set a repeat'}>
          <Icon icon={Repeat} size={14} />
          {/* THE one label for a recurrence (lib/recurrence.ts). The private map
              that used to live here is why the chip could disagree with the
              export, the parser and the task itself. */}
          {value ? describeRecurrence(value) : 'Repeat'}
        </button>
      )}
    >
      {(close) => <RepeatMenu value={value} weekdayHint={weekdayHint} onChange={onChange} close={close} />}
    </Pop>
  );
}

function RepeatMenu({
  value, weekdayHint, onChange, close,
}: {
  value: Recurrence | null;
  weekdayHint?: number;
  onChange: (next: Recurrence | null) => void;
  close: () => void;
}) {
  const freq = value?.freq ?? null;
  const interval = value?.interval ?? 1;

  // Every edit rebuilds the WHOLE recurrence from the current one, so changing
  // the interval can never drop the weekday and toggling `every!` can never
  // drop the interval — the flattening bug this component exists to fix.
  const patch = (next: Partial<Recurrence>) => {
    if (!value && !next.freq) return;
    const base: Recurrence = value ?? { freq: 'daily' };
    const merged: Recurrence = { ...base, ...next };
    // `interval: 1` is the default and `weekdays` has no interval — storing
    // either would make two equal recurrences compare unequal.
    if (merged.interval === 1 || merged.freq === 'weekdays') delete merged.interval;
    if (merged.freq !== 'weekly') delete merged.byday;
    if (merged.freq !== 'monthly') delete merged.bymonthday;
    // A successor's flag; never something an edit should carry forward.
    delete merged.spawned;
    onChange(merged);
  };

  const pickFreq = (f: RecurrenceFreq) => {
    patch({
      freq: f,
      // Switching to weekly with no weekday yet anchors on the task's own day,
      // so "Every week" immediately means something concrete.
      ...(f === 'weekly' && value?.byday == null && weekdayHint != null ? { byday: weekdayHint } : {}),
    });
  };

  const unit = FREQS.find((f) => f.id === freq)?.unit ?? '';

  return (
    <div>
      <span style={popLabel}>Repeat every</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 6px 6px' }}>
        {FREQS.map((f) => {
          const on = freq === f.id;
          return (
            <button
              key={f.id}
              onClick={() => pickFreq(f.id)}
              aria-pressed={on}
              className={POP_ROW_CLASS}
              style={{
                padding: '5px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer', width: 'auto',
                fontSize: 'var(--text-caption-size)', border: '1px solid var(--line)',
                background: on ? 'var(--nav-active-bg)' : 'var(--paper-3)',
                color: on ? 'var(--text-primary)' : 'var(--ink-2)',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Interval — hidden for `weekdays`, which has no cadence to multiply. */}
      {freq && freq !== 'weekdays' && (
        <>
          <span style={popLabel}>Every {interval === 1 ? unit.replace(/s$/, '') : `${interval} ${unit}`}</span>
          <div style={{ display: 'flex', gap: 4, padding: '2px 6px 6px' }}>
            {INTERVALS.map((n) => {
              const on = interval === n;
              return (
                <button
                  key={n}
                  onClick={() => patch({ interval: n })}
                  aria-pressed={on}
                  aria-label={`Every ${n} ${unit}`}
                  className={POP_ROW_CLASS}
                  style={{
                    minWidth: 30, padding: '5px 0', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    fontSize: 'var(--text-caption-size)', border: '1px solid var(--line)',
                    background: on ? 'var(--nav-active-bg)' : 'var(--paper-3)',
                    color: on ? 'var(--text-primary)' : 'var(--ink-2)',
                  }}
                >
                  <span className="num">{n}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Weekly anchor. Seven 30px targets rather than a dropdown: picking a day
          is the single most common recurrence edit there is. */}
      {freq === 'weekly' && (
        <>
          <span style={popLabel}>On</span>
          <div style={{ display: 'flex', gap: 3, padding: '2px 6px 6px' }}>
            {DAYS.map((d, i) => {
              const on = (value?.byday ?? weekdayHint) === i;
              return (
                <button
                  key={i}
                  onClick={() => patch({ byday: i })}
                  aria-pressed={on}
                  aria-label={DAY_NAMES[i]}
                  style={{
                    width: 30, height: 28, borderRadius: 'var(--r-md)', cursor: 'pointer',
                    fontSize: 'var(--text-caption-size)', border: '1px solid var(--line)',
                    background: on ? 'var(--nav-active-bg)' : 'var(--paper-3)',
                    color: on ? 'var(--text-primary)' : 'var(--ink-2)',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* `every!`. The contract's second clause, and until now unreachable
          except by typing it into quick-add. Worded as what it DOES rather than
          as its syntax — nobody should have to know what a bang means. */}
      {freq && (
        <button
          className={POP_ROW_CLASS}
          style={popRow}
          role="switch"
          aria-checked={!!value?.afterCompletion}
          onClick={() => patch({ afterCompletion: !value?.afterCompletion })}
        >
          <SelectMark on={!!value?.afterCompletion} />
          <span style={{ flex: 1, minWidth: 0 }}>Count from when it&rsquo;s done</span>
        </button>
      )}

      <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 4, paddingTop: 4 }}>
        <button
          className={POP_ROW_CLASS}
          style={{ ...popRow, color: value ? 'var(--ink-2)' : 'var(--text-secondary)' }}
          onClick={() => { onChange(null); close(); }}
        >
          <Icon icon={Repeat} size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          Don&rsquo;t repeat
        </button>
      </div>
    </div>
  );
}

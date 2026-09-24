'use client';
// THE repeat control — how often a habit happens. Rendered by both the
// new-habit modal and the habit detail, so creating and editing a schedule are
// the same act with the same widget.
//
// One control, not two. The reference app splits this into "Repeat" (Daily /
// Weekly / Monthly, then Every Day / specific days) beside "Goal" (N times per
// day / week) — two dropdown pairs that overlap, so "3 times per week" can be
// expressed twice and "every day, 3 times per day" is a fourth combination you
// have to reason about. Here the two questions are separated cleanly and asked
// once each:
//
//   Repeat → WHICH DAYS is it due?     (this component)
//   Goal   → what counts as done ON such a day?  (a plain number beside it)
//
// So a Mon/Wed/Fri habit is a repeat, and "drink water 8 times" is a goal, and
// neither can be written two different ways.
import { Icon, SegmentedControl, TextInput, ToggleGroup, ToggleGroupItem } from '@/components/ds/ui';
import { Info } from '@/components/ds/icons';
import { scheduleLabel, scheduleLongLabel, type HabitSchedule, type ScheduleKind } from '@/lib/habit-schedule';

const KINDS: { value: ScheduleKind; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'days', label: 'Certain days' },
  { value: 'weekly', label: 'Times a week' },
];

// Sunday-first, matching the heat grid's rows and the calendar module.
const DAYS = [
  { d: 0, short: 'S', name: 'Sunday' },
  { d: 1, short: 'M', name: 'Monday' },
  { d: 2, short: 'T', name: 'Tuesday' },
  { d: 3, short: 'W', name: 'Wednesday' },
  { d: 4, short: 'T', name: 'Thursday' },
  { d: 5, short: 'F', name: 'Friday' },
  { d: 6, short: 'S', name: 'Saturday' },
];

export function RepeatPicker({ value, onChange }: {
  value: HabitSchedule;
  onChange: (s: HabitSchedule) => void;
}) {
  // Switching kind keeps a sensible default for the new kind rather than
  // dropping the user into an unusable state (no days picked = due never).
  const setKind = (k: ScheduleKind) => {
    if (k === 'daily') return onChange({ kind: 'daily' });
    if (k === 'weekly') return onChange({ kind: 'weekly', count: value.kind === 'weekly' ? value.count : 3 });
    onChange({ kind: 'days', days: value.kind === 'days' && value.days.length ? value.days : [1, 2, 3, 4, 5] });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <SegmentedControl
        aria-label="How often"
        value={value.kind}
        onValueChange={(v) => setKind(v as ScheduleKind)}
        options={KINDS}
      />

      {value.kind === 'days' && (
        <ToggleGroup
          type="multiple"
          spacing={1}
          aria-label="Days of the week"
          // Radix hands back the selected values as strings.
          value={value.days.map(String)}
          onValueChange={(vals: string[]) => {
            const days = vals.map(Number).sort();
            // Never let the set empty out — a habit due on no day can never be
            // done, and the review would have nothing to measure. Keeping the
            // last day is friendlier than disabling its toggle with no reason
            // given, and `toSchedule` treats an empty set as daily anyway.
            onChange({ kind: 'days', days: days.length ? days : value.days });
          }}
        >
          {DAYS.map((d) => (
            <ToggleGroupItem key={d.d} value={String(d.d)} aria-label={d.name} className="size-8 rounded-md p-0 text-ui">
              {d.short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {value.kind === 'weekly' && (
        <div className="flex items-center gap-2">
          <TextInput
            type="number" min={1} max={7} className="w-16"
            aria-label="Times a week"
            value={String(value.count)}
            onChange={(e) => onChange({ kind: 'weekly', count: Math.min(7, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
          />
          <span className="text-ui text-ink-500">times a week, any days</span>
        </div>
      )}

      {/* What the schedule MEANS for the numbers. Worth one quiet line: it is
          the difference between "you missed Saturday" and "Saturday was never
          yours", and it is the whole reason this control exists. */}
      <p className="flex items-start gap-1.5 text-caption text-ink-500">
        <Icon icon={Info} size={12} className="mt-px shrink-0" />
        <span>
          {value.kind === 'weekly'
            ? `Measured by the week — no single day counts against you.`
            : `${scheduleLabel(value)}. Days it isn’t due never count as missed.`}
          <span className="sr-only"> Schedule: {scheduleLongLabel(value)}.</span>
        </span>
      </p>
    </div>
  );
}

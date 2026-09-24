'use client';
// The capacity line — master plan §7C, rendered once for every surface that
// asks "does the plan fit the day?".
//
// ONE SENTENCE, THREE PLACES. Home states it in prose, the morning ritual draws
// it as a bar you can act on, and the Week board draws seven tiny ones. Before
// this each wrote its own verdict against its own hardcoded day (8h on Home, 6h
// on Week, nothing at all in the ritual), so the same Tuesday could read
// "manageable" on one screen and red on the next. The numbers now come from
// `lib/capacity.ts` and the wording from here.
//
// BENCHMARK (rule 7). Sunsama shows a running total per day and asks you to
// estimate everything — its capacity number is honest but the estimating is
// homework, and it turns an unestimated task into a blocker. Motion goes
// further and schedules the day for you, which is the failure this plan calls
// out by name. Ours does neither: it counts what you have estimated, SAYS how
// many you have not, and offers to move the lowest-priority work — a
// suggestion, one click, never automatic. Linear and Notion have no equivalent;
// Google Calendar's time insights merges overlapping meetings, which is where
// `busyMinutes` gets that rule.
import * as React from 'react';
import { SegmentedProgress } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { formatMinutes } from '@/lib/date';
import { capacityHeadline, capacityTone, unestimatedNote, type Capacity } from '@/lib/capacity';

/**
 * Copy for each tone. Lower case and no dash of its own: this is the second
 * half of `capacityHeadline`'s sentence, joined by an em-dash, so a capital or
 * a second dash makes two sentences fight ("…in an 8h day — A full day — no
 * room left").
 */
function verdict(c: Capacity): string {
  switch (capacityTone(c)) {
    case 'empty': return 'nothing planned yet.';
    case 'over': return `${formatMinutes(c.overMinutes)} more than the day holds.`;
    case 'full': return 'a full day, with no room for surprises.';
    default: return `${formatMinutes(c.freeMinutes)} still free.`;
  }
}

/**
 * The bar. Meetings first because they are the part of the day you cannot move;
 * your own work sits after them, which is also how the day is actually spent.
 */
export function CapacityBar({ c, className }: { c: Capacity; className?: string }) {
  return (
    <SegmentedProgress
      className={className}
      total={c.dayMinutes}
      totalLabel={formatMinutes(c.dayMinutes)}
      segments={[
        { value: c.meetingMinutes, color: 'neutral', label: 'Meetings' },
        { value: c.taskMinutes, color: 'ink', label: 'Tasks' },
      ]}
    />
  );
}

export function CapacityLine({ c, bar = false, className }: {
  c: Capacity;
  /** Draw the bar above the sentence. Home says it in prose; the ritual shows it. */
  bar?: boolean;
  className?: string;
}) {
  const tone = capacityTone(c);
  const note = unestimatedNote(c);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {bar && <CapacityBar c={c} />}
      <p className="text-ui text-ink-500">
        <span className="tabular-nums text-ink-800">{capacityHeadline(c)}</span>
        {' — '}
        {/* Warning, never danger: an overloaded day is a planning signal, and a
            product that alarms about ordinary days teaches people to ignore it
            (§7O's notification diet, applied to a colour). */}
        <span className={tone === 'over' ? 'text-warning-600' : undefined}>{verdict(c)}</span>
        {note && (
          <>
            {' '}
            {/* Stated, never guessed at — see `capacity()`. An unestimated task
                is a fact about the plan, not a gap to fill in with a default. */}
            <span className="text-ink-500">{note}.</span>
          </>
        )}
      </p>
    </div>
  );
}

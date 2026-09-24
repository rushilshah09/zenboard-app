'use client';
// The row control for a habit whose goal is more than once a day.
//
// `goal_target` shipped as a stored, *displayed* number — a row could read
// "3×/day" — while the only control was a binary checkbox. So the goal was
// decorative: there was no way to record two of three, and the review counted
// the day as a flat failure until the third. This is the missing half.
//
// A habit done once a day keeps the plain checkbox. Introducing a stepper for
// the common case would make the ordinary act worse to serve the rare one.
import { Icon } from '@/components/ds/ui';
import { Minus, Plus, Check } from '@/components/ds/icons';
import { cn } from '@/lib/cn';

export function HabitCount({ count, target, title, disabled, onChange }: {
  count: number;
  target: number;
  title: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const complete = count >= target;
  const btn = 'focus-ring grid size-6 shrink-0 place-items-center rounded-sm text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-900 disabled:pointer-events-none disabled:text-ink-500';
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group"
      aria-label={`${title}: ${count} of ${target} done today`}>
      <button type="button" className={btn} disabled={disabled || count === 0}
        onClick={() => onChange(count - 1)} aria-label={`One fewer for ${title}`}>
        <Icon icon={Minus} size={14} />
      </button>
      {/* The tally is the state, so it carries the completion signal rather than
          a separate tick appearing elsewhere on the row. */}
      <span className={cn(
        'inline-flex min-w-[42px] items-center justify-center gap-1 rounded-sm px-1 py-0.5 text-caption tabular-nums transition-colors duration-fast',
        complete ? 'bg-surface-selected font-medium text-ink-900' : 'text-ink-600',
      )}>
        {complete && <Icon icon={Check} size={12} className="shrink-0" />}
        {count}/{target}
      </span>
      <button type="button" className={btn} disabled={disabled || complete}
        onClick={() => onChange(count + 1)} aria-label={`One more for ${title}`}>
        <Icon icon={Plus} size={14} />
      </button>
    </div>
  );
}

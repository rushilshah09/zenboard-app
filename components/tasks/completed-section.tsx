'use client';
// The collapsed "Completed (n)" group that finished tasks settle into.
//
// ONE COMPONENT, EVERY LIST — same argument as `TaskRow` itself. A person
// learns this disclosure once; finding it collapsed on a project and expanded
// on Home, or labelled differently, is the kind of small inconsistency that
// makes an app feel assembled rather than designed.
//
// COLLAPSED BY DEFAULT, and it stays collapsed. What you finished is a record,
// not a working list — the reason to move a completed task out of the way is
// that you are done thinking about it. Expanding is one click and the state is
// per-mount rather than persisted, because a list that reopens with twenty
// struck-through rows has undone the whole point.
//
// The count is on the summary so the section says something useful while shut:
// "Completed (15)" answers "did I do anything today?" without opening it.
import * as React from 'react';
import { ChevronRight } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export function CompletedSection({ count, children, className }: {
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  if (count === 0) return null;

  return (
    <div className={cn('border-t border-line-soft', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        // Names the whole disclosure, not just the word "Completed", so a
        // screen reader announces what is inside before it is opened.
        aria-label={`Completed, ${count} ${count === 1 ? 'task' : 'tasks'}`}
        // --row-group, and the panel inset: this disclosure is list furniture,
        // the same kind of thing as a workstream heading, and it was the third
        // distinct height (36) inside a card whose rows are 36 and whose
        // headings are 32. `px-3` also sat it 4px inside the rows above it.
        className="focus-ring flex h-[var(--row-group)] w-full items-center gap-1.5 px-[var(--panel-px)] text-left text-meta text-ink-500 transition-colors duration-fast hover:text-ink-700"
      >
        <Icon
          icon={ChevronRight}
          size={14}
          aria-hidden
          className={cn('shrink-0 transition-transform duration-fast ease-standard', open && 'rotate-90')}
        />
        <span>Completed</span>
        <span className="tabular-nums">({count})</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

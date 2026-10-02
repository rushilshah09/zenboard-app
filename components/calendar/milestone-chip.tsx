'use client';
// A milestone on the calendar — master plan §7E, the second half of "dated
// checkpoints rendering on Overview + Calendar".
//
// ONE COMPONENT, BOTH GRIDS. Week/day puts these in the all-day lane and Month
// puts them in the cell, but a checkpoint must look identical in both — two
// implementations would drift the moment either grid was touched, and the
// difference between "a marker" and "an event" is exactly the thing that has to
// stay stable.
//
// WHY IT MUST NOT LOOK LIKE AN EVENT. An event is a BLOCK: it owns a span of
// time and is drawn as a filled colour bar. A milestone owns no time at all —
// it is a line on the day saying "this was the date". So it is drawn as a
// marker: no fill, a hairline border, a flag glyph, and the project's colour as
// a 4px dot rather than as a background. On a week with six meetings the
// milestone should read as a different KIND of thing at a glance, not as a
// seventh meeting in a different shade.
//
// BENCHMARK (rule 7). Google Calendar has no milestone concept — an all-day
// event is the closest thing and looks exactly like every other event. Asana's
// timeline draws milestones as diamonds on a Gantt bar, which needs a Gantt.
// Notion calendars render a database row, so a milestone looks like a page.
// Ours is the Asana idea (a distinct glyph that reads as a checkpoint) without
// the Gantt, in a calendar people already use for meetings.
import * as React from 'react';
import { Flag, Check } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { ICON_SIZE } from '@/components/ds/ui/icon';
import { cn } from '@/lib/cn';
import { milestoneState, type CalendarMilestone } from '@/lib/milestones';
import { scopeFill } from '@/lib/entity-color';

export function MilestoneChip({
  milestone, onOpen, compact = false,
}: {
  milestone: CalendarMilestone;
  /** Opens the project the checkpoint belongs to. */
  onOpen: (projectId: string) => void;
  /** Month cells are tighter than the all-day lane. */
  compact?: boolean;
}) {
  const state = milestoneState(milestone);
  const overdue = state === 'overdue';

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}   // never start the grid's create-drag
      onClick={(e) => { e.stopPropagation(); onOpen(milestone.projectId); }}
      title={`${milestone.title}, ${milestone.projectName}`}
      // The whole sentence, because the visible text is only the checkpoint's
      // name and a screen reader user should not have to guess whose it is.
      aria-label={`Milestone: ${milestone.title}, ${milestone.projectName}${milestone.done ? ', done' : overdue ? ', overdue' : ''}`}
      className={cn(
        'focus-ring flex w-full items-center gap-1 truncate [@media(pointer:coarse)]:min-h-6 rounded-md border bg-transparent text-left transition-colors duration-fast',
        compact ? 'px-1 py-px text-caption' : 'px-1.5 py-0.5 text-meta',
        // Overdue is the only state that gets colour, matching the Overview —
        // a calendar full of coloured events can afford exactly one more signal.
        overdue ? 'border-danger-300 text-danger-600 hover:bg-danger-100'
          : milestone.done ? 'border-line-soft text-ink-500 hover:bg-surface-hover'
            : 'border-line text-ink-800 hover:bg-surface-hover',
      )}
    >
      <Icon icon={milestone.done ? Check : Flag} size={ICON_SIZE.xs} className="shrink-0" aria-hidden />
      {/* The project's colour as a dot, never as a fill: it identifies without
          competing with the event blocks below. Omitted when the project has no
          colour rather than substituting a default nobody chose.
          THEME-AWARE, not the stored value (2026-09-30): this painted
          `milestone.projectColor` straight onto the page, and measured on the calendar
          harness it rendered rgb(154,27,111) — --scope-plum's LIGHT value — which stays
          put when the theme flips. scopeFill() snaps a stored hex OR name to the nearest
          scope and hands back `var(--scope-*)`. */}
      {milestone.projectColor && !compact && (
        <span aria-hidden className="size-1 shrink-0 rounded-full" style={{ background: scopeFill(milestone.projectColor) }} />
      )}
      <span className={cn('truncate', milestone.done && 'line-through')}>{milestone.title}</span>
    </button>
  );
}

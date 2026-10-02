'use client';
// THE task card — a task stood up in a board column: the Tasks board, a project's board, the Week board. The row's
// twin (components/tasks/task-row.tsx): the same square box, the same title that opens the task, the same facts
// through `TaskMeta`, and the same one ••• (Open, Highlight, then the surface's own verbs).
//
// There were two. The Tasks board drew a DS card; the Week board drew its own — a priority-ringed CIRCLE for "done",
// three always-on chips that opened hand-rolled popovers (a ghost "Low", "Project" and "Estimate" on every card whose
// fields were unset), a hand-rolled ••• menu, and a title you could not click: a task on the week could be dragged,
// ticked and deleted, but not opened (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 3).
import { useRef } from 'react';
import { Ellipsis, Pencil, Highlight } from '@/components/ds/icons';
import {
  Checkbox, Icon, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  type PriorityLevel,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { TaskMeta } from '@/components/tasks/task-meta';

export type CardTask = {
  id: string; title: string; done: boolean; priority: PriorityLevel; highlight: boolean;
  estimate_minutes: number | null; scheduled_date?: string | null; recurrence?: unknown;
};

export function TaskCard({ task, sub, project, showWhen = true, onToggle, onOpen, onHighlight, menu, dragging = false }: {
  task: CardTask;
  sub?: { done: number; total: number };
  project?: { name: string; color: string | null } | null;
  /** The day it is planned for. Off where the column already says it (a day of the Week board). */
  showWhen?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
  onHighlight?: () => void;
  /** The surface's own verbs, below Open and Highlight. No menu, no ••• (the drag overlay). */
  menu?: React.ReactNode;
  /** Lifted: the drag overlay, or the card standing in for it. */
  dragging?: boolean;
}) {
  // Open hands the keyboard to the task's panel; a closing menu would hand focus back to its trigger and the panel
  // would read that as a dismissal (the same trap TaskRow names).
  const opening = useRef(false);
  return (
    <div data-task-card className={cn(
      'group/card group relative flex gap-2.5 rounded-md border border-line-soft bg-surface-raised px-2.5 py-2 transition-colors duration-fast',
      dragging ? 'shadow-lift-2' : 'hover:border-line-strong',
    )}>
      <Checkbox
        size="sm" checked={task.done} onCheckedChange={() => onToggle?.()}
        aria-label={task.done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
        className="mt-px shrink-0"
      />
      <button type="button" onClick={onOpen} className="focus-ring min-w-0 flex-1 rounded-xs text-left">
        {/* A card is a summary: three lines of title at most; the task itself holds the rest. */}
        <div data-task-card-title className={cn('line-clamp-3 text-ui leading-snug', task.done ? 'text-ink-500 line-through' : 'text-ink-800')}>{task.title}</div>
        {/* The same facts, in the same order and marks, as the task's row in a list — a card is the row stood up. */}
        <TaskMeta layout="card" className="mt-1.5" project={project} priority={task.priority} sub={sub} recurring={!!task.recurrence}
          when={showWhen ? task.scheduled_date : null} estimate={task.estimate_minutes} done={task.done} highlight={task.highlight} />
      </button>
      {menu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-task-card-menu
            aria-label="Task actions"
            // The card is a drag handle; a press on its ••• must open the menu, not lift the card.
            onPointerDown={(e) => e.stopPropagation()}
            className="focus-ring touch-min reveal-on-hover -me-1 -mt-0.5 grid size-6 shrink-0 place-items-center self-start rounded-sm text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900 data-[state=open]:opacity-100"
          >
            <Icon icon={Ellipsis} size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56"
            onCloseAutoFocus={(e) => { if (opening.current) { e.preventDefault(); opening.current = false; } }}>
            {onOpen && <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={() => { opening.current = true; onOpen(); }}>Open</DropdownMenuItem>}
            {onHighlight && (
              <DropdownMenuItem icon={<Icon icon={Highlight} size={16} state={!!task.highlight} />} onSelect={onHighlight}>
                {task.highlight ? 'Remove highlight' : 'Highlight'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

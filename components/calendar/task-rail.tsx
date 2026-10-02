'use client';
// The calendar's task rail — master plan §7D: "Drag task from the rail (Today
// list docked right) onto a slot → twin created with estimate as duration."
//
// This is the ergonomic half of timeboxing. The twin itself already existed
// (0030, lib/timebox.ts) and could be created from the task drawer's Timebox
// chip — but planning a day one drawer at a time is not planning a day. Akiflow
// and Sunsama both sell almost entirely on this one gesture: your list beside
// your calendar, drag, done.
//
// TWO WAYS IN, ALWAYS. Dragging is a pointer gesture, which means it does not
// exist for a keyboard and barely exists for a thumb. Every row therefore also
// carries a slot menu that does exactly the same thing — that menu is the
// keyboard path AND the mobile "schedule at…" affordance §7C asks for, not a
// lesser fallback. The drag is the shortcut for people holding a mouse.
import * as React from 'react';
import { Clock, Plus, GripVertical } from '@/components/ds/icons';
import {
  Icon, EmptyLine, MenuLabel,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { TIMEBOX_SLOTS, timeboxMinutes } from '@/lib/timebox';
import { fmtMinTime, hhmm } from '@/lib/calendar';
import { formatRelativeDay, formatMinutes } from '@/lib/date';

export type RailTask = {
  id: string;
  title: string;
  estimate_minutes: number | null;
  scheduled_date: string | null;
  is_inbox: boolean;
};

/** How far a pointer must travel before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;


export function TaskRail({
  tasks, dayISO, dayLabel, dragging, onDragStart, onSchedule, onOpen,
}: {
  /** Open, un-timeboxed tasks. Already filtered by the caller. */
  tasks: RailTask[];
  /** The day the slot menu schedules into — the grid's anchor, not "today". */
  dayISO: string;
  /** That day, spelled for a human ("Today", "Tomorrow", "12 Aug"). */
  dayLabel: string;
  /** The id currently being dragged onto the grid, if any. */
  dragging: string | null;
  onDragStart: (task: RailTask, pointer: { x: number; y: number }) => void;
  onSchedule: (task: RailTask, startsAtISO: string) => void;
  onOpen: (id: string) => void;
}) {
  const today = tasks.filter((t) => !t.is_inbox);
  const inbox = tasks.filter((t) => t.is_inbox);

  // Scheduling a task REMOVES its row, and the menu it was chosen from tries to
  // hand focus back to a trigger that no longer exists — so focus lands on
  // <body> and the next Tab restarts from the top of the page. Planning a day
  // is scheduling several tasks in a row, so that is not a rare edge; it is the
  // second thing that happens. Focus moves to whatever now occupies that
  // position instead, which makes the next one five keystrokes away too.
  const listRef = React.useRef<HTMLDivElement>(null);
  const restoreAt = React.useRef<number | null>(null);
  const schedule = (task: RailTask, startsAtISO: string) => {
    restoreAt.current = tasks.findIndex((t) => t.id === task.id);
    onSchedule(task, startsAtISO);
  };
  React.useEffect(() => {
    const i = restoreAt.current;
    if (i == null) return;
    restoreAt.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[data-schedule]');
    if (buttons?.length) buttons[Math.min(i, buttons.length - 1)].focus();
    else listRef.current?.focus();   // rail is empty now — land somewhere real
  }, [tasks]);

  return (
    <aside
      className="flex w-[264px] shrink-0 flex-col border-l border-line-soft bg-paper"
      aria-label="Tasks to schedule"
    >
      <div className="flex h-10 shrink-0 items-center px-3">
        <MenuLabel>To schedule</MenuLabel>
      </div>
      <div ref={listRef} tabIndex={-1} className="focus-ring min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tasks.length === 0 ? (
          // §UX empty state: one line, no illustration. An empty rail is a GOOD
          // state — everything planned is on the grid — so it must not read as
          // a failure or an invitation to create work.
          <EmptyLine className="px-1.5 py-3">Nothing left to slot in.</EmptyLine>
        ) : (
          <>
            <Group label="Scheduled" tasks={today} {...{ dayISO, dayLabel, dragging, onDragStart, onOpen }} onSchedule={schedule} />
            <Group label="Inbox" tasks={inbox} {...{ dayISO, dayLabel, dragging, onDragStart, onOpen }} onSchedule={schedule} />
          </>
        )}
      </div>
    </aside>
  );
}

function Group({
  label, tasks, dayISO, dayLabel, dragging, onDragStart, onSchedule, onOpen,
}: {
  label: string; tasks: RailTask[]; dayISO: string; dayLabel: string; dragging: string | null;
  onDragStart: (task: RailTask, pointer: { x: number; y: number }) => void;
  onSchedule: (task: RailTask, startsAtISO: string) => void;
  onOpen: (id: string) => void;
}) {
  if (!tasks.length) return null;
  return (
    <section className="mb-2">
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <MenuLabel>{label}</MenuLabel>
        <span className="text-caption tabular-nums text-ink-500">{tasks.length}</span>
      </div>
      <ul className="flex flex-col gap-px">
        {tasks.map((t) => (
          <RailRow key={t.id} task={t} dayISO={dayISO} dayLabel={dayLabel} dragging={dragging === t.id}
            onDragStart={onDragStart} onSchedule={onSchedule} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function RailRow({
  task, dayISO, dayLabel, dragging, onDragStart, onSchedule, onOpen,
}: {
  task: RailTask; dayISO: string; dayLabel: string; dragging: boolean;
  onDragStart: (task: RailTask, pointer: { x: number; y: number }) => void;
  onSchedule: (task: RailTask, startsAtISO: string) => void;
  onOpen: (id: string) => void;
}) {
  const mins = timeboxMinutes(task.estimate_minutes);

  // A press becomes a drag only after the pointer actually TRAVELS. Without the
  // threshold, every click on a row would start a drag and the row would stop
  // being clickable — the bug that makes drag-and-drop lists feel broken.
  //
  // The move listener goes on the WINDOW, not on the row. On the row it works
  // for a slow, careful drag and silently fails for a quick flick: the pointer
  // can leave the row's box between two move events, so the row never sees the
  // travel and the gesture just… doesn't happen. Pointer capture would fix that
  // too, but capture also redirects the following `click`, which would break
  // opening a task by clicking its title.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const origin = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - origin.x) < DRAG_THRESHOLD && Math.abs(ev.clientY - origin.y) < DRAG_THRESHOLD) return;
      stop();
      onDragStart(task, { x: ev.clientX, y: ev.clientY });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md pl-1 pr-1.5 transition-colors duration-fast',
          dragging ? 'opacity-40' : 'hover:bg-surface-hover',
        )}
        onPointerDown={onPointerDown}
      >
        {/* The grab affordance. Decorative: the row itself is what you drag, and
            the KEYBOARD equivalent is the slot menu on the right, so this must
            not become a tab stop that does nothing. */}
        <Icon icon={GripVertical} size={14} aria-hidden
          className="shrink-0 cursor-grab text-ink-500 opacity-0 transition-opacity duration-fast group-hover:opacity-100" />

        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="focus-ring min-w-0 flex-1 truncate rounded-xs py-2 text-left text-ui text-ink-800 [@media(pointer:coarse)]:min-h-6"
        >
          {task.title}
        </button>

        <span className="inline-flex shrink-0 items-center gap-1 text-caption tabular-nums text-ink-500" title="Block length">
          <Icon icon={Clock} size={12} aria-hidden />
          {formatMinutes(mins)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              // Always reachable by keyboard; revealed on hover for a mouse so a
              // resting rail stays quiet. `reveal-on-hover` keeps it visible on
              // a coarse pointer, where there is no hover to reveal it with.
              data-schedule
              className="focus-ring reveal-on-hover grid size-6 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-surface-active hover:text-ink-800"
              aria-label={`Add ${task.title} to the calendar`}
            >
              <Icon icon={Plus} size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
            {/* Which DAY this schedules into is the one thing a slot list can
                get silently wrong — it follows the grid you are looking at, not
                today, so the menu says so out loud. */}
            <DropdownMenuLabel>{dayLabel} · {formatMinutes(mins)}</DropdownMenuLabel>
            {TIMEBOX_SLOTS.map((min) => (
              <DropdownMenuItem key={min} onSelect={() => onSchedule(task, isoAt(dayISO, min))}>
                <span className="tabular-nums">{fmtMinTime(min)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

const isoAt = (dayISO: string, minutes: number) => new Date(`${dayISO}T${hhmm(minutes)}:00`).toISOString();

/** The rail header's day label, shared with the slot menu so they cannot disagree. */
export const railDayLabel = (dayISO: string) => formatRelativeDay(dayISO) ?? dayISO;

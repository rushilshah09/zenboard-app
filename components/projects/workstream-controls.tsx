'use client';
// What a workstream carries wherever it is drawn: the List's group heading and
// the Board's column header.
//
// These lived inline in the List's heading, about 130 lines of it. The Board
// needs every one of them — a column you cannot rename, date or pause is a
// column you have to leave the Board to manage — and a second inline copy is
// exactly how the two would start disagreeing about when "Paused" shows or
// which way a stream can move. So: one set of controls, two compositions.
// CONSISTENCY_PRINCIPLE.md: the same behaviour, not necessarily the same screen.
import { useLayoutEffect, useRef, useState } from 'react';
import {
  Calendar, Ellipsis, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pause, Play, Pencil, Eye, EyeOff, Trash,
} from '@/components/ds/icons';
import {
  Badge, DatePicker, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, Icon,
} from '@/components/ds/ui';
import { formatRelativeDay } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { Workstream } from '@/lib/workstreams';

/**
 * How far along, and whether someone paused it.
 *
 * Progress, not a count: the heading of a container should answer something
 * the rows underneath cannot, and "6" is just the number of lines you can
 * already see. `progressOf` counts top-level tasks and calls an empty stream
 * 0%, never 100%. "Paused" is the one state progress cannot know — `statusOf`
 * derives active and completed from the figure beside it — so it is the only
 * one worth the chrome. No news is good news.
 */
export function WorkstreamFacts({ stream, progress }: {
  stream: Workstream | null;
  progress?: { done: number; total: number };
}) {
  return (
    <>
      {progress && progress.total > 0 && (
        <span className="shrink-0 text-caption tabular-nums text-ink-500">{progress.done}/{progress.total}</span>
      )}
      {stream?.status === 'paused' && <Badge status="warning">Paused</Badge>}
    </>
  );
}

/**
 * The stream's deadline.
 *
 * Quiet until wanted — "Add a date" appears on hover or focus, and always on a
 * touch screen, where there is no hover. A set date is always shown. Overdue is
 * the only state that takes a colour: a calm page affords one alarm, and "you
 * already missed this" is it. The same control the Overview's checkpoints used,
 * deliberately — a phase deadline and a checkpoint date are one kind of promise.
 */
export function WorkstreamDate({ stream, today, onDate }: {
  stream: Workstream;
  today: string;
  onDate: (id: string, date: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="w-[168px] shrink-0">
        <DatePicker
          aria-label={`Deadline for ${stream.name}`}
          value={stream.due_date ?? null}
          onValueChange={(iso) => { onDate(stream.id, iso || null); setEditing(false); }}
        />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      aria-label={stream.due_date ? `Change the deadline for ${stream.name}` : `Add a deadline to ${stream.name}`}
      className={cn(
        'focus-ring touch-min shrink-0 rounded-xs px-1 text-caption tabular-nums transition-colors duration-fast',
        !stream.due_date ? 'reveal-on-hover text-ink-500'
          : stream.due_date < today ? 'text-danger-600' : 'text-ink-500 hover:text-ink-800',
      )}>
      {stream.due_date
        ? formatRelativeDay(stream.due_date)
        : <span className="inline-flex items-center gap-1"><Icon icon={Calendar} size={12} aria-hidden /><span className="@max-md:sr-only">Add a date</span></span>}
    </button>
  );
}

/**
 * The stream's menu.
 *
 * `axis` is where its neighbours are ON SCREEN. The List stacks streams, so
 * they move up and down; the Board lines them up, so they move left and right.
 * Same act, same order, same `sort_order` — the label follows the eye.
 */
export function WorkstreamMenu({ stream, axis, canMoveBack, canMoveForward, onRename, onMove, onPause, share, onDelete }: {
  stream: Workstream;
  axis: 'vertical' | 'horizontal';
  canMoveBack: boolean;
  canMoveForward: boolean;
  onRename: () => void;
  onMove: (id: string, delta: 1 | -1) => void;
  onPause?: (id: string, paused: boolean) => void;
  /** The bulk pass, scoped to the tasks in this stream. Absent without a portal
   *  or with no tasks in the stream — there would be nothing for it to do. */
  share?: { onAll: (id: string, next: boolean) => void };
  onDelete: (id: string) => void;
}) {
  const across = axis === 'horizontal';
  const paused = stream.status === 'paused';
  // Rename opens a field, and focus belongs IN it. By default the menu hands
  // focus back to its trigger as it closes, which would pull the caret out of
  // the name you are about to type.
  const renaming = useRef(false);
  return (
    <DropdownMenu>
      {/* The trigger stays visible while its menu is open: focus has moved into
          the portalled menu by then, so `focus-within` alone would hide the
          very control the menu is anchored to. */}
      <DropdownMenuTrigger aria-label={`${stream.name} options`}
        className="focus-ring touch-min grid size-6 shrink-0 place-items-center rounded-sm text-ink-500 opacity-0 transition-colors hover:bg-surface-hover hover:text-ink-900 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <Icon icon={Ellipsis} size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end"
        onCloseAutoFocus={(e) => { if (renaming.current) { e.preventDefault(); renaming.current = false; } }}>
        <DropdownMenuItem icon={<Icon icon={Pencil} size={14} />} onSelect={() => { renaming.current = true; onRename(); }}>Rename</DropdownMenuItem>
        <DropdownMenuItem icon={<Icon icon={across ? ChevronLeft : ChevronUp} size={14} />} disabled={!canMoveBack}
          onSelect={() => onMove(stream.id, -1)}>{across ? 'Move left' : 'Move up'}</DropdownMenuItem>
        <DropdownMenuItem icon={<Icon icon={across ? ChevronRight : ChevronDown} size={14} />} disabled={!canMoveForward}
          onSelect={() => onMove(stream.id, 1)}>{across ? 'Move right' : 'Move down'}</DropdownMenuItem>
        {onPause && (
          <DropdownMenuItem icon={<Icon icon={paused ? Play : Pause} size={14} />}
            onSelect={() => onPause(stream.id, !paused)}>
            {paused ? 'Resume workstream' : 'Pause workstream'}
          </DropdownMenuItem>
        )}
        {share && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Icon icon={Eye} size={14} />}
              onSelect={() => share.onAll(stream.id, true)}>Share all tasks with client</DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={EyeOff} size={14} />}
              onSelect={() => share.onAll(stream.id, false)}>Make all tasks internal</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem danger icon={<Icon icon={Trash} size={14} />}
          onSelect={() => onDelete(stream.id)}>Delete workstream</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The inline rename field, shared so both views commit and cancel the same way.
 *
 * It finishes EXACTLY ONCE. Escape closes the field, and closing it can blur
 * it — if the blur were also allowed to commit, Escape would save the very
 * edit it exists to throw away.
 */
export function WorkstreamRename({ stream, onRename, onDone }: {
  stream: Workstream;
  onRename: (id: string, name: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(stream.name);
  const finished = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  // The whole name, selected, so typing REPLACES it — Notion's and Linear's
  // rename. `autoFocus` + an onFocus `select()` left the caret at the end:
  // measured selection [6, 6] on "Design".
  useLayoutEffect(() => { field.current?.focus(); field.current?.select(); }, []);
  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const name = draft.trim();
    if (save && name && name !== stream.name) onRename(stream.id, name);
    onDone();
  };
  return (
    <input ref={field} value={draft} onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); }}
      onBlur={() => finish(true)}
      aria-label="Workstream name" autoComplete="off" data-1p-ignore data-lpignore="true"
      className="focus-ring min-w-0 flex-1 rounded-sm bg-surface-sunken px-1 py-0.5 text-ui font-medium text-ink-900 outline-none" />
  );
}

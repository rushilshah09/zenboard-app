'use client';
// THE task row — every list that shows tasks draws them with this: Home's plan, the Tasks page, a project's Tasks
// tab. Presentation only: parents own the list state and pass optimistic handlers.
//
// There used to be two. The Tasks page kept a roomy row of its own (title over a line of grey capsules) beside this
// compact one, so the same task was a 36px line on Home and a 61-or-82px block on Tasks, and the Inbox stepped
// 61 → 82 → 61 down the page depending on which rows had a chip. One row now, one height (`--row-task`), and the
// facts through the one `TaskMeta` (components/tasks/task-meta.tsx). Tests: task-meta.test.ts, task-row-quiet.test.ts.
import { useRef } from 'react';
import { Star, Ellipsis, Check, Pencil } from "@/components/ds/icons";
import {
  Icon, Checkbox, IconButton, type PriorityLevel,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { rowSurface } from '@/components/tasks/row-surface';
import { TaskMeta } from '@/components/tasks/task-meta';
import { ShareToggle } from '@/components/sharing/share-toggle';
import type { ShareChannels } from '@/lib/visibility';

export type RowTask = {
  id: string;
  title: string;
  done: boolean;
  priority: PriorityLevel;
  highlight: boolean;
  estimate_minutes: number | null;
  elapsed_minutes?: number;
};

type Scope = { name: string; color: string | null };

export function TaskRow({
  task,
  sub,
  project,
  list,
  labels,
  onToggle,
  onOpen,
  onHighlight,
  showHighlightBadge = true,
  showHighlightToggle = false,
  showElapsed = false,
  last = false,
  recurring = false,
  selected,
  onSelect,
  blocked = false,
  share,
  move,
  menu,
}: {
  task: RowTask;
  sub?: { done: number; total: number };
  /** Omit where every row would say the same thing — a project's own list does not name the project. */
  project?: Scope | null;
  list?: Scope | null;
  labels?: readonly { name: string; color: string }[];
  onToggle: () => void;
  onOpen: () => void;
  onHighlight?: () => void;
  showHighlightBadge?: boolean;
  showHighlightToggle?: boolean;
  showElapsed?: boolean;
  last?: boolean;
  recurring?: boolean;
  /** The keyboard cursor, or a checked row in multi-select — either way the row takes the selected wash. */
  selected?: boolean;
  onSelect?: () => void;
  /**
   * Waiting on an unfinished task (§7B, lib/task-links.ts). Presentation only — the row still completes, because a
   * dependency is information, not a lock (Linear does the same). It just stops competing for attention with the
   * work you can actually start.
   */
  blocked?: boolean;
  /**
   * Client-facing marking, for the surfaces where a project's share settings are known — today the project's Tasks
   * tab. Absent everywhere else on purpose: a task in Today or Inbox may belong to no project, and a control that
   * cannot say WHICH client would be worse than no control.
   */
  share?: { visible: boolean; channels: ShareChannels; onToggle: (next: boolean) => void };
  /**
   * File this task into one of its project's workstreams, from the row. Measured on a real workspace: 0 of 88 tasks
   * were filed into a workstream, because filing one took the task panel and a picker that only appeared in some
   * states. Todoist and Things make the group a drop target; that single affordance decides whether a grouping level
   * gets used, so it belongs on the row. Absent where the answer would be ambiguous (a task with no project).
   */
  move?: {
    targets: { id: string; name: string }[];
    /** The stream this task is in, or the sentinel for unfiled. */
    current: string;
    onMove: (target: string) => void;
  };
  /**
   * More of the row's menu, below Open and Highlight: the page's own verbs (Schedule, Project, List, Delete on the
   * Tasks page). ONE ••• per row, whatever the surface adds to it — a second menu glyph on the same row was the
   * thing Home kept catching itself doing.
   */
  menu?: React.ReactNode;
}) {
  // Open hands the keyboard to the task's panel. A closing Radix menu hands focus back to its trigger — outside that
  // panel — and the panel read it as a dismissal and shut the moment it opened (found proving the Tasks menu,
  // 2026-09-21). Open alone asks the menu not to.
  const opening = useRef(false);
  // The divider on the outer box, the wash on an inner one — see components/tasks/row-surface.ts. The LEADING inset
  // is the panel's (`--panel-px`), so a row's checkbox lines up with the heading above it. The HEIGHT is declared:
  // a row's rhythm must not be decided by whichever control was added last (a 28px star once made this 48px).
  const surface = rowSurface({ selected, last, heightClass: 'h-[var(--row-task)]', padding: 'items-center gap-3 px-[var(--panel-px)]' });
  const hasMenu = !!menu || !!move;
  return (
    <div className={surface.outer}>
      <div className={surface.wash}>
      {onSelect && (
        <Checkbox
          size="sm"
          checked={!!selected}
          onCheckedChange={() => onSelect()}
          aria-label={selected ? 'Deselect' : 'Select'}
          className="shrink-0"
        />
      )}
      <Checkbox
        size="md"
        checked={task.done}
        onCheckedChange={() => onToggle()}
        aria-label={task.done ? 'Mark incomplete' : 'Complete'}
        className="shrink-0"
      />

      <button
        onClick={onOpen}
        className={cn(
          // `truncate` is overflow:hidden, which CLIPS the touch-min expander — measured 61×20 on a phone. A text
          // control takes the floor as a real min-height instead; 24 is invisible inside a 36px row.
          'focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui [@media(pointer:coarse)]:min-h-6',
          task.done ? 'text-ink-500 line-through' : blocked ? 'text-ink-500' : 'text-ink-800',
        )}
      >
        {task.title}
      </button>

      <TaskMeta
        blocked={blocked}
        project={project}
        list={list}
        labels={labels}
        priority={task.priority}
        sub={sub}
        recurring={recurring}
        estimate={task.estimate_minutes}
        elapsed={showElapsed ? task.elapsed_minutes : null}
        done={task.done}
        // Where there is no star to toggle, a highlighted task still says so — with the same star, as the last fact,
        // not a "Highlight" chip: one fact, one mark.
        highlight={showHighlightBadge && !showHighlightToggle && task.highlight}
      />

      <span className="flex shrink-0 items-center gap-1.5 empty:hidden">
        {share && (
          <ShareToggle
            kind="task"
            item={{ client_visible: share.visible, done: task.done }}
            channels={share.channels}
            name={task.title}
            onToggle={share.onToggle}
          />
        )}
        {/* A FILLED star is a fact and always shows. An EMPTY one is an invitation, and an invitation repeated on
            every row of every list is wallpaper — CLAUDE.md: "star/flag glyphs render only when meaningful; reveal
            on row hover otherwise". `reveal-on-hover`, not a hand-rolled opacity pair: the house utility also turns
            it on for a COARSE POINTER, where there is no hover. */}
        {showHighlightToggle && onHighlight && (
          <IconButton
            size="xs"
            variant="ghost"
            selected={task.highlight}
            onClick={onHighlight}
            label={task.highlight ? 'Remove highlight' : 'Highlight this task'}
            // 44px of reach belongs to an ISOLATED icon control. In a cluster the reach is the floor: 24.
            // On, the FILLED glyph is the state — the toolbar-toggle wash behind it made a grey tile on the one
            // highlighted row of the list, heavier than anything else on it (2026-09-22). aria-pressed still says it.
            className={cn('[@media(pointer:coarse)]:after:w-6', task.highlight ? 'bg-transparent text-ink-700 hover:bg-surface-hover active:bg-surface-hover' : 'reveal-on-hover')}
            icon={<Icon icon={Star} size={14} weight={task.highlight ? 'fill' : 'regular'} />}
          />
        )}

        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Task actions"
              onClick={(e) => e.stopPropagation()}
              className="focus-ring touch-min reveal-on-hover grid size-6 shrink-0 place-items-center rounded-sm text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900 data-[state=open]:opacity-100"
            >
              <Icon icon={Ellipsis} size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56"
              onCloseAutoFocus={(e) => { if (opening.current) { e.preventDefault(); opening.current = false; } }}>
              <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={() => { opening.current = true; onOpen(); }}>Open</DropdownMenuItem>
              {onHighlight && (
                <DropdownMenuItem icon={<Icon icon={Star} size={16} weight={task.highlight ? 'fill' : 'regular'} />} onSelect={onHighlight}>
                  {task.highlight ? 'Remove highlight' : 'Highlight'}
                </DropdownMenuItem>
              )}
              {/* A FLAT list of destinations, not a "Move to →" submenu: one verb does not earn a second surface to
                  aim at. The tick is always laid out, at zero opacity when it does not apply, so the names line up
                  in a column instead of shuffling sideways as the selection moves. */}
              {move && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {move.targets.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      icon={<Icon icon={Check} size={14} className={t.id === move.current ? undefined : 'opacity-0'} />}
                      onSelect={() => { if (t.id !== move.current) move.onMove(t.id); }}
                    >
                      {t.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {menu && <><DropdownMenuSeparator />{menu}</>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
      </div>
    </div>
  );
}

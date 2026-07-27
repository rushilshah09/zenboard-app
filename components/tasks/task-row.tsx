'use client';
// Shared task row — the single COMPACT row used by both the Projects List view
// and the Today view, so they never drift. Presentation only: parents own the
// list state and pass optimistic handlers (onToggle / onOpen / onHighlight).
// Rebuilt entirely from DS primitives + tokens: §4.16 Checkbox (done + multi-
// select), §4.9 PriorityBadge (semantic priority), §4.8 Tag / FigmaTag, §4.3
// IconButton (star). No inline styles, no legacy Paper-OS tokens.
import { Star, ListChecks, Clock, Repeat } from "@/components/ds/icons";
import { Icon, Tag, Checkbox, IconButton, PriorityBadge, type PriorityLevel } from '@/components/ds/ui';
import { FigmaTag } from '@/components/ui/panels';
import { cn } from '@/lib/cn';

export type RowTask = {
  id: string;
  title: string;
  done: boolean;
  priority: PriorityLevel;
  highlight: boolean;
  estimate_minutes: number | null;
  elapsed_minutes?: number;
};

export const fmtDur = (m: number) =>
  m <= 0 ? '0m' : m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;

export function TaskRow({
  task,
  sub,
  project,
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
}: {
  task: RowTask;
  sub?: { done: number; total: number };
  project?: { name: string; color: string | null } | null;
  onToggle: () => void;
  onOpen: () => void;
  onHighlight?: () => void;
  showHighlightBadge?: boolean;
  showHighlightToggle?: boolean;
  showElapsed?: boolean;
  last?: boolean;
  recurring?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3.5 py-3 transition-colors duration-fast',
        !last && 'border-b border-line-soft',
        selected ? 'bg-surface-selected' : 'hover:bg-surface-hover',
      )}
    >
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
          'focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui',
          task.done ? 'text-ink-500 line-through' : 'text-ink-800',
        )}
      >
        {task.title}
      </button>

      {project && (
        <FigmaTag icon={<span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: project.color || 'var(--color-ink-500)' }} />}>
          {project.name}
        </FigmaTag>
      )}

      {showHighlightBadge && task.highlight && (
        <Tag color="stone" size="sm" icon={<Icon icon={Star} size={12} />}>Highlight</Tag>
      )}

      {recurring && <Icon icon={Repeat} size={14} className="shrink-0 text-ink-500" />}

      {sub && sub.total > 0 && (
        <span className="inline-flex items-center gap-1 text-caption tabular-nums text-ink-500">
          <Icon icon={ListChecks} size={12} />{sub.done}/{sub.total}
        </span>
      )}

      <PriorityBadge level={task.priority} variant="bars" />

      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-caption tabular-nums text-ink-500">
          <Icon icon={Clock} size={12} />
          {showElapsed && task.done && (task.estimate_minutes != null || (task.elapsed_minutes ?? 0) > 0)
            ? `${fmtDur(task.estimate_minutes ?? 0)} · ${fmtDur(task.elapsed_minutes ?? 0)} done`
            : task.estimate_minutes != null ? fmtDur(task.estimate_minutes) : '—'}
        </span>
        {showHighlightToggle && onHighlight && (
          <IconButton
            size="sm"
            variant="ghost"
            selected={task.highlight}
            onClick={onHighlight}
            label="Toggle highlight"
            icon={<Icon icon={Star} size={14} weight={task.highlight ? 'fill' : 'regular'} />}
          />
        )}
      </span>
    </div>
  );
}

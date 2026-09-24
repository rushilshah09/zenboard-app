// THE facts of a task, drawn one way — beside the title in a list row, under it on a card, under the one task Focus is
// on. Before this file the same task wore five vocabularies: priority as bars with a red word (Home), a grey capsule
// (Tasks), a flag (Focus) and a bare tick (the week board); its project as a dot, a filled folder or a rounded square.
// Tests: components/tasks/task-meta.test.ts.
//
// The rules it keeps:
//   · Only what is TRUE. `low` is the database default, so it is not a fact; nor is a missing estimate or an empty
//     checklist. A task with nothing set draws nothing at all (null), not an empty flex box.
//   · One order everywhere — state, where it lives, how it is tagged, how urgent, how much of it is done, when, how
//     long, and the star last — so the eye finds the estimate in the same place on every surface.
//   · Colour on the smallest thing that can carry it: the priority GLYPH is red or amber, its word is ink like every
//     other word here. The project's colour is its folder, not a filled capsule around its name.
//   · No capsules. Every fact is a glyph and a word in the meta ink, spaced by the gap — a row of five filled chips
//     reads as confetti beside a 13px title. `Blocked` is the one exception: it is a state that asks you to wait,
//     so it keeps its tag.
//   · In a narrow container (a phone) the title is the row. WHERE a task lives — project, list, labels — goes to
//     screen readers whole; HOW urgent and HOW long keep their glyphs, and priority gives up its word. Measured at
//     390px: with every fact's glyph kept, a filed task's title had 28% of its row. The caller's list must be an
//     `@container` for this to apply.
import { Folder, List as ListIcon, ListChecks, Repeat, Clock, CalendarDays, Star } from '@/components/ds/icons';
import { Icon, Tag, PriorityBadge, type PriorityLevel } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { scopeFill } from '@/lib/entity-color';
import { formatMinutes, formatRelativeDay } from '@/lib/date';

export type TaskFacts = {
  priority?: PriorityLevel;
  project?: { name: string; color: string | null } | null;
  list?: { name: string; color: string | null } | null;
  labels?: readonly { name: string; color: string }[];
  sub?: { done: number; total: number } | null;
  /** The day it is planned for (a calendar date, `YYYY-MM-DD`) — on surfaces where that varies row to row. */
  when?: string | null;
  /** Planned minutes. */
  estimate?: number | null;
  /** Minutes actually spent. Shown only on a finished task, beside its estimate (a project's Tasks tab). */
  elapsed?: number | null;
  done?: boolean;
  recurring?: boolean;
  /** Waiting on an unfinished task (lib/task-links.ts). Said in a word — grey alone reads as a rendering fault. */
  blocked?: boolean;
  /** Today's highlight, as a filled star — where the surface has no star to toggle (a row that has one passes false). */
  highlight?: boolean;
  /** Where the facts sit: `row` beside a one-line title (never wraps), `card` under a title (wraps). */
  layout?: 'row' | 'card';
  className?: string;
};

/** Visually gone, still announced, below a phone-width container — at 375px the title is the row. */
const NARROW = '@max-md:sr-only';

function Fact({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex min-w-0 shrink-0 items-center gap-1 whitespace-nowrap text-caption tabular-nums text-ink-500', className)}>
      {children}
    </span>
  );
}

export function TaskMeta({
  priority = 'low', project, list, labels, sub, when, estimate, elapsed, done = false, recurring = false, blocked = false,
  highlight = false, layout = 'row', className,
}: TaskFacts) {
  const timed = done && elapsed != null && elapsed > 0;
  // The phone rule is a ROW rule: beside a one-line title the facts compete with it for width. Under a card's title
  // they wrap onto their own line and take nothing from it, so a card keeps every word.
  const narrow = layout === 'row' ? NARROW : undefined;
  const facts = [
    blocked && !done && <Tag key="blocked" color="stone" size="sm">Blocked</Tag>,
    project && (
      <Fact key="project" title={project.name} className={narrow}>
        <Icon icon={Folder} size={12} weight="fill" style={{ color: scopeFill(project.color, 'var(--color-ink-500)') }} />
        <span data-fact-word className="max-w-40 truncate">{project.name}</span>
      </Fact>
    ),
    list && (
      <Fact key="list" title={list.name} className={narrow}>
        <Icon icon={ListIcon} size={12} style={{ color: scopeFill(list.color, 'var(--color-ink-500)') }} />
        <span data-fact-word className="max-w-32 truncate">{list.name}</span>
      </Fact>
    ),
    ...(labels ?? []).map((l) => (
      <Fact key={`label:${l.name}`} title={l.name} className={narrow}>
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: `var(--color-label-${l.color})` }} />
        <span data-fact-word className="max-w-28 truncate">{l.name}</span>
      </Fact>
    )),
    // The gate sits on the render's own line: components/tasks/quiet-list.test.ts sweeps for a priority drawn
    // without one, because `low` on every untouched task is how 78 of 88 rows once wore a "Low" chip.
    priority !== 'low' && <PriorityBadge key="priority" level={priority} labelClassName={narrow} />,
    sub && sub.total > 0 && (
      <Fact key="sub" title={`${sub.done} of ${sub.total} subtasks done`}>
        <Icon icon={ListChecks} size={12} />{sub.done}/{sub.total}
      </Fact>
    ),
    recurring && (
      <Fact key="repeat" title="Repeats">
        <Icon icon={Repeat} size={12} aria-label="Repeats" />
      </Fact>
    ),
    when && (
      <Fact key="when">
        <Icon icon={CalendarDays} size={12} />{formatRelativeDay(when)}
      </Fact>
    ),
    (estimate != null || timed) && (
      <Fact key="estimate">
        <Icon icon={Clock} size={12} />
        {timed ? `${formatMinutes(estimate ?? 0)} · ${formatMinutes(elapsed!)} done` : formatMinutes(estimate!)}
      </Fact>
    ),
    highlight && <Icon key="highlight" icon={Star} size={12} weight="fill" className="shrink-0 text-ink-600" aria-label="Highlighted" />,
  ].filter(Boolean);

  if (facts.length === 0) return null;
  return (
    <span className={cn('flex min-w-0 items-center', layout === 'row' ? 'shrink-0 gap-3' : 'flex-wrap gap-x-3 gap-y-1', className)}>
      {facts}
    </span>
  );
}

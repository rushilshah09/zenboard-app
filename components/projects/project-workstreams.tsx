'use client';
// The project's shape and schedule, on the Overview.
//
// ── WHAT REPLACED WHAT ──────────────────────────────────────────────────────
// This is where "Milestones" used to be, and it answers the question that list
// could not. A milestone was a dated checkpoint that OWNED NOTHING, so "will
// we hit Beta to client?" had no answer in the product — you read a date and a
// tickbox somebody had to remember to tick. A workstream owns the work, so its
// date comes with evidence: `Design · 19 Sep · 2/7`.
//
// Migration 0041 folds the old checkpoints in here. Until it runs on a given
// project, that project keeps its editable milestone list as well — see the
// gate in projects-workspace.tsx.
//
// ── WHY IT IS READ-ONLY ─────────────────────────────────────────────────────
// Every control here would be a second home for something the Tasks tab
// already owns: renaming, dating, pausing, reordering and deleting all live on
// the stream's own heading, one click away. §7E's split is that Overview
// answers "where does this stand" and Tasks answers "what am I doing", and a
// page that lets you edit from both places has to keep them agreeing forever.
//
// A row is still a LINK — clicking it takes you to the Tasks tab, which is
// where acting on it happens. Read here, act there.
import { Icon } from '@/components/ds/ui';
import { EmptyLine } from '@/components/ds/ui';
import { Calendar as CalendarIcon } from '@/components/ds/icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { cn } from '@/lib/cn';
import { formatRelativeDay, todayISO } from '@/lib/date';
import { groupByStream, statusOf, type StreamTask, type Workstream } from '@/lib/workstreams';

export function ProjectWorkstreams({ streams, tasks, onOpen }: {
  streams: Workstream[];
  /** The project's top-level tasks. Progress counts these, never subtasks. */
  tasks: StreamTask[];
  /** Take me to where I can act on this. */
  onOpen: () => void;
}) {
  const today = todayISO();
  // THE one projection, the same one the Tasks tab and the client portal read.
  // The unfiled group is dropped here on purpose: this section is about the
  // shape somebody CHOSE for the project, and "everything I have not filed" is
  // not part of that shape — it is a working state, and the Tasks tab is where
  // you see it and fix it.
  const groups = groupByStream(tasks, streams).filter((g) => g.stream !== null);
  if (streams.length === 0) return null;

  const done = groups.filter((g) => statusOf(g.stream!, g.progress) === 'completed').length;

  return (
    <section className="mt-10">
      {/* The count is how many phases are finished, which is the one number
          that describes a project's shape at a glance. A percentage would be
          the dashboard this page is deliberately not. */}
      <SectionHeading count={groups.length > 0 ? `${done}/${groups.length}` : undefined}>Workstreams</SectionHeading>

      {groups.length === 0 ? (
        <EmptyLine className="py-0">No workstreams yet: bigger jobs split into Identity, Motion, Web.</EmptyLine>
      ) : (
        <div className="flex flex-col">
          {groups.map((g) => {
            const s = g.stream!;
            const state = statusOf(s, g.progress);
            const overdue = !!s.due_date && s.due_date < today && state !== 'completed';
            return (
              <button
                key={s.id}
                type="button"
                onClick={onOpen}
                className="group -mx-2 flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors duration-fast hover:bg-surface-hover focus-ring"
              >
                <span className={cn('min-w-0 flex-1 truncate text-ui', state === 'completed' ? 'text-ink-500' : 'text-ink-800')}>
                  {s.name}
                </span>

                {/* Paused is the only status worth a word: active and
                    completed are already legible in the figure beside it. */}
                {s.status === 'paused' && (
                  <span className="shrink-0 text-caption text-ink-500">Paused</span>
                )}

                {/* Nothing for an empty stream. "0/0" is not progress, it is
                    the absence of any, and this page does not report absences. */}
                {g.progress.total > 0 && (
                  <span className="shrink-0 text-caption tabular-nums text-ink-500">
                    {g.progress.done}/{g.progress.total}
                  </span>
                )}

                {/* Overdue is the only state that takes a colour — a calm page
                    affords exactly one alarm, and "you already missed this" is
                    it. Undated streams show nothing rather than a prompt: this
                    section reports, it does not nag. */}
                {s.due_date && (
                  <span className={cn(
                    'inline-flex w-[72px] shrink-0 items-center justify-end gap-1 text-caption tabular-nums',
                    overdue ? 'text-danger-600' : 'text-ink-500',
                  )}>
                    <Icon icon={CalendarIcon} size={12} aria-hidden />
                    {formatRelativeDay(s.due_date)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

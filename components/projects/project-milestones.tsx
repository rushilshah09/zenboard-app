'use client';
// Project milestones — master plan §7E: "**Milestones** move to project level:
// dated checkpoints rendering on Overview + Calendar."
//
// WHAT A MILESTONE IS, and why it is not a task with a flag: no assignee, no
// estimate, no subtasks, no status beyond done. It is the part of §7E's "memory
// surface" that records *when this was supposed to matter* — "what did we
// agree", not "what am I doing". Giving it any more anatomy would make it a
// second, weaker task, which is how project tools get heavy.
//
// BENCHMARK (rule 7). Asana's milestone IS a task with a diamond icon, so it
// inherits assignees, subtasks and dependencies it has no use for. Linear has
// no milestones at all — a project has a target date and that is it. Basecamp
// has none either; it narrates health in prose instead. We take Asana's idea
// (dated checkpoints you can see at a glance) with Linear's restraint (a
// separate, minimal object rather than an overloaded task), and we render it in
// Basecamp's register: quiet prose on the Overview, not a Gantt chart.
//
// The visual language is the Overview's, deliberately: a sentence-case heading,
// a hoverable list with no dividers, and a composer that matches the update
// box. §7E's Overview is a Notion page, not a dashboard, and a boxed
// "Milestones" widget would be the one thing on it that looked like one.
import { SectionHeading } from '@/components/ui/section-heading';
import * as React from 'react';
import { Plus, X, Calendar as CalendarIcon } from '@/components/ds/icons';
import { Icon, Checkbox, EmptyLine, DatePicker, Button } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { formatRelativeDay } from '@/lib/date';
import { sortMilestones, milestoneState, milestoneProgress, type Milestone } from '@/lib/milestones';

export function ProjectMilestones({
  milestones, onAdd, onToggle, onSetDate, onDelete,
}: {
  milestones: Milestone[];
  onAdd: (title: string, dueDate: string | null) => void;
  onToggle: (id: string, done: boolean) => void;
  onSetDate: (id: string, dueDate: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = React.useState('');
  const [draftDate, setDraftDate] = React.useState('');
  const ordered = React.useMemo(() => sortMilestones(milestones), [milestones]);
  const { done, total } = milestoneProgress(milestones);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t, draftDate || null);
    setDraft('');
    setDraftDate('');
  };

  return (
    <section className="mt-10">
      {/* The count is the progress — a ring or a percent bar would be the
          dashboard this page is deliberately not. */}
      <SectionHeading count={total > 0 ? `${done}/${total}` : undefined}>Milestones</SectionHeading>

      {ordered.length === 0 ? (
        <EmptyLine className="py-0">No checkpoints yet — add the first date that matters.</EmptyLine>
      ) : (
        <div className="flex flex-col">
          {ordered.map((mile) => (
            <MilestoneRow key={mile.id} milestone={mile} onToggle={onToggle} onSetDate={onSetDate} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* Composer, matching the Update box's shape. The date is optional on
          purpose: a checkpoint you know about but cannot date yet is real, and
          forcing a date would make people invent one. */}
      <div className="mt-2 flex items-center gap-2">
        <Icon icon={Plus} size={14} className="shrink-0 text-ink-500" aria-hidden />
        <input data-chromeless
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Add a milestone…"
          aria-label="New milestone"
          autoComplete="off" data-1p-ignore data-lpignore="true"
          className="min-w-0 flex-1 border-none bg-transparent py-1.5 text-ui text-ink-800 outline-none placeholder:text-ink-500"
        />
        {draft.trim() && (
          <>
            <div className="w-[168px] shrink-0">
              <DatePicker aria-label="Milestone date" value={draftDate || null} onValueChange={setDraftDate} placeholder="When? (optional)" />
            </div>
            <Button size="sm" variant="secondary" onClick={submit}>Add</Button>
          </>
        )}
      </div>
    </section>
  );
}

function MilestoneRow({
  milestone, onToggle, onSetDate, onDelete,
}: {
  milestone: Milestone;
  onToggle: (id: string, done: boolean) => void;
  onSetDate: (id: string, dueDate: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const state = milestoneState(milestone);

  return (
    <div className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors duration-fast hover:bg-surface-hover">
      <Checkbox
        size="sm"
        checked={milestone.done}
        onCheckedChange={() => onToggle(milestone.id, !milestone.done)}
        aria-label={milestone.done ? `Reopen ${milestone.title}` : `Complete ${milestone.title}`}
        className="shrink-0"
      />
      <span className={cn('min-w-0 flex-1 truncate text-ui', milestone.done ? 'text-ink-500 line-through' : 'text-ink-800')}>
        {milestone.title}
      </span>

      {editing ? (
        <div className="w-[168px] shrink-0">
          <DatePicker
            aria-label="Milestone date"
            value={milestone.due_date ?? null}
            onValueChange={(iso) => { onSetDate(milestone.id, iso || null); setEditing(false); }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'focus-ring shrink-0 rounded-xs px-1 text-caption tabular-nums transition-colors duration-fast',
            // Overdue is the only state that gets a colour. A calm page can
            // afford exactly one alarm, and "you already missed this" is it —
            // everything else is a date, which is information, not a warning.
            state === 'overdue' ? 'text-danger-600'
              : state === 'today' ? 'text-ink-800'
                : state === 'undated' ? 'text-ink-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                  : 'text-ink-500',
          )}
          aria-label={milestone.due_date ? `Change the date for ${milestone.title}` : `Add a date to ${milestone.title}`}
        >
          {milestone.due_date
            ? formatRelativeDay(milestone.due_date)
            : <span className="inline-flex items-center gap-1"><Icon icon={CalendarIcon} size={12} aria-hidden />Add a date</span>}
        </button>
      )}

      <button
        type="button"
        onClick={() => onDelete(milestone.id)}
        aria-label={`Delete ${milestone.title}`}
        className="focus-ring reveal-on-hover grid size-6 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-surface-active hover:text-ink-800"
      >
        <Icon icon={X} size={12} />
      </button>
    </div>
  );
}

/**
 * The Overview's one-line lead: the soonest checkpoint that still matters.
 * Rendered next to the project's other header facts, so `nextMilestone` has a
 * single presentation rather than each host inventing its own phrasing.
 */
export function NextMilestoneLine({ milestone }: { milestone: Milestone | null }) {
  if (!milestone) return null;
  const state = milestoneState(milestone);
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-ink-500">
      <Icon icon={CalendarIcon} size={12} aria-hidden />
      <span className="text-ink-700">{milestone.title}</span>
      <span className={cn('tabular-nums', state === 'overdue' ? 'text-danger-600' : 'text-ink-500')}>
        {formatRelativeDay(milestone.due_date)}
      </span>
    </span>
  );
}

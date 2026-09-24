'use client';
// The project's Board: one column per WORKSTREAM.
//
// ── WHAT IT REPLACED, AND WHY ───────────────────────────────────────────────
// The columns used to be To do / In progress / Review / Done, driven by
// `tasks.status` — a fourth task-state vocabulary that nothing else in the app
// read. Measured on the live workspace: null on 78 of 88 tasks, invisible in
// the List, the Calendar, Home and the portal. It was also LOSSY: drag a card
// from Review to Done, untick it in the List, and it came back in To do — the
// Review state silently gone, because the List writes `done` and never
// `status`. And switching layout changed what the columns MEANT.
//
// Now the List and the Board are two drawings of ONE structure: the columns
// are the workstreams, in their order, from `groupByStream` — the projection
// the List and the client portal already share. Dragging a card between
// columns files it; the tick on the card finishes it. Grouping is a view, not
// a second model — which is how Notion and Linear both treat it.
//
// "Review" was never a task state here anyway. A client's review of work is
// an `approvals` row, with its own states and its own trail.
//
// ── IT IS THE TASKS BOARD ───────────────────────────────────────────────────
// Not a third kanban. `TasksBoard` owns the drag, the card, the quick add and
// the per-column Completed fold; this file decides what the columns are and
// carries each workstream's own controls into its header — the same
// components the List's headings use (workstream-controls.tsx).
import { useState } from 'react';
import { TasksBoard, type BoardColumn, type BoardTask } from '@/components/tasks/tasks-board';
import { WorkstreamFacts, WorkstreamDate, WorkstreamMenu, WorkstreamRename } from '@/components/projects/workstream-controls';
import { boardGroups, landAt, NO_STREAM, type Workstream } from '@/lib/workstreams';
import { useSettling } from '@/lib/use-settling';
import { todayISO } from '@/lib/date';
import type { PTask, PSection } from '@/components/projects/projects-workspace';

const toCard = (t: PTask): BoardTask => ({
  id: t.id, title: t.title, done: t.done, priority: t.priority, highlight: t.highlight,
  estimate_minutes: t.estimate_minutes, scheduled_date: t.scheduled_date, recurrence: null,
});

export function ProjectBoard({
  tasks, sections, subByParent, sectionsSupported, onToggle, onOpen, onAdd, onDrop,
  onNewSection, onRenameSection, onDeleteSection, onMoveSection, onDateSection, onPauseSection, onShareStreamTasks,
}: {
  /** The project's TOP-LEVEL tasks — subtasks travel with their parent. */
  tasks: PTask[];
  /** This project's workstreams. */
  sections: PSection[];
  subByParent: Map<string, { done: number; total: number }>;
  /** 0014. Without it there are no workstreams to be columns, so the board is
   *  one column and there is nothing to make a second one with. */
  sectionsSupported: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onAdd: (title: string, sectionId: string | null) => void;
  /** A card landed: its workstream (`null` = none) and the column's new order. */
  onDrop: (taskId: string, sectionId: string | null, orderedIds: string[]) => void;
  onNewSection: (name: string) => void;
  onRenameSection: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onMoveSection: (id: string, delta: 1 | -1) => void;
  onDateSection: (id: string, date: string | null) => void;
  onPauseSection: (id: string, paused: boolean) => void;
  /** The bulk share pass. Absent without a portal. */
  onShareStreamTasks?: (id: string, next: boolean) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const settling = useSettling();
  const today = todayISO();

  // A card you tick holds its place for a beat, then folds into its column's
  // Completed group — the same beat the List gives a row. Which way the beat
  // runs is decided before the parent's optimistic update lands.
  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t?.done) settling.release(id); else settling.hold(id);
    onToggle(id);
  };

  // Every stream is a column, empty or not, and "No workstream" is always the
  // last — see `boardGroups` for why the Board differs from the List here.
  const groups = boardGroups(tasks, sections as Workstream[]);

  const columns: BoardColumn[] = groups.map((g, gi) => {
    const s = g.stream;
    return {
      key: g.key,
      name: s?.name ?? 'No workstream',
      tasks: g.tasks.map(toCard),
      // The unfiled column is named in the muted ink the List uses for it: it
      // is where work sits before anyone decided, not a stream of its own.
      title: s
        ? (renamingId === s.id ? <WorkstreamRename stream={s} onRename={onRenameSection} onDone={() => setRenamingId(null)} /> : undefined)
        : <h2 className="min-w-0 truncate text-ui font-medium text-ink-500">No workstream</h2>,
      facts: <WorkstreamFacts stream={s} progress={g.progress} />,
      actions: s ? (
        <>
          <WorkstreamDate stream={s} today={today} onDate={onDateSection} />
          {sectionsSupported && (
            <WorkstreamMenu stream={s} axis="horizontal"
              canMoveBack={gi > 0} canMoveForward={gi < sections.length - 1}
              onRename={() => setRenamingId(s.id)} onMove={onMoveSection} onPause={onPauseSection}
              share={onShareStreamTasks && g.tasks.length > 0 ? { onAll: onShareStreamTasks } : undefined}
              onDelete={onDeleteSection} />
          )}
        </>
      ) : undefined,
    };
  });

  const drop = (taskId: string, key: string, index: number) => {
    const target = columns.find((c) => c.key === key);
    if (!target) return;
    onDrop(taskId, key === NO_STREAM ? null : key, landAt(target.tasks.map((t) => t.id), taskId, index));
  };

  return (
    // Framed, like the List's card, so switching layout changes the drawing and
    // not the page — but NOT filled: the cards are the raised surface here, as
    // on the Tasks board, and a raised card inside a raised frame is separated
    // from it by a hairline alone. Columns grow with their cards and stretch to
    // the tallest; the page scrolls, as a project page does in every other tab.
    <div className="flex overflow-hidden rounded-lg border border-line-soft">
      <TasksBoard
        columns={columns}
        subByParent={Object.fromEntries(subByParent)}
        settling={settling.ids}
        onToggle={toggle}
        onOpen={onOpen}
        onAdd={(key, title) => onAdd(title, key === NO_STREAM ? null : key)}
        onDrop={drop}
        newColumn={sectionsSupported ? { label: 'New workstream', placeholder: 'Motion, Web design, Identity…', onCreate: onNewSection } : undefined}
      />
    </div>
  );
}

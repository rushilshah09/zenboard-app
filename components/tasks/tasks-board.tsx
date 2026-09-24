'use client';
// The Tasks BOARD — one column per pile, the way Google Tasks lays your lists
// out side by side.
//
// WHY IT IS A PANE AND NOT A PAGE. The rail, the header, the filter, the task
// state and every mutation already live in `TasksView`. A parallel board page
// would need its own copy of all five, and the module has been burned by that
// exact split before: the week board used to replace the rail with a column of
// its own, so switching layout moved everything on screen. This file draws the
// CENTRE and nothing else — it takes columns and handlers, and owns no task
// state at all.
//
// BENCHMARK (rule 7). Google Tasks: a column per list, a "+ Add a task" row at
// the top, a collapsed "Completed (n)" at the foot of each column, and dragging
// a card between columns re-files it. Trello and Linear both add within-column
// ordering, which Google Tasks also has — we match all of it. Where we
// deliberately differ: Google Tasks' columns are fixed-width cards floating on
// a canvas, which wastes a third of the screen on gutters; ours are full-height
// wells that scroll independently, so a long list is scrollable without moving
// the whole board.
//
// WHAT A COLUMN MEANS is not this file's decision. It draws two boards:
//   - Tasks: a column per PILE — `columnKey` in lib/task-scopes.ts decides (a
//     task's list wins over its project, so one card is drawn exactly once
//     and a drop is never ambiguous);
//   - a project: a column per WORKSTREAM — `groupByStream` in
//     lib/workstreams.ts decides, the same projection the List draws.
// That second board used to be a third kanban, hand-built inside the project
// workspace, grouping by a status vocabulary nothing else in the app used. A
// board is a board: the columns are the caller's, the behaviour is this file's
// — the same card, the same drag, the same quick add, the same Completed fold.
import { useId, useMemo, useState } from 'react';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin, closestCorners,
  useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent, type CollisionDetection,
  type Announcements, type UniqueIdentifier,
} from '@dnd-kit/core';
import { dropSettle } from '@/lib/drop-settle';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AddLine, BOARD_COLUMN } from '@/components/ds/ui';
import { TaskCard } from '@/components/tasks/task-card';
import { CompletedSection } from '@/components/tasks/completed-section';
import { splitSettled } from '@/lib/use-settling';
import { cn } from '@/lib/cn';

export type BoardTask = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; scheduled_date: string | null;
  recurrence: { freq?: string } | null;
};

export type BoardColumn = {
  key: string;
  /** The column's name — its heading, and its accessible label. */
  name: string;
  tasks: BoardTask[];
  /** A colour swatch before the name: a list's or a project's colour. */
  swatch?: string;
  /** Drawn INSTEAD of the name — an inline rename field. `name` still labels
   *  the column for assistive tech while it is open. */
  title?: React.ReactNode;
  /** What follows the name. Defaults to the number of open cards; a
   *  workstream states its progress instead ("2/5"), because a count is only
   *  the number of cards you can already see. */
  facts?: React.ReactNode;
  /** Controls at the heading's far end — a date, a menu. Quiet or not is the
   *  caller's call; the heading carries `group` so `reveal-on-hover` works. */
  actions?: React.ReactNode;
};


/** A card mid-drag, and the same markup at rest — the shared `TaskCard`, so the overlay cannot drift from the thing
 *  it is standing in for, and this board's card cannot drift from the Week board's. */
function CardBody({ t, sub, onToggle, onOpen, dragging }: {
  t: BoardTask; sub?: { done: number; total: number };
  onToggle?: () => void; onOpen?: () => void; dragging?: boolean;
}) {
  return <TaskCard task={t} sub={sub} onToggle={onToggle} onOpen={onOpen} dragging={dragging} />;
}

function SortableCard({ t, sub, onToggle, onOpen }: {
  t: BoardTask; sub?: { done: number; total: number }; onToggle: () => void; onOpen: () => void;
}) {
  // A LIST ITEM, not dnd-kit's default `role="button"`. The card holds two
  // controls of its own — the checkbox and the title — and a button that
  // contains buttons is one tab stop swallowing others and ambiguous to a
  // screen reader. As an item in the column's list it is the thing you pick up
  // (Space), and the controls inside it are still themselves.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: t.id, attributes: { role: 'listitem', roleDescription: 'movable task' },
  });
  return (
    // The drag handle is the WHOLE card, but the listeners sit on this wrapper
    // rather than on the checkbox or the title button — dnd-kit's pointer sensor
    // has a 4px activation distance, so a click still reaches them and a drag
    // still starts anywhere on the card. The keyboard sensor only lifts when
    // the key is pressed ON this wrapper, so Space on the checkbox still ticks.
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('focus-ring touch-none rounded-md', isDragging && 'opacity-40')}
      aria-label={t.title}
      {...attributes} {...listeners}
    >
      <CardBody t={t} sub={sub} onToggle={onToggle} onOpen={onOpen} />
    </div>
  );
}

function QuickAdd({ onAdd, label }: { onAdd: (title: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const commit = () => { const v = title.trim(); if (v) onAdd(v); setTitle(''); setOpen(false); };
  if (!open) {
    return (
      <AddLine onClick={() => setOpen(true)}>Add task</AddLine>
    );
  }
  return (
    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label={label}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setTitle(''); setOpen(false); } }}
      placeholder="New task" autoComplete="off" data-1p-ignore data-lpignore="true"
      className="focus-ring h-8 w-full rounded-md border border-line-strong bg-surface-raised px-2 text-ui text-ink-800 outline-none placeholder:text-ink-500" />
  );
}

function Column({ col, subByParent, settling, onToggle, onOpen, onAdd }: {
  col: BoardColumn;
  subByParent: Record<string, { done: number; total: number }>;
  settling: ReadonlySet<string>;
  onToggle: (id: string) => void; onOpen: (id: string) => void; onAdd: (columnKey: string, title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  // The same split the list uses, per column: a card you tick stays where it is
  // for a beat and then drops into this column's own Completed group.
  const { active, completed } = splitSettled(col.tasks, settling);

  return (
    <section
      ref={setNodeRef}
      aria-label={col.name}
      // `BOARD_COLUMN` — the app's one kanban column, shared with the content
      // pipeline and the database board. This lane used to be 288px wide,
      // unfilled, and divided from its neighbour by a hairline, with an h-11
      // header and a square swatch: seven differences from the same object
      // drawn one screen away. What stays local is the HEIGHT — `h-full` with
      // the body scrolling inside — because a dedicated board page's scroll
      // architecture is its own, and that is composition rather than behaviour.
      className={cn(
        'flex flex-col',
        BOARD_COLUMN.widthClass, BOARD_COLUMN.well,
        isOver && BOARD_COLUMN.over,
      )}
    >
      <header className={cn('group shrink-0', BOARD_COLUMN.header)}>
        {col.swatch && <span aria-hidden className={BOARD_COLUMN.dot} style={{ background: col.swatch }} />}
        {col.title ?? <h2 className="min-w-0 truncate text-ui font-medium text-ink-800">{col.name}</h2>}
        {col.facts ?? (active.length > 0 && <span className="shrink-0 text-caption tabular-nums text-ink-500">{active.length}</span>)}
        <span className="flex-1" />
        {col.actions}
      </header>

      <div className={cn(BOARD_COLUMN.body, 'min-h-0')}>
        {/* Adding into "Unfiled" means a task in no pile — the same thing the
            Inbox holds — so it gets the same quick add as every other column. */}
        <QuickAdd label={`New task in ${col.name}`} onAdd={(title) => onAdd(col.key, title)} />

        <SortableContext items={active.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div role="list" aria-label={`${col.name} tasks`} className="flex flex-col gap-2">
            {active.map((t) => (
              <SortableCard key={t.id} t={t} sub={subByParent[t.id]} onToggle={() => onToggle(t.id)} onOpen={() => onOpen(t.id)} />
            ))}
          </div>
        </SortableContext>

        {active.length === 0 && completed.length === 0 && (
          <p className="px-2 py-3 text-caption text-ink-500">Nothing here yet.</p>
        )}

        <CompletedSection count={completed.length} className="mt-1 border-t-0">
          <div className="flex flex-col gap-2 pb-1">
            {completed.map((t) => (
              <CardBody key={t.id} t={t} sub={subByParent[t.id]} onToggle={() => onToggle(t.id)} onOpen={() => onOpen(t.id)} />
            ))}
          </div>
        </CompletedSection>
      </div>
    </section>
  );
}

/**
 * The last column: a way to make the next one.
 *
 * Google Tasks hides list creation in a menu three clicks away; a board whose
 * whole subject is columns should let you add one from the board. It names the
 * column right here, in place — the Tasks board used to find the rail's own
 * "New list" button in the DOM and click it, which did nothing when the rail
 * was not on screen, and could only ever find the board's OWN button, with the
 * same label, and click that instead.
 */
function NewColumn({ label, placeholder, onCreate }: { label: string; placeholder: string; onCreate: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  const commit = () => { const v = name?.trim(); if (v) onCreate(v); setName(null); };
  return (
    <div className={cn('flex flex-col', BOARD_COLUMN.widthClass, 'shrink-0 p-2')}>
      {name === null ? (
        <AddLine onClick={() => setName('')} className="w-auto self-start">{label}</AddLine>
      ) : (
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={label}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setName(null); }}
          placeholder={placeholder} autoComplete="off" data-1p-ignore data-lpignore="true"
          className="focus-ring h-8 w-full rounded-md border border-line-strong bg-surface-raised px-2 text-ui text-ink-800 outline-none placeholder:text-ink-500" />
      )}
    </div>
  );
}

/**
 * Where a drop lands.
 *
 * `pointerWithin` answers from the POINTER, and a keyboard drag has none: a
 * card lifted with Space and walked with the arrows was over nothing at all,
 * so every keyboard drop snapped home. The pointer keeps `pointerWithin` —
 * it is what lets a drop into a column's empty space land — and the keyboard
 * gets the nearest target.
 */
export const boardCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCorners(args);

export function TasksBoard({
  columns, subByParent, settling, onToggle, onOpen, onAdd, onDrop, newColumn, emptyText,
}: {
  columns: BoardColumn[];
  subByParent: Record<string, { done: number; total: number }>;
  settling: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onAdd: (columnKey: string, title: string) => void;
  /** A card was dropped: which task, into which column, at which index. */
  onDrop: (taskId: string, columnKey: string, index: number) => void;
  /** Offer a last column that makes the next one. Absent when the caller
   *  cannot create columns (an unmigrated account). */
  newColumn?: { label: string; placeholder: string; onCreate: (name: string) => void };
  /** What a board with no columns says. */
  emptyText?: string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  // Generated, never a literal: dnd-kit derives the drag description's element
  // id from this and, given none, falls back to a MODULE-LEVEL COUNTER that
  // keeps counting on the server and restarts at 0 in the browser — which
  // hydrates `aria-describedby="DndDescribedBy-1"` against a client expecting
  // `-0` and makes React discard the subtree. A hard-coded string fixes that
  // but collides the moment two of these mount at once; `useId` does both.
  // There is no `id` prop to override it: the one caller that named its board
  // passed a literal, which is exactly the collision this rules out.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => {
    const m: Record<string, BoardTask> = {};
    for (const c of columns) for (const t of c.tasks) m[t.id] = t;
    return m;
  }, [columns]);

  const columnOf = (id: string) => columns.find((c) => c.tasks.some((t) => t.id === id));

  // WHAT A SCREEN READER HEARS. dnd-kit's defaults read out raw ids —
  // "Draggable item 6f1c… was moved over droppable area 91be…" — which is a
  // drag you cannot follow. These say the task and the column by name, and
  // the place as a POSITION among the cards you can see, which is how a
  // sortable list is announced everywhere else ("position 2 of 5"). Positions
  // count the open cards only: finished ones sit behind a closed disclosure.
  const nameOf = (x: UniqueIdentifier) => byId[String(x)]?.title ?? 'The task';
  const placeOf = (moving: UniqueIdentifier, x: UniqueIdentifier) => {
    const key = String(x);
    const col = columns.find((c) => c.key === key);
    if (col) return `${col.name}, at the end`;
    const home = columnOf(key);
    if (!home) return 'that place';
    const open = splitSettled(home.tasks, settling).active;
    const count = open.length + (open.some((t) => t.id === String(moving)) ? 0 : 1);
    return `${home.name}, position ${open.findIndex((t) => t.id === key) + 1} of ${count}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is in ${placeOf(active.id, over.id)}.` : `${nameOf(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped in ${placeOf(active.id, over.id)}.` : `${nameOf(active.id)} put back.`),
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled. It is back where it was.`,
  };

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const taskId = String(e.active.id);
    const over = e.over?.id;
    if (!over) return;
    const overId = String(over);

    // `over` is either a COLUMN (dropped on empty space) or another CARD
    // (dropped between cards). Resolving both to "which column, which index"
    // here is what keeps the caller's handler a single simple write.
    const target = columns.find((c) => c.key === overId) ?? columnOf(overId);
    if (!target) return;
    const from = columnOf(taskId);
    const index = columns.find((c) => c.key === overId)
      ? target.tasks.length
      : Math.max(0, target.tasks.findIndex((t) => t.id === overId));
    if (from?.key === target.key && from.tasks.findIndex((t) => t.id === taskId) === index) return;
    onDrop(taskId, target.key, index);
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={boardCollision} accessibility={{ announcements }}
      onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
      onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className={cn('flex min-h-0 flex-1 items-start overflow-x-auto p-2', BOARD_COLUMN.gapClass)}>
        {columns.map((c) => (
          <Column key={c.key} col={c} subByParent={subByParent} settling={settling}
            onToggle={onToggle} onOpen={onOpen} onAdd={onAdd} />
        ))}

        {newColumn && <NewColumn {...newColumn} />}

        {columns.length === 0 && emptyText && (
          <p className="p-6 text-ui text-ink-500">{emptyText}</p>
        )}
      </div>

      {/* The lifted card. Without it dnd-kit drags the original in place, which
          inside a column that scrolls means the card disappears at the edge. */}
      <DragOverlay dropAnimation={dropSettle()}>
        {/* The column's width less its 2×8 well padding — what you hold is the
            width of the slot it drops into. */}
        {dragId && byId[dragId] ? <div className={BOARD_COLUMN.cardWidthClass}><CardBody t={byId[dragId]} sub={subByParent[dragId]} dragging /></div> : null}
      </DragOverlay>
    </DndContext>
  );
}

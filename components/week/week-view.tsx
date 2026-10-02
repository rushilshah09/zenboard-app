'use client';
// Week — the Tasks board laid out by day: an Unscheduled staging column, then the week's seven days divided by
// hairlines. The days FLEX to fit a week on screen (lib/week-layout.ts) — deliberately not the house BOARD_COLUMN
// well (memory: zenboard-week-board-fit). Cards are the shared `TaskCard`; each column adds through the house add line
// speaking the ONE task grammar (lib/task-parse). Drag a card between columns to reschedule (optimistic + persisted;
// rolls back on failure). Reuses the shared task actions and the same task data as Today — just arranged weekly.
//
// Rebuilt on the design system 2026-09-22 (plans/PRODUCT_POLISH_2026-09-22.md sprint 3). It was the last legacy
// island in Tasks: a hand-rolled `ChipPop` portal (its own outside-click, scroll and Escape handling), a hand-rolled
// ••• menu and date picker, all in inline styles on legacy tokens; a priority-ringed CIRCLE for done; ghost
// "Low · Project · Estimate" chips on every card; its own capture grammar ("!!" meant high) beside the app's one;
// "TODAY" and "MOVE TO" in tracked capitals; empty days that said "Open." or "Rest."; today's whole column filled
// grey; and a card you could not open.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import { dropSettle } from '@/lib/drop-settle';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Inbox, ChevronLeft, ChevronRight, CalendarDays, Folder, Trash2 } from "@/components/ds/icons";
import {
  Icon, Button, ButtonGroup, IconButton, AddLine, addLine, EmptyLine, toastReverted,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ds/ui";
import { HubLayout } from '@/components/ui/hub-layout';
import { ParsedChips } from '@/components/ui/parsed-chips';
import { TasksRail } from '@/components/tasks/tasks-rail';
import { TaskCard } from '@/components/tasks/task-card';
import { railHref } from '@/components/tasks/types';
import { NO_SAVED_VIEWS, type RailCounts, type SavedViewDef, type ScopeCounts } from '@/components/tasks/types';
import { useScopes } from '@/components/tasks/use-scopes';
import type { Scope } from '@/lib/task-scopes';
import { scopeFill } from '@/lib/entity-color';
import { useNarrow } from '@/lib/use-narrow';
import { cn } from '@/lib/cn';
import {
  COL_INBOX, COL_INBOX_COLLAPSED, COL_DAY_MIN, COL_DAY_MAX,
  boardMinWidth, weekFits, useInboxCollapsed,
} from '@/lib/week-layout';
import { addTask, toggleTask, updateTask, setHighlight, deleteTask, reorderTasks } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import { formatMinutes, type WeekDay } from '@/lib/date';
import { workMinutes, DEFAULT_WORK_HOURS, type WorkHours } from '@/lib/capacity';
import { parseTask, type ChipKind } from '@/lib/task-parse';
import { taskOpenHref } from '@/lib/task-address';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin,
  useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { tempId } from '@/lib/temp-id';
import { useSettling } from '@/lib/use-settling';

export type WeekTask = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; scheduled_date: string | null; is_inbox: boolean;
  project_id: string | null; parent_task_id: string | null; sort_order: number;
  recurrence: { freq?: string } | null;
};
export type WeekProject = { id: string; name: string; color: string | null };

// Module-level so the identity never changes — see the same note in
// tasks-view.tsx. `useServerState` compares by reference, and a `= []` default
// parameter is a new array every render, which loops.
const NO_SCOPES: Scope[] = [];
const NO_KEYS: string[] = [];
const NO_COUNTS: ScopeCounts = Object.freeze({});

// The header's stat line. Module scope, not in render — they close over nothing,
// and a component redeclared each render is a new type each render.
const Dot = () => <span aria-hidden className="text-ink-500">·</span>;
const Stat = ({ n, label }: { n: number | string; label: string }) => (
  <span className="whitespace-nowrap"><span className="font-medium tabular-nums text-ink-700">{n}</span> {label}</span>
);

const WEEKDAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

// ── A card on the board ──────────────────────────────────────────────────────
// The shared TaskCard in a sortable shell. The whole card is the drag handle (dnd-kit's 4px activation distance
// lets a click still reach the box, the title and the •••); a LIST ITEM, not dnd-kit's default role="button", because
// a button holding buttons is one tab stop swallowing others (the same reasoning as the Tasks board's card).
function WeekCard({ task, project, sub, onToggle, onOpen, onHighlight, menu }: {
  task: WeekTask; project?: WeekProject | null; sub?: { done: number; total: number };
  onToggle: () => void; onOpen: () => void; onHighlight: () => void; menu: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, attributes: { role: 'listitem', roleDescription: 'movable task' },
  });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('focus-ring touch-none rounded-md', isDragging && 'opacity-40')}
      aria-label={task.title} {...attributes} {...listeners}>
      <TaskCard task={task} project={project} sub={sub} showWhen={false}
        onToggle={onToggle} onOpen={onOpen} onHighlight={onHighlight} menu={menu} />
    </div>
  );
}

// ── The card's own verbs ─────────────────────────────────────────────────────
// Below the Open and Highlight every task card carries. Move to is this board's Schedule — the days of THIS week and
// Unscheduled; Project is the same submenu the Tasks list offers; Delete last. It replaces a hand-rolled menu whose
// "MOVE TO" day chips sat in a portal with its own outside-click and scroll handling.
function WeekCardMenu({ task, project, days, projects, onMove, onProject, onDelete }: {
  task: WeekTask; project?: WeekProject | null; days: WeekDay[]; projects: WeekProject[];
  onMove: (target: string) => void; onProject: (projectId: string | null) => void; onDelete: () => void;
}) {
  const here = task.is_inbox ? 'inbox' : task.scheduled_date;
  const targets = days.filter((d) => !d.past && d.id !== here);
  return (
    <>
      {!task.done && (targets.length > 0 || here !== 'inbox') && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<Icon icon={CalendarDays} size={16} />}>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {targets.map((d) => (
              <DropdownMenuItem key={d.id} onSelect={() => onMove(d.id)}>
                {d.today ? 'Today' : `${WEEKDAY_FULL[d.label] ?? d.label} ${d.date}`}
              </DropdownMenuItem>
            ))}
            {here !== 'inbox' && (
              <>
                {targets.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem icon={<Icon icon={Inbox} size={16} />} onSelect={() => onMove('inbox')}>Unscheduled</DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={<Icon icon={Folder} size={16} />} value={project?.name ?? null}>Project</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] w-52 overflow-y-auto">
          <DropdownMenuRadioGroup value={task.project_id ?? ''} onValueChange={(v) => onProject(v || null)}>
            <DropdownMenuRadioItem value="">No project</DropdownMenuRadioItem>
            {projects.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id}>
                <Icon icon={Folder} size={14} weight="fill" style={{ color: scopeFill(p.color, 'var(--color-ink-500)') }} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />} onSelect={onDelete}>Delete</DropdownMenuItem>
    </>
  );
}

// ── Adding in a column ───────────────────────────────────────────────────────
type AddSpec = { title: string; priority: WeekTask['priority']; estimateMinutes: number | null; projectId: string | null; dueDate: string | null };

/**
 * The house add line; pressed, it becomes a field that speaks the ONE task grammar (lib/task-parse — "!high 30m
 * #acme due friday"), with the parsed chips as its confirmation, exactly as Home's does. The COLUMN is the day, so the
 * grammar is not asked for one: a "when" token stays in the title rather than quietly moving the task out of the
 * column it was typed into. It stays open for the next task; Escape, or leaving it empty, puts it away.
 */
const COLUMN_DECIDES: ChipKind[] = ['when', 'inbox'];
function WeekAdd({ projects, onAdd }: { projects: WeekProject[]; onAdd: (spec: AddSpec) => void }) {
  const [open, setOpen] = useState(false);
  useFocusReturn(open);
  const [draft, setDraft] = useState('');
  const [ignored, setIgnored] = useState<Set<ChipKind>>(() => new Set(COLUMN_DECIDES));
  const inputRef = useRef<HTMLInputElement>(null);
  const refs = useMemo(() => projects.map((p) => ({ id: p.id, name: p.name })), [projects]);
  const parsed = useMemo(() => parseTask(draft, refs, ignored), [draft, refs, ignored]);
  const close = () => { setOpen(false); setDraft(''); setIgnored(new Set(COLUMN_DECIDES)); };
  const submit = () => {
    if (!parsed.title) { close(); return; }
    onAdd({ title: parsed.title, priority: parsed.priority ?? 'low', estimateMinutes: parsed.estimateMinutes, projectId: parsed.projectId, dueDate: parsed.dueDate });
    setDraft('');
    setIgnored(new Set(COLUMN_DECIDES));
    requestAnimationFrame(() => inputRef.current?.focus()); // keep open for rapid entry
  };
  if (!open) return <AddLine onClick={() => setOpen(true)}>Add task</AddLine>;
  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn(addLine({ as: 'field' }), 'rounded-md border border-line-strong bg-surface-raised')}>
        <Icon icon={Plus} size={14} className="shrink-0" />
        <input ref={inputRef} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') close(); }}
          onBlur={() => { if (!draft.trim()) close(); }}
          placeholder="Task name" aria-label="New task" autoComplete="off" data-1p-ignore data-lpignore="true"
          className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
      </label>
      {parsed.chips.length > 0 && (
        <ParsedChips className="px-1" chips={parsed.chips} onDismiss={(k) => setIgnored((s) => new Set(s).add(k))} />
      )}
    </div>
  );
}

// ── Column shell (droppable) ─────────────────────────────────────────────────
/**
 * One board column.
 *
 * `width` fixes it (the Unscheduled staging column); omitting it makes the column FLEX — `flex: 1 1 0` with a
 * `COL_DAY_MIN` floor — so the seven days share whatever the pane has instead of each demanding 268px. `week-col`
 * marks it as a container so a card inside can thin itself when the column gets narrow (ds-theme.css).
 *
 * Today wears the Calendar's own whisper (`surface-row`), not a grey slab: the column used `--fill-whisper`, ink at
 * 6% over a full-height column — the largest tinted area on the screen, for the smallest fact on it. Held over, a
 * column takes the house's "this one" wash (`BOARD_COLUMN.over`'s `surface-active`), with no accent outline running
 * through the card being carried.
 */
function Column({ id, width, today, last, header, footer, children }: {
  id: string; width?: number; today?: boolean; last?: boolean;
  header: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const sizing: React.CSSProperties = width != null
    ? { width, flex: '0 0 auto' }
    : { flex: '1 1 0', minWidth: COL_DAY_MIN, maxWidth: COL_DAY_MAX };
  return (
    <div ref={setNodeRef} style={sizing}
      className={cn('week-col flex min-h-0 flex-col transition-colors duration-fast', !last && 'border-r border-line-soft',
        isOver ? 'bg-surface-active' : today && 'bg-surface-row')}>
      {header}
      <div data-week-scroll className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pt-2.5 pb-4">{children}</div>
      {footer}
    </div>
  );
}

/**
 * A day's heading, in the Calendar's own words: the short weekday and the date, today's date in the accent circle
 * (components/calendar/week-grid.tsx). It read "Tuesday" at h2 size with "TODAY" beside it in tracked capitals.
 */
function DayHead({ d }: { d: WeekDay }) {
  const num = d.date.split(' ')[0];
  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-line-soft px-3">
      <span className={cn('text-ui font-medium', d.past ? 'text-ink-500' : 'text-ink-800')}>{d.label}</span>
      {d.today
        ? <span aria-label="Today" className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-caption font-semibold tabular-nums text-[var(--on-accent)]">{num}</span>
        : <span className={cn('text-ui tabular-nums', d.past ? 'text-ink-500' : 'text-ink-800')}>{num}</span>}
    </div>
  );
}

/**
 * Unscheduled, collapsed to a spine.
 *
 * Still a droppable with the same id, because a column you cannot drop onto is not collapsed — it is gone, and the
 * one gesture the board is built around (drag a task off the week and back into staging) would quietly stop working.
 */
function CollapsedInbox({ count, onExpand }: { count: number; onExpand: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'inbox' });
  return (
    <div ref={setNodeRef} style={{ width: COL_INBOX_COLLAPSED, flex: '0 0 auto' }}
      className={cn('flex min-h-0 flex-col items-center gap-2.5 border-r border-line-soft pt-2.5 transition-colors duration-fast', isOver && 'bg-surface-active')}>
      <IconButton size="sm" variant="ghost" label="Expand unscheduled" icon={<Icon icon={ChevronRight} size={14} />} onClick={onExpand} />
      {/* The count stays legible while collapsed — the whole reason you would expand it again is that something is
          waiting in there. */}
      <span className={cn('text-caption tabular-nums', count > 0 ? 'text-ink-800' : 'text-ink-500')}>{count}</span>
      <span aria-hidden className="select-none text-caption text-ink-500 [writing-mode:vertical-rl]">Unscheduled</span>
    </div>
  );
}

// Group pre-sorted tasks into ordered id lists per column. Tasks arrive sorted by
// (sort_order, created_at), so push order = display order.
function groupOrder(tasks: WeekTask[], days: WeekDay[]): Record<string, string[]> {
  const o: Record<string, string[]> = { inbox: [] };
  for (const d of days) o[d.id] = [];
  for (const t of tasks) {
    const c = !t.is_inbox && t.scheduled_date && o[t.scheduled_date] !== undefined ? t.scheduled_date : 'inbox';
    o[c].push(t.id);
  }
  return o;
}

export function WeekView({ days, initialTasks, projects, subByParent, rangeLabel, offset, viewSwitch, railCounts, savedViews = NO_SAVED_VIEWS as SavedViewDef[], savedViewsSupported = false, workHours = DEFAULT_WORK_HOURS, scopeCounts = NO_COUNTS, lists = NO_SCOPES, listsSupported = false, hiddenScopes = NO_KEYS }: {
  days: WeekDay[]; initialTasks: WeekTask[]; projects: Record<string, WeekProject>;
  subByParent: Record<string, { done: number; total: number }>; rangeLabel: string; offset: number; viewSwitch?: React.ReactNode;
  // The board only loads this week's tasks plus the unscheduled ones, so it
  // cannot derive the rail's numbers the way the list does — the route counts
  // them with the same query for both, which is what keeps the rail identical
  // across the switch instead of merely similar.
  railCounts: RailCounts; savedViews?: SavedViewDef[]; savedViewsSupported?: boolean;
  /** The piles, so this layout draws the SAME rail the list does — including
   *  the visibility checkboxes, which have to mean the same thing in both. */
  scopeCounts?: ScopeCounts; lists?: Scope[]; listsSupported?: boolean; hiddenScopes?: string[];
  /**
   * The hours the user says they work (§7C). The per-day bars used to measure
   * against a local `DAY_CAP = 360`, so the same Tuesday could be red here and
   * "a manageable day" on Home two clicks away — and neither read the day-end
   * the user gave at onboarding.
   *
   * Meetings are deliberately NOT counted here, unlike Home and the ritual: the
   * board only loads tasks, and fetching seven days of calendar events to
   * colour seven 4px bars is not a trade worth making. The bar therefore reads
   * "committed to tasks", which is what a task board is about; the day's full
   * load lives on Home, where the events are already loaded.
   */
  workHours?: WorkHours;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // A card opens its task, as a row does everywhere else — over the board (lib/task-address.ts). The week board's
  // cards could be dragged, ticked and deleted, but not opened.
  const open = (id: string) => router.push(taskOpenHref(pathname, window.location.search, id));
  // Generated, never a literal: dnd-kit derives the drag description's element
  // id from this and, given none, falls back to a MODULE-LEVEL COUNTER that
  // keeps counting on the server and restarts at 0 in the browser — which
  // hydrates `aria-describedby="DndDescribedBy-1"` against a client expecting
  // `-0` and makes React discard the subtree. A hard-coded string fixes that
  // but collides the moment two of these mount at once; `useId` does both.
  const dndId = useId();
  const narrow = useNarrow(760);
  const projectList = Object.values(projects);
  const projectScopes = useMemo<Scope[]>(
    () => projectList.map((p) => ({ kind: 'project', id: p.id, name: p.name, color: p.color })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects],
  );
  const scopes = useScopes({ projects: projectScopes, initialLists: lists, initialHidden: hiddenScopes });
  /** One number for all seven columns — the day the user says they have. */
  const dayCap = workMinutes(workHours);
  // Two-part state: `byId` holds task data; `order` holds the ordered id list per
  // column ('inbox' + each day id). Drag updates `order` (and `byId` for the moved
  // task's day), then persists day + sort_order via reorderTasks.
  const [byId, setById] = useState<Record<string, WeekTask>>(() => Object.fromEntries(initialTasks.map((t) => [t.id, t])));
  // One hook, every list: a ticked task holds its place for a beat before it leaves.
  const settling = useSettling();
  const [order, setOrder] = useState<Record<string, string[]>>(() => groupOrder(initialTasks, days));
  // `orderRef` is a SYNCHRONOUS mirror, not a `useLatest`: a drag reads it back
  // several times inside one gesture, before React has re-rendered, so it has to
  // be current the instant it is written. That is what `applyOrder` is for — and
  // it is now the only writer, so the ref cannot drift from the state. It used
  // to be re-synced during render (`orderRef.current = order`), which was the
  // one place the two could disagree, because the effect below set the state
  // without telling the ref.
  const orderRef = useRef(order);
  function applyOrder(next: Record<string, string[]>) { orderRef.current = next; setOrder(next); }

  // Re-seed from the server DURING RENDER, not in an effect.
  //
  // This used to be `useEffect(() => { setById(…); applyOrder(…) }, [initialTasks, days])`,
  // which React flags as `react-hooks/set-state-in-effect` and is a real defect
  // rather than a style note: an effect runs after paint, so a refresh painted
  // the stale board, committed it, then set state and painted again — one frame
  // of last week's columns on every navigation. Comparing during render makes
  // React restart the render before anything is committed, so the stale pass is
  // never shown. It is the same rule `useServerState` encodes; this board can't
  // use that hook directly because one server prop seeds TWO pieces of state
  // plus the synchronous `orderRef` mirror.
  const [seed, setSeed] = useState<{ tasks: WeekTask[]; days: WeekDay[] }>({ tasks: initialTasks, days });
  if (seed.tasks !== initialTasks || seed.days !== days) {
    setSeed({ tasks: initialTasks, days });
    setById(Object.fromEntries(initialTasks.map((t) => [t.id, t])));
    // `setOrder`, not `applyOrder`: writing a ref during render is its own
    // defect (the compiler says so, and it is right — render must be pure).
    // `onDragStart` re-points the mirror from the state it is rendering with,
    // which is strictly MORE correct than keeping it eagerly in sync: the ref
    // only has to be right for the duration of a gesture, and a gesture always
    // begins there.
    setOrder(groupOrder(initialTasks, days));
  }
  const snapshot = useRef<{ order: Record<string, string[]>; byId: Record<string, WeekTask> } | null>(null);
  // ── Does the week fit? ────────────────────────────────────────────────────
  // The staging column's collapsed state is remembered per browser, and read
  // AFTER mount rather than during render: `localStorage` does not exist on the
  // server, so seeding state from it directly would hydrate a collapsed board
  // into markup the server rendered open.
  const [inboxCollapsed, setInboxCollapsed] = useInboxCollapsed();

  // The board pane's own width, which is what decides whether seven days fit —
  // not the window's, because the tasks rail beside it takes 232 of them.
  const boardRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setPaneWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Only used to WORD the collapse tooltip — the layout itself is flexbox's job
  // (see lib/week-layout.ts). `paneWidth === 0` is "not measured yet", which
  // must read as "say nothing" rather than as "nothing fits".
  const fitsOpen = paneWidth === 0 || weekFits(paneWidth, days.length, false);
  const fitsCollapsed = paneWidth === 0 || weekFits(paneWidth, days.length, true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containers = ['inbox', ...days.map((d) => d.id)];
  const findContainer = (id: string) => (order[id] !== undefined ? id : containers.find((c) => (order[c] ?? []).includes(id)));

  const scheduledTasks = Object.values(byId).filter((t) => !t.is_inbox);
  const openCount = scheduledTasks.filter((t) => !t.done).length;
  const doneCount = scheduledTasks.filter((t) => t.done).length;
  const committedMin = scheduledTasks.filter((t) => !t.done).reduce((a, t) => a + (t.estimate_minutes ?? 0), 0);
  const inboxOpen = (order['inbox'] ?? []).filter((id) => byId[id] && !byId[id].done).length;
  // The column and the count are ONE decision: what is still to do, plus whatever is settling.
  const inboxIds = (order['inbox'] ?? []).filter((id) => byId[id] && (!byId[id].done || settling.ids.has(id)));

  async function toggle(id: string) {
    const t = byId[id]; if (!t) return;
    const nd = !t.done;
    setById((m) => ({ ...m, [id]: { ...m[id], done: nd } }));
    // The same beat every other list gives a ticked task (lib/use-settling.ts): it stays where it
    // is, struck through, long enough to see it land and to change your mind.
    if (nd) settling.hold(id); else settling.release(id);
    signalTaskToggle(nd);
    const res = await toggleTask(id, nd);
    if ('error' in res) { setById((m) => ({ ...m, [id]: { ...m[id], done: !nd } })); toastReverted(res.error); }
  }
  async function update(id: string, patch: Partial<Pick<WeekTask, 'priority' | 'project_id' | 'estimate_minutes'>>) {
    const prev = byId[id]; if (!prev) return;
    setById((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
    const res = await updateTask(id, patch);
    if ('error' in res) { setById((m) => ({ ...m, [id]: prev })); toastReverted(res.error); }
  }
  async function highlight(id: string) {
    const t = byId[id]; if (!t) return;
    const nh = !t.highlight;
    setById((m) => ({ ...m, [id]: { ...m[id], highlight: nh } }));
    const res = await setHighlight(id, nh);
    if ('error' in res) { setById((m) => ({ ...m, [id]: { ...m[id], highlight: !nh } })); toastReverted(res.error); }
  }
  async function del(id: string) {
    const snapO = order, snapB = byId;
    const c = findContainer(id);
    if (c) applyOrder({ ...order, [c]: order[c].filter((x) => x !== id) });
    setById((m) => { const n = { ...m }; delete n[id]; return n; });
    const res = await deleteTask(id);
    if ('error' in res) { applyOrder(snapO); setById(snapB); toastReverted(res.error); }
  }
  async function add(container: string, spec: AddSpec) {
    const tmp = tempId();
    const isInbox = container === 'inbox';
    const ids = order[container] ?? [];
    const sortOrder = ids.reduce((mx, tid) => Math.max(mx, byId[tid]?.sort_order ?? 0), 0) + 1;
    const temp: WeekTask = { id: tmp, title: spec.title, done: false, priority: spec.priority, highlight: false, estimate_minutes: spec.estimateMinutes, scheduled_date: isInbox ? null : container, is_inbox: isInbox, project_id: spec.projectId, parent_task_id: null, sort_order: sortOrder, recurrence: null };
    setById((m) => ({ ...m, [tmp]: temp }));
    applyOrder({ ...order, [container]: [...ids, tmp] });
    const res = await addTask({ title: spec.title, priority: spec.priority, estimateMinutes: spec.estimateMinutes, scheduledDate: isInbox ? null : container, isInbox, projectId: spec.projectId, dueDate: spec.dueDate, sortOrder });
    if ('id' in res) {
      const realId = res.id;
      setById((m) => { const n = { ...m }; const t = n[tmp]; if (t) { delete n[tmp]; n[realId] = { ...t, id: realId }; } return n; });
      applyOrder({ ...orderRef.current, [container]: (orderRef.current[container] ?? []).map((x) => (x === tmp ? realId : x)) });
    } else {
      setById((m) => { const n = { ...m }; delete n[tmp]; return n; });
      applyOrder({ ...orderRef.current, [container]: (orderRef.current[container] ?? []).filter((x) => x !== tmp) });
    }
  }
  // Write a column's day + 0..n sort_order to the DB (optimistic; rolls the whole
  // drag back to the pre-drag snapshot on failure).
  async function persistContainer(container: string, ord: Record<string, string[]>) {
    const isInbox = container === 'inbox';
    const ids = ord[container] ?? [];
    setById((m) => { const n = { ...m }; ids.forEach((tid, i) => { if (n[tid]) n[tid] = { ...n[tid], is_inbox: isInbox, scheduled_date: isInbox ? null : container, sort_order: i }; }); return n; });
    const updates = ids.map((tid, i) => ({ id: tid, scheduledDate: isInbox ? null : container, isInbox, sortOrder: i })).filter((u) => !u.id.startsWith('temp-'));
    if (!updates.length) return;
    const res = await reorderTasks(updates);
    if ('error' in res && snapshot.current) { applyOrder(snapshot.current.order); setById(snapshot.current.byId); }
  }
  // ••• "Move to" — append to the target column.
  function move(id: string, target: string) {
    const from = findContainer(id); if (!from || from === target) return;
    snapshot.current = { order, byId };
    const next = { ...order, [from]: (order[from] ?? []).filter((x) => x !== id), [target]: [...(order[target] ?? []), id] };
    applyOrder(next);
    persistContainer(target, next);
  }
  function onDragStart(e: DragStartEvent) {
    snapshot.current = { order, byId };
    orderRef.current = order;   // the mirror only has to be current for this gesture
    setActiveId(String(e.active.id));
  }
  function onDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const from = findContainer(active);
    const to = orderRef.current[over] !== undefined ? over : findContainer(over);
    if (!from || !to || from === to) return;
    const fromArr = [...orderRef.current[from]];
    const toArr = [...orderRef.current[to]];
    const fi = fromArr.indexOf(active); if (fi < 0) return;
    fromArr.splice(fi, 1);
    const oi = toArr.indexOf(over);
    toArr.splice(oi >= 0 ? oi : toArr.length, 0, active);
    applyOrder({ ...orderRef.current, [from]: fromArr, [to]: toArr });
  }
  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!over) { if (snapshot.current) { applyOrder(snapshot.current.order); setById(snapshot.current.byId); } return; }
    const container = orderRef.current[over] !== undefined ? over : findContainer(over);
    if (!container) return;
    const arr = [...(orderRef.current[container] ?? [])];
    const from = arr.indexOf(active);
    let to = arr.indexOf(over);
    if (to < 0) to = arr.length - 1;
    const next = from === to || from < 0 ? orderRef.current : { ...orderRef.current, [container]: arrayMove(arr, from, to) };
    applyOrder(next);
    persistContainer(container, next);
  }
  const activeTask = activeId ? byId[activeId] ?? null : null;

  // One card, with its verbs, for any column — and the overlay draws the same card lifted.
  const card = (id: string) => {
    const t = byId[id];
    if (!t) return null;
    const project = t.project_id ? projects[t.project_id] ?? null : null;
    return (
      <WeekCard key={id} task={t} project={project} sub={subByParent[id]}
        onToggle={() => toggle(id)} onOpen={() => open(id)} onHighlight={() => highlight(id)}
        menu={<WeekCardMenu task={t} project={project} days={days} projects={projectList}
          onMove={(target) => move(id, target)} onProject={(pid) => update(id, { project_id: pid })} onDelete={() => del(id)} />} />
    );
  };

  // The week board is a HUB whose detail is a CANVAS: the same rail Tasks
  // draws, beside a board that owns its own horizontal scrolling. `bleed`
  // because a board is not a reading column, `railPadding={false}` because the
  // rail brings its own section rhythm — the same two answers Tasks gives, from
  // the same component, which is what keeps the two halves of Tasks identical
  // down their left edge.
  return (
    <HubLayout
      railLabel="Task views"
      railPadding={false}
      bleed
      rail={(
        <TasksRail
          counts={railCounts}
          scopeCounts={scopeCounts}
          projects={scopes.projects}
          lists={scopes.lists}
          listsSupported={listsSupported}
          savedViews={savedViews}
          savedViewsSupported={savedViewsSupported}
          // The board is a LAYOUT, not one of the rail's views — nothing is lit,
          // and picking any row takes you to the list showing it.
          active={{ view: 'board', scope: null }}
          narrow={narrow}
          // A real navigation here: the board holds only this week's tasks, so
          // anything the rail selects genuinely needs the server.
          onSelect={(f) => router.push(railHref(f))}
          hidden={scopes.hidden}
          onToggleScope={scopes.toggle}
          onCreateList={scopes.createList}
          onRenameList={scopes.renameList}
          onRecolourList={scopes.recolourList}
          onDeleteList={scopes.deleteList}
        />
      )}
      lead={(
        <ButtonGroup>
          <Button size="sm" variant="outline" iconOnly aria-label="Previous week"
            onClick={() => router.push(`/tasks?view=week&w=${offset - 1}`)} icon={<Icon icon={ChevronLeft} size={14} />} />
          <Button size="sm" variant="outline" iconOnly aria-label="Next week"
            onClick={() => router.push(`/tasks?view=week&w=${offset + 1}`)} icon={<Icon icon={ChevronRight} size={14} />} />
        </ButtonGroup>
      )}
      // Off the current week, "Week" names nothing — the dates are the scope.
      title={offset === 0 ? 'This week' : rangeLabel}
      subtitle={(
        <span className="inline-flex flex-wrap items-center gap-2">
          {offset === 0 && <><span>{rangeLabel}</span><Dot /></>}
          <Stat n={openCount} label="open" />
          <Stat n={doneCount} label="done" />
          <Stat n={inboxOpen} label="unscheduled" /><Dot />
          <Stat n={formatMinutes(committedMin)} label="planned" />
        </span>
      )}
      actions={(
        <>
          {offset !== 0 && <Button size="sm" variant="outline" onClick={() => router.push('/tasks?view=week')}>This week</Button>}
          {viewSwitch}
        </>
      )}
    >
      <DndContext id={dndId} sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div ref={boardRef} className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full" style={{ minWidth: boardMinWidth(days.length, inboxCollapsed) }}>
            {/* Unscheduled — the staging column, collapsible so the week can have its width back. Collapsed it is a
                44px spine you can still drop onto, because a column you cannot reach is not collapsed, it is gone. */}
            {inboxCollapsed ? (
              <CollapsedInbox count={inboxOpen} onExpand={() => setInboxCollapsed(false)} />
            ) : (
            <Column id="inbox" width={COL_INBOX} header={
              // The same 44px heading as a day's, so every column's cards start on one line across the board.
              <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-line-soft ps-3 pe-1.5" title="Drag a task onto a day to plan it">
                {/* "Unscheduled", not "Inbox": the rail beside it says Inbox, and the same word twice on one screen
                    for two different things — a place you navigate to and a column you drag out of — is the
                    duplication this pass removes. The rows are the same rows. */}
                <span className="text-ui font-medium text-ink-800">Unscheduled</span>
                <span className="text-caption tabular-nums text-ink-500">{inboxOpen}</span>
                <span className="flex-1" />
                <IconButton size="sm" variant="ghost" label="Collapse unscheduled"
                  tooltip={fitsCollapsed && !fitsOpen ? 'Collapse: this is what is hiding the rest of your week' : 'Collapse unscheduled'}
                  icon={<Icon icon={ChevronLeft} size={14} />} onClick={() => setInboxCollapsed(true)} />
              </div>
            }>
              <WeekAdd projects={projectList} onAdd={(spec) => add('inbox', spec)} />
              {/* WHAT IS STILL TO DO. This column listed the whole unscheduled pile — finished work
                  included — while the header beside it counted only what was open, so a board
                  reading "6 unscheduled" could show fourteen rows, nearly all struck through (user
                  screenshot, 2026-09-24). A task that is done and was never scheduled is not
                  waiting to be planned; it is just done. The DAY columns keep theirs, because
                  there a completed task is the record of that day.

                  Not a blunt `!done`: a task ticked here holds its place for the beat first
                  (lib/use-settling.ts), so it never vanishes under the pointer. */}
              <SortableContext items={inboxIds} strategy={verticalListSortingStrategy}>
                <div role="list" aria-label="Unscheduled tasks" className="flex flex-col gap-2">
                  {inboxIds.map(card)}
                </div>
              </SortableContext>
              {inboxIds.length === 0 && <EmptyLine className="px-2 py-2">Nothing unscheduled.</EmptyLine>}
            </Column>
            )}

            {/* Day columns */}
            {days.map((d, i) => {
              const ids = order[d.id] ?? [];
              const committed = ids.reduce((a, id) => a + (byId[id] && !byId[id].done ? (byId[id].estimate_minutes ?? 0) : 0), 0);
              const over = committed > dayCap;
              return (
                <Column key={d.id} id={d.id} today={d.today} last={i === days.length - 1}
                  header={<DayHead d={d} />}
                  footer={
                    <div className="flex shrink-0 items-center gap-2 border-t border-line-soft px-3 py-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-fill">
                        {/* Amber, not red. An overloaded day is a planning signal (§7O) — red is for something being
                            wrong, and a full Wednesday is not wrong. Home says the same thing in the same colour. */}
                        <span className={cn('block h-full rounded-full', over ? 'bg-warning-500' : 'bg-ink-400')}
                          style={{ width: `${Math.min(100, (committed / dayCap) * 100)}%` }} />
                      </span>
                      <span className={cn('min-w-8 text-right text-caption tabular-nums', over ? 'text-warning-600' : 'text-ink-500')}>{formatMinutes(committed)}</span>
                    </div>
                  }
                >
                  {!d.past && <WeekAdd projects={projectList} onAdd={(spec) => add(d.id, spec)} />}
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div role="list" aria-label={`${WEEKDAY_FULL[d.label] ?? d.label} tasks`} className="flex flex-col gap-2">
                      {ids.map(card)}
                    </div>
                  </SortableContext>
                  {/* An empty day says nothing — its add line is the invitation. It used to say "Open." or "Rest.". */}
                </Column>
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={dropSettle()}>
          {activeTask ? (
            <div style={{ width: COL_DAY_MIN + 40 }}>
              <TaskCard task={activeTask} project={activeTask.project_id ? projects[activeTask.project_id] : null} sub={subByParent[activeTask.id]} showWhen={false} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </HubLayout>
  );
}

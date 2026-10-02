'use client';
// Tasks, list layout — the shared rail (components/tasks/tasks-rail.tsx, drawn
// identically by the week board) beside the task pane: Filter + layout header,
// an add line that expands into a full composer, and the shared `TaskRow` —
// the same row Home and a project's Tasks tab draw.
// The Inbox is one of the rail's views, and Triage — processing it one thought
// at a time — lives here too; both used to be a separate /inbox page.
// All mutations reuse the shared task actions (optimistic w/ rollback), and the
// natural-language capture lives on inside the composer title as live hints.
//
// Built entirely from the design system: TaskRow + TaskMeta (the one task
// row and the one way to draw its facts), §4.34 DropdownMenu (rail/row/header
// menus), §5.1 Button, AddLine. No inline styles, no legacy Paper-OS tokens,
// no hand-rolled popovers — every colour, size, radius, and motion value comes
// from a token.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus, Sun, Inbox as Tray, CalendarDays as CalendarDots, Timer, Repeat, Trash2 as Trash, Flag, Folder, Filter as FunnelSimple, ChevronDown as CaretDown, AlarmClock as Alarm, Tag as TagIcon, Check, Upload, ListChecks, List as ListIcon, Rows3, Kanban } from "@/components/ds/icons";
import { Icon, Button, AddLine, Kbd, PriorityBars, EmptyState as EmptyStateBase, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, MENU_PANEL_CLASS, SegmentedControl, EmptyLine, DatePicker, Presence, Move, MOTION, EXIT_ROW, toast, toastReverted, cardClass } from '@/components/ds/ui';
import { TasksRail } from '@/components/tasks/tasks-rail';
import { CompletedSection } from '@/components/tasks/completed-section';
import { TaskRow } from '@/components/tasks/task-row';
import { TasksBoard, type BoardColumn } from '@/components/tasks/tasks-board';
import { useSettling, splitSettled } from '@/lib/use-settling';
import { scopeFill } from '@/lib/entity-color';
import { applyPending } from '@/lib/mutation-queue';
import { push as queueMutation, MUTATION_REVERTED, type RevertedDetail } from '@/lib/mutation-store';
import { usePendingMutations } from '@/lib/use-pending-mutations';
import { useScopes } from '@/components/tasks/use-scopes';
import { findScope, readRailState, railStateHref, NO_SAVED_VIEWS, type View, type TaskProject, type SavedViewDef, type ScopeCounts, type RailState } from '@/components/tasks/types';
import { useUrlState } from '@/lib/use-url-state';
import { afterProjectChange, taskScopes, visibleTasks, groupIntoColumns, NO_SCOPE, type Scope } from '@/lib/task-scopes';
import { taskOpenHref } from '@/lib/task-address';
import { setTaskList } from '@/lib/actions/task-lists';
// Re-exported so the route and the harnesses keep one import site for the module.
export type { View, TaskProject, SavedViewDef } from '@/components/tasks/types';
import { HubLayout } from '@/components/ui/hub-layout';
import { Triage, type InboxTask, type TriageSuggestResult, type UndoKind } from '@/components/tasks/triage';
import { addTask, deleteTask, moveTaskToProject, returnToInbox, setTaskOrder } from '@/lib/actions/tasks';
import { setTaskLabel } from '@/lib/actions/labels';
import { useListCursor, useListKeys } from '@/lib/list-keys';
import { parseTask } from '@/lib/task-parse';
import { signalTaskToggle } from '@/lib/sound';
import { useNarrow } from '@/lib/use-narrow';
import { formatDay, formatMinutes, formatRelativeDay, todayISO as dayToday, addDaysISO, isoDateIn } from '@/lib/date';
import { cn } from '@/lib/cn';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';
import { useChanged } from '@/lib/use-changed';

export type TaskItem = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; scheduled_date: string | null; is_inbox: boolean;
  project_id: string | null; recurrence: { freq?: string } | null; parent_task_id: string | null;
  // 0038. Optional because the column does not exist until the migration is
  // applied — the route omits it from the select and every rule below reads a
  // missing value as "no list", which is exactly the pre-0038 behaviour.
  list_id?: string | null;
  // Triage drains the queue oldest-first and tells you how long a thought has
  // been sitting there, so this is required by the Inbox view. Optional only
  // because the dev-preview harnesses predate it.
  created_at?: string;
};

type Filter = 'all' | 'high' | 'highlights' | 'recurring' | 'noEstimate';

const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; };

// The keyboard grammar's inline picker (S/P/L) — one small popover reused for
// schedule, project, and label, anchored to the focused row. Mirrors §7 popover
// rules: bg-surface-raised, hairline, radius-lg, h-8 rounded-md items, number
// hotkeys. Kept dependency-free (fixed position from the row rect) so it never
// fights the Radix menus already on the row.
type RowMenuKind = 'schedule' | 'project' | 'list' | 'label';
type RowMenuOpt = { label: string; color?: string | null; isLabel?: boolean; on?: boolean; run: () => void };

// Natural-language capture — delegates to the shared grammar in
// lib/task-parse.ts (one parser behind Quick Capture, ⌘K, and this composer),
// mapped to the local hint shape. `date`/`dueDate` are resolved ISO strings;
// the *Label fields carry the human wording for the hint chips.
function parse(raw: string, projects: TaskProject[]) {
  const p = parseTask(raw, projects);
  return {
    title: p.title,
    priority: p.priority,
    estimate: p.estimateMinutes,
    projectId: p.projectId,
    date: p.scheduledDate,
    dateLabel: p.chips.find((c) => c.kind === 'when')?.label ?? null,
    dueDate: p.dueDate,
    dueLabel: p.chips.find((c) => c.kind === 'due')?.label ?? null,
    isInbox: p.isInbox,
    freq: p.recurrence?.freq ?? null,
  };
}

const PRIO_LABEL: Record<string, string> = { high: 'High', med: 'Medium', low: 'Low' };

// ── Priority picker (design: "Change priority" menu — semantic signal bars per
//    level + Urgent alarm + keyboard hint). Composer-local: Urgent maps to High on
//    save, since tasks.priority is constrained to low/med/high. In B&G, colour is
//    reserved for meaning — priority is one such place (danger/warning/neutral). ──
type CPrio = 'low' | 'med' | 'high' | 'urgent' | null;
const PRIO_OPTS: { id: CPrio; label: string }[] = [
  { id: null, label: 'No priority' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'med', label: 'Medium' },
  { id: 'low', label: 'Low' },
];
const prioLabel = (id: CPrio) => PRIO_OPTS.find((o) => o.id === id)?.label ?? 'Priority';

// Priority glyph: the shared semantic PriorityBars, with Urgent shown as a danger
// alarm and "no priority" as a neutral flag.
function PrioGlyph({ id, size = 16 }: { id: CPrio; size?: number }) {
  if (id === 'urgent') return <Icon icon={Alarm} size={size} weight="fill" className="shrink-0 text-danger-500" />;
  if (id === null) return <Icon icon={Flag} size={size} className="shrink-0 text-ink-500" />;
  return <PriorityBars level={id} size={size} />;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All tasks' }, { id: 'high', label: 'High priority' }, { id: 'highlights', label: 'Highlights' },
  { id: 'recurring', label: 'Recurring' }, { id: 'noEstimate', label: 'No estimate' },
];

// Triage sorts oldest-first on created_at and prints each thought's age. The
// route always selects it; this only stands in for the dev-preview harnesses,
// and it is a constant so the queue's sort can't shuffle between renders.
const EPOCH = '1970-01-01T00:00:00.000Z';

export type TaskLabelDef = { id: string; name: string; color?: string | null };

// STABLE EMPTY DEFAULTS, and they have to be module-level constants rather than
// `= []` in the parameter list.
//
// A default parameter builds a NEW array every render the prop is omitted, and
// `useServerState` compares the server value with `Object.is`. A fresh identity
// each render therefore reads as "the server sent something new", so it sets
// state during render, which restarts the render, which builds another new
// array — an infinite loop that also wipes whatever the user just did. This
// cost a real debugging round: the visibility toggle worked and then silently
// undid itself. One shared frozen instance means the identity never changes.
const NO_SCOPES: Scope[] = [];
const NO_KEYS: string[] = [];
const NO_TASK_LABELS: Record<string, string[]> = Object.freeze({});

export function TasksView({
  initialTasks, projects, subByParent, labels = [], taskLabels = NO_TASK_LABELS, savedViews = NO_SAVED_VIEWS as SavedViewDef[], savedViewsSupported = false,
  lists = NO_SCOPES, listsSupported = false, hiddenScopes = NO_KEYS, onSuggestFiling,
}: {
  initialTasks: TaskItem[]; projects: Record<string, TaskProject>; subByParent: Record<string, { done: number; total: number }>; labels?: TaskLabelDef[]; taskLabels?: Record<string, string[]>; savedViews?: SavedViewDef[]; savedViewsSupported?: boolean;
  /** 0038. Empty + unsupported until the migration is applied. */
  lists?: Scope[]; listsSupported?: boolean;
  /** Scope keys switched off in the rail, read from `profiles.preferences` by
   *  the route so the first paint is already right. */
  hiddenScopes?: string[];
  /** Ask the clerk where the Inbox's thoughts go (§7Q *File*). Absent ⇒ triage offers nothing,
   *  which is what the dev-preview harnesses get: they have no session to spend an allowance. */
  onSuggestFiling?: () => Promise<TriageSuggestResult>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // ── WHERE THE RAIL'S SELECTION LIVES ──────────────────────────────────────
  // Still the URL — linkable, shareable, Back works. But changing it no longer
  // asks the server anything.
  //
  // It used to: the route read `?view` / `?scope` / `?filter`, passed them as
  // props, and KEYED this component on them so a rail click remounted the whole
  // thing. Which meant clicking "Today" re-fetched every task you own, to draw
  // a subset of the tasks already sitting in this component's state, and threw
  // away your scroll position and any open menu on the way.
  //
  // Every one of these choices is a question the browser can already answer, so
  // it now answers them: `useUrlState` writes with `pushState`, `useSearchParams`
  // re-renders, and nothing crosses the network. The one exception is the WEEK
  // board, which loads a different seven-day window — `go` instead of `set`.
  const url = useUrlState<RailState>(readRailState, railStateHref);
  const { view, scope, layout } = url.value;
  const filter = url.value.filter as Filter;
  const labelFilter = url.value.labelId;
  const setRail = (patch: Partial<RailState>) => {
    const next = { ...url.value, ...patch };
    // Only the week board needs the server. Everything else is already here.
    if (next.layout === 'week') url.go(next); else url.set(next);
  };

  const projectList = Object.values(projects);
  const [serverTasks, setTasks] = useServerState(initialTasks);

  // THE SERVER'S ROWS, WITH UNDELIVERED EDITS RE-LAID ON TOP.
  //
  // `useServerState` snaps to whatever the server last said. That is right when
  // everything has been delivered and wrong the instant something has not: a
  // tick still sitting in the queue would vanish off the screen the moment
  // anything refreshed — a realtime nudge from another device, the
  // revalidate-on-stale pass, a `router.refresh()` after some unrelated edit.
  //
  // THE OVERLAY IS APPLIED AT RENDER, NOT FED INTO `useServerState`. Passing
  // `applyPending(initialTasks, pending)` as the seed looks tidier and is a
  // bug: the seed's identity changes on every queue movement — a push, an op
  // going in flight, an op being delivered — and `useServerState` compares by
  // reference, so each of those would snap local state back and silently
  // discard optimistic edits that are NOT in the queue yet, like a task you
  // had just created. Overlaying here leaves the server-backed state alone and
  // only changes what is drawn.
  const pending = usePendingMutations();
  const tasks = useMemo(() => applyPending(serverTasks, pending), [serverTasks, pending]);

  // The piles, their visibility, and the list CRUD the rail's menu drives —
  // one hook so the list layout and the board can never disagree about which
  // lists exist or which are switched off.
  const projectScopes = useMemo<Scope[]>(
    () => projectList.map((p) => ({ kind: 'project', id: p.id, name: p.name, color: p.color })),
    // projectList is rebuilt from `projects` each render; the map's identity is
    // what matters to the consumers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects],
  );
  const scopes = useScopes({ projects: projectScopes, initialLists: lists, initialHidden: hiddenScopes });
  const activeScope = findScope(scopes.all, scope);

  const setFilter = (f: Filter) => setRail({ filter: f, ...(f === 'all' ? { labelId: null } : {}) });
  const setLabelFilter = (id: string | null) => setRail({ labelId: id });
  const [composing, setComposing] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const narrow = useNarrow(760);

  // ── keyboard grammar (§6.3) — a roving focus over the visible rows plus the
  //    single-key actions ⏎/e/t/s/p/l/1·2·3. Focus is visual state (no DOM focus
  //    stealing), keys are handled at the window so they survive mouse clicks. ──
  const [menu, setMenu] = useState<{ kind: RowMenuKind; id: string; rect: { top: number; bottom: number; left: number } } | null>(null);
  useFocusReturn(!!menu);
  const [menuSel, setMenuSel] = useState(0);
  const [labelOverride, setLabelOverride] = useState<Record<string, string[]>>({});

  // The day ids come from the vocabulary, not from a private copy of the rule
  // and a raw clock read during render. `todayISO()` is also the app's answer
  // to *which* day it is — the local calendar date, never the UTC one.
  const todayISO = dayToday();
  const tomorrowISO = addDaysISO(todayISO, 1);
  const nextWeekISO = isoDateIn(nextMonday())!;

  // A pile (project OR list) is its own scope — everything filed under it, no
  // matter when it's due. It used to leave `view` untouched, so picking one
  // showed the intersection of that pile and whichever view you happened to be
  // in: from the default Inbox that meant "project tasks still in the inbox",
  // which is close to none, because filing a task IS what takes it out of the
  // inbox. The rail's most-used section looked empty.
  //
  // `matchesView` deliberately no longer excludes finished tasks. A task you
  // tick off has to stay in the list long enough to settle into the Completed
  // group below it — filtering `!t.done` here is exactly what made a row vanish
  // out from under the finger that ticked it. `splitSettled` decides which of
  // the two sections draws it.
  const matchesView = (t: TaskItem) => {
    if (scope) return true;
    if (view === 'inbox') return t.is_inbox;
    if (view === 'today') return t.scheduled_date === todayISO && !t.is_inbox;
    return t.done;
  };
  const matchesFilter = (t: TaskItem) => {
    // Scope membership, not the board's column rule: a Life-studio task filed
    // under Priority is still Life studio's, so clicking that project shows it.
    if (scope && !taskScopes(t).includes(scope)) return false;
    if (labelFilter && !(taskLabels[t.id] ?? []).includes(labelFilter)) return false;
    if (filter === 'high') return t.priority === 'high';
    if (filter === 'highlights') return t.highlight;
    if (filter === 'recurring') return !!t.recurrence;
    if (filter === 'noEstimate') return t.estimate_minutes == null;
    return true;
  };
  // The rail's switched-off piles apply BEFORE anything else, in every view:
  // "when turned off, its tasks should not appear in the current view" is not a
  // rule about one screen. Standing on the pile itself is the one exception —
  // you asked for it by name, so it is shown even while its box is unticked,
  // rather than presenting an empty list with no explanation.
  const shown = useMemo(
    () => (scope ? tasks : visibleTasks(tasks, scopes.hidden)),
    [tasks, scopes.hidden, scope],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inView = useMemo(() => shown.filter((t) => matchesView(t) && matchesFilter(t)), [shown, view, filter, labelFilter, taskLabels, scope, todayISO]);

  // Just-ticked rows stay in place for a beat, then settle into Completed —
  // lib/use-settling.ts, the same behaviour Home and the project tabs use.
  const settling = useSettling();
  // The Completed VIEW is already nothing but finished work; splitting it would
  // leave an empty list above a collapsed group holding everything.
  const grouped = view !== 'completed' || !!scope;
  const split = useMemo(() => splitSettled(inView, settling.ids), [inView, settling.ids]);
  const visible = grouped ? split.active : inView;
  // The roving cursor is shared (lib/list-keys.ts) — visual state, never DOM
  // focus. It takes the list length so IT clamps when the list shrinks; this
  // view used to do that by hand a few hundred lines below. `focusIdx` stays as
  // a local alias so the read sites below are unchanged.
  const cursor = useListCursor(visible.length);
  const focusIdx = cursor.index;
  const completed = grouped ? split.completed : [];

  const counts: Record<View, number> = useMemo(() => ({
    inbox: tasks.filter((t) => t.is_inbox && !t.done).length,
    today: tasks.filter((t) => t.scheduled_date === todayISO && !t.is_inbox && !t.done).length,
    completed: tasks.filter((t) => t.done).length,
  }), [tasks, todayISO]);

  // ── The board's columns ───────────────────────────────────────────────────
  // The board ignores the rail's VIEW on purpose. Inbox and Today are two ways
  // of slicing time; a board is a way of seeing your piles, and a board that
  // only ever showed today's tasks would leave most columns empty. It still
  // honours the switched-off piles and the Filter menu, because those are
  // statements about what you want to see at all.
  const boardTasks = useMemo(
    () => visibleTasks(tasks, scopes.hidden).filter((t) => matchesFilter(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, scopes.hidden, filter, labelFilter, taskLabels, scope],
  );
  const boardColumns: BoardColumn[] = useMemo(
    () => groupIntoColumns(boardTasks, scopes.visible).map((c) => ({
      key: c.key,
      // "Unfiled", not "No list": this column also holds tasks that are in no
      // PROJECT, and calling it "No list" would be a half-truth about half of them.
      name: c.scope?.name ?? 'Unfiled',
      swatch: scopeFill(c.scope?.color),
      tasks: c.tasks,
    })),
    [boardTasks, scopes.visible],
  );

  // The number beside each pile: open work in it. Membership, so a task in a
  // project AND a list counts once in each — both rows are telling the truth
  // about their own pile.
  const scopeCounts: ScopeCounts = useMemo(() => {
    const c: ScopeCounts = {};
    for (const t of tasks) {
      if (t.done) continue;
      for (const k of taskScopes(t)) c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [tasks]);

  // ── mutations (optimistic) ──
  /**
   * Tick a task off — QUEUED, not awaited.
   *
   * This used to `await toggleTask(id, nd)` and roll back on error. Close the
   * tab inside that ~300ms and the tick was gone, after the interface had
   * already told you it was saved. Now the intent is written to disk before
   * this function returns and delivered by the worker — this tab, the next one
   * you open, or, if the server finally refuses, undone in front of you with a
   * reason (`MUTATION_REVERTED`, handled below).
   */
  function toggle(id: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const nd = !t.done;
    // Start (or cancel) the settle beat BEFORE the optimistic write, so the row
    // is already held in place by the time it is marked done and never blinks
    // through the Completed group on its way.
    if (nd) settling.hold(id); else settling.release(id);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: nd } : x)));
    signalTaskToggle(nd);
    queueMutation({
      kind: 'task.toggle', recordId: id, args: [id, nd],
      patch: { done: nd }, revert: { done: t.done },
    });
  }
  /** QUEUED, for the same reason `toggle` is — see the note there. */
  function highlight(id: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const nh = !t.highlight;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, highlight: nh } : x)));
    queueMutation({
      kind: 'task.highlight', recordId: id, args: [id, nh],
      patch: { highlight: nh }, revert: { highlight: t.highlight },
    });
  }
  async function remove(id: string) {
    const snap = tasks;
    setTasks((ts) => ts.filter((x) => x.id !== id));
    const res = await deleteTask(id);
    if ('error' in res) { setTasks(snap); toastReverted(res.error); }
  }
  /** QUEUED. Dragging a task to another day is the edit most likely to be
   *  followed immediately by closing the tab, so it is the one that most needs
   *  to survive it. `rescheduleTask` takes the target VALUE, not a delta, so it
   *  is safe to retry and safe to collapse. */
  function reschedule(id: string, target: string) {
    const prev = tasks.find((x) => x.id === id); if (!prev) return;
    const isInbox = target === 'inbox';
    const next = { is_inbox: isInbox, scheduled_date: isInbox ? null : target };
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, ...next } : x)));
    queueMutation({
      kind: 'task.reschedule', recordId: id, args: [id, target],
      patch: next,
      revert: { is_inbox: prev.is_inbox, scheduled_date: prev.scheduled_date },
    });
  }

  type ComposerSpec = { title: string; notes: string; date: string | null; priority: TaskItem['priority'] | null; projectId: string | null; dest: 'inbox' | 'today' | 'tomorrow'; estimate: number | null };
  async function create(spec: ComposerSpec) {
    const hint = parse(spec.title, projectList);
    if (!hint.title) return;
    const priority = spec.priority ?? hint.priority ?? 'low';
    const projectId = spec.projectId ?? hint.projectId;
    const isInbox = spec.date ? false : (hint.date ? false : spec.dest === 'inbox');
    const scheduledDate = spec.date ?? hint.date ?? (spec.dest === 'today' ? todayISO : spec.dest === 'tomorrow' ? tomorrowISO : null);
    const recurrence = hint.freq ? { freq: hint.freq } : null;
    const tmp = tempId();
    setTasks((ts) => [...ts, { id: tmp, title: hint.title, done: false, priority, highlight: false, estimate_minutes: spec.estimate ?? hint.estimate, scheduled_date: isInbox ? null : scheduledDate, is_inbox: isInbox, project_id: projectId, recurrence, parent_task_id: null }]);
    const res = await addTask({ title: hint.title, priority, estimateMinutes: spec.estimate ?? hint.estimate, scheduledDate: isInbox ? null : scheduledDate, isInbox, projectId, recurrence, dueDate: hint.dueDate, notes: spec.notes || null });
    if ('id' in res) setTasks((ts) => ts.map((t) => (t.id === tmp ? { ...t, id: res.id } : t)));
    else setTasks((ts) => ts.filter((t) => t.id !== tmp));
  }

  // ── Board mutations ───────────────────────────────────────────────────────
  /** Quick-add straight into a column: the pile the column stands for is the
   *  pile the new task lands in. It goes to the Inbox in the sense that matters
   *  — no date — but it is already filed, so it never needs triaging. */
  async function addToColumn(key: string, title: string) {
    const clean = title.trim();
    if (!clean) return;
    const [kind, id] = key === NO_SCOPE ? ['none', null] : (key.split(':') as [string, string]);
    const projectId = kind === 'project' ? id : null;
    const listId = kind === 'list' ? id : null;
    const tmp = tempId();
    setTasks((ts) => [...ts, {
      id: tmp, title: clean, done: false, priority: 'low', highlight: false,
      estimate_minutes: null, scheduled_date: null, is_inbox: kind === 'none',
      project_id: projectId, list_id: listId, recurrence: null, parent_task_id: null,
      created_at: new Date().toISOString(),
    }]);
    const res = await addTask({ title: clean, isInbox: kind === 'none', projectId, scheduledDate: null });
    if (!('id' in res)) { setTasks((ts) => ts.filter((t) => t.id !== tmp)); return; }
    setTasks((ts) => ts.map((t) => (t.id === tmp ? { ...t, id: res.id } : t)));
    // `addTask` predates lists, so filing is a second write rather than a
    // widened signature — the alternative is a `listId` parameter that every
    // pre-0038 account would send to a column that does not exist.
    if (listId) await setTaskList(res.id, listId);
  }

  /**
   * A card was dropped into a column.
   *
   * TWO WRITES, deliberately kept apart: where the task is FILED, and where it
   * sits in the column. Re-filing is the meaningful change and must land even
   * if the ordering write fails; ordering is cosmetic and never worth rolling
   * a re-file back for.
   */
  async function dropTask(taskId: string, key: string, index: number) {
    const t = tasks.find((x) => x.id === taskId); if (!t) return;
    const [kind, id] = key === NO_SCOPE ? ['none', null] : (key.split(':') as [string, string]);

    // Dropping onto a PROJECT column has to clear the list as well, because the
    // list wins the column (lib/task-scopes.ts, rule 2) — leaving it set would
    // spring the card straight back to where it came from. Dropping onto a LIST
    // column leaves the project alone: the two answer different questions, and
    // quietly un-filing the client work would lose who gets billed.
    // "Unfiled" means exactly that, so it clears both.
    const patch: Partial<TaskItem> =
      kind === 'list' ? { list_id: id, is_inbox: false }
        : kind === 'project' ? { project_id: id, list_id: null, is_inbox: false }
          : { project_id: null, list_id: null };

    const before = { project_id: t.project_id, list_id: t.list_id ?? null, is_inbox: t.is_inbox };
    // Reorder locally by moving the row to sit just before whatever currently
    // occupies that slot in the target column — the column order is the array
    // order, so this is the whole of "put it at index n".
    const target = boardColumns.find((c) => c.key === key);
    const anchorId = target?.tasks.filter((x) => x.id !== taskId)[index]?.id ?? null;
    setTasks((ts) => {
      const moved = { ...t, ...patch };
      const rest = ts.filter((x) => x.id !== taskId);
      const at = anchorId ? rest.findIndex((x) => x.id === anchorId) : -1;
      if (at < 0) return [...rest, moved];
      return [...rest.slice(0, at), moved, ...rest.slice(at)];
    });

    const res = kind === 'list'
      ? await setTaskList(taskId, id)
      : kind === 'project'
        ? await moveTaskToProject(taskId, id!)
        : await Promise.all([setTaskList(taskId, null), moveTaskToProject(taskId, null)])
          .then((rs) => rs.find((r) => 'error' in r) ?? ({ ok: true as const }));
    if ('error' in res) { setTasks((ts) => ts.map((x) => (x.id === taskId ? { ...x, ...before } : x))); toastReverted(res.error); return; }

    // Renumber the whole target column rather than computing a midpoint: a
    // column holds tens of rows, not thousands, and one pass can never produce
    // the tie that a fractional index eventually does.
    const after = groupIntoColumns(
      visibleTasks(tasks.map((x) => (x.id === taskId ? { ...x, ...patch } : x)), scopes.hidden),
      scopes.visible,
    ).find((c) => c.key === key);
    if (after) void setTaskOrder(after.tasks.map((x, i) => ({ id: x.id, sortOrder: i })));
  }

  // Over the list, not instead of it: the scope and view behind the task stay put (lib/task-address.ts).
  const open = (id: string) => router.push(taskOpenHref(pathname, window.location.search, id));

  // ── keyboard-grammar mutations (optimistic, same rollback shape as above) ──
  const labelsFor = (id: string) => labelOverride[id] ?? taskLabels[id] ?? [];
  // ALL THREE ARE QUEUED. These are the keyboard-grammar edits — the fastest
  // interactions in the app, fired in bursts and the most likely to be followed
  // straight away by closing the tab or navigating. Awaiting the server here
  // meant the row said "saved" while the write was still in flight, and the
  // edit was lost if you left inside that window. Each action takes the VALUE,
  // not a delta, so it is safe for the queue to retry and to collapse.
  function setPriorityFor(id: string, level: TaskItem['priority']) {
    const prev = tasks.find((x) => x.id === id); if (!prev || prev.priority === level) return;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, priority: level } : x)));
    queueMutation({
      kind: 'task.priority', recordId: id, args: [id, level],
      patch: { priority: level }, revert: { priority: prev.priority },
    });
  }
  /** File under a project, or under none. The rule is `afterProjectChange` — the server applies the same one —
   *  so choosing the project a task already has writes nothing, and one left with nowhere to be goes back to
   *  the Inbox instead of disappearing from the rail. */
  function moveToProject(id: string, pid: string | null) {
    const prev = tasks.find((x) => x.id === id); if (!prev) return;
    const change = afterProjectChange(prev, pid);
    if (!change) return;
    const next = { project_id: change.project_id, is_inbox: change.is_inbox };
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, ...next } : x)));
    queueMutation({
      kind: 'task.setProject', recordId: id, args: [id, pid],
      patch: next, revert: { project_id: prev.project_id, is_inbox: prev.is_inbox },
    });
  }
  /** File into a list, or out of every list. Never touches `project_id` — the
   *  two piles answer different questions and a "move" that quietly un-filed
   *  the client work would lose the fact that decides who is billed. */
  function moveToList(id: string, lid: string | null) {
    const prev = tasks.find((x) => x.id === id); if (!prev) return;
    const next = { list_id: lid, is_inbox: lid ? false : prev.is_inbox };
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, ...next } : x)));
    queueMutation({
      kind: 'task.setList', recordId: id, args: [id, lid],
      patch: next, revert: { list_id: prev.list_id, is_inbox: prev.is_inbox },
    });
  }
  async function toggleLabel(id: string, labelId: string) {
    const cur = labelsFor(id);
    const on = !cur.includes(labelId);
    const next = on ? [...cur, labelId] : cur.filter((x) => x !== labelId);
    setLabelOverride((o) => ({ ...o, [id]: next }));
    const res = await setTaskLabel(id, labelId, on);
    if ('error' in res) { setLabelOverride((o) => ({ ...o, [id]: cur })); toastReverted(res.error); }
  }

  const openRowMenu = (kind: RowMenuKind, i: number, id: string) => {
    const el = cursor.el(i); if (!el) return;
    const r = el.getBoundingClientRect();
    setMenu({ kind, id, rect: { top: r.top, bottom: r.bottom, left: r.left } });
    setMenuSel(0);
  };
  const closeMenu = () => { setMenu(null); setMenuSel(0); };

  // Options for the active S/P/L popover (recomputed each render so the keyboard
  // handler below — a fresh closure — always sees current data).
  const menuOpts: RowMenuOpt[] = useMemo(() => {
    if (!menu) return [];
    if (menu.kind === 'schedule') return [
      { label: 'Today', run: () => reschedule(menu.id, todayISO) },
      { label: 'Tomorrow', run: () => reschedule(menu.id, tomorrowISO) },
      { label: 'Next week', run: () => reschedule(menu.id, nextWeekISO) },
      { label: 'Inbox', run: () => reschedule(menu.id, 'inbox') },
    ];
    if (menu.kind === 'project') return [
      { label: 'No project', run: () => moveToProject(menu.id, null) },
      ...projectList.map((p) => ({ label: p.name, color: p.color, run: () => moveToProject(menu.id, p.id) })),
    ];
    if (menu.kind === 'list') return [
      { label: 'No list', run: () => moveToList(menu.id, null) },
      ...scopes.lists.map((l) => ({ label: l.name, color: l.color, run: () => moveToList(menu.id, l.id) })),
    ];
    return labels.map((l) => ({ label: l.name, isLabel: true, on: labelsFor(menu.id).includes(l.id), run: () => toggleLabel(menu.id, l.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, projectList, labels, labelOverride, taskLabels, tasks]);

  // Declared before the key grammar, which reads it: `handleKey` closes over
  // `inboxQueue` to decide whether "t" opens Triage, and JS hoisting made that
  // work while reading bottom-up. The compiler is stricter and it is right —
  // a value should exist above the code that uses it.
  const inboxQueue: InboxTask[] = useMemo(
    () => tasks.filter((t) => t.is_inbox && !t.done).map((t) => ({
      id: t.id, title: t.title, priority: t.priority, done: t.done, is_inbox: t.is_inbox,
      project_id: t.project_id, created_at: t.created_at ?? EPOCH,
    })),
    [tasks],
  );

  // The grammar. Window-level (via a ref, like Triage) so it survives clicks and
  // always reads fresh state. Yields to inputs, the "g" navigation chord, an open
  // task drawer (?task=), the composer, and any open Radix menu/popover.
  // The guard — modifiers, the `g` chord, typing targets, an open menu, an open
  // record — is `lib/list-keys.ts` now, shared with every other list. What stays
  // here is what these keys DO, which is the part that legitimately differs.
  // `composing` and `triaging` are this view's own suspensions: triage is a
  // full-screen layer with its own single-key grammar, and the list underneath
  // must not also act on those keys.
  const handleKey = (e: KeyboardEvent) => {

    // ⇧T starts triage from anywhere on the Inbox — the shortcut Settings →
    // Keyboard already advertises, which moved here with the flow.
    if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
      if (layout === 'list' && view === 'inbox' && !scope && inboxQueue.length > 0) { e.preventDefault(); setTriaging(true); }
      return;
    }

    if (menu) {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setMenuSel((s) => Math.min(menuOpts.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMenuSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); menuOpts[menuSel]?.run(); closeMenu(); }
      else if (/^[1-9]$/.test(e.key)) { const o = menuOpts[Number(e.key) - 1]; if (o) { e.preventDefault(); o.run(); closeMenu(); } }
      return;
    }

    const list = visible;
    if (!list.length) return;
    const k = e.key.toLowerCase();
    if (cursor.arrows(e)) return;
    const t = list[focusIdx];
    if (!t) return;
    if (e.key === 'Enter' || k === 'o') { e.preventDefault(); open(t.id); }
    else if (k === 'e') { e.preventDefault(); toggle(t.id); }
    else if (k === 't') { e.preventDefault(); reschedule(t.id, todayISO); }
    else if (k === '1') { e.preventDefault(); setPriorityFor(t.id, 'low'); }
    else if (k === '2') { e.preventDefault(); setPriorityFor(t.id, 'med'); }
    else if (k === '3') { e.preventDefault(); setPriorityFor(t.id, 'high'); }
    else if (k === 's') { e.preventDefault(); openRowMenu('schedule', focusIdx, t.id); }
    else if (k === 'p') { e.preventDefault(); if (projectList.length) openRowMenu('project', focusIdx, t.id); }
    // "m" for move-to-list. `l` was already labels and stays labels — silently
    // re-pointing a key someone has in their fingers is worse than one more key.
    else if (k === 'm') { e.preventDefault(); if (listsSupported) openRowMenu('list', focusIdx, t.id); }
    else if (k === 'l') { e.preventDefault(); if (labels.length) openRowMenu('label', focusIdx, t.id); }
  };
  // A queued edit that the server finally refused. The worker raises this from
  // wherever it happens to be draining, which may not be the tab that made the
  // edit — so the handler works from the op's own `revert` map rather than any
  // closure it could not have.
  useEffect(() => {
    const onReverted = (e: Event) => {
      const d = (e as CustomEvent<RevertedDetail>).detail;
      settling.release(d.recordId);
      setTasks((ts) => ts.map((x) => (x.id === d.recordId ? { ...x, ...d.revert } : x)));
    };
    window.addEventListener(MUTATION_REVERTED, onReverted);
    return () => window.removeEventListener(MUTATION_REVERTED, onReverted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useListKeys(handleKey, { suspended: composing || triaging });
  // Clamping as the list shrinks is the cursor's job now. What stays here is
  // this view's own rule: a change of VIEW or FILTER is a different list, so the
  // cursor starts over rather than pointing at whatever is now in that slot.
  // One composite key, because `useChanged` compares a single value and four
  // separate calls could not be combined without short-circuiting a hook.
  if (useChanged(`${view}|${scope ?? ''}|${filter}|${labelFilter ?? ''}`)) { cursor.set(-1); setMenu(null); }
  // A popover anchored to a rect must not linger through scroll/resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [menu]);

  // The combo the rail's "save this view" would capture, and the one it matches
  // an existing saved view against. Saving and restoring live in the rail now,
  // because the rail is the thing that shows them — this view only has to say
  // what it is currently looking at.
  const currentCombo = { view, filter, labelId: labelFilter, scope };
  const filterActive = filter !== 'all' || !!labelFilter || !!scope;

  // ── Triage (§7A) — the Inbox processed one thought at a time, full-screen,
  //    every decision one key and every decision reversible. It used to live on
  //    a separate /inbox page that duplicated this very view in the sidebar; the
  //    page is gone and the flow came here rather than being dropped, because
  //    the flow was the only thing that page had and this list didn't.

  // Triage's decisions are the mutations this view already has: each one takes
  // the task out of the inbox, and `inboxQueue` is derived from `tasks`, so the
  // row leaves the queue on its own. No toasts here — triage owns its undo (Z).
  const triageDone = (t: InboxTask) => { void toggle(t.id); };
  const triageSchedule = (t: InboxTask, date: string) => { void reschedule(t.id, date); };
  const triageProject = (t: InboxTask, pid: string) => { void moveToProject(t.id, pid); };
  const triageDelete = (t: InboxTask) => { void remove(t.id); };

  // Accepting the clerk's answer (§7Q *File*) is ONE decision made of the mutations this view
  // already has — no new write path, and therefore nothing new for Z to know about: both of these
  // take the thought out of the Inbox, and `triageUndo` puts it back the same way for either.
  const triageFile = (t: InboxTask, filing: { projectId?: string; date?: string }) => {
    if (filing.projectId) moveToProject(t.id, filing.projectId);
    if (filing.date) reschedule(t.id, filing.date);
  };

  // Z steps a decision back. A delete is the one that can't be patched back —
  // the row is gone from the table — so it is undone by re-creating it, which
  // means a new id, which is why this returns the restored task.
  async function triageUndo(t: InboxTask, kind: UndoKind): Promise<InboxTask> {
    if (kind === 'delete') {
      const res = await addTask({ title: t.title, priority: t.priority, isInbox: true });
      // The row is already gone from the table; a failed re-create with no word
      // is a deletion the person thought they had taken back.
      if ('error' in res) { toast({ message: res.error, variant: 'error' }); return t; }
      setTasks((ts) => [...ts, {
        id: res.id, title: t.title, done: false, priority: t.priority, highlight: false,
        estimate_minutes: null, scheduled_date: null, is_inbox: true, project_id: null,
        recurrence: null, parent_task_id: null, created_at: t.created_at,
      }]);
      return { ...t, id: res.id };
    }
    // Mirrors returnToInbox's patch exactly, so the optimistic row matches the
    // one the server writes.
    setTasks((ts) => ts.map((x) => (x.id === t.id
      ? { ...x, is_inbox: true, done: false, scheduled_date: null, project_id: null }
      : x)));
    await returnToInbox(t.id);
    return t;
  }

  // A row's facts, minus the one every row in the view shares: inside a project's own list, naming that project on
  // every line is wallpaper (the same for a list), so the row names only where a task lives when that varies.
  const rowFacts = (t: TaskItem) => ({
    task: t,
    sub: subByParent[t.id],
    recurring: !!t.recurrence,
    project: t.project_id && !(activeScope?.kind === 'project' && activeScope.id === t.project_id) ? projects[t.project_id] ?? null : null,
    list: t.list_id && !(activeScope?.kind === 'list' && activeScope.id === t.list_id) ? scopes.lists.find((l) => l.id === t.list_id) ?? null : null,
    labels: labelsFor(t.id).flatMap((id) => {
      const l = labels.find((x) => x.id === id);
      return l ? [{ name: l.name, color: l.color ?? 'stone' }] : [];
    }),
  });
  // The row's own verbs, below the Open and Highlight every task row carries.
  const rowMenu = (t: TaskItem) => (
    <RowMenu t={t}
      project={t.project_id ? projects[t.project_id] ?? null : null}
      list={t.list_id ? scopes.lists.find((l) => l.id === t.list_id) ?? null : null}
      todayISO={todayISO} tomorrowISO={tomorrowISO} nextWeekISO={nextWeekISO}
      projects={projectList} lists={scopes.lists}
      onMove={(target) => reschedule(t.id, target)} onProject={(pid) => moveToProject(t.id, pid)}
      onList={(lid) => moveToList(t.id, lid)} onDelete={() => remove(t.id)} />
  );

  // The rail. Shared verbatim with the board — see components/tasks/tasks-rail.tsx.
  const rail = (
    <TasksRail
      counts={counts}
      scopeCounts={scopeCounts}
      projects={scopes.projects}
      lists={scopes.lists}
      listsSupported={listsSupported}
      savedViews={savedViews}
      savedViewsSupported={savedViewsSupported}
      // On the board nothing in the rail is lit: a layout is not one of the
      // rail's views, and picking any row takes you to the list showing it.
      active={{ view: layout === 'board' ? 'board' : view, scope }}
      current={currentCombo}
      saveSnapshot={filterActive ? currentCombo : undefined}
      narrow={narrow}
      // Shallow: every rail row filters tasks this component already holds.
      onSelect={(f) => setRail({
        view: (f.view as View) ?? 'inbox',
        scope: f.scope ?? (f.listId ? `project:${f.listId}` : null),
        filter: f.filter ?? 'all',
        labelId: f.labelId ?? null,
        layout: 'list',
      })}
      hidden={scopes.hidden}
      onToggleScope={scopes.toggle}
      onCreateList={scopes.createList}
      onRenameList={scopes.renameList}
      onRecolourList={scopes.recolourList}
      onDeleteList={scopes.deleteList}
    />
  );

  const activeParts = [
    ...(filter !== 'all' ? [FILTERS.find((f) => f.id === filter)!.label] : []),
    ...(labelFilter ? [labels.find((l) => l.id === labelFilter)?.name ?? ''] : []),
  ].filter(Boolean);
  const filtering = activeParts.length > 0;

  // Tasks is a HUB whose detail is a list OR a board, so the pane drops the
  // reading column only for the board (`bleed`) — the list keeps the same
  // centred column and vertical rhythm every other page has. Its rail brings
  // its own section rhythm, hence railPadding={false}. Both are use-case
  // divergences from the default hub, named here per CONSISTENCY_PRINCIPLE.
  return (
    <HubLayout
      railLabel="Task views"
      rail={rail}
      railPadding={false}
      bleed={layout === 'board'}
      // The list is a READING column, not a hub's wide detail: it is one column
      // of rows you read down, the same shape Home and Inbox have. A hub's
      // default `wide` is for a detail that lays content out in columns beside
      // the rail, which the board does — and the board takes `bleed` anyway.
      width="reading"
      overlays={(
        <>
          {triaging && (
            <Triage
              items={inboxQueue} projects={projectList} labels={labels}
              onComplete={triageDone} onSchedule={triageSchedule} onProject={triageProject} onDelete={triageDelete}
              onFile={onSuggestFiling ? triageFile : undefined} onSuggest={onSuggestFiling}
              onLabel={(id, labelId) => { void setTaskLabel(id, labelId, true); }}
              onUnlabel={(id, labelId) => { void setTaskLabel(id, labelId, false); }}
              onUndo={triageUndo}
              onClose={() => setTriaging(false)}
            />
          )}

          {/* Keyboard-grammar popover (S schedule · P project · L label) */}
          {menu && (
            <>
              <div className="fixed inset-0 z-dropdown" aria-hidden onClick={closeMenu} />
              <div role="menu" aria-label={menu.kind === 'schedule' ? 'Schedule' : menu.kind === 'project' ? 'Move to project' : menu.kind === 'list' ? 'Move to list' : 'Labels'}
                className={cn(MENU_PANEL_CLASS, 'fixed z-dropdown max-h-[min(320px,60vh)] w-56 overflow-y-auto origin-top-left')}
                style={{ top: Math.min(menu.rect.bottom + 4, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320), left: Math.min(menu.rect.left + 28, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 240) }}>
                {menuOpts.length === 0 ? (
                  <div className="px-2.5 py-2 text-caption text-ink-500">Nothing to pick</div>
                ) : menuOpts.map((o, i) => (
                  <button key={i} role="menuitem" type="button" onMouseEnter={() => setMenuSel(i)}
                    onClick={() => { o.run(); closeMenu(); }}
                    className={cn('flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-ui', i === menuSel ? 'bg-surface-active' : 'hover:bg-surface-hover')}>
                    {o.isLabel
                      ? <Icon icon={TagIcon} size={12} className="shrink-0 text-ink-500" />
                      : o.color !== undefined
                        ? <span aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ background: scopeFill(o.color) }} />
                        : <span className="w-0.5" />}
                    <span className="min-w-0 flex-1 truncate text-ink-800">{o.label}</span>
                    {o.on && <Icon icon={Check} size={14} className="shrink-0 text-ink-500" />}
                    {i < 9 && <Kbd keys={[String(i + 1)]} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
        actions={(
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant={filtering ? 'tinted' : 'ghost'}
                  icon={<Icon icon={FunnelSimple} size={16} />}
                  iconRight={<Icon icon={CaretDown} size={12} className="text-ink-500" />}>
                  {filtering ? activeParts.join(' · ') : 'Filter'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={filter} onValueChange={(v) => { setFilter(v as Filter); if (v === 'all') setLabelFilter(null); }}>
                  {FILTERS.map((f) => <DropdownMenuRadioItem key={f.id} value={f.id}>{f.label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
                {labels.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Labels</DropdownMenuLabel>
                    {labels.map((l) => (
                      <DropdownMenuCheckboxItem key={l.id} checked={labelFilter === l.id}
                        onCheckedChange={() => setLabelFilter(labelFilter === l.id ? null : l.id)}>
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--color-label-${l.color ?? 'stone'})` }} /> {l.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Triage belongs to the Inbox and nowhere else — there is nothing to
                process on Today or Completed, so the button isn't there. */}
            {layout === 'list' && view === 'inbox' && !scope && inboxQueue.length > 0 && (
              <Button size="sm" variant="secondary" icon={<Icon icon={ListChecks} size={16} />} onClick={() => setTriaging(true)}>
                Triage {inboxQueue.length}
              </Button>
            )}

            {/* The layout switch, and the board's grouping beside it.
                Rendered HERE rather than handed down from the route, because
                switching List⇄Board is now a client-side change — the tasks are
                already in this component and the server has nothing to add. The
                route cannot pass a control that flips state it does not own. */}
            {layout === 'board' && (
              <SegmentedControl
                aria-label="Group board by"
                value="scope"
                onValueChange={(v) => setRail({ layout: v === 'week' ? 'week' : 'board' })}
                options={[{ value: 'scope', label: 'Lists' }, { value: 'week', label: 'Week' }]}
              />
            )}
            <SegmentedControl
              aria-label="Task layout"
              value={layout === 'list' ? 'list' : 'board'}
              onValueChange={(v) => setRail({ layout: v === 'board' ? 'board' : 'list' })}
              options={[
                { value: 'list', 'aria-label': 'List', label: <Icon icon={Rows3} size={16} /> },
                { value: 'board', 'aria-label': 'Board', label: <Icon icon={Kanban} size={16} /> },
              ]}
            />
          </>
        )}
    >
      {layout === 'board' ? (
            <TasksBoard
              columns={boardColumns}
              subByParent={subByParent}
              settling={settling.ids}
              onToggle={(id) => toggle(id)}
              onOpen={open}
              onAdd={addToColumn}
              onDrop={dropTask}
              // The same act as the rail's "New list" — a name, then Enter —
              // through the same `createList`, so there is one way to make a
              // list and two places to start it.
              newColumn={listsSupported ? { label: 'New list', placeholder: 'List name…', onCreate: scopes.createList } : undefined}
              emptyText="Make a list, or file a task into a project, and its column appears here."
            />
      ) : (
        <>
            {/* The empty state has to account for the Completed group: a day
                where you finished everything has no active rows but is the
                opposite of empty, and "Capture now, plan later" over a list of
                fifteen things you just did would be absurd. */}
            {visible.length === 0 && completed.length === 0 && !composing ? (
              <EmptyState view={view} scopeName={activeScope?.name} onAdd={() => setComposing(true)} onImport={() => router.push('/settings?section=import')} />
            ) : (
              <>
                {composing ? (
                  <Composer
                    projects={projectList}
                    defaultDest={view === 'inbox' ? 'inbox' : 'today'}
                    defaultProject={activeScope?.kind === 'project' ? activeScope.id : null}
                    onCancel={() => setComposing(false)}
                    onSubmit={(spec) => { create(spec); setComposing(false); }}
                  />
                ) : (
                  // The one add line every list grows from (the DS `AddLine`), its + on the checkboxes' vertical and
                  // its word on the titles' — not a 48px grey slab reading "Add Task" above the list.
                  <AddLine lead="checkbox" onClick={() => setComposing(true)} className="border-b border-line-soft">Add task</AddLine>
                )}

                {/* A container, so a row's facts give up their words before its title does at phone width. */}
                <div className="@container">
                  {/* Rows ARRIVE and LEAVE. A list where items blink in and out
                      is the other half of "the app feels static" — the press
                      answers "did you hear me", this answers "where did that go".
                      `Presence` keeps a removed row on screen long enough to
                      leave; `Move` animates the rows below it closing the gap,
                      which CSS cannot do because it has no idea where a row used
                      to be. Both are no-ops under reduced motion. */}
                  <Presence>
                  {visible.map((t, i) => (
                    <Move key={t.id} exit={EXIT_ROW} initial={{ opacity: 0, transform: 'translateY(4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      transition={{ duration: MOTION.base, ease: MOTION.ease, delay: Math.min(i, 6) * 0.02 }}>
                    <div ref={cursor.ref(i)}>
                    <TaskRow {...rowFacts(t)} last={i === visible.length - 1} selected={i === focusIdx}
                      onToggle={() => toggle(t.id)} onOpen={() => open(t.id)} onHighlight={() => highlight(t.id)} showHighlightToggle
                      menu={rowMenu(t)} />
                    </div>
                    </Move>
                  ))}
                  </Presence>
                  {visible.length === 0 && completed.length === 0 && (
                    <EmptyLine className="px-2 py-7">Nothing open here. Add a task above.</EmptyLine>
                  )}
                </div>

                {/* Finished work, out of the way but one click from being undone.
                    The same component Home and the project tabs use — this list
                    used to be the one place a ticked task simply disappeared. */}
                <CompletedSection count={completed.length} className="mt-2 @container">
                  {completed.map((t, i) => (
                    <TaskRow key={t.id} {...rowFacts(t)} last={i === completed.length - 1}
                      onToggle={() => toggle(t.id)} onOpen={() => open(t.id)} onHighlight={() => highlight(t.id)}
                      menu={rowMenu(t)} />
                  ))}
                </CompletedSection>
              </>
          )}
        </>
      )}
    </HubLayout>
  );
}

// ── A task row's own menu ──────────────────────────────────────────────────
// The row itself is the shared `TaskRow` (components/tasks/task-row.tsx), which carries Open and Highlight; these
// are the Tasks page's verbs below them. Every edit a pointer can reach: Schedule, Project and List were the `s`,
// `p` and `l` keys and nothing else, so filing a task under a project with a mouse was impossible from the list
// (user report, 2026-09-19). Each is a submenu showing the task's current answer, the way Linear's are; a specific
// date, notes and everything else are in the task itself — Open.
function RowMenu({ t, project, list = null, todayISO, tomorrowISO, nextWeekISO, projects, lists, onMove, onProject, onList, onDelete }: {
  t: TaskItem; project: TaskProject | null; list?: Scope | null;
  todayISO: string; tomorrowISO: string; nextWeekISO: string;
  /** Everything the task could be filed under — the menu's twin of the `p` and `l` keys. */
  projects: TaskProject[]; lists: Scope[];
  onMove: (target: string) => void; onProject: (projectId: string | null) => void; onList: (listId: string | null) => void; onDelete: () => void;
}) {
  return (
    <>
      {!t.done && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<Icon icon={CalendarDots} size={16} />}
            value={t.scheduled_date ? formatRelativeDay(t.scheduled_date) : t.is_inbox ? 'Inbox' : null}>
            Schedule
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem icon={<Icon icon={Sun} size={16} />} active={t.scheduled_date === todayISO} onSelect={() => onMove(todayISO)}>Today</DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={CalendarDots} size={16} />} active={t.scheduled_date === tomorrowISO} onSelect={() => onMove(tomorrowISO)}>Tomorrow</DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={CalendarDots} size={16} />} active={t.scheduled_date === nextWeekISO} onSelect={() => onMove(nextWeekISO)}>Next week</DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={Tray} size={16} />} active={t.is_inbox && !t.scheduled_date} onSelect={() => onMove('inbox')}>Inbox</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={<Icon icon={Folder} size={16} />} value={project?.name ?? null}>
          Project
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] w-52 overflow-y-auto">
          <DropdownMenuRadioGroup value={t.project_id ?? ''} onValueChange={(v) => onProject(v || null)}>
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
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={<Icon icon={ListIcon} size={16} />} value={list?.name ?? null}>
          List
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] w-52 overflow-y-auto">
          <DropdownMenuRadioGroup value={t.list_id ?? ''} onValueChange={(v) => onList(v || null)}>
            <DropdownMenuRadioItem value="">No list</DropdownMenuRadioItem>
            {lists.map((l) => (
              <DropdownMenuRadioItem key={l.id} value={l.id}>
                <Icon icon={ListIcon} size={14} style={{ color: scopeFill(l.color, 'var(--color-ink-500)') }} />
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem danger icon={<Icon icon={Trash} size={16} />} onSelect={onDelete}>Delete</DropdownMenuItem>
    </>
  );
}

// ── New-task composer (design: title · description · Date/Priority/Project chips ·
//    destination + Cancel/Add task). NL hints still parse from the title. ──
export function Composer({ projects, defaultDest, defaultProject, onCancel, onSubmit }: {
  projects: TaskProject[]; defaultDest: 'inbox' | 'today'; defaultProject: string | null;
  onCancel: () => void; onSubmit: (spec: { title: string; notes: string; date: string | null; priority: 'low' | 'med' | 'high' | null; projectId: string | null; dest: 'inbox' | 'today' | 'tomorrow'; estimate: number | null }) => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<CPrio>(null);
  // How long you think this will take. The value was ALWAYS reachable — `parse`
  // reads "30m" out of the title — but only if you knew the syntax, so most
  // tasks arrived with no estimate and Focus had nothing to count against.
  // Picking one is now a chip like every other property.
  const [estimate, setEstimate] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<string | null>(defaultProject);
  const [dest, setDest] = useState<'inbox' | 'today' | 'tomorrow'>(defaultDest);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const hint = title.trim() ? parse(title, projects) : null;
  const canAdd = !!(hint && hint.title);
  // Urgent is a composer-only convenience; persist it as High.
  // An explicitly picked estimate wins over one parsed from the title: the chip
  // is the deliberate act, the text is a shortcut.
  const submit = () => { if (canAdd) onSubmit({ title, notes, date, priority: priority === 'urgent' ? 'high' : priority, projectId, dest, estimate: estimate ?? hint?.estimate ?? null }); };
  const proj = projectId ? projects.find((p) => p.id === projectId) : null;
  const destLabel = dest === 'inbox' ? 'Inbox' : dest === 'today' ? 'Today' : 'Tomorrow';

  // Chip: 32px trigger, radius-md, hairline stroke — set keeps the neutral fill +
  // strong stroke, unset is transparent with a hover wash. Token-driven throughout.
  const chip = (set: boolean) => cn(
    'focus-ring relative inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-ui font-normal transition-colors duration-fast',
    set ? 'border-line-strong bg-surface-fill text-ink-800' : 'border-line-strong bg-transparent text-ink-600 hover:bg-surface-hover hover:text-ink-800',
  );

  return (
    <div className={cardClass('mb-4 overflow-hidden px-4 pt-3.5 shadow-lift-1')}>
      <input data-chromeless ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="New task" autoComplete="off" data-1p-ignore data-lpignore="true"
        className="w-full border-0 bg-transparent p-0 text-lead font-normal text-ink-900 outline-none placeholder:text-ink-500" />
      <textarea data-chromeless value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Description" rows={notes.includes('\n') ? 3 : 2}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-ui leading-relaxed text-ink-800 outline-none placeholder:text-ink-500" />

      {hint && (hint.priority || hint.projectId || hint.estimate != null || hint.freq || hint.date || hint.dueDate || hint.isInbox) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {hint.date && <Hint><Icon icon={CalendarDots} size={12} /> {hint.dateLabel}</Hint>}
          {hint.dueDate && <Hint><Icon icon={Alarm} size={12} /> {hint.dueLabel}</Hint>}
          {hint.isInbox && <Hint><Icon icon={Tray} size={12} /> inbox</Hint>}
          {hint.priority && <Hint><PriorityBars level={hint.priority} size={12} /> {PRIO_LABEL[hint.priority]}</Hint>}
          {hint.projectId && <Hint><Icon icon={Folder} size={12} /> {projects.find((p) => p.id === hint.projectId)?.name}</Hint>}
          {hint.estimate != null && <Hint><Icon icon={Timer} size={12} /> {formatMinutes(hint.estimate)}</Hint>}
          {hint.freq && <Hint><Icon icon={Repeat} size={12} /> {hint.freq}</Hint>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* The chip IS the trigger. It used to be a <label> with an invisible
            native date input stretched over it, which opened Chrome's calendar
            from inside our own composer. */}
        <DatePicker
          aria-label="Due date"
          value={date}
          onValueChange={(iso) => setDate(iso || null)}
          trigger={(
            <button type="button" className={chip(!!date)}>
              <Icon icon={CalendarDots} size={16} /> {formatDay(date) ?? 'Date'}
            </button>
          )}
        />

        <DropdownMenu>
          <DropdownMenuTrigger className={chip(!!priority)} title="Change priority">
            {priority ? <PrioGlyph id={priority} /> : <Icon icon={Flag} size={16} />} {priority ? prioLabel(priority) : 'Priority'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Change priority</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={String(priority)} onValueChange={(v) => setPriority(v === 'null' ? null : (v as CPrio))}>
              {PRIO_OPTS.map((o) => (
                <DropdownMenuRadioItem key={String(o.id)} value={String(o.id)}>
                  <PrioGlyph id={o.id} size={16} /> {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={chip(estimate != null)} aria-label="Estimate">
            <Icon icon={Timer} size={16} /> {estimate != null ? formatMinutes(estimate) : 'Estimate'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>How long will it take?</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={String(estimate ?? '')} onValueChange={(v) => setEstimate(v ? Number(v) : null)}>
              <DropdownMenuRadioItem value="">No estimate</DropdownMenuRadioItem>
              {[5, 15, 30, 45, 60, 90, 120].map((m) => (
                <DropdownMenuRadioItem key={m} value={String(m)}>{formatMinutes(m)}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={chip(!!proj)} aria-label="Project">
            {proj
              ? <><span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: scopeFill(proj.color, 'var(--color-ink-500)') }} /> {proj.name}</>
              : <><Icon icon={Folder} size={16} /> Project</>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            <DropdownMenuRadioGroup value={projectId ?? ''} onValueChange={(v) => setProjectId(v || null)}>
              <DropdownMenuRadioItem value="">No project</DropdownMenuRadioItem>
              {projects.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: scopeFill(p.color, 'var(--color-ink-500)') }} /> {p.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer band — full-bleed sunken strip: destination left, actions right. */}
      <div className="mx-[-16px] mt-3.5 flex items-center gap-2 rounded-b-[calc(var(--radius-lg)-1px)] border-t border-line-soft bg-surface-sunken px-4 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-ui text-ink-800 transition-colors hover:bg-surface-hover" aria-label="Add to">
            {destLabel} <Icon icon={CaretDown} size={12} className="text-ink-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={dest} onValueChange={(v) => setDest(v as 'inbox' | 'today' | 'tomorrow')}>
              <DropdownMenuRadioItem value="inbox">Inbox</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="tomorrow">Tomorrow</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!canAdd} onClick={submit} iconRight={<Icon icon={Plus} size={14} />}>Add task</Button>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-xs bg-surface-fill px-1.5 py-0.5 text-caption font-medium text-ink-600">{children}</span>;
}

// ── Empty states (design copy for Inbox; calm equivalents elsewhere) ──
function EmptyState({ view, scopeName, onAdd, onImport }: { view: View; scopeName?: string; onAdd: () => void; onImport: () => void }) {
  const copy: Record<View, { h: string; sub: string }> = {
    inbox: { h: 'Capture now, plan later', sub: 'Inbox is your go-to spot for quick task entry. Clear your mind now, organize when you’re ready.' },
    today: { h: 'All clear for today', sub: 'Nothing on today’s plate. Add a task, or pull something in from your Inbox.' },
    completed: { h: 'Nothing completed yet', sub: 'Finished tasks land here. Your quiet record of progress.' },
  };
  const c = scopeName ? { h: `Nothing in ${scopeName}`, sub: 'Tasks you file here will show up in this list.' } : copy[view];
  // Coming from another app? Offer the CSV import on the Inbox empty state (§7U:
  // "Importers offered on the Tasks empty state, not the first run").
  const showImport = view === 'inbox' && !scopeName;
  return (
    <EmptyStateBase
      title={c.h}
      description={c.sub}
      primary={view !== 'completed'
        ? <Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={onAdd}>Add task</Button>
        : undefined}
      secondary={showImport
        ? <Button variant="secondary" icon={<Icon icon={Upload} size={16} />} onClick={onImport}>Import from CSV</Button>
        : undefined}
    />
  );
}

'use client';
// Tasks — HiFi two-pane layout: a views rail (Inbox / Today / Upcoming /
// Completed + project Lists) beside the task pane (Filter + layout header,
// quick-add that expands into a full composer, and roomy rows with tag lines).
// All mutations reuse the shared task actions (optimistic w/ rollback), and the
// natural-language capture lives on inside the composer title as live hints.
//
// Built entirely from the design system: §4.16 Checkbox, §4.9 PriorityBadge,
// §4.34 DropdownMenu (rail/row/header menus), §4.3 IconButton, §5.1 Button,
// §4.8 Tag/FigmaTag. No inline styles, no legacy Paper-OS tokens, no hand-rolled
// popovers — every colour, size, radius, and motion value comes from a token.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus, Sun, Inbox as Tray, SquareCheckBig as CheckSquare, CalendarCheck, CalendarDays as CalendarDots, Timer, Repeat, Trash2 as Trash, Star, Flag, Folder, Filter as FunnelSimple, ChevronDown as CaretDown, Ellipsis as DotsThree, LayoutGrid as SquaresFour, AlarmClock as Alarm, Tag as TagIcon, Check, Upload } from "@/components/ds/icons";
import { QuickAddRow } from '@/components/ui/primitives';
import {
  Icon, Button, Checkbox, IconButton, Kbd, PriorityBadge, PriorityBars, EmptyState as EmptyStateBase,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel,
  MENU_PANEL_CLASS,
} from '@/components/ds/ui';
import { FigmaTag } from '@/components/ui/panels';
import { ViewContainer } from '@/components/ui/view-container';
import { fmtDur } from '@/components/tasks/task-row';
import { addTask, toggleTask, setHighlight, deleteTask, rescheduleTask, updateTask, moveTaskToProject } from '@/lib/actions/tasks';
import { setTaskLabel } from '@/lib/actions/labels';
import { goChordActive } from '@/components/shell/keyboard-shortcuts';
import { parseTask } from '@/lib/task-parse';
import { createSavedView, deleteSavedView } from '@/lib/actions/saved-views';
import { signalTaskToggle } from '@/lib/sound';
import { cn } from '@/lib/cn';

export type TaskItem = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; scheduled_date: string | null; is_inbox: boolean;
  project_id: string | null; recurrence: { freq?: string } | null; parent_task_id: string | null;
};
export type TaskProject = { id: string; name: string; color: string | null };

type View = 'inbox' | 'today' | 'upcoming' | 'completed';
type Filter = 'all' | 'high' | 'highlights' | 'recurring' | 'noEstimate';

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; };

// The keyboard grammar's inline picker (S/P/L) — one small popover reused for
// schedule, project, and label, anchored to the focused row. Mirrors §7 popover
// rules: bg-surface-raised, hairline, radius-lg, h-8 rounded-md items, number
// hotkeys. Kept dependency-free (fixed position from the row rect) so it never
// fights the Radix menus already on the row.
type RowMenuKind = 'schedule' | 'project' | 'label';
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

// Rail glyphs mirror the HiFi frames: filled tray / calendar-check / check-square.
const VIEWS: { id: View; label: string; icon: typeof Sun }[] = [
  { id: 'inbox', label: 'Inbox', icon: Tray },
  { id: 'today', label: 'Today', icon: CalendarCheck },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarCheck },
  { id: 'completed', label: 'Completed', icon: CheckSquare },
];
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All tasks' }, { id: 'high', label: 'High priority' }, { id: 'highlights', label: 'Highlights' },
  { id: 'recurring', label: 'Recurring' }, { id: 'noEstimate', label: 'No estimate' },
];

// ── Shared class helpers (token-driven — the one place each row/chip look is
//    defined, so the rail, header, and composer stay in lockstep). ──
const railBtn = (on: boolean) => cn(
  'focus-ring group relative flex h-[34px] items-center gap-2 rounded-sm px-2 text-left text-ui transition-colors duration-fast',
  on ? 'bg-surface-selected font-medium text-ink-900' : 'font-normal text-ink-600 hover:bg-surface-hover hover:text-ink-800',
);
const headerBtn = (on: boolean) => cn(
  'focus-ring inline-flex h-[30px] items-center gap-1.5 rounded-sm px-2.5 text-ui font-medium transition-colors duration-fast',
  on ? 'bg-surface-selected text-ink-900' : 'text-ink-600 hover:bg-surface-hover hover:text-ink-800',
);
const sectionLabel = 'text-caption font-medium tracking-[0.02em] text-ink-500';

export type TaskLabelDef = { id: string; name: string; color?: string | null };
export type SavedViewDef = { id: string; name: string; filter: { view?: string; filter?: string; labelId?: string | null; listId?: string | null } };

export function TasksView({ initialTasks, projects, subByParent, labels = [], taskLabels = {}, savedViews = [], savedViewsSupported = false }: {
  initialTasks: TaskItem[]; projects: Record<string, TaskProject>; subByParent: Record<string, { done: number; total: number }>; labels?: TaskLabelDef[]; taskLabels?: Record<string, string[]>; savedViews?: SavedViewDef[]; savedViewsSupported?: boolean; viewSwitch?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const projectList = Object.values(projects);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  const [view, setView] = useState<View>('inbox');
  const [listId, setListId] = useState<string | null>(null); // project "List" filter
  const [filter, setFilter] = useState<Filter>('all');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [views, setViews] = useState<SavedViewDef[]>(savedViews);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  useEffect(() => { setViews(savedViews); }, [savedViews]);
  const [composing, setComposing] = useState(false);
  const [narrow, setNarrow] = useState(false);

  // ── keyboard grammar (§6.3) — a roving focus over the visible rows plus the
  //    single-key actions ⏎/e/t/s/p/l/1·2·3. Focus is visual state (no DOM focus
  //    stealing), keys are handled at the window so they survive mouse clicks. ──
  const [focusIdx, setFocusIdx] = useState(-1);
  const [menu, setMenu] = useState<{ kind: RowMenuKind; id: string; rect: { top: number; bottom: number; left: number } } | null>(null);
  const [menuSel, setMenuSel] = useState(0);
  const [labelOverride, setLabelOverride] = useState<Record<string, string[]>>({});
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const todayISO = iso(new Date());
  const tomorrowISO = iso(new Date(Date.now() + 86400000));

  const matchesView = (t: TaskItem) => {
    if (view === 'inbox') return t.is_inbox && !t.done;
    if (view === 'today') return t.scheduled_date === todayISO && !t.is_inbox && !t.done;
    if (view === 'upcoming') return !!t.scheduled_date && t.scheduled_date > todayISO && !t.done;
    return t.done;
  };
  const matchesFilter = (t: TaskItem) => {
    if (listId && t.project_id !== listId) return false;
    if (labelFilter && !(taskLabels[t.id] ?? []).includes(labelFilter)) return false;
    if (filter === 'high') return t.priority === 'high';
    if (filter === 'highlights') return t.highlight;
    if (filter === 'recurring') return !!t.recurrence;
    if (filter === 'noEstimate') return t.estimate_minutes == null;
    return true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => tasks.filter((t) => matchesView(t) && matchesFilter(t)), [tasks, view, filter, labelFilter, taskLabels, listId, todayISO]);

  const counts = useMemo(() => ({
    inbox: tasks.filter((t) => t.is_inbox && !t.done).length,
    today: tasks.filter((t) => t.scheduled_date === todayISO && !t.is_inbox && !t.done).length,
    upcoming: tasks.filter((t) => !!t.scheduled_date && t.scheduled_date > todayISO && !t.done).length,
    completed: tasks.filter((t) => t.done).length,
  }), [tasks, todayISO]);

  // ── mutations (optimistic) ──
  async function toggle(id: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const nd = !t.done;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: nd } : x)));
    signalTaskToggle(nd);
    const res = await toggleTask(id, nd);
    if ('error' in res) setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !nd } : x)));
  }
  async function highlight(id: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const nh = !t.highlight;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, highlight: nh } : x)));
    const res = await setHighlight(id, nh);
    if ('error' in res) setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, highlight: !nh } : x)));
  }
  async function remove(id: string) {
    const snap = tasks;
    setTasks((ts) => ts.filter((x) => x.id !== id));
    const res = await deleteTask(id);
    if ('error' in res) setTasks(snap);
  }
  async function reschedule(id: string, target: string) {
    const prev = tasks.find((x) => x.id === id); if (!prev) return;
    const isInbox = target === 'inbox';
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, is_inbox: isInbox, scheduled_date: isInbox ? null : target } : x)));
    const res = await rescheduleTask(id, target);
    if ('error' in res) setTasks((ts) => ts.map((x) => (x.id === id ? prev : x)));
  }

  type ComposerSpec = { title: string; notes: string; date: string | null; priority: TaskItem['priority'] | null; projectId: string | null; dest: 'inbox' | 'today' | 'tomorrow' };
  async function create(spec: ComposerSpec) {
    const hint = parse(spec.title, projectList);
    if (!hint.title) return;
    const priority = spec.priority ?? hint.priority ?? 'low';
    const projectId = spec.projectId ?? hint.projectId;
    const isInbox = spec.date ? false : (hint.date ? false : spec.dest === 'inbox');
    const scheduledDate = spec.date ?? hint.date ?? (spec.dest === 'today' ? todayISO : spec.dest === 'tomorrow' ? tomorrowISO : null);
    const recurrence = hint.freq ? { freq: hint.freq } : null;
    const tempId = 'temp-' + Date.now();
    setTasks((ts) => [...ts, { id: tempId, title: hint.title, done: false, priority, highlight: false, estimate_minutes: hint.estimate, scheduled_date: isInbox ? null : scheduledDate, is_inbox: isInbox, project_id: projectId, recurrence, parent_task_id: null }]);
    const res = await addTask({ title: hint.title, priority, estimateMinutes: hint.estimate, scheduledDate: isInbox ? null : scheduledDate, isInbox, projectId, recurrence, dueDate: hint.dueDate, notes: spec.notes || null });
    if ('id' in res) setTasks((ts) => ts.map((t) => (t.id === tempId ? { ...t, id: res.id } : t)));
    else setTasks((ts) => ts.filter((t) => t.id !== tempId));
  }

  const open = (id: string) => router.push(`${pathname}?task=${id}`);
  const activeViewDef = VIEWS.find((v) => v.id === view)!;
  const activeList = listId ? projects[listId] : null;

  // ── keyboard-grammar mutations (optimistic, same rollback shape as above) ──
  const labelsFor = (id: string) => labelOverride[id] ?? taskLabels[id] ?? [];
  async function setPriorityFor(id: string, level: TaskItem['priority']) {
    const prev = tasks.find((x) => x.id === id); if (!prev || prev.priority === level) return;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, priority: level } : x)));
    const res = await updateTask(id, { priority: level });
    if ('error' in res) setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, priority: prev.priority } : x)));
  }
  async function moveToProject(id: string, pid: string) {
    const prev = tasks.find((x) => x.id === id); if (!prev) return;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, project_id: pid, is_inbox: false } : x)));
    const res = await moveTaskToProject(id, pid);
    if ('error' in res) setTasks((ts) => ts.map((x) => (x.id === id ? prev : x)));
  }
  async function toggleLabel(id: string, labelId: string) {
    const cur = labelsFor(id);
    const on = !cur.includes(labelId);
    const next = on ? [...cur, labelId] : cur.filter((x) => x !== labelId);
    setLabelOverride((o) => ({ ...o, [id]: next }));
    const res = await setTaskLabel(id, labelId, on);
    if ('error' in res) setLabelOverride((o) => ({ ...o, [id]: cur }));
  }

  const focusRow = (n: number) => {
    setFocusIdx(n);
    requestAnimationFrame(() => rowsRef.current[n]?.scrollIntoView({ block: 'nearest' }));
  };
  const openRowMenu = (kind: RowMenuKind, i: number, id: string) => {
    const el = rowsRef.current[i]; if (!el) return;
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
      { label: 'Next week', run: () => reschedule(menu.id, iso(nextMonday())) },
      { label: 'Inbox', run: () => reschedule(menu.id, 'inbox') },
    ];
    if (menu.kind === 'project') return projectList.map((p) => ({ label: p.name, color: p.color, run: () => moveToProject(menu.id, p.id) }));
    return labels.map((l) => ({ label: l.name, isLabel: true, on: labelsFor(menu.id).includes(l.id), run: () => toggleLabel(menu.id, l.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, projectList, labels, labelOverride, taskLabels, tasks]);

  // The grammar. Window-level (via a ref, like Triage) so it survives clicks and
  // always reads fresh state. Yields to inputs, the "g" navigation chord, an open
  // task drawer (?task=), the composer, and any open Radix menu/popover.
  const handleKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (goChordActive()) return;
    const el = e.target as HTMLElement | null;
    if (el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable)) return;
    if (composing) return;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('task')) return;
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return;

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
    if (e.key === 'ArrowDown' || k === 'j') { e.preventDefault(); focusRow(focusIdx < 0 ? 0 : Math.min(list.length - 1, focusIdx + 1)); return; }
    if (e.key === 'ArrowUp' || k === 'k') { e.preventDefault(); focusRow(focusIdx < 0 ? 0 : Math.max(0, focusIdx - 1)); return; }
    if (e.key === 'Escape' && focusIdx >= 0) { e.preventDefault(); setFocusIdx(-1); return; }
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
    else if (k === 'l') { e.preventDefault(); if (labels.length) openRowMenu('label', focusIdx, t.id); }
  };
  const keyRef = useRef(handleKey);
  keyRef.current = handleKey;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  // Keep focus in range as the list changes; reset it (and any menu) when the
  // view/filter changes so the cursor never points at a stale row.
  useEffect(() => { setFocusIdx((i) => (i < 0 ? i : Math.min(i, visible.length - 1))); }, [visible.length]);
  useEffect(() => { setFocusIdx(-1); setMenu(null); }, [view, listId, filter, labelFilter]);
  // A popover anchored to a rect must not linger through scroll/resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [menu]);

  // Saved views — a named filter combo (spec §3.5). Any active filter can be
  // saved; clicking one restores view + filter + label + list at once. Which
  // view is "active" is derived from current state, so it self-detaches the
  // moment any filter is changed by hand — no bookkeeping through mutations.
  const filterActive = filter !== 'all' || !!labelFilter || !!listId;
  const viewMatches = (v: SavedViewDef) => {
    const f = v.filter || {};
    return (f.view ?? 'inbox') === view && (f.filter ?? 'all') === filter && (f.labelId ?? null) === labelFilter && (f.listId ?? null) === listId;
  };
  const applyView = (v: SavedViewDef) => {
    const f = v.filter || {};
    setView((f.view as View) ?? 'inbox');
    setFilter((f.filter as Filter) ?? 'all');
    setLabelFilter(f.labelId ?? null);
    setListId(f.listId ?? null);
    setComposing(false);
  };
  async function saveView() {
    const name = viewName.trim();
    if (!name) return;
    setViewName(''); setSavingView(false);
    const snapshot: SavedViewDef['filter'] = { view, filter, labelId: labelFilter, listId };
    const tmp = { id: 'tmp-' + Date.now(), name, filter: snapshot };
    setViews((vs) => [...vs, tmp]);
    const res = await createSavedView(name, snapshot);
    if ('error' in res) setViews((vs) => vs.filter((v) => v.id !== tmp.id));
    else setViews((vs) => vs.map((v) => (v.id === tmp.id ? { ...v, id: res.id } : v)));
  }
  async function removeView(id: string) {
    setViews((vs) => vs.filter((v) => v.id !== id));
    await deleteSavedView(id);
  }

  // ── rail (or pills when narrow) — same row language as the global sidebar:
  //    34px row, 8px gap, rounded-sm, ink-600 → ink-900 with the neutral selected
  //    wash when active (B&G — no edge bar), 16px regular icons. ──
  const rail = (
    <aside
      className={narrow
        ? 'flex gap-1.5 overflow-x-auto border-b border-line-soft px-3.5 py-2.5'
        : 'flex w-[232px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line-soft px-3.5 py-3'}
    >
      {VIEWS.map((v) => {
        const on = view === v.id && !listId;
        const count = counts[v.id];
        return (
          <button key={v.id} onClick={() => { setView(v.id); setListId(null); setComposing(false); }} className={cn(railBtn(on), 'shrink-0')}>
            <Icon icon={v.icon} size={16} className="shrink-0" />
            <span className={narrow ? undefined : 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap'}>{v.label}</span>
            {!narrow && count > 0 && <span className="text-caption tabular-nums text-ink-500">{count}</span>}
          </button>
        );
      })}

      {!narrow && savedViewsSupported && (
        <>
          <div aria-hidden className="mx-[-14px] mt-2 mb-[3px] h-px bg-line-soft" />
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="flex flex-1 items-center gap-1.5">
              <Icon icon={CaretDown} size={12} className="text-ink-500" />
              <span className={sectionLabel}>Views</span>
            </span>
            {filterActive && !savingView && (
              <IconButton size="xs" variant="ghost" onClick={() => setSavingView(true)} label="Save this view" icon={<Icon icon={Plus} size={12} />} />
            )}
          </div>
          {savingView && (
            <div className="flex items-center gap-1.5 px-1 pb-1">
              <input autoFocus value={viewName} onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveView(); if (e.key === 'Escape') { setViewName(''); setSavingView(false); } }}
                placeholder="View name…" autoComplete="off" data-1p-ignore data-lpignore="true"
                className="focus-ring min-w-0 flex-1 rounded-sm border border-line-strong bg-surface-raised px-2 py-1.5 text-caption text-ink-800 outline-none placeholder:text-ink-400" />
            </div>
          )}
          {views.map((v) => {
            const on = viewMatches(v);
            return (
              <button key={v.id} onClick={() => applyView(v)} className={cn(railBtn(on), 'group shrink-0')}>
                <Icon icon={FunnelSimple} size={14} className="shrink-0 text-ink-500" />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{v.name}</span>
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeView(v.id); }} aria-label={`Delete ${v.name}`}
                  className="focus-ring grid size-[18px] place-items-center rounded-xs text-ink-500 opacity-0 transition-opacity hover:text-ink-800 group-hover:opacity-100">
                  <Icon icon={Trash} size={12} />
                </span>
              </button>
            );
          })}
          {views.length === 0 && !savingView && (
            <div className="px-2 pb-1 pt-0.5 text-caption text-ink-500">
              {filterActive ? 'Save the current filter with +' : 'Filter tasks, then save the view.'}
            </div>
          )}
        </>
      )}

      {!narrow && projectList.length > 0 && (
        <>
          <div aria-hidden className="mx-[-14px] mt-2 mb-[3px] h-px bg-line-soft" />
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="flex flex-1 items-center gap-1.5">
              <Icon icon={CaretDown} size={12} className="text-ink-500" />
              <span className={sectionLabel}>List</span>
            </span>
            <IconButton size="xs" variant="ghost" onClick={() => router.push('/projects')} label="New list" icon={<Icon icon={Plus} size={12} />} />
          </div>
          {projectList.map((p) => {
            const on = listId === p.id;
            return (
              <button key={p.id} onClick={() => { setListId(on ? null : p.id); setComposing(false); }} className={cn(railBtn(on), 'shrink-0')}>
                <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: p.color ?? 'var(--color-ink-500)' }} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
              </button>
            );
          })}
        </>
      )}
    </aside>
  );

  const activeParts = [
    ...(filter !== 'all' ? [FILTERS.find((f) => f.id === filter)!.label] : []),
    ...(labelFilter ? [labels.find((l) => l.id === labelFilter)?.name ?? ''] : []),
  ].filter(Boolean);
  const filtering = activeParts.length > 0;

  return (
    <div className={cn('flex h-full animate-ds-fadein', narrow ? 'flex-col' : 'flex-row')}>
      {rail}

      {/* ── Task pane ── */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header: view context left · Filter + layout right. Full-width border
            bar, but the content centers in the same column as the body below. */}
        <div className="h-12 shrink-0 border-b border-line-soft">
          <ViewContainer className="flex h-full items-center gap-2">
          <span className="text-ui font-medium text-ink-900">{activeList ? activeList.name : activeViewDef.label}</span>
          {visible.length > 0 && <span className="text-caption tabular-nums text-ink-500">{visible.length}</span>}
          <span className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger className={headerBtn(filtering)}>
              <Icon icon={FunnelSimple} size={16} /> {filtering ? activeParts.join(' · ') : 'Filter'}
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
                      onCheckedChange={() => setLabelFilter((cur) => (cur === l.id ? null : l.id))}>
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--color-label-${l.color ?? 'stone'})` }} /> {l.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className={headerBtn(false)}>
              <Icon icon={SquaresFour} size={16} /> Layout <Icon icon={CaretDown} size={12} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem icon={<Icon icon={SquaresFour} size={16} />}>List</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={CalendarDots} size={16} />} onSelect={() => router.push('/tasks?view=week')}>Week board</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </ViewContainer>
        </div>

        {/* Body — same centered container as the header, so the task list sits in
            a max-width column centered in the workspace (not hugging the left). */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', narrow ? 'pb-16 pt-4' : 'pb-20 pt-[18px]')}>
          <ViewContainer>
            {visible.length === 0 && !composing ? (
              <EmptyState view={view} listName={activeList?.name} onAdd={() => setComposing(true)} onImport={() => router.push('/settings?section=import')} />
            ) : (
              <>
                {composing ? (
                  <Composer
                    projects={projectList}
                    defaultDest={view === 'inbox' ? 'inbox' : 'today'}
                    defaultProject={listId}
                    onCancel={() => setComposing(false)}
                    onSubmit={(spec) => { create(spec); setComposing(false); }}
                  />
                ) : (
                  <QuickAddRow onClick={() => setComposing(true)} className="mb-4" />
                )}

                <div>
                  {visible.map((t, i) => (
                    <Row key={t.id} t={t} project={t.project_id ? projects[t.project_id] : null} sub={subByParent[t.id]}
                      rowLabels={labelsFor(t.id).map((id) => labels.find((l) => l.id === id)).filter(Boolean).map((l) => ({ name: l!.name, color: l!.color ?? 'stone' }))}
                      last={i === visible.length - 1} todayISO={todayISO} tomorrowISO={tomorrowISO}
                      focused={i === focusIdx} innerRef={(el) => { rowsRef.current[i] = el; }}
                      onToggle={() => toggle(t.id)} onOpen={() => open(t.id)} onStar={() => highlight(t.id)}
                      onMove={(target) => reschedule(t.id, target)} onDelete={() => remove(t.id)} />
                  ))}
                  {visible.length === 0 && (
                    <div className="px-2 py-7 text-center text-ui text-ink-600">Nothing here yet.</div>
                  )}
                </div>
              </>
            )}
          </ViewContainer>
        </div>
      </main>

      {/* Keyboard-grammar popover (S schedule · P project · L label) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-[120]" aria-hidden onClick={closeMenu} />
          <div role="menu" aria-label={menu.kind === 'schedule' ? 'Schedule' : menu.kind === 'project' ? 'Move to project' : 'Labels'}
            className={cn(MENU_PANEL_CLASS, 'fixed z-[121] max-h-[min(320px,60vh)] w-56 overflow-y-auto')}
            style={{ top: Math.min(menu.rect.bottom + 4, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320), left: Math.min(menu.rect.left + 28, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 240) }}>
            {menuOpts.length === 0 ? (
              <div className="px-2.5 py-2 text-caption text-ink-500">Nothing to pick</div>
            ) : menuOpts.map((o, i) => (
              <button key={i} role="menuitem" type="button" onMouseEnter={() => setMenuSel(i)}
                onClick={() => { o.run(); closeMenu(); }}
                className={cn('flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-ui', i === menuSel ? 'bg-surface-active' : 'hover:bg-surface-hover')}>
                {o.isLabel
                  ? <Icon icon={TagIcon} size={13} className="shrink-0 text-ink-500" />
                  : o.color !== undefined
                    ? <span aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ background: o.color ?? 'var(--color-ink-400)' }} />
                    : <span className="w-0.5" />}
                <span className="min-w-0 flex-1 truncate text-ink-800">{o.label}</span>
                {o.on && <Icon icon={Check} size={14} className="shrink-0 text-ink-500" />}
                {i < 9 && <Kbd keys={[String(i + 1)]} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Task row (design: roomy row · checkbox · title · tag line · hover ⋮ menu) ──
function Row({ t, project, sub, rowLabels = [], last, todayISO, tomorrowISO, focused = false, innerRef, onToggle, onOpen, onStar, onMove, onDelete }: {
  t: TaskItem; project: TaskProject | null; sub?: { done: number; total: number }; rowLabels?: { name: string; color: string }[]; last: boolean;
  todayISO: string; tomorrowISO: string; focused?: boolean; innerRef?: (el: HTMLDivElement | null) => void;
  onToggle: () => void; onOpen: () => void; onStar: () => void; onMove: (target: string) => void; onDelete: () => void;
}) {
  const hasMeta = t.priority !== 'low' || project || t.estimate_minutes != null || t.recurrence || t.highlight || rowLabels.length > 0 || (sub && sub.total > 0);
  return (
    <div ref={innerRef} aria-selected={focused}
      className={cn('group relative flex gap-3 px-2.5 py-4 transition-colors duration-fast', !last && 'border-b border-line-soft', focused ? 'bg-surface-selected' : 'hover:bg-surface-hover')}>
      <Checkbox size="md" checked={t.done} onCheckedChange={() => onToggle()} aria-label={t.done ? 'Mark not done' : 'Mark done'} className="mt-0.5 shrink-0" />
      <button onClick={onOpen} className="focus-ring min-w-0 flex-1 rounded-xs text-left">
        <div className={cn('truncate text-ui leading-normal', t.done ? 'text-ink-500 line-through' : 'text-ink-800')}>{t.title}</div>
        {hasMeta && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {t.priority !== 'low' && <PriorityBadge level={t.priority} variant="chip" />}
            {project && (
              <FigmaTag icon={<Icon icon={Folder} size={12} weight="fill" style={{ color: project.color ?? 'var(--color-ink-500)' }} />}>
                {project.name}
              </FigmaTag>
            )}
            {rowLabels.map((l) => (
              <FigmaTag key={l.name} bar={`var(--color-label-${l.color})`}>{l.name}</FigmaTag>
            ))}
            {sub && sub.total > 0 && <span className="text-caption tabular-nums text-ink-500">{sub.done}/{sub.total}</span>}
            {t.estimate_minutes != null && <span className="text-caption tabular-nums text-ink-500">{fmtDur(t.estimate_minutes)}</span>}
            {t.recurrence && <Icon icon={Repeat} size={12} className="text-ink-500" />}
            {t.highlight && <Icon icon={Star} size={12} weight="fill" className="text-ink-600" />}
          </div>
        )}
      </button>
      <div className="self-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" iconOnly aria-label="Task actions"
              className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              icon={<Icon icon={DotsThree} size={16} weight="bold" />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem icon={<Icon icon={Star} size={16} />} onSelect={onStar}>{t.highlight ? 'Remove highlight' : 'Highlight'}</DropdownMenuItem>
            {!t.done && <DropdownMenuItem icon={<Icon icon={Sun} size={16} />} onSelect={() => onMove(todayISO)}>Today</DropdownMenuItem>}
            {!t.done && <DropdownMenuItem icon={<Icon icon={CalendarDots} size={16} />} onSelect={() => onMove(tomorrowISO)}>Tomorrow</DropdownMenuItem>}
            {!t.done && <DropdownMenuItem icon={<Icon icon={Tray} size={16} />} onSelect={() => onMove('inbox')}>Inbox</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem danger icon={<Icon icon={Trash} size={16} />} onSelect={onDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── New-task composer (design: title · description · Date/Priority/Project chips ·
//    destination + Cancel/Add task). NL hints still parse from the title. ──
export function Composer({ projects, defaultDest, defaultProject, onCancel, onSubmit }: {
  projects: TaskProject[]; defaultDest: 'inbox' | 'today'; defaultProject: string | null;
  onCancel: () => void; onSubmit: (spec: { title: string; notes: string; date: string | null; priority: 'low' | 'med' | 'high' | null; projectId: string | null; dest: 'inbox' | 'today' | 'tomorrow' }) => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<CPrio>(null);
  const [projectId, setProjectId] = useState<string | null>(defaultProject);
  const [dest, setDest] = useState<'inbox' | 'today' | 'tomorrow'>(defaultDest);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const hint = title.trim() ? parse(title, projects) : null;
  const canAdd = !!(hint && hint.title);
  // Urgent is a composer-only convenience; persist it as High.
  const submit = () => { if (canAdd) onSubmit({ title, notes, date, priority: priority === 'urgent' ? 'high' : priority, projectId, dest }); };
  const proj = projectId ? projects.find((p) => p.id === projectId) : null;
  const destLabel = dest === 'inbox' ? 'Inbox' : dest === 'today' ? 'Today' : 'Tomorrow';

  // Chip: 32px trigger, radius-md, hairline stroke — set keeps the neutral fill +
  // strong stroke, unset is transparent with a hover wash. Token-driven throughout.
  const chip = (set: boolean) => cn(
    'focus-ring relative inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-ui font-normal transition-colors duration-fast',
    set ? 'border-line-strong bg-surface-fill text-ink-800' : 'border-line-strong bg-transparent text-ink-600 hover:bg-surface-hover hover:text-ink-800',
  );

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-line-soft bg-surface-raised px-4 pt-3.5 shadow-lift-1">
      <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="New task" autoComplete="off" data-1p-ignore data-lpignore="true"
        className="w-full border-0 bg-transparent p-0 text-lead font-normal text-ink-900 outline-none placeholder:text-ink-400" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Description" rows={notes.includes('\n') ? 3 : 2}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-ui leading-relaxed text-ink-800 outline-none placeholder:text-ink-400" />

      {hint && (hint.priority || hint.projectId || hint.estimate != null || hint.freq || hint.date || hint.dueDate || hint.isInbox) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {hint.date && <Hint><Icon icon={CalendarDots} size={12} /> {hint.dateLabel}</Hint>}
          {hint.dueDate && <Hint><Icon icon={Alarm} size={12} /> {hint.dueLabel}</Hint>}
          {hint.isInbox && <Hint><Icon icon={Tray} size={12} /> inbox</Hint>}
          {hint.priority && <Hint><PriorityBars level={hint.priority} size={12} /> {PRIO_LABEL[hint.priority]}</Hint>}
          {hint.projectId && <Hint><Icon icon={Folder} size={12} /> {projects.find((p) => p.id === hint.projectId)?.name}</Hint>}
          {hint.estimate != null && <Hint><Icon icon={Timer} size={12} /> {fmtDur(hint.estimate)}</Hint>}
          {hint.freq && <Hint><Icon icon={Repeat} size={12} /> {hint.freq}</Hint>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={chip(!!date)}>
          <Icon icon={CalendarDots} size={16} /> {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Date'}
          <input type="date" value={date ?? ''} onChange={(e) => setDate(e.target.value || null)} aria-label="Due date"
            className="absolute inset-0 cursor-pointer opacity-0" />
        </label>

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
          <DropdownMenuTrigger className={chip(!!proj)} aria-label="Project">
            {proj
              ? <><span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: proj.color ?? 'var(--color-ink-500)' }} /> {proj.name}</>
              : <><Icon icon={Folder} size={16} /> Project</>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            <DropdownMenuRadioGroup value={projectId ?? ''} onValueChange={(v) => setProjectId(v || null)}>
              <DropdownMenuRadioItem value="">No project</DropdownMenuRadioItem>
              {projects.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: p.color ?? 'var(--color-ink-500)' }} /> {p.name}
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
function EmptyState({ view, listName, onAdd, onImport }: { view: View; listName?: string; onAdd: () => void; onImport: () => void }) {
  const copy: Record<View, { h: string; sub: string }> = {
    inbox: { h: 'Capture now, plan later', sub: 'Inbox is your go-to spot for quick task entry. Clear your mind now, organize when you’re ready.' },
    today: { h: 'All clear for today', sub: 'Nothing on today’s plate. Add a task, or pull something in from your Inbox.' },
    upcoming: { h: 'Nothing scheduled ahead', sub: 'Tasks with a future date will line up here so you can see what’s coming.' },
    completed: { h: 'Nothing completed yet', sub: 'Finished tasks land here — your quiet record of progress.' },
  };
  const c = listName ? { h: `Nothing in ${listName}`, sub: 'Tasks you file under this list will show up here.' } : copy[view];
  // Coming from another app? Offer the CSV import on the Inbox empty state (§7U:
  // "Importers offered on the Tasks empty state, not the first run").
  const showImport = view === 'inbox' && !listName;
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

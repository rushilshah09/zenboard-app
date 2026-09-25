'use client';
// Task detail — right-side drawer driven by ?task=<id>. Nested infinite-depth
// subtasks (walk into any node, breadcrumb keeps you oriented) + a chat-style
// comments/activity dock posting to the selected node. Reads via the browser
// client (RLS); writes via shared server actions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { todayISO, formatClock, formatMinutes, formatRelativeDay } from '@/lib/date';
import { useResync } from '@/lib/use-resync';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
// X is still used by the "No workstream" row inside a picker popover — the panel's
// own close button comes from <PageView> now.
import { X, ChevronRight, Plus, Minus, Timer, Sun, Send, Tag, Folder, Calendar as CalendarIcon, List as ListIcon } from "@/components/ds/icons";
import { Checkbox, DatePicker, Icon, MenuField, PageView, addLine, inlineEdit, inlineEditProps, toast, toastReverted } from "@/components/ds/ui";
import { createClient } from '@/lib/supabase/client';
import { Pop, SelectMark, chipClass, popRow, POP_ROW_CLASS } from '@/components/task-detail/chip-ui';
import { ReminderChip } from '@/components/reminders/reminder-chip';
import { BlockersChip, type Blocker } from '@/components/task-detail/blockers-chip';
import { RepeatChip } from '@/components/task-detail/repeat-chip';
import { parseRecurrence, type Recurrence } from '@/lib/recurrence';
import { type TaskLink } from '@/lib/task-links';
import { addBlocker, removeBlocker } from '@/lib/actions/task-links';
import { announceReminderChange } from '@/lib/reminders';
import { setReminder } from '@/lib/actions/reminders';
import { addSubtask, addComment, updateTask, toggleTask, rescheduleTask, moveTaskToProject } from '@/lib/actions/tasks';
import { setTaskList } from '@/lib/actions/task-lists';
import { afterDayChange, afterProjectChange, scopeFill } from '@/lib/task-scopes';
import { taskClosedHref } from '@/lib/task-address';
import { createLabel, setLabelColor, setTaskLabel, setTaskSection } from '@/lib/actions/labels';
import { timeboxTask, untimeboxTask } from '@/lib/actions/timebox';
import { TIMEBOX_SLOTS } from '@/lib/timebox';
import { fmtTime, fmtMinTime, minutesOfDay, isoFromLocal } from '@/lib/calendar';
import { ColorPalette } from '@/components/ds/ui';
import { type LabelColor } from '@/lib/labelColor';
import { signalTaskToggle } from '@/lib/sound';
import { ConnectedPanel } from '@/components/connected/connected-panel';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';
import type { EntityType } from '@/lib/connected';
import { tempId } from '@/lib/temp-id';

// Module-level so the prop is referentially stable across the drawer's renders. `project` too: the Project chip
// already names it, and saying it twice was a line of the clutter (2026-09-21).
const CONNECTED_OMIT: EntityType[] = ['task', 'project'];
/** Whether the panel shows every property or only the ones with a value. */
const ALL_PROPS_KEY = 'zb:task-panel:all-properties';

type Row = {
  id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high';
  estimate_minutes: number | null; scheduled_date: string | null; is_inbox: boolean;
  notes: string | null; parent_task_id: string | null; recurrence: Recurrence | null;
  project_id: string | null; section_id?: string | null;
  // A task is filed under a project or a list OF ITS OWN SPACE, and nothing else may be offered.
  space_id?: string;
  list_id?: string | null;
  // 0031 — merged in by a separate probe, like section_id above, so the
  // critical fetch never depends on a migration.
  remind_at?: string | null; reminded_at?: string | null;
};
type Label = { id: string; name: string; color?: string | null };
type Section = { id: string; project_id: string; name: string };
/** Somewhere a task can be filed: a project, or a list (0038). */
type Pile = { id: string; name: string; color: string | null; space_id: string };
type Node = Row & { subtasks: Node[] };
type FeedItem = { id: string; kind: 'comment' | 'event'; mine: boolean; body: string; at: string };

/** A text field as tall as what it holds — when it is first drawn and when it is redrawn, not only while typing.
 *  With `rows={1}` and no sizing on mount, a two-line title opened cut to its first line. */
const fitHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

/** Null stays null here — "no estimate" is a different answer from "0m". */
const fmtDur = (m: number | null) => (m == null ? null : formatMinutes(m));
const PRI = { high: { c: 'var(--red)', t: 'High' }, med: { c: 'var(--amber)', t: 'Medium' }, low: { c: 'var(--text-secondary)', t: 'Low' } } as const;
// Comment/activity timestamps. Through THE date vocabulary — this hardcoded
// 'en-US', so the same panel could stamp a comment "7:21 PM" while the chip
// beside it read "19:21".
const time = (iso: string) => formatClock(iso) ?? '';

function buildTree(rows: Row[], rootId: string): Node | null {
  const byParent = new Map<string | null, Row[]>();
  for (const r of rows) { const k = r.parent_task_id; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(r); }
  const root = rows.find((r) => r.id === rootId);
  if (!root) return null;
  const attach = (r: Row): Node => ({ ...r, subtasks: (byParent.get(r.id) ?? []).map(attach) });
  return attach(root);
}
function findNode(n: Node, id: string): Node | null {
  if (n.id === id) return n;
  for (const k of n.subtasks) { const f = findNode(k, id); if (f) return f; }
  return null;
}
function pathTo(n: Node, id: string, acc: Node[] = []): Node[] | null {
  const next = [...acc, n];
  if (n.id === id) return next;
  for (const k of n.subtasks) { const f = pathTo(k, id, next); if (f) return f; }
  return null;
}
const progress = (n: Node) => ({ done: n.subtasks.filter((s) => s.done).length, total: n.subtasks.length });



/** The chevron's slot at the head of a subtask row — present even when there is nothing to expand, so boxes align. */
const CHEVRON_SLOT = 18;
/** Where a top-level subtask's box starts inside its row: the row's 8px inset, the chevron slot, an 8px gap. */
const TREE_LEAD = 8 + CHEVRON_SLOT + 8;

function TreeRow({ node, depth, selectedId, expanded, onToggleExp, onSelect, onToggle, onAddChild }: {
  node: Node; depth: number; selectedId: string; expanded: Set<string>;
  onToggleExp: (id: string) => void; onSelect: (id: string) => void; onToggle: (id: string) => void; onAddChild: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const kids = node.subtasks;
  const prog = progress(node);
  const sel = node.id === selectedId;
  return (
    <>
      <div className="group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => onSelect(node.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `6px 8px 6px ${8 + Math.min(depth, 6) * CHEVRON_SLOT}px`, minHeight: 36, borderRadius: 'var(--r-md)', cursor: 'pointer', background: sel ? 'var(--nav-active-bg)' : hover ? 'var(--color-surface-hover)' : 'transparent', transition: 'background var(--duration-fast) var(--ease-hover)' }}>
        {kids.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleExp(node.id); }}
            aria-label={expanded.has(node.id) ? `Hide the subtasks of ${node.title}` : `Show the subtasks of ${node.title}`}
            aria-expanded={expanded.has(node.id)} style={{ width: CHEVRON_SLOT, height: CHEVRON_SLOT, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon icon={ChevronRight} size={14} style={{ transform: expanded.has(node.id) ? 'rotate(90deg)' : 'none', transition: 'transform var(--duration-fast) var(--ease-out-quiet)' }} />
          </button>
        ) : <span style={{ width: CHEVRON_SLOT, flexShrink: 0 }} />}
        {/* Square, like every task's box (CLAUDE.md); an open subtask of some priority keeps that colour on its edge. */}
        <span onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
          <Checkbox size="sm" checked={node.done} onCheckedChange={() => onToggle(node.id)}
            aria-label={node.done ? `Mark ${node.title} not done` : `Mark ${node.title} done`}
            style={!node.done && node.priority !== 'low' ? { borderColor: PRI[node.priority].c } : undefined} />
        </span>
        <span className="text-ui" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: node.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: node.done ? 'line-through' : 'none', fontWeight: sel ? 600 : 400 }}>{node.title}</span>
        {prog.total > 0 && <span style={{ fontSize: 'var(--text-label-size)', color: prog.done === prog.total ? 'var(--green-text)' : 'var(--text-secondary)' }}>{prog.done}/{prog.total}</span>}
        {/* Revealed on hover, on keyboard focus and always on a touch screen — the DS rule, where a JS hover
            flag hid it from both a keyboard and a finger. */}
        <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} aria-label={`Add a subtask to ${node.title}`} title="Add subtask"
          className="reveal-on-hover" style={{ width: 22, height: 22, border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text-secondary)', background: 'transparent', display: 'grid', placeItems: 'center' }}>
          <Icon icon={Plus} size={14} />
        </button>
      </div>
      {expanded.has(node.id) && kids.map((k) => (
        <TreeRow key={k.id} node={k} depth={depth + 1} selectedId={selectedId} expanded={expanded} onToggleExp={onToggleExp} onSelect={onSelect} onToggle={onToggle} onAddChild={onAddChild} />
      ))}
    </>
  );
}

export function TaskDetailDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rootId = params.get('task');

  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [draftSub, setDraftSub] = useState('');
  const [comment, setComment] = useState('');
  const [labels, setLabels] = useState<Label[]>([]);
  const [taskLabels, setTaskLabels] = useState<Record<string, string[]>>({});
  const [labelsSupported, setLabelsSupported] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsSupported, setSectionsSupported] = useState(false);
  // Where a task can be FILED. Until 2026-09-19 nothing here could change a task's project or list — the Tasks
  // list's `p` and `l` keys were the only way, so a pointer could not file a task at all (user report).
  const [projects, setProjects] = useState<Pile[]>([]);
  const [lists, setLists] = useState<Pile[]>([]);
  const [listsSupported, setListsSupported] = useState(false);
  // Timebox twin (0030). Probed like labels/sections: the critical task fetch
  // never depends on it, and without the migration the chip simply isn't there.
  const [timeboxSupported, setTimeboxSupported] = useState(false);
  const [twin, setTwin] = useState<Record<string, string>>({});   // taskId -> block start ISO
  // Reminders (0031). Same probe-and-hide contract as the three above.
  const [remindersSupported, setRemindersSupported] = useState(false);
  // Dependencies (0032). Same probe-and-hide contract: without the table the
  // chip is not there and nothing else changes.
  const [linksSupported, setLinksSupported] = useState(false);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('stone');
  const [colorEditId, setColorEditId] = useState<string | null>(null);
  // Every property, or only the ones that carry a value. A per-viewer convenience, so it lives in this browser
  // and falls back to folded when storage is refused (a private window).
  const [allProps, setAllProps] = useState<boolean>(() => {
    try { return window.localStorage.getItem(ALL_PROPS_KEY) === '1'; } catch { return false; }
  });
  const toggleAllProps = () => {
    const next = !allProps;
    setAllProps(next);
    try { window.localStorage.setItem(ALL_PROPS_KEY, next ? '1' : '0'); } catch { /* private window: forget it */ }
  };
  // Which nodes have been visited in this panel, and where in that list we are.
  const [hist, setHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const meId = useRef<string | null>(null);

  const loadTree = useCallback(async (focusId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    meId.current = user?.id ?? null;
    const { data } = await supabase.from('tasks')
      .select('id, title, done, priority, estimate_minutes, scheduled_date, is_inbox, notes, parent_task_id, recurrence, project_id, space_id');
    let rows = (data as Row[]) ?? [];
    // Labels + sections (migration 0014) — probed separately so the critical
    // fetch above never depends on them; missing → the chips stay hidden.
    const [lab, tl, sec, ts, proj, lst, tli] = await Promise.all([
      supabase.from('labels').select('id, name, color').order('sort_order').order('name'),
      supabase.from('task_labels').select('task_id, label_id'),
      supabase.from('sections').select('id, project_id, name').order('sort_order'),
      supabase.from('tasks').select('id, section_id').not('section_id', 'is', null),
      // In the same round trip as the probes above: where a task can be filed.
      supabase.from('projects').select('id, name, color, space_id').order('name'),
      supabase.from('task_lists').select('id, name, color, space_id').order('sort_order'),
      supabase.from('tasks').select('id, list_id').not('list_id', 'is', null),
    ]);
    setProjects(!proj.error ? ((proj.data as Pile[]) ?? []) : []);
    setListsSupported(!lst.error && !tli.error);
    setLists(!lst.error ? ((lst.data as Pile[]) ?? []) : []);
    if (!tli.error) {
      const lm = new Map(((tli.data as { id: string; list_id: string }[]) ?? []).map((r) => [r.id, r.list_id]));
      rows = rows.map((r) => ({ ...r, list_id: lm.get(r.id) ?? null }));
    }
    // The twin's time comes from the EVENT, not the task — the task only holds
    // the link. One extra query, and only when 0030 is applied.
    const tw = await supabase.from('calendar_events').select('id, starts_at, task_id').not('task_id', 'is', null);
    setTimeboxSupported(!tw.error);
    setTwin(!tw.error
      ? Object.fromEntries(((tw.data as { starts_at: string; task_id: string }[]) ?? []).map((e) => [e.task_id, e.starts_at]))
      : {});
    setLabelsSupported(!lab.error);
    setLabels(!lab.error ? ((lab.data as Label[]) ?? []) : []);
    const tlMap: Record<string, string[]> = {};
    if (!tl.error) for (const r of (tl.data as { task_id: string; label_id: string }[]) ?? []) (tlMap[r.task_id] ??= []).push(r.label_id);
    setTaskLabels(tlMap);
    setSectionsSupported(!sec.error);
    setSections(!sec.error ? ((sec.data as Section[]) ?? []) : []);
    if (!ts.error) {
      const m = new Map((ts.data ?? []).map((r) => [r.id, r.section_id]));
      rows = rows.map((r) => ({ ...r, section_id: m.get(r.id) ?? null }));
    }
    // Reminders (0031), merged the same way. Only rows that HAVE one come back
    // — the overwhelming majority of tasks never carry a reminder, and asking
    // for the column across every task would read a value that is null for all
    // of them.
    const rem = await supabase.from('tasks').select('id, remind_at, reminded_at').not('remind_at', 'is', null);
    setRemindersSupported(!rem.error);
    if (!rem.error) {
      const m = new Map(((rem.data as { id: string; remind_at: string | null; reminded_at: string | null }[]) ?? [])
        .map((r) => [r.id, r]));
      rows = rows.map((r) => ({ ...r, remind_at: m.get(r.id)?.remind_at ?? null, reminded_at: m.get(r.id)?.reminded_at ?? null }));
    }
    // Dependencies (0032). The WHOLE graph, not just this task's edges: the
    // cycle check has to see links between tasks that are nowhere near the
    // open drawer. It is one small table of ids — a task list, not a data set.
    const deps = await supabase.from('task_links').select('task_id, blocked_by_task_id');
    setLinksSupported(!deps.error);
    setLinks(!deps.error ? ((deps.data as unknown as TaskLink[]) ?? []) : []);
    setRows(rows);
    if (focusId) setSelectedId(focusId);
  }, [supabase]);

  // open / close on param change
  // The tree is loaded here on the client, so the failure net's refresh cannot
  // correct it; it asks for a reload instead. Only while a task is open.
  useResync(() => { void loadTree(); }, !!rootId);

  // Opening a task — or a different one — starts fresh, and closing one forgets it. Adjusted while rendering
  // (React's "resetting state when a prop changes"), not in an effect that set state and then rendered twice.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (shownFor !== rootId) {
    setShownFor(rootId);
    if (!rootId) { setRows([]); setSelectedId(null); setFeed([]); setHist([]); setHistIdx(-1); }
    else {
      setSelectedId(rootId);
      // Opening a different task starts a fresh trail — the nodes you walked
      // inside the LAST task are not somewhere "back" leads from this one.
      setHist([rootId]);
      setHistIdx(0);
      setExpanded(new Set([rootId]));
    }
  }
  useEffect(() => {
    if (!rootId) return;
    // Fetching from the database IS what an effect is for; `loadTree` sets state only after its first `await`,
    // which the rule cannot see through.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTree();
  }, [rootId, loadTree]);

  // load feed when selection changes
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from('task_comments').select('id, body, created_at, user_id').eq('task_id', selectedId).order('created_at'),
        supabase.from('task_activity').select('id, kind, meta, created_at').eq('task_id', selectedId).order('created_at'),
      ]);
      if (cancelled) return;
      const items: FeedItem[] = [
        ...((c as { id: string; body: string; created_at: string; user_id: string }[]) ?? []).map((x) => ({ id: 'c' + x.id, kind: 'comment' as const, mine: x.user_id === meId.current, body: x.body, at: time(x.created_at) })),
        ...((a as { id: string; kind: string; created_at: string }[]) ?? []).map((x) => ({ id: 'a' + x.id, kind: 'event' as const, mine: false, body: x.kind, at: time(x.created_at) })),
      ];
      setFeed(items);
    })();
    return () => { cancelled = true; };
  }, [selectedId, supabase]);

  const tree = useMemo(() => (rootId ? buildTree(rows, rootId) : null), [rows, rootId]);
  const node = tree && selectedId ? findNode(tree, selectedId) : null;
  const crumbs = tree && selectedId ? pathTo(tree, selectedId) ?? [] : [];

  if (!rootId) return null;

  // Closing takes the task away and nothing else — the page behind comes back exactly as it was.
  const close = () => router.push(taskClosedHref(pathname, params.toString()));

  const place = (() => {
    const r = rows.find((x) => x.id === rootId);
    if (!r) return null;
    const proj = projects.find((x) => x.id === r.project_id);
    if (proj) return { label: proj.name, icon: <Icon icon={Folder} size={16} weight="fill" style={{ color: scopeFill(proj.color, 'var(--color-ink-500)') }} /> };
    const lst = lists.find((x) => x.id === r.list_id);
    if (lst) return { label: lst.name, icon: <Icon icon={ListIcon} size={16} style={{ color: scopeFill(lst.color, 'var(--color-ink-500)') }} /> };
    return { label: r.is_inbox ? 'Inbox' : 'Tasks' };
  })();

  const unsetExtras = node ? [
    !node.parent_task_id && listsSupported && !node.list_id,
    labelsSupported && !(taskLabels[node.id] ?? []).length,
    node.estimate_minutes == null,
    timeboxSupported && !twin[node.id],
    remindersSupported && !node.remind_at,
    !node.parent_task_id && !node.recurrence,
    linksSupported && !links.some((l) => l.task_id === node.id),
  ].filter(Boolean).length : 0;

  // Walking into a subtask and back out is navigation, so ← / → and the toolbar
  // arrows move through the nodes you actually visited — not the browser's
  // history, which would leave the app entirely. Selecting from a crumb (or a
  // subtask row) truncates the forward branch, the same way a browser does.
  const select = (id: string) => {
    setHist((h) => [...h.slice(0, histIdx + 1), id]);
    setHistIdx((i) => i + 1);
    setSelectedId(id);
  };
  const step = (delta: number) => {
    const next = histIdx + delta;
    if (next < 0 || next >= hist.length) return;
    setHistIdx(next);
    setSelectedId(hist[next]);
  };
  const patchLocal = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  // EVERY write here is optimistic, and none may be a silent keep: a refusal puts the old value back and says so.
  // Until 2026-09-21 the title, notes, priority, estimate, repeat, done, labels and workstream wrote
  // fire-and-forget — a thrown failure reached the shell's net, but a returned `{ error }` (a refusal) left the
  // new value on screen as if it had saved.
  const settle = async (id: string, before: Partial<Row>, write: Promise<{ error: string } | object>) => {
    const res = await write;
    if ('error' in res && typeof res.error === 'string') { patchLocal(id, before); toastReverted(res.error); }
  };
  const onToggle = (id: string) => {
    const r = rows.find((x) => x.id === id); if (!r) return;
    patchLocal(id, { done: !r.done });
    signalTaskToggle(!r.done);
    void settle(id, { done: r.done }, toggleTask(id, !r.done));
  };
  const commit = (id: string, p: Partial<Row>) => {
    const r = rows.find((x) => x.id === id); if (!r) return;
    const before = Object.fromEntries(Object.keys(p).map((k) => [k, r[k as keyof Row] ?? null])) as Partial<Row>;
    patchLocal(id, p);
    void settle(id, before, updateTask(id, p as never));
  };
  // Give a task a block on the calendar. The DAY is the task's own scheduled
  // date when it has one, otherwise today — picking a time should never also
  // silently move a task to a different day than the one it was planned for.
  const onTimebox = async (id: string, minutes: number) => {
    const row = rows.find((r) => r.id === id);
    const day = row?.scheduled_date ?? todayISO();
    const startsAt = isoFromLocal(day, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    setTwin((t) => ({ ...t, [id]: startsAt }));
    patchLocal(id, { scheduled_date: day, is_inbox: false });
    const res = await timeboxTask(id, startsAt);
    if ('error' in res) { setTwin((t) => { const n = { ...t }; delete n[id]; return n; }); loadTree(); toastReverted(res.error); }
  };

  const onUntimebox = async (id: string) => {
    setTwin((t) => { const n = { ...t }; delete n[id]; return n; });
    const res = await untimeboxTask(id);
    if ('error' in res) { loadTree(); toastReverted(res.error); }
  };

  // Set or clear the one reminder. Optimistic, and `reminded_at` is cleared
  // locally too — moving a reminder makes it pending again, exactly as the
  // server does it, so the chip does not keep its delivered tick.
  const onRemind = async (id: string, at: string | null) => {
    patchLocal(id, { remind_at: at, reminded_at: null });
    const res = await setReminder(id, at);
    if ('error' in res) { loadTree(); toastReverted(res.error); return; }
    // Tell the scheduler now rather than letting it find out on its next
    // heartbeat — a reminder set for two minutes' time must arrive in two.
    announceReminderChange();
  };

  // Add / remove a dependency. Optimistic on the local graph so the chip and
  // the picker's refusals update under the pointer; a rejection reloads, which
  // is also how a cycle two tabs raced into gets corrected.
  const onAddBlocker = async (id: string, blocker: Blocker) => {
    setLinks((ls) => [...ls, { task_id: id, blocked_by_task_id: blocker.id }]);
    const res = await addBlocker(id, blocker.id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); loadTree(); }
  };
  const onRemoveBlocker = async (id: string, blockerId: string) => {
    setLinks((ls) => ls.filter((l) => !(l.task_id === id && l.blocked_by_task_id === blockerId)));
    const res = await removeBlocker(id, blockerId);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); loadTree(); }
  };

  // Filing and scheduling follow the list's own rules (`afterDayChange`, `afterProjectChange` in lib/task-scopes.ts;
  // the server applies the same ones), and unlike the fire-and-forget writes above, a refusal puts the chip back
  // and says so — a chip that shows a project the task does not have is worse than no chip.
  const onSchedule = async (id: string, target: string | 'inbox' | null) => {
    const row = rows.find((r) => r.id === id); if (!row) return;
    const before = { scheduled_date: row.scheduled_date, is_inbox: row.is_inbox };
    patchLocal(id, afterDayChange(row, target));
    const res = await rescheduleTask(id, target);
    if ('error' in res) { patchLocal(id, before); toastReverted(res.error); }
  };
  const onProject = async (id: string, projectId: string | null) => {
    const row = rows.find((r) => r.id === id); if (!row) return;
    const change = afterProjectChange(row, projectId);
    if (!change) return;
    const before = { project_id: row.project_id, is_inbox: row.is_inbox, section_id: row.section_id ?? null };
    patchLocal(id, change);
    const res = await moveTaskToProject(id, projectId);
    if ('error' in res) { patchLocal(id, before); toastReverted(res.error); }
  };
  // A list never touches the project: the two answer different questions (lib/task-scopes.ts).
  const onList = async (id: string, listId: string | null) => {
    const row = rows.find((r) => r.id === id); if (!row || (row.list_id ?? null) === listId) return;
    const before = { list_id: row.list_id ?? null, is_inbox: row.is_inbox };
    patchLocal(id, { list_id: listId, is_inbox: listId ? false : row.is_inbox });
    const res = await setTaskList(id, listId);
    if ('error' in res) { patchLocal(id, before); toastReverted(res.error); }
  };

  const toggleLabel = (taskId: string, labelId: string) => {
    const cur = taskLabels[taskId] ?? [];
    const on = !cur.includes(labelId);
    setTaskLabels((m) => ({ ...m, [taskId]: on ? [...cur, labelId] : cur.filter((x) => x !== labelId) }));
    void setTaskLabel(taskId, labelId, on).then((res) => {
      if (!('error' in res)) return;
      setTaskLabels((m) => {
        const now = m[taskId] ?? [];
        return { ...m, [taskId]: on ? now.filter((x) => x !== labelId) : [...now, labelId] };
      });
      toastReverted(res.error);
    });
  };
  const addLabel = async (taskId: string) => {
    const name = newLabel.trim();
    if (!name) return;
    const color = newLabelColor;
    setNewLabel(''); setNewLabelColor('stone');
    const res = await createLabel(name, color);
    // Refused: the name goes back in the field, so nothing typed is lost.
    if (!('id' in res)) { setNewLabel(name); toast({ message: res.error, variant: 'error' }); return; }
    setLabels((ls) => [...ls, { id: res.id, name, color }]);
    setTaskLabels((m) => ({ ...m, [taskId]: [...(m[taskId] ?? []), res.id] }));
    const put = await setTaskLabel(taskId, res.id, true);
    if ('error' in put) {
      setTaskLabels((m) => ({ ...m, [taskId]: (m[taskId] ?? []).filter((x) => x !== res.id) }));
      toastReverted(put.error);
    }
  };
  const recolorLabel = (labelId: string, color: LabelColor) => {
    const was = labels.find((l) => l.id === labelId)?.color ?? null;
    setLabels((ls) => ls.map((l) => (l.id === labelId ? { ...l, color } : l)));
    void setLabelColor(labelId, color).then((res) => {
      if (!('error' in res)) return;
      setLabels((ls) => ls.map((l) => (l.id === labelId ? { ...l, color: was } : l)));
      toastReverted(res.error);
    });
  };
  const onSection = (taskId: string, sectionId: string | null) => {
    const r = rows.find((x) => x.id === taskId); if (!r) return;
    patchLocal(taskId, { section_id: sectionId });
    void settle(taskId, { section_id: r.section_id ?? null }, setTaskSection(taskId, sectionId));
  };

  // ADDING A SUBTASK DOES NOT WALK INTO IT. This used to pass the new id to
  // `loadTree`, which selects it — so pressing Enter on "Add a subtask…" took you
  // inside the thing you had just created, and adding a second one meant
  // navigating back out first. Breaking a task down is a burst: you type three or
  // four in a row. Opening a subtask is a separate decision, and the row is right
  // there to click when you want it.
  const addChild = async (parentId: string, title: string) => {
    const res = await addSubtask(parentId, title);
    if ('id' in res) { setExpanded((s) => new Set(s).add(parentId)); await loadTree(); return; }
    toast({ message: res.error, variant: 'error' });
  };
  const send = async () => {
    const body = comment.trim(); if (!body || !selectedId) return;
    setComment('');
    const tmp = tempId();
    setFeed((f) => [...f, { id: tmp, kind: 'comment', mine: true, body, at: time(new Date().toISOString()) }]);
    const res = await addComment(selectedId, body);
    // Refused: the message leaves the thread and goes back in the box — words are never silently lost.
    if ('error' in res) {
      setFeed((f) => f.filter((x) => x.id !== tmp));
      setComment((cur) => cur || body);
      toastReverted(res.error);
    }
  };

  return (
    // THE opening system (components/ds/ui/page-view.tsx). This used to be a
    // hand-rolled scrim + <aside> + breadcrumb strip in inline styles — a task
    // opened one way, an invoice another, and neither could be moved to full page
    // or a new tab. Everything shell-shaped now comes from the primitive; only the
    // task's own content lives below.
    <PageView
      open
      onOpenChange={(o) => { if (!o) close(); }}
      contentType="task"
      title={node?.title ?? 'Task'}
      // The crumbs walk the SUBTASK tree, not the app — clicking one selects that
      // node in place. `onNavigate` (no href) is exactly what DS Crumb wants for
      // that, and it inherits the >4-level "…" collapse a deep tree will hit.
      // WHERE the task lives — its project, its list, or the Inbox — rather than its name, which the heading
      // right below already says (the same words twice was part of the clutter). Inside a subtask the path
      // follows, each step selecting that node in place.
      breadcrumbs={[
        ...(place ? [place] : []),
        ...(crumbs.length > 1 ? crumbs.map((n) => ({ label: n.title, onNavigate: () => select(n.id) })) : []),
      ]}
      // `?task=<id>` IS this record's address, so a new tab is a real link, not a
      // simulation.
      href={`${pathname}?task=${rootId}`}
      history={{
        canBack: histIdx > 0,
        canForward: histIdx < hist.length - 1,
        onBack: () => step(-1),
        onForward: () => step(1),
      }}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-full)', padding: '4px 4px 4px 16px' }}>
          <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Leave a message…" aria-label="Message" {...inlineEditProps} className={inlineEdit({ as: 'ui' })} style={{ flex: 1, minWidth: 0 }} />
          <button onClick={send} disabled={!comment.trim()} aria-label="Send" style={{ width: 'var(--row-nav)', height: 'var(--row-nav)', borderRadius: 'var(--r-full)', border: 'none', flexShrink: 0, background: comment.trim() ? 'var(--primary)' : 'color-mix(in srgb, var(--ink) 10%, transparent)', color: comment.trim() ? 'var(--on-primary)' : 'var(--text-secondary)', cursor: comment.trim() ? 'pointer' : 'default', display: 'grid', placeItems: 'center', transition: 'background var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)' }}><Icon icon={Send} size={16} /></button>
        </div>
      }
    >
      <div>
          {node && (
            <>
              {/* subject */}
              <div style={{ padding: '18px 22px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Square, and the same box the list draws (CLAUDE.md: a task is never a radio circle). */}
                  <Checkbox size="md" checked={node.done} onCheckedChange={() => onToggle(node.id)}
                    aria-label={node.done ? 'Mark not done' : 'Mark done'} className="mt-1.5 shrink-0" />
                  {/* An emptied name is not a rename: leaving the field puts the old one back rather than showing a
                      blank title over a task that still has its name. */}
                  <textarea defaultValue={node.title} key={`${node.id}:t:${node.title}`} rows={1} aria-label="Task name" placeholder="Task name"
                    {...inlineEditProps} className="placeholder:text-ink-500"
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (!next) { e.target.value = node.title; fitHeight(e.target); return; }
                      if (next !== node.title) commit(node.id, { title: next });
                    }}
                    ref={fitHeight} onInput={(e) => fitHeight(e.currentTarget)}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', resize: 'none', overflow: 'hidden', fontFamily: 'var(--font-editorial)', fontWeight: 500, fontSize: 'var(--text-stat-size)', lineHeight: 1.2, letterSpacing: '-0.015em', color: node.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: node.done ? 'line-through' : 'none', padding: 0 }} />
                </div>

                {/* meta chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 14 }}>
                  {/* A real date — the DS picker, whose `trigger` exists for exactly this chip. It offered Today and
                      Inbox and nothing else, so "Friday" could not be said here at all. "No date" keeps the task in its
                      project or list; with neither it goes to the Inbox (`afterDayChange`). */}
                  <DatePicker aria-label="Schedule" value={node.scheduled_date}
                    onValueChange={(iso) => onSchedule(node.id, iso || null)}
                    trigger={(
                      <button className={chipClass(!!node.scheduled_date || node.is_inbox)}>
                        <Icon icon={Sun} size={14} />
                        {node.scheduled_date ? formatRelativeDay(node.scheduled_date) : node.is_inbox ? 'Inbox' : 'Schedule'}
                      </button>
                    )} />
                  {/* Filing: a project (and then its workstream), a list. Root tasks only — a subtask lives where its
                      parent does, as the Repeat chip below already assumes. */}
                  {!node.parent_task_id && (() => {
                    const mine = projects.filter((x) => !node.space_id || x.space_id === node.space_id);
                    const cur = mine.find((x) => x.id === node.project_id) ?? null;
                    return (
                      <Pop width={220} label="Project" trigger={(_o, p) => (
                        <button {...p} className={chipClass(!!cur)}>
                          <Icon icon={Folder} size={14} weight={cur ? 'fill' : 'regular'} style={cur ? { color: scopeFill(cur.color, 'var(--color-ink-500)') } : undefined} />
                          {cur?.name ?? 'Project'}
                        </button>
                      )}>
                        {(close) => (
                          <div>
                            {/* A long list scrolls inside the panel rather than growing past the window. */}
                            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                            {mine.map((x) => (
                              <button key={x.id} className={POP_ROW_CLASS} style={popRow} aria-pressed={x.id === node.project_id} onClick={() => { void onProject(node.id, x.id); close(); }}>
                                <SelectMark on={x.id === node.project_id} />
                                <Icon icon={Folder} size={12} weight="fill" style={{ color: scopeFill(x.color, 'var(--color-ink-500)'), flexShrink: 0 }} />
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                              </button>
                            ))}
                            </div>
                            {mine.length === 0 && <div style={{ padding: '4px 8px 6px', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>No projects yet.</div>}
                            {cur && (
                              <button className={POP_ROW_CLASS} style={{ ...popRow, marginTop: 4, borderTop: '1px solid var(--line)', borderRadius: 0 }}
                                onClick={() => { void onProject(node.id, null); close(); }}>
                                <Icon icon={X} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />No project
                              </button>
                            )}
                          </div>
                        )}
                      </Pop>
                    );
                  })()}
                  {sectionsSupported && node.project_id && sections.some((s) => s.project_id === node.project_id) && (() => {
                    const projSections = sections.filter((s) => s.project_id === node.project_id);
                    const cur = projSections.find((s) => s.id === node.section_id);
                    return (
                      <Pop width={200} label="Workstream" trigger={(_o, p) => <button {...p} className={chipClass(!!cur)}><Icon icon={Folder} size={14} />{cur?.name ?? 'Workstream'}</button>}>
                        {(close) => (
                          <div>
                            {projSections.map((s) => (
                              <button key={s.id} className={POP_ROW_CLASS} style={popRow} aria-pressed={s.id === node.section_id} onClick={() => { onSection(node.id, s.id === node.section_id ? null : s.id); close(); }}>
                                <SelectMark on={s.id === node.section_id} />{s.name}
                              </button>
                            ))}
                            <button className={POP_ROW_CLASS} style={popRow} onClick={() => { onSection(node.id, null); close(); }}>
                              <Icon icon={X} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />No workstream
                            </button>
                          </div>
                        )}
                      </Pop>
                    );
                  })()}
                  <Pop width={170} label="Priority" trigger={(_o, p) => <button {...p} className={chipClass(node.priority !== 'low')}><span style={{ width: 3, height: 12, borderRadius: 2, background: PRI[node.priority].c }} />{PRI[node.priority].t}</button>}>
                    {(close) => (<div>{(['high', 'med', 'low'] as const).map((p) => (
                      <button key={p} className={POP_ROW_CLASS} style={popRow} aria-pressed={node.priority === p} onClick={() => { commit(node.id, { priority: p }); close(); }}><SelectMark on={node.priority === p} /><span style={{ width: 3, height: 13, borderRadius: 2, background: PRI[p].c }} />{PRI[p].t}</button>
                    ))}</div>)}
                  </Pop>
                  {!node.parent_task_id && listsSupported && (allProps || !!node.list_id) && (() => {
                    const mine = lists.filter((x) => !node.space_id || x.space_id === node.space_id);
                    const cur = mine.find((x) => x.id === node.list_id) ?? null;
                    return (
                      <Pop width={220} label="List" trigger={(_o, p) => (
                        <button {...p} className={chipClass(!!cur)}>
                          <Icon icon={ListIcon} size={14} style={cur ? { color: scopeFill(cur.color, 'var(--color-ink-500)') } : undefined} />
                          {cur?.name ?? 'List'}
                        </button>
                      )}>
                        {(close) => (
                          <div>
                            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                            {mine.map((x) => (
                              <button key={x.id} className={POP_ROW_CLASS} style={popRow} aria-pressed={x.id === node.list_id} onClick={() => { void onList(node.id, x.id); close(); }}>
                                <SelectMark on={x.id === node.list_id} />
                                <Icon icon={ListIcon} size={12} style={{ color: scopeFill(x.color, 'var(--color-ink-500)'), flexShrink: 0 }} />
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                              </button>
                            ))}
                            </div>
                            {mine.length === 0 && <div style={{ padding: '4px 8px 6px', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>No lists yet.</div>}
                            {cur && (
                              <button className={POP_ROW_CLASS} style={{ ...popRow, marginTop: 4, borderTop: '1px solid var(--line)', borderRadius: 0 }}
                                onClick={() => { void onList(node.id, null); close(); }}>
                                <Icon icon={X} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />No list
                              </button>
                            )}
                          </div>
                        )}
                      </Pop>
                    );
                  })()}
                  {labelsSupported && (allProps || (taskLabels[node.id] ?? []).length > 0) && (() => {
                    const mine = (taskLabels[node.id] ?? []).map((id) => labels.find((l) => l.id === id)?.name).filter(Boolean) as string[];
                    const label = mine.length === 0 ? 'Labels' : mine.length <= 2 ? mine.join(', ') : `${mine.slice(0, 2).join(', ')} +${mine.length - 2}`;
                    return (
                      <Pop width={220} label="Labels" trigger={(_o, p) => <button {...p} className={chipClass(mine.length > 0)}><Icon icon={Tag} size={14} />{label}</button>}>
                        {() => (
                          <div>
                            {labels.map((l) => {
                              const on = (taskLabels[node.id] ?? []).includes(l.id);
                              return (
                                <div key={l.id}>
                                  <div className={POP_ROW_CLASS} style={{ ...popRow, cursor: 'default' }}>
                                    <button onClick={() => setColorEditId((id) => (id === l.id ? null : l.id))} title="Change colour" style={{ border: 'none', background: 'transparent', padding: 2, margin: -2, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--color-label-${l.color ?? 'stone'})` }} />
                                    </button>
                                    <button onClick={() => toggleLabel(node.id, l.id)} aria-pressed={on} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }}>
                                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                                      <SelectMark on={on} />
                                    </button>
                                  </div>
                                  {colorEditId === l.id && (
                                    <div style={{ padding: '2px 8px 6px' }}>
                                      <ColorPalette value={(l.color as LabelColor) ?? 'stone'} onValueChange={(c) => { recolorLabel(l.id, c); setColorEditId(null); }} aria-label="Label colour" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {labels.length === 0 && <div style={{ padding: '4px 8px 6px', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>No labels yet.</div>}
                            <div style={{ borderTop: labels.length ? '1px solid var(--line-2)' : 'none', marginTop: labels.length ? 4 : 0, paddingTop: labels.length ? 4 : 0 }}>
                              {/* A field inside a panel is the DS `MenuField` (the overlay-chrome directive): the wash as its ground, the house placeholder ink, the caret as its focus. */}
                              <MenuField icon={<Icon icon={Plus} size={16} />} value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') addLabel(node.id); }}
                                placeholder="New label…" aria-label="New label" />
                              {newLabel.trim() && (
                                <div style={{ padding: '2px 8px 6px' }}>
                                  <ColorPalette value={newLabelColor} onValueChange={(c) => setNewLabelColor(c)} aria-label="New label colour" />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Pop>
                    );
                  })()}
                  {(allProps || node.estimate_minutes != null) && (
                  <Pop width={188} label="Estimate" trigger={(_o, p) => <button {...p} className={chipClass(node.estimate_minutes != null)}><Icon icon={Timer} size={14} />{fmtDur(node.estimate_minutes) ?? 'Estimate'}</button>}>
                    {(close) => (<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 4 }}>{[15, 30, 45, 60, 90, 120].map((m) => (
                      <button key={m} onClick={() => { commit(node.id, { estimate_minutes: m }); close(); }} style={{ padding: '6px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--text-caption-size)', background: node.estimate_minutes === m ? 'var(--nav-active-bg)' : 'var(--paper-3)', color: node.estimate_minutes === m ? 'var(--text-primary)' : 'var(--ink-2)', border: '1px solid var(--line)' }}>{fmtDur(m)}</button>
                    ))}</div>)}
                  </Pop>
                  )}
                  {timeboxSupported && (allProps || !!twin[node.id]) && (
                    <Pop width={188} label="Timebox" trigger={(_o, p) => <button {...p} className={chipClass(!!twin[node.id])}><Icon icon={CalendarIcon} size={14} />{twin[node.id] ? fmtTime(twin[node.id]) : 'Timebox'}</button>}>
                      {(close) => (
                        <div>
                          {/* Times run 07:00–21:00 in half hours: the window a
                              working day actually falls in. A full 24h list is
                              96 rows of mostly-3am, and the point of this chip is
                              to be faster than opening the calendar. */}
                          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                            {TIMEBOX_SLOTS.map((min) => {
                              const on = !!twin[node.id] && minutesOfDay(twin[node.id]) === min;
                              return (
                                <button key={min} className={POP_ROW_CLASS} style={{ ...popRow, background: on ? 'var(--nav-active-bg)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--ink-2)' }}
                                  onClick={() => { onTimebox(node.id, min); close(); }}>
                                  <span className="num">{fmtMinTime(min)}</span>
                                </button>
                              );
                            })}
                          </div>
                          {twin[node.id] && (
                            <button className={POP_ROW_CLASS} style={{ ...popRow, marginTop: 4, borderTop: '1px solid var(--line)', borderRadius: 0 }}
                              onClick={() => { onUntimebox(node.id); close(); }}>
                              Remove from calendar
                            </button>
                          )}
                        </div>
                      )}
                    </Pop>
                  )}
                  {remindersSupported && (allProps || !!node.remind_at) && (
                    <ReminderChip
                      remindAt={node.remind_at ?? null}
                      remindedAt={node.reminded_at ?? null}
                      // The presets read the task: its calendar block gives
                      // "Before the timebox", its day gives "On the day".
                      context={{ scheduledDate: node.scheduled_date, blockStart: twin[node.id] ?? null }}
                      onSet={(iso) => onRemind(node.id, iso)}
                      onClear={() => onRemind(node.id, null)}
                    />
                  )}
                  {!node.parent_task_id && (allProps || !!node.recurrence) && (
                    <RepeatChip
                      // Re-validated on the way in: `recurrence` is jsonb, so a
                      // row written before a field existed — or by hand — must
                      // not reach the editor as a half-shape.
                      value={parseRecurrence(node.recurrence)}
                      weekdayHint={node.scheduled_date ? new Date(`${node.scheduled_date}T00:00:00`).getDay() : undefined}
                      onChange={(next) => commit(node.id, { recurrence: next })}
                    />
                  )}
                  {linksSupported && (allProps || links.some((l) => l.task_id === node.id)) && (
                    <BlockersChip
                      taskId={node.id}
                      blockers={links
                        .filter((l) => l.task_id === node.id)
                        .map((l) => {
                          const t = rows.find((r) => r.id === l.blocked_by_task_id);
                          // A blocker whose task is gone cannot happen — the FK
                          // cascades — but a row that has not loaded yet can, so
                          // it degrades to a name rather than disappearing.
                          return { id: l.blocked_by_task_id, title: t?.title ?? 'Another task', done: !!t?.done };
                        })}
                      links={links}
                      onAdd={(b) => onAddBlocker(node.id, b)}
                      onRemove={(id) => onRemoveBlocker(node.id, id)}
                    />
                  )}
                  {/* The rest of the properties, folded while empty — a set value is never hidden, and the choice is
                      remembered (Notion's "more properties", as one quiet chip). */}
                  {(allProps || unsetExtras > 0) && (
                    <button type="button" className={chipClass(false)} aria-expanded={allProps} onClick={toggleAllProps}
                      aria-label={allProps ? 'Show fewer properties' : `Show ${unsetExtras} more properties`}>
                      <Icon icon={allProps ? Minus : Plus} size={14} />{allProps ? 'Less' : 'More'}
                    </button>
                  )}
                </div>

                <textarea defaultValue={node.notes ?? ''} key={`${node.id}:n:${node.notes ?? ''}`} placeholder="Add a description…" aria-label="Description" rows={node.notes ? 2 : 1}
                  {...inlineEditProps} className={inlineEdit({ as: 'body' })}
                  onBlur={(e) => e.target.value !== (node.notes ?? '') && commit(node.id, { notes: e.target.value })}
                  ref={fitHeight} onInput={(e) => fitHeight(e.currentTarget)}
                  style={{ marginTop: 14, resize: 'none', overflow: 'hidden', lineHeight: 1.6 }} />
              </div>

              {/* subtasks */}
              {/* Sections speak only when they have something to say: a heading over subtasks, never over their
                  absence — the add row below is the whole invitation (2026-09-21: "so much cluttered"). */}
              <div style={{ padding: '4px 14px 4px' }}>
                {node.subtasks.length > 0 && (
                  <div className="flex items-center gap-2 px-2 pb-1.5 pt-2">
                    <span className="text-overline">Subtasks</span>
                    <span className="text-overline tabular-nums">{progress(node).done}/{progress(node).total}</span>
                  </div>
                )}
                {node.subtasks.map((k) => (
                  <TreeRow key={k.id} node={k} depth={0} selectedId={selectedId!} expanded={expanded}
                    onToggleExp={(id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
                    onSelect={select} onToggle={onToggle} onAddChild={(id) => addChild(id, 'New subtask')} />
                ))}
                {/* The DS add line's field shape. With no subtasks it sits on the panel's column, level with Add file
                    below; with some it is the tree's next row — the + where a box goes, the words where names go.
                    Only the inset moves between the two, so the field is never remounted under a typing hand. */}
                <div className={addLine({ as: 'field' })} style={node.subtasks.length > 0 ? { paddingLeft: TREE_LEAD } : undefined}>
                  <Icon icon={Plus} size={14} className="shrink-0" />
                  <input value={draftSub} onChange={(e) => setDraftSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draftSub.trim()) { addChild(node.id, draftSub.trim()); setDraftSub(''); } }}
                    placeholder="Add a subtask…" aria-label="Add a subtask" {...inlineEditProps} className={inlineEdit({ as: 'ui' })} />
                </div>
              </div>

              {/* files (§7H, 0033) — the same owner-agnostic panel the project
                  Files tab uses, never a second copy: a fork here would drift
                  the upload limit, the refusal wording and the delete confirm
                  away from the surface next to it. Shown even when empty,
                  because Subtasks directly above sets that precedent and a
                  section that appears only sometimes is a section people never
                  learn is there. Its query runs in parallel with the drawer's
                  own load wave, so opening a task is not a round trip slower. */}
              <div style={{ padding: '0 14px 8px' }}>
                <AttachmentsPanel owner={{ task_id: node.id }} quiet />
              </div>

              {/* connected (§3.4) — renders nothing until this task has edges.
                  `task` is omitted: subtasks have their own section above and the
                  parent is already in the breadcrumb, so the panel would repeat
                  both. What it adds is everything the drawer can't show — the
                  project, who it's for, the goal it serves, what it was billed on. */}
              <div style={{ padding: '2px 22px 10px' }}>
                <ConnectedPanel self={{ type: 'task', id: node.id }} omit={CONNECTED_OMIT} />
              </div>

              {/* comments + activity */}
              {feed.length > 0 && (
                <div style={{ padding: '12px 22px 4px', borderTop: '1px solid var(--line-2)', marginTop: 6 }}>
                  <span className="text-overline">Activity</span>
                </div>
              )}
              <div style={{ padding: '4px 22px 18px' }}>
                {feed.map((it) => it.kind === 'event' ? (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '6px 0' }}>
                    <span style={{ height: 1, flex: 1, maxWidth: 40, background: 'var(--line-2)' }} />
                    <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{it.body} · {it.at}</span>
                    <span style={{ height: 1, flex: 1, maxWidth: 40, background: 'var(--line-2)' }} />
                  </div>
                ) : (
                  <div key={it.id} style={{ display: 'flex', flexDirection: it.mine ? 'row-reverse' : 'row', margin: '6px 0' }}>
                    <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: it.mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{ padding: '8px 12px', borderRadius: 'var(--r-lg)', fontSize: 'var(--text-small-size)', lineHeight: 1.45, background: it.mine ? 'var(--neutral-fill)' : 'var(--paper-3)', color: it.mine ? 'var(--on-neutral-fill)' : 'var(--ink)', border: it.mine ? 'none' : '1px solid var(--line)', borderBottomRightRadius: it.mine ? 4 : 14, borderBottomLeftRadius: it.mine ? 14 : 4 }}>{it.body}</div>
                      <div style={{ fontSize: 'var(--text-micro-size)', color: 'var(--text-secondary)', marginTop: 3, padding: '0 3px' }}>{it.at}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
      </div>
    </PageView>
  );
}

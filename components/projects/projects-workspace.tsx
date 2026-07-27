'use client';
// Projects hub — v3 two-pane: project rail (color dot · name · OPEN count) +
// selected-project detail (header · 4 real stat cards · 5-tab bar). Tabs follow
// MASTER_PRODUCT_PLAN §7E: Overview (progress · key tasks · activity log) ·
// Tasks (List/Board/Calendar) · Docs · Money (time → invoice) · Portal (share ·
// client requests). Optimistic writes via existing task/project actions.
//
// Built entirely from the design system: §4.30 Tabs (detail tabs), §4.19
// SegmentedControl (List/Board/Calendar), §4.54 Stat, §4.7 Badge, §4.36 Modal,
// §4.41 toast/Toaster, §4.43 Progress, §4.45 EmptyState, §4.16 Checkbox, Panel
// cards. The only inline `style={}` left is sanctioned: user project colour and
// computed geometry (timeline bar left/width, dnd transforms).
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Pencil, Share2, Eye, Kanban, Timer, Star, Landmark, Circle, Target, Calendar, User, Clock, FileText, Ellipsis, Trash, Activity, type IconType } from "@/components/ds/icons";
import {
  Icon, Button, IconButton, Badge, Stat, Tabs, SegmentedControl, Checkbox, PriorityBadge, Tag,
  EmptyState, Progress, ActivityFeed as DSActivityFeed, Modal, Field, TextInput, Textarea, DatePicker,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Toaster, toast, type BadgeStatus, type ActivityEntry, type TabItem,
} from '@/components/ds/ui';
import { TaskRow, fmtDur } from '@/components/tasks/task-row';
import { SharePanel } from '@/components/projects/share-panel';
import { PreviewOverlay } from '@/components/projects/preview-overlay';
import { RequestsTab } from '@/components/projects/requests-tab';
import { ProjectDocs } from '@/components/projects/project-docs';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin,
  useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toggleTask, setHighlight, setTaskStatus, setTaskOrder, type TaskStatus } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import { addProjectTask, updateProject, logProjectActivity } from '@/lib/actions/projects';
import { NewProjectModal } from '@/components/projects/new-project-modal';
import { createSection, renameSection, deleteSection } from '@/lib/actions/labels';
import { addTimeEntry, invoiceUnbilledTime } from '@/lib/actions/money';
import { requestApproval, cancelApproval } from '@/lib/actions/portal';
import { FormsPanel } from '@/components/forms/forms-panel';
import { useViewWidth } from '@/components/shell/view-width';
import { cn } from '@/lib/cn';
import type { RequestDecision } from '@/lib/request-status';

export type PProject = {
  id: string; name: string; color: string | null; status: string; client_id: string | null; created_at: string; updated_at: string;
  deadline?: string | null; deadline_label?: string | null;
  portal_enabled?: boolean; portal_token?: string | null;
  share_progress?: boolean; share_completed_tasks?: boolean; share_open_tasks?: boolean;
  share_timeline?: boolean; share_files?: boolean; share_invoices?: boolean; allow_requests?: boolean; portal_intro?: string | null;
};
export type PTask = { id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high'; estimate_minutes: number | null; elapsed_minutes: number; scheduled_date: string | null; due_date?: string | null; highlight: boolean; completed_at: string | null; project_id: string | null; parent_task_id: string | null; created_at: string; status?: string | null; sort_order?: number; section_id?: string | null };
export type PSection = { id: string; project_id: string; name: string; sort_order: number };
export type PTime = { id: string; project_id: string; task_id: string | null; minutes: number | null; started_at: string; billed: boolean };
export type PActivity = { id: string; project_id: string; type: string; body: string | null; created_at: string };
export type PRequest = { id: string; project_id: string; name: string | null; title: string | null; body: string; status: RequestDecision; client_id: string | null; task_id: string | null; resolution_note: string | null; created_at: string };
export type PRequestMessage = { id: string; request_id: string; author: 'team' | 'client'; body: string; client_facing: boolean; created_at: string };
export type PApproval = { id: string; project_id: string; page_id: string; title: string | null; status: 'awaiting' | 'approved' | 'changes_requested'; note: string | null; created_at: string };
export type PDoc = { id: string; project_id: string | null; title: string | null; type: string; client_visible: boolean; updated_at: string };

/** A project's form, in the shape FormsPanel consumes (plus its project id). */
export type PForm = {
  id: string; title: string; status: 'draft' | 'live' | 'closed'; shareToken: string | null;
  updatedAt: string; responses: number; partials: number; projectId: string;
};

export type DetailTab = 'overview' | 'tasks' | 'docs' | 'money' | 'forms' | 'portal';
const COLORS = ['#9A1B6F', '#7B8B5F', '#C88A3B', '#2B5CB0', '#5C4FB8']; // data-layer palette (persisted per-project) — token SOURCE, not a violation
const STATUSES = ['active', 'paused', 'completed', 'archived'];
// §5 colour-as-meaning: paused → warning, completed → success; the rest neutral.
const STATUS_TONE: Record<string, BadgeStatus> = { active: 'neutral', paused: 'warning', completed: 'success', done: 'success', archived: 'neutral' };
const statusLabel = (s: string) => (s === 'done' ? 'Completed' : s.charAt(0).toUpperCase() + s.slice(1));

const todayISO = () => new Date().toISOString().slice(0, 10);
const dateToISO = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmtDate = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function relTime(iso?: string | null) {
  if (!iso) return 'no activity';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const d = Math.floor(s / 86400);
  if (d < 7) return d + 'd ago';
  if (d < 30) return Math.floor(d / 7) + 'w ago';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type Ev = { at: string; verb: string; title: string };
// Merge derived task events (created/completed) with manual project_activity rows.
function buildEvents(tasks: PTask[], activity: PActivity[]): Ev[] {
  const out: Ev[] = [];
  for (const t of tasks) {
    out.push({ at: t.created_at, verb: 'created', title: t.title });
    if (t.completed_at) out.push({ at: t.completed_at, verb: 'completed', title: t.title });
  }
  for (const a of activity) {
    const verb = a.type === 'status_change' ? 'changed status' : a.type === 'note' ? 'noted' : a.type;
    out.push({ at: a.created_at, verb, title: a.body ?? '' });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

// One transient confirmation channel (§4.41) — replaces the per-page zen Toast.
const flash = (m: string) => { toast({ message: m, variant: 'info' }); };

// ── Shared class recipes (same row/composer language as tasks-view) ──
const railBtn = (on: boolean) => cn(
  'focus-ring flex h-[34px] w-full items-center gap-2 rounded-sm px-2 text-left text-ui transition-colors duration-fast',
  on ? 'bg-surface-selected font-medium text-ink-900' : 'font-normal text-ink-600 hover:bg-surface-hover hover:text-ink-800',
);
const composerShell = 'flex items-center gap-2 rounded-lg border border-line-strong bg-surface-raised py-1 pl-3.5 pr-1.5';
const composerInput = 'min-w-0 flex-1 border-0 bg-transparent py-2 text-ui text-ink-900 outline-none placeholder:text-ink-400';
const cardShell = 'rounded-lg border border-line-soft bg-surface-raised';
const sectionLabel = 'text-caption font-medium tracking-[0.02em] text-ink-500';

// Derived project health (§7E "health as narrative"). Calm by design: returns
// null unless an ACTIVE project actually needs attention — overdue work (danger)
// or gone quiet ≥ 7 days with no recent activity/completions (warning). No news
// is good news, so a healthy project shows no health chip at all.
function projectHealth({ status, open, today, projActivity, projTasks, updatedAt, createdAt }: {
  status: string; open: PTask[]; today: string; projActivity: PActivity[]; projTasks: PTask[]; updatedAt?: string; createdAt: string;
}): { label: string; tone: BadgeStatus } | null {
  if (status !== 'active') return null;
  const overdue = open.filter((t) => t.scheduled_date && t.scheduled_date < today).length;
  if (overdue > 0) return { label: `${overdue} overdue`, tone: 'danger' };
  const lastCompleted = projTasks.reduce<string | null>((m, t) => (t.completed_at && (!m || t.completed_at > m) ? t.completed_at : m), null);
  const touches = [projActivity[0]?.created_at ?? null, lastCompleted, updatedAt ?? null, createdAt].filter(Boolean) as string[];
  const lastTouch = touches.sort()[touches.length - 1];
  const quietDays = Math.floor((Date.now() - Date.parse(lastTouch)) / 86400000);
  if (quietDays >= 7) return { label: `Quiet ${quietDays}d`, tone: 'warning' };
  return null;
}

const NO_ACTIVITY: PActivity[] = []; // stable identity so the default doesn't retrigger the reconcile effect
const NO_REQUESTS: PRequest[] = [];
const NO_MESSAGES: PRequestMessage[] = [];
const NO_APPROVALS: PApproval[] = [];
const NO_DOCS: PDoc[] = [];
const NO_TV: Record<string, boolean> = {};
const NO_SECTIONS: PSection[] = [];
const NO_FORMS: PForm[] = [];

export function ProjectsWorkspace({ projects: initProjects, tasks: initTasks, times: initTimes, activity: initActivity = NO_ACTIVITY, requests = NO_REQUESTS, messages = NO_MESSAGES, approvals = NO_APPROVALS, docs: initDocs = NO_DOCS, forms = NO_FORMS, taskVisible = NO_TV, weekStart, initialProjectId, initialTab, sections: initSections = NO_SECTIONS, deadlineSupported = false, activitySupported = false, portalSupported = false, statusSupported = false, sectionsSupported = false }: {
  projects: PProject[]; tasks: PTask[]; times: PTime[]; activity?: PActivity[]; requests?: PRequest[]; messages?: PRequestMessage[]; approvals?: PApproval[]; docs?: PDoc[]; forms?: PForm[]; taskVisible?: Record<string, boolean>; weekStart: string; initialProjectId?: string; initialTab?: DetailTab; sections?: PSection[]; deadlineSupported?: boolean; activitySupported?: boolean; portalSupported?: boolean; statusSupported?: boolean; sectionsSupported?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { full } = useViewWidth();
  const [projects, setProjects] = useState(initProjects);
  const [tasks, setTasks] = useState(initTasks);
  const [times, setTimes] = useState(initTimes);
  const [activity, setActivity] = useState(initActivity);
  const [docs, setDocs] = useState(initDocs);
  const [sections, setSections] = useState(initSections);
  useEffect(() => { setProjects(initProjects); }, [initProjects]);
  useEffect(() => { setTasks(initTasks); }, [initTasks]);
  useEffect(() => { setTimes(initTimes); }, [initTimes]);
  useEffect(() => { setActivity(initActivity); }, [initActivity]);
  useEffect(() => { setDocs(initDocs); }, [initDocs]);

  const [activeId, setActiveId] = useState<string | undefined>(initialProjectId ?? initProjects[0]?.id);
  useEffect(() => { if (initialProjectId) setActiveId(initialProjectId); }, [initialProjectId]);
  useEffect(() => { if (projects.length && !projects.find((p) => p.id === activeId)) setActiveId(projects[0].id); }, [projects, activeId]);

  const [tab, setTab] = useState<DetailTab>(initialTab ?? 'overview');
  // A notification deep-link (`/projects/<id>?tab=portal`) can change the wanted
  // tab while this component is already mounted — follow it.
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const [layout, setLayout] = useState<'list' | 'board' | 'calendar'>('list');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [closeOutOpen, setCloseOutOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  // patch the active project's portal settings locally (so header/preview reflect immediately)
  const patchActive = (patch: Partial<PProject>) => setProjects((ps) => ps.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));

  const subByParent = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const t of tasks) if (t.parent_task_id) { const e = m.get(t.parent_task_id) ?? { done: 0, total: 0 }; e.total++; if (t.done) e.done++; m.set(t.parent_task_id, e); }
    return m;
  }, [tasks]);
  const openCount = (pid: string) => tasks.filter((t) => t.project_id === pid && !t.done).length;

  const active = projects.find((p) => p.id === activeId) ?? projects[0];

  function toggle(id: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const done = !t.done;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done, completed_at: done ? new Date().toISOString() : null } : x)));
    signalTaskToggle(done);
    toggleTask(id, done);
  }
  function toggleHl(id: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const hl = !t.highlight;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, highlight: hl } : x)));
    setHighlight(id, hl);
  }
  // Board: move a card into another status column. Persists status (+done /
  // completed_at sync) for the moved card, then renumbers the destination column.
  async function boardMove(id: string, status: TaskStatus, orderedIds: string[]) {
    setTasks((ts) => ts
      .map((x) => (x.id === id
        ? { ...x, status, done: status === 'done', completed_at: status === 'done' ? (x.completed_at ?? new Date().toISOString()) : null }
        : x))
      .map((x) => { const i = orderedIds.indexOf(x.id); return i >= 0 ? { ...x, sort_order: i } : x; }));
    const r = await setTaskStatus(id, status);
    if ('error' in r) { flash(r.error); return; }
    await setTaskOrder(orderedIds.map((tid, i) => ({ id: tid, sortOrder: i })));
  }
  // Board: reorder within the same column (sort_order only).
  async function boardReorder(orderedIds: string[]) {
    setTasks((ts) => ts.map((x) => { const i = orderedIds.indexOf(x.id); return i >= 0 ? { ...x, sort_order: i } : x; }));
    await setTaskOrder(orderedIds.map((tid, i) => ({ id: tid, sortOrder: i })));
  }
  // Add a task to the active project, optionally into a section. Shared by the
  // top composer (loose) and each section's inline composer.
  async function addProjectTaskLocal(title: string, sectionId: string | null) {
    if (!active) return; const t = title.trim(); if (!t) return;
    const tmp = 'tmp-' + Date.now();
    setTasks((ts) => [...ts, { id: tmp, title: t, done: false, priority: 'low', estimate_minutes: null, elapsed_minutes: 0, scheduled_date: null, highlight: false, completed_at: null, project_id: active.id, parent_task_id: null, created_at: new Date().toISOString(), section_id: sectionId }]);
    const res = await addProjectTask(active.id, t, sectionId);
    if ('id' in res) setTasks((ts) => ts.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else setTasks((ts) => ts.filter((x) => x.id !== tmp));
  }
  async function addTaskRow() {
    const title = draft.trim(); if (!title) return;
    setDraft('');
    await addProjectTaskLocal(title, null);
  }
  // Section mutations (optimistic). Deleting a section keeps its tasks — the FK
  // is `on delete set null`, so removing it from state re-groups them as loose.
  async function renameSectionLocal(id: string, name: string) {
    const trimmed = name.trim(); if (!trimmed) return;
    setSections((ss) => ss.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
    const res = await renameSection(id, trimmed);
    if ('error' in res) flash(res.error);
  }
  async function deleteSectionLocal(id: string) {
    const snapshot = sections;
    setSections((ss) => ss.filter((s) => s.id !== id));
    setTasks((ts) => ts.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)));
    const res = await deleteSection(id);
    if ('error' in res) { setSections(snapshot); flash(res.error); return; }
    flash('Section deleted. Its tasks were kept.');
  }
  function logManual(projectId: string, body: string, type: 'note' | 'status_change') {
    if (!activitySupported) return;
    const tmp = 'tmp-' + Date.now();
    const row: PActivity = { id: tmp, project_id: projectId, type, body, created_at: new Date().toISOString() };
    setActivity((a) => [row, ...a]);
    logProjectActivity(projectId, body, type).then((r) => {
      if ('id' in r) setActivity((a) => a.map((x) => (x.id === tmp ? { ...x, id: r.id } : x)));
      else setActivity((a) => a.filter((x) => x.id !== tmp));
    });
  }
  function saveEdit(patch: { name: string; color: string; status: string; deadline: string | null; deadline_label: string | null }) {
    if (!active) return; const id = active.id; const prevStatus = active.status;
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    updateProject(id, deadlineSupported ? patch : { name: patch.name, color: patch.color, status: patch.status });
    if (patch.status !== prevStatus) {
      logManual(id, `Status → ${statusLabel(patch.status)}`, 'status_change');
      // Completing a project opens the close-out moment: bill open time + a retro.
      if (patch.status === 'completed') setCloseOutOpen(true);
    }
  }
  const logNote = (body: string) => { if (active && body.trim()) logManual(active.id, body.trim(), 'note'); };
  async function addTime(minutes: number, loggedAt: string | null) {
    if (!active || minutes <= 0) return;
    const tmp = 'tmp-' + Date.now();
    const startedAt = (loggedAt ? new Date(loggedAt + 'T12:00:00') : new Date()).toISOString();
    setTimes((ts) => [{ id: tmp, project_id: active.id, task_id: null, minutes, started_at: startedAt, billed: false }, ...ts]);
    const res = await addTimeEntry({ projectId: active.id, minutes, loggedAt });
    if ('id' in res) setTimes((ts) => ts.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else setTimes((ts) => ts.filter((x) => x.id !== tmp));
  }
  async function invoiceUnbilled() {
    if (!active) return;
    const snapshot = times;
    // Optimistic: the project's unbilled logs move to Billed immediately.
    setTimes((ts) => ts.map((t) => (t.project_id === active.id && !t.billed ? { ...t, billed: true } : t)));
    const res = await invoiceUnbilledTime(active.id);
    if ('error' in res) { setTimes(snapshot); flash(res.error); return; }
    flash(`${res.number} drafted from ${res.lineCount} ${res.lineCount === 1 ? 'entry' : 'entries'}`);
    router.push(`/money/${res.id}`);
  }
  const openTask = (id: string) => router.push(`${pathname}?task=${id}`);
  const newTask = () => { setTab('tasks'); setLayout('list'); setTimeout(() => addRef.current?.focus(), 60); };

  // ── Empty: no projects at all ──
  if (!projects.length || !active) {
    return (
      <div className="flex h-full animate-ds-fadein flex-col items-center justify-center">
        <EmptyState
          illustration={<Icon icon={Kanban} size={20} />}
          title="No projects yet"
          description="Create one to group tasks, time, docs, and activity."
          primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setNewOpen(true)}>New project</Button>}
        />
        <NewProjectModal open={newOpen} onOpenChange={setNewOpen} deadlineSupported={deadlineSupported} />
      </div>
    );
  }

  const projTasks = tasks.filter((t) => t.project_id === active.id);
  const open = projTasks.filter((t) => !t.done);
  const doneWeek = projTasks.filter((t) => t.completed_at && t.completed_at >= weekStart).length;
  const projTimes = times.filter((t) => t.project_id === active.id);
  const timeWeek = projTimes.filter((t) => t.started_at >= weekStart).reduce((a, t) => a + (t.minutes ?? 0), 0);
  const today = todayISO();
  const deadlineCands: { date: string; label: string }[] = open.filter((t) => t.scheduled_date && t.scheduled_date >= today).map((t) => ({ date: t.scheduled_date!, label: t.title }));
  if (active.deadline && active.deadline >= today) deadlineCands.push({ date: active.deadline, label: active.deadline_label || 'Project deadline' });
  deadlineCands.sort((a, b) => (a.date < b.date ? -1 : 1));
  const nextDl = deadlineCands[0] ?? null;
  const doneCount = projTasks.length - open.length;
  const pct = projTasks.length ? Math.round((doneCount / projTasks.length) * 100) : 0;
  const projActivity = activity.filter((a) => a.project_id === active.id);
  const events = buildEvents(projTasks, projActivity);
  // Health = a calm, derived narrative signal (§7E). Only surfaces when the
  // project needs attention (overdue work, or gone quiet) — no news is good news.
  const health = projectHealth({ status: active.status, open, today, projActivity, projTasks, updatedAt: active.updated_at, createdAt: active.created_at });

  const detailTabs: TabItem[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'docs', label: 'Docs' },
    { value: 'money', label: 'Money' },
    { value: 'forms', label: 'Forms' },
    { value: 'portal', label: 'Portal' },
  ];

  return (
    <div className="relative flex h-full animate-ds-fadein flex-col md:flex-row">
      {/* Rail — stacks above the detail on mobile (< md), side rail on desktop */}
      <aside className="w-full shrink-0 overflow-y-auto overflow-x-hidden border-b border-line-soft p-3.5 max-h-[42vh] md:h-full md:max-h-none md:w-60 md:border-b-0 md:border-r">
        {/* Quiet section label — the top bar already titles the page "Projects" */}
        <div className="mb-2 flex items-center gap-2 pl-0.5">
          <span className={cn(sectionLabel, 'flex-1')}>Projects</span>
          <IconButton size="xs" variant="ghost" onClick={() => setNewOpen(true)} label="New project" icon={<Icon icon={Plus} size={14} />} />
        </div>
        <div className="flex flex-col gap-0.5">
          {projects.map((p) => (
            <RailRow key={p.id} project={p} open={openCount(p.id)} active={p.id === active.id} onClick={() => setActiveId(p.id)} />
          ))}
        </div>
      </aside>

      {/* Detail */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className={cn('px-[clamp(18px,3vw,40px)] pb-10 pt-8', !full && 'mx-auto max-w-[1200px]')}>
          {/* Header — a Notion page header: a large title, generous space, then
              a properties block. Status lives in the properties, not on the title. */}
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <span aria-hidden className="size-3.5 shrink-0 rounded-[4px]" style={{ background: active.color ?? 'var(--color-ink-500)' }} />
            <h1 className="text-balance text-h1 text-ink-900">{active.name}</h1>
            <span className="flex-1" />
            {/* Only project-wide actions live here. Share / Preview-as-client are
                portal-domain actions and live in the Portal tab (one home per action). */}
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="ghost" icon={<Icon icon={Pencil} size={16} />} onClick={() => setEditOpen(true)}>Edit</Button>
              <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={newTask}>New task</Button>
            </div>
          </div>

          {/* Properties — Notion-style labelled rows under the title, always visible
              across tabs. Quiet gray labels + icons, values in ink. No metric tiles,
              no busy middot strip, no right rail. */}
          <div className="mb-7 flex flex-col gap-px">
            <PropRow icon={Circle} label="Status"><Badge status={STATUS_TONE[active.status] ?? 'neutral'}>{statusLabel(active.status)}</Badge></PropRow>
            {health && <PropRow icon={Activity} label="Health"><Badge status={health.tone}>{health.label}</Badge></PropRow>}
            <PropRow icon={Target} label="Progress">
              <div className="flex items-center gap-3">
                <div className="w-32"><Progress value={pct} size="sm" /></div>
                <span className="tabular-nums text-caption text-ink-500">{doneCount}/{projTasks.length} done</span>
              </div>
            </PropRow>
            {nextDl && <PropRow icon={Calendar} label="Deadline"><span className="text-ink-800">{fmtDate(nextDl.date)}</span>{nextDl.label ? <span className="text-ink-500"> · {nextDl.label}</span> : null}</PropRow>}
            <PropRow icon={User} label="Client">{active.client_id ? 'Linked' : <span className="text-ink-400">Not linked</span>}</PropRow>
            <PropRow icon={Clock} label="Started">{fmtDate(active.created_at)}</PropRow>
            {active.portal_enabled && <PropRow icon={Share2} label="Sharing"><button onClick={() => setTab('portal')} className="focus-ring rounded-xs text-ink-800 transition-colors hover:text-ink-900">Portal on</button></PropRow>}
          </div>

          {/* Tab bar — a single full-width underline row. The tasks view-switcher
              lives inside the Tasks panel, not mixed onto the tab strip. */}
          <div className="mb-6">
            <Tabs items={detailTabs} value={tab} onValueChange={(v) => setTab(v as DetailTab)} aria-label="Project sections" />
          </div>

          {/* Tab body */}
          {tab === 'overview' && <Overview tasks={projTasks} events={events} notes={activity.filter((a) => a.project_id === active.id)} onOpenTask={openTask} onToggle={toggle} canLog={activitySupported} onLog={logNote} />}
          {tab === 'tasks' && (
            <div>
              <div className="mb-3 flex items-center justify-end">
                <SegmentedControl
                  aria-label="Task layout" fit="content" value={layout}
                  onValueChange={(v) => setLayout(v as 'list' | 'board' | 'calendar')}
                  options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }, { value: 'calendar', label: 'Calendar' }]}
                />
              </div>
              <div className={cn(composerShell, 'mb-3')}>
                <Icon icon={Plus} size={14} className="shrink-0 text-ink-500" />
                <input ref={addRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTaskRow(); }} placeholder="Add a task to this project…" autoComplete="off" data-1p-ignore data-lpignore="true" className={composerInput} />
                {draft.trim() && <Button size="sm" variant="secondary" onClick={addTaskRow}>Add</Button>}
              </div>
              {layout === 'list' && (
                <TaskList tasks={projTasks} subByParent={subByParent} onToggle={toggle} onOpen={openTask} onHighlight={toggleHl}
                  sections={sections.filter((s) => s.project_id === active.id)} sectionsSupported={sectionsSupported}
                  onNewSection={async (name) => {
                    const res = await createSection(active.id, name);
                    if ('id' in res) setSections((ss) => [...ss, { id: res.id, project_id: active.id, name, sort_order: ss.length }]);
                  }}
                  onRenameSection={renameSectionLocal}
                  onDeleteSection={deleteSectionLocal}
                  onAddTask={addProjectTaskLocal} />
              )}
              {layout === 'board' && <Board tasks={projTasks} onOpen={openTask} draggable={statusSupported} onMove={boardMove} onReorder={boardReorder} />}
              {layout === 'calendar' && <CalendarView tasks={projTasks} onOpen={openTask} />}
            </div>
          )}
          {tab === 'docs' && (
            <ProjectDocs
              projectId={active.id}
              docs={docs.filter((d) => d.project_id === active.id)}
              portalSupported={portalSupported}
              onChange={(next) => setDocs((prev) => [...next, ...prev.filter((d) => d.project_id !== active.id)])}
              flash={flash}
            />
          )}
          {tab === 'money' && <ProjectTime times={projTimes} onAdd={addTime} onInvoice={invoiceUnbilled} />}
          {tab === 'forms' && <FormsPanel forms={forms.filter((f) => f.projectId === active.id)} projectId={active.id} className="mt-0" />}
          {tab === 'portal' && (
            <PortalTab
              enabled={!!active.portal_enabled}
              requests={requests.filter((r) => r.project_id === active.id)}
              messages={messages}
              taskDone={Object.fromEntries(tasks.map((t) => [t.id, t.done]))}
              approvals={approvals.filter((a) => a.project_id === active.id)}
              docs={docs.filter((d) => d.project_id === active.id)}
              portalSupported={portalSupported}
              onAccepted={openTask}
              onManageShare={() => setShareOpen(true)}
              onPreview={() => setPreviewOpen(true)}
            />
          )}
        </div>
      </div>

      <Toaster />
      <NewProjectModal open={newOpen} onOpenChange={setNewOpen} deadlineSupported={deadlineSupported} />
      {editOpen && <ProjectModal title="Edit project" showStatus showDeadline={deadlineSupported} initial={{ name: active.name, color: active.color ?? COLORS[0], status: active.status, deadline: active.deadline ?? '', deadline_label: active.deadline_label ?? '' }} onClose={() => setEditOpen(false)} onSave={saveEdit} />}
      {closeOutOpen && (
        <CloseOutModal
          projectName={active.name}
          doneCount={doneCount}
          totalTasks={projTasks.length}
          loggedMinutes={projTimes.reduce((a, t) => a + (t.minutes ?? 0), 0)}
          unbilledMinutes={projTimes.filter((t) => !t.billed).reduce((a, t) => a + (t.minutes ?? 0), 0)}
          unbilledCount={projTimes.filter((t) => !t.billed && (t.minutes ?? 0) > 0).length}
          activitySupported={activitySupported}
          onInvoice={() => { setCloseOutOpen(false); invoiceUnbilled(); }}
          onSaveRetro={logNote}
          onClose={() => setCloseOutOpen(false)}
        />
      )}
      {shareOpen && (
        <SharePanel
          project={active}
          tasks={projTasks}
          docs={docs.filter((d) => d.project_id === active.id)}
          taskVisible={taskVisible}
          portalSupported={portalSupported}
          onClose={() => setShareOpen(false)}
          onPatch={patchActive}
          flash={flash}
        />
      )}
      {previewOpen && <PreviewOverlay projectId={active.id} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function RailRow({ project, open, active, onClick }: { project: PProject; open: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={railBtn(active)}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: project.color ?? 'var(--color-ink-500)' }} />
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
      {open > 0 && <span className="text-caption tabular-nums text-ink-500">{open}</span>}
    </button>
  );
}

// Stat tile — DS §4.54 Stat inside the standard bordered raised card.
function StatCard({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className={cn(cardShell, 'px-4 py-3')}>
      <Stat label={label} value={value} />
      {hint && <div className="mt-0.5 truncate text-caption text-ink-500">{hint}</div>}
    </div>
  );
}

// ── Tasks: List ──
function TaskList({ tasks, subByParent, onToggle, onOpen, onHighlight, sections = [], sectionsSupported = false, onNewSection, onRenameSection, onDeleteSection, onAddTask }: {
  tasks: PTask[]; subByParent: Map<string, { done: number; total: number }>;
  onToggle: (id: string) => void; onOpen: (id: string) => void; onHighlight: (id: string) => void;
  sections?: PSection[]; sectionsSupported?: boolean; onNewSection?: (name: string) => void;
  onRenameSection?: (id: string, name: string) => void; onDeleteSection?: (id: string) => void;
  onAddTask?: (title: string, sectionId: string | null) => void;
}) {
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [addingIn, setAddingIn] = useState<string | null>(null); // section id whose composer is open
  const [addDraft, setAddDraft] = useState('');
  if (tasks.length === 0 && sections.length === 0) return <Empty title="No tasks yet" line="Add one above to get this project moving." />;

  // Things-style: loose tasks first, then each named section. Assign a task to a
  // section either from its drawer or by adding it straight into the section here.
  const secIds = new Set(sections.map((s) => s.id));
  const loose = tasks.filter((t) => !t.section_id || !secIds.has(t.section_id));
  const groups: { section: PSection | null; items: PTask[] }[] = [
    ...(loose.length > 0 ? [{ section: null, items: loose }] : []),
    ...sections.map((s) => ({ section: s as PSection | null, items: tasks.filter((t) => t.section_id === s.id) })),
  ];
  const hasSections = sections.length > 0;

  const submitSection = () => {
    const name = sectionName.trim();
    if (name) onNewSection?.(name);
    setSectionName(''); setAddingSection(false);
  };
  const submitRename = () => {
    if (renamingId && renameDraft.trim()) onRenameSection?.(renamingId, renameDraft);
    setRenamingId(null); setRenameDraft('');
  };
  const submitAdd = (sectionId: string) => {
    const title = addDraft.trim();
    if (title) onAddTask?.(title, sectionId);
    setAddDraft(''); // keep the composer open so several tasks can be added in a row
  };

  return (
    <div>
      <div className={cn(cardShell, 'overflow-hidden')}>
        {groups.map((g, gi) => (
          <div key={g.section?.id ?? 'loose'}>
            {g.section && (
              <div className="group/sec flex items-center gap-2 border-t border-line-soft px-3.5 pb-1.5 pt-2.5">
                {renamingId === g.section.id ? (
                  <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); } }}
                    onBlur={submitRename} aria-label="Section name" autoComplete="off" data-1p-ignore data-lpignore="true"
                    className={cn(sectionLabel, 'flex-1 rounded-sm bg-surface-sunken px-1 py-0.5 text-ink-800 outline-none focus-ring')} />
                ) : (
                  <>
                    <span className={cn(sectionLabel, 'text-ink-600')}>{g.section.name}</span>
                    <span className="text-caption tabular-nums text-ink-500">{g.items.length}</span>
                    <span className="flex-1" />
                    {sectionsSupported && (
                      <DropdownMenu>
                        <DropdownMenuTrigger aria-label="Section options"
                          className="focus-ring grid size-6 place-items-center rounded-sm text-ink-500 opacity-0 transition-colors hover:bg-surface-hover hover:text-ink-900 group-hover/sec:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                          <Icon icon={Ellipsis} size={15} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem icon={<Icon icon={Pencil} size={14} />}
                            onSelect={() => { setRenamingId(g.section!.id); setRenameDraft(g.section!.name); }}>Rename</DropdownMenuItem>
                          <DropdownMenuItem danger icon={<Icon icon={Trash} size={14} />}
                            onSelect={() => onDeleteSection?.(g.section!.id)}>Delete section</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </div>
            )}
            {g.items.map((t, i) => {
              const isLastItem = i === g.items.length - 1;
              // Border-free only when the following element already provides a
              // divider: the loose group's last item is followed by a section
              // header (border-t), and the card's terminal item needs no border.
              const nextIsSectionHeader = isLastItem && g.section === null && gi < groups.length - 1;
              const isTerminal = !hasSections && g.section === null && isLastItem;
              return (
                <TaskRow key={t.id} task={t} sub={subByParent.get(t.id)} last={nextIsSectionHeader || isTerminal}
                  onToggle={() => onToggle(t.id)} onOpen={() => onOpen(t.id)} onHighlight={() => onHighlight(t.id)}
                  showHighlightToggle showElapsed />
              );
            })}
            {/* Per-section inline add — the section's terminal row (no border). */}
            {g.section && (
              addingIn === g.section.id ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5">
                  <Icon icon={Plus} size={14} className="shrink-0 text-ink-500" />
                  <input autoFocus value={addDraft} onChange={(e) => setAddDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(g.section!.id); if (e.key === 'Escape') { setAddDraft(''); setAddingIn(null); } }}
                    onBlur={() => { submitAdd(g.section!.id); setAddingIn(null); }}
                    placeholder="Add a task to this section…" autoComplete="off" data-1p-ignore data-lpignore="true"
                    className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
                </div>
              ) : (
                <button onClick={() => { setAddingIn(g.section!.id); setAddDraft(''); }}
                  className="focus-ring flex w-full items-center gap-2 px-3.5 py-1.5 text-left text-caption text-ink-500 transition-colors hover:text-ink-800">
                  <Icon icon={Plus} size={13} /> Add task
                </button>
              )
            )}
          </div>
        ))}
      </div>
      {sectionsSupported && (
        addingSection ? (
          <div className={cn(composerShell, 'mt-2 py-0.5')}>
            <input autoFocus value={sectionName} onChange={(e) => setSectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSection(); if (e.key === 'Escape') { setSectionName(''); setAddingSection(false); } }}
              placeholder="Section name…" autoComplete="off" data-1p-ignore data-lpignore="true"
              className={cn(composerInput, 'py-1.5')} />
            <Button size="sm" variant="secondary" onClick={submitSection}>Add</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-2" icon={<Icon icon={Plus} size={14} />} onClick={() => setAddingSection(true)}>
            New section
          </Button>
        )
      )}
    </div>
  );
}

// ── Tasks: Board (kanban) ──
// Columns To do / In progress / Review / Done. Done is driven by tasks.done
// (authoritative); the other three by tasks.status. Drag a card between columns
// → persist status; drag within a column → persist sort_order. Click → open.
const BOARD_COLS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];
const colOfTask = (t: PTask): TaskStatus => {
  if (t.done) return 'done';
  const s = t.status as TaskStatus | null | undefined;
  return s === 'doing' || s === 'review' ? s : 'todo';
};

const boardColShell = 'min-h-40 rounded-lg border bg-surface-sunken p-2 transition-colors duration-fast';
const boardColHead = 'flex items-center justify-between px-1.5 pb-2 pt-1';
const boardCardShell = 'mb-1.5 rounded-md border border-line-soft bg-surface-raised p-2';

// Card body shared by the static and draggable boards, so they never drift.
function BoardCardBody({ t }: { t: PTask }) {
  return (
    <>
      <div className={cn('text-ui leading-snug', t.done ? 'text-ink-500 line-through' : 'text-ink-800')}>{t.title}</div>
      {(t.estimate_minutes != null || t.priority === 'high' || t.highlight) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {t.estimate_minutes != null && <span className="text-caption tabular-nums text-ink-500">{fmtDur(t.estimate_minutes)}</span>}
          {t.priority === 'high' && <PriorityBadge level="high" variant="bars" />}
          {t.highlight && <Tag color="stone" size="sm" icon={<Icon icon={Star} size={12} />}>Highlight</Tag>}
        </div>
      )}
    </>
  );
}

function Board({ tasks, onOpen, draggable, onMove, onReorder }: {
  tasks: PTask[]; onOpen: (id: string) => void;
  draggable: boolean; onMove: (id: string, status: TaskStatus, orderedIds: string[]) => void; onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragJustEnded = useRef(false);

  const sorted = [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at));
  const byCol: Record<TaskStatus, PTask[]> = { todo: [], doing: [], review: [], done: [] };
  for (const t of sorted) byCol[colOfTask(t)].push(t);
  const colOfId = (id: string) => (Object.keys(byCol) as TaskStatus[]).find((k) => byCol[k].some((t) => t.id === id));

  if (!draggable) {
    return (
      <div>
        <div className="grid grid-cols-4 gap-2.5">
          {BOARD_COLS.map((c) => (
            <div key={c.id} className={cn(boardColShell, 'border-line-soft')}>
              <div className={boardColHead}>
                <span className="text-caption font-medium text-ink-600">{c.label}</span>
                <span className="text-caption tabular-nums text-ink-500">{byCol[c.id].length}</span>
              </div>
              {byCol[c.id].map((t) => (
                <button key={t.id} onClick={() => onOpen(t.id)} className={cn(boardCardShell, 'focus-ring block w-full cursor-pointer text-left')}>
                  <BoardCardBody t={t} />
                </button>
              ))}
              {byCol[c.id].length === 0 && <div className="p-4 text-center text-caption text-ink-400">—</div>}
            </div>
          ))}
        </div>
        <div className="mt-2.5 text-caption text-ink-500">
          Apply migration 0011 to drag cards between columns.
        </div>
      </div>
    );
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    dragJustEnded.current = true;
    setTimeout(() => { dragJustEnded.current = false; }, 0);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const from = colOfId(id);
    if (!from) return;
    const overId = String(over.id);
    const isCol = (Object.keys(byCol) as string[]).includes(overId);
    const to = (isCol ? overId : colOfId(overId)) as TaskStatus | undefined;
    if (!to) return;

    if (from === to) {
      const ids = byCol[to].map((t) => t.id);
      const oldIndex = ids.indexOf(id);
      const newIndex = isCol ? ids.length - 1 : ids.indexOf(overId);
      if (oldIndex === newIndex || newIndex < 0) return;
      onReorder(arrayMove(ids, oldIndex, newIndex));
    } else {
      const destIds = byCol[to].map((t) => t.id);
      const at = isCol ? destIds.length : Math.max(0, destIds.indexOf(overId));
      destIds.splice(at, 0, id);
      onMove(id, to, destIds);
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;
  return (
    <DndContext id="project-board" sensors={sensors} collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid grid-cols-4 gap-2.5">
        {BOARD_COLS.map((c) => (
          <BoardCol key={c.id} id={c.id} label={c.label} items={byCol[c.id]} onOpen={onOpen} dragJustEnded={dragJustEnded} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <div className="pointer-events-none"><BoardCard task={activeTask} onOpen={onOpen} dragJustEnded={dragJustEnded} overlay /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function BoardCol({ id, label, items, onOpen, dragJustEnded }: {
  id: TaskStatus; label: string; items: PTask[]; onOpen: (id: string) => void; dragJustEnded: React.MutableRefObject<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className={cn(boardColShell, isOver ? 'border-ink-400' : 'border-line-soft')}>
      <div className={boardColHead}>
        <span className="text-caption font-medium text-ink-600">{label}</span>
        <span className="text-caption tabular-nums text-ink-500">{items.length}</span>
      </div>
      <div ref={setNodeRef} className={cn('min-h-[120px] rounded-md transition-colors duration-fast', isOver && 'bg-surface-selected')}>
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {items.map((t) => <BoardCard key={t.id} task={t} onOpen={onOpen} dragJustEnded={dragJustEnded} draggable />)}
        </SortableContext>
        {items.length === 0 && <div className="p-4 text-center text-caption text-ink-400">—</div>}
      </div>
    </div>
  );
}

function BoardCard({ task: t, onOpen, dragJustEnded, draggable = false, overlay = false }: {
  task: PTask; onOpen: (id: string) => void; dragJustEnded: React.MutableRefObject<boolean>; draggable?: boolean; overlay?: boolean;
}) {
  const s = useSortable({ id: t.id, disabled: overlay || !draggable });
  // Sanctioned inline style: dnd-kit's computed transform only.
  const style: React.CSSProperties = { transform: CSS.Transform.toString(s.transform), transition: s.transition };
  const handlers = draggable && !overlay ? { ...s.attributes, ...s.listeners } : {};
  return (
    <div ref={overlay ? undefined : s.setNodeRef} style={style} {...handlers}
      className={cn(boardCardShell, draggable ? 'cursor-grab' : 'cursor-pointer', overlay && 'shadow-lift-2', s.isDragging && 'opacity-35')}
      onClick={() => { if (dragJustEnded.current) return; onOpen(t.id); }}>
      <BoardCardBody t={t} />
    </div>
  );
}

// ── Tasks: Calendar (current month, tasks by scheduled_date) ──
function CalendarView({ tasks, onOpen }: { tasks: PTask[]; onOpen: (id: string) => void }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Mon-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayD = now.getDate();
  const byDay = new Map<number, PTask[]>();
  for (const t of tasks) {
    if (!t.scheduled_date) continue;
    const d = new Date(t.scheduled_date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const arr = byDay.get(d.getDate()) ?? []; arr.push(t); byDay.set(d.getDate(), arr);
    }
  }
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const scheduled = tasks.filter((t) => t.scheduled_date).length;
  return (
    <div className={cn(cardShell, 'p-3.5')}>
      <div className="mb-2.5 text-title-4 text-ink-900">{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      {scheduled === 0 && <div className="mb-2.5 text-ui text-ink-500">No tasks have a date yet — set a date on a task to see it here.</div>}
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-1 text-overline text-ink-500">{d.toUpperCase()}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className={cn('min-h-[76px] rounded-sm border p-1', d ? 'border-line-soft' : 'border-transparent', d === todayD && 'bg-surface-selected')}>
            {d && <div className={cn('mb-1 text-caption tabular-nums', d === todayD ? 'font-semibold text-ink-900' : 'text-ink-500')}>{d}</div>}
            {d && (byDay.get(d) ?? []).slice(0, 3).map((t) => (
              <button key={t.id} onClick={() => onOpen(t.id)} title={t.title}
                className={cn('focus-ring mb-1 block w-full truncate rounded-xs border border-line-soft px-1.5 py-0.5 text-left text-caption transition-colors duration-fast',
                  t.done ? 'bg-surface-sunken text-ink-400 line-through' : 'bg-surface-fill text-ink-800 hover:bg-surface-fill-hover')}>
                {t.title}
              </button>
            ))}
            {d && (byDay.get(d)?.length ?? 0) > 3 && <div className="text-caption text-ink-500">+{byDay.get(d)!.length - 3} more</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Property-strip separator — a hairline middot so the header reads as one quiet line.
function PropDot() {
  return <span aria-hidden className="text-ink-300">·</span>;
}

// Detail row for the Overview right rail (Linear-style properties sidebar):
// muted label left, value right, on one line.
// Notion-style property row: a fixed-width gray label with a leading icon, then
// the value in ink. Rows breathe (min-h-8) and carry no borders — the alignment
// and whitespace do the work, the way Notion lists page properties.
function PropRow({ icon, label, children }: { icon: IconType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <span className="flex w-[124px] shrink-0 items-center gap-2 text-ui text-ink-500">
        <Icon icon={icon} size={15} className="shrink-0 text-ink-400" strokeWidth={1.75} />{label}
      </span>
      <div className="min-w-0 flex-1 text-ui text-ink-800">{children}</div>
    </div>
  );
}

// ── Overview — the project's "memory surface" (MASTER_PRODUCT_PLAN §7E), as a
// Notion page: properties live under the title (in the header), so the body is
// pure content — a written status that leads (the sentence is the hill chart, not
// a percent tile), a light task list, and the activity log, separated by
// whitespace and quiet sentence-case headings, never boxed dashboard sections.
function Overview({ tasks, events, notes, onOpenTask, onToggle, canLog, onLog }: {
  tasks: PTask[]; events: Ev[]; notes: PActivity[];
  onOpenTask: (id: string) => void; onToggle: (id: string) => void; canLog: boolean; onLog: (body: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const submit = () => { const t = draft.trim(); if (!t) return; onLog(t); setDraft(''); };
  const open = tasks.filter((t) => !t.done);
  const key = [...open].sort((a, b) => Number(b.highlight) - Number(a.highlight) || (a.scheduled_date ?? '9999') < (b.scheduled_date ?? '9999') ? -1 : 1).slice(0, 5);
  const statusNote = [...notes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).find((n) => n.body && n.body.trim());
  const activityEntries: ActivityEntry[] = events.map((e) => ({ kind: 'action', actor: 'You', verb: e.verb, object: e.title, time: relTime(e.at) }));

  return (
    <div className="max-w-[720px]">
      {/* Update — the written status narrative leads and reads as prose.
          (Named "Update" so it doesn't collide with the Status property above.) */}
      <section>
        <h3 className="mb-2.5 text-h4 text-ink-900">Update</h3>
        {statusNote ? (
          <div className="mb-4">
            <p className="text-pretty text-body-lg leading-relaxed text-ink-800">{statusNote.body}</p>
            <div className="mt-2 text-caption text-ink-500">Updated {relTime(statusNote.created_at)}</div>
          </div>
        ) : !canLog ? (
          <p className="mb-1 text-body-lg leading-relaxed text-ink-400">No update yet.</p>
        ) : null}
        {canLog && (
          <div className={composerShell}>
            <Icon icon={Pencil} size={14} className="shrink-0 text-ink-500" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={statusNote ? 'Post an update…' : 'Write the first status update — where do things stand?'}
              autoComplete="off" data-1p-ignore data-lpignore="true" className={composerInput} />
            {draft.trim() && <Button size="sm" variant="secondary" onClick={submit}>Post</Button>}
          </div>
        )}
      </section>

      {/* Key tasks — a light hoverable list, no dividers (Notion). */}
      <section className="mt-10">
        <div className="mb-1.5 flex items-baseline gap-2">
          <h3 className="text-h4 text-ink-900">Key tasks</h3>
          <span className="text-caption tabular-nums text-ink-500">{open.length}</span>
        </div>
        {key.length === 0
          ? <div className="text-ui text-ink-500">Nothing open — all clear.</div>
          : <div className="flex flex-col">
              {key.map((t) => (
                <div key={t.id} className="group -mx-2 flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors hover:bg-surface-hover">
                  <Checkbox size="sm" checked={false} onCheckedChange={() => onToggle(t.id)} aria-label={`Complete ${t.title}`} className="shrink-0" />
                  <button onClick={() => onOpenTask(t.id)} className="focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui text-ink-800">{t.title}</button>
                  {t.highlight && <Icon icon={Star} size={14} weight="fill" className="shrink-0 text-ink-600" />}
                </div>
              ))}
            </div>}
      </section>

      {/* Activity */}
      <section className="mt-10">
        <h3 className="mb-3 text-h4 text-ink-900">Activity</h3>
        {events.length === 0
          ? <div className="text-ui text-ink-500">No activity yet.</div>
          : <DSActivityFeed entries={activityEntries} />}
      </section>
    </div>
  );
}

// ── Portal tab — share status + client requests (MASTER_PRODUCT_PLAN §7L) ──
function PortalTab({ enabled, requests, messages, taskDone, approvals, docs, portalSupported, onAccepted, onManageShare, onPreview }: {
  enabled: boolean; requests: PRequest[]; messages: PRequestMessage[]; taskDone: Record<string, boolean>;
  approvals: PApproval[]; docs: PDoc[]; portalSupported: boolean;
  onAccepted?: (taskId: string) => void; onManageShare: () => void; onPreview: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* The single home for portal actions — explains the portal, then acts.
          Secondary/ghost only: the header's "New task" stays the one accent. */}
      <div className={cn(cardShell, 'p-5')}>
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', enabled ? 'bg-success-500' : 'bg-ink-400')} />
          <h2 className="text-body-lg font-medium text-ink-900">{enabled ? 'Portal is live' : 'Client portal'}</h2>
        </div>
        <p className="mt-1.5 max-w-prose text-pretty text-ui text-ink-500">
          {enabled
            ? 'Your client follows this project through a private link — progress, shared docs, and a place to send requests. Manage what they see, or preview it as they would.'
            : 'Share a curated, read-only view of this project — progress, deliverables, and a request inbox — through a private link. No account needed on their side.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Icon icon={Share2} size={16} />} onClick={onManageShare}>{enabled ? 'Manage sharing' : 'Turn on sharing'}</Button>
          <Button size="sm" variant="ghost" icon={<Icon icon={Eye} size={16} />} onClick={onPreview}>Preview as client</Button>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <span className={cn(sectionLabel, 'text-ink-600')}>Client requests</span>
          {requests.length > 0 && <span className="text-caption tabular-nums text-ink-500">{requests.length}</span>}
        </div>
        <RequestsTab requests={requests} messages={messages} taskDone={taskDone} portalSupported={portalSupported} onAccepted={onAccepted} />
      </div>

      <ApprovalsSection approvals={approvals} docs={docs} />
    </div>
  );
}

const APPROVAL_TONE: Record<PApproval['status'], BadgeStatus> = { awaiting: 'warning', approved: 'success', changes_requested: 'danger' };
const APPROVAL_LABEL: Record<PApproval['status'], string> = { awaiting: 'Awaiting client', approved: 'Approved', changes_requested: 'Changes requested' };

// Owner-side deliverable approvals: request sign-off on a doc, watch it come back
// Approved or with a change note. The trigger picks from this project's documents.
function ApprovalsSection({ approvals: initial, docs }: { approvals: PApproval[]; docs: PDoc[] }) {
  const [approvals, setApprovals] = useState(initial);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setApprovals(initial); }, [initial]);

  const openPageIds = new Set(approvals.filter((a) => a.status === 'awaiting').map((a) => a.page_id));

  async function request(d: PDoc) {
    setBusy(d.id);
    const res = await requestApproval(d.id);
    setBusy(null);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setPick(false);
    // Optimistic: show an awaiting card immediately (reconciles from realtime/refresh).
    if (!openPageIds.has(d.id)) {
      setApprovals((a) => [{ id: `tmp-${Date.now()}`, project_id: '', page_id: d.id, title: d.title, status: 'awaiting', note: null, created_at: new Date().toISOString() }, ...a]);
    }
    toast({ message: 'Approval requested', variant: 'success' });
  }

  async function cancel(id: string) {
    setBusy(id);
    const res = await cancelApproval(id);
    setBusy(null);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setApprovals((a) => a.filter((x) => x.id !== id));
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cn(sectionLabel, 'text-ink-600')}>Deliverable approvals</span>
        {approvals.length > 0 && <span className="text-caption tabular-nums text-ink-500">{approvals.length}</span>}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={14} />} onClick={() => setPick(true)} disabled={docs.length === 0}>Request approval</Button>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong">
          <EmptyState size="inline" illustration={<Icon icon={Circle} size={20} />} title="No approvals yet"
            description={docs.length === 0 ? 'Add a document to this project, then send it to the client for sign-off.' : 'Send a document to the client for sign-off — you’ll see their decision here.'} />
        </div>
      ) : (
        <div className="grid gap-2.5">
          {approvals.map((a) => (
            <div key={a.id} className={cn('rounded-lg border bg-surface-raised px-4 py-3.5', a.status === 'awaiting' ? 'border-line-strong' : 'border-line-soft')}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{a.title?.trim() || 'Deliverable'}</span>
                <Badge status={APPROVAL_TONE[a.status]}>{APPROVAL_LABEL[a.status]}</Badge>
              </div>
              {a.status === 'changes_requested' && a.note && (
                <div className="mt-2 rounded-md border border-line-soft bg-surface-sunken px-3 py-2">
                  <span className="text-overline uppercase text-ink-500">Client asked for</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-ui text-ink-700">{a.note}</p>
                </div>
              )}
              {a.status !== 'approved' && (
                <div className="mt-2.5 flex gap-2">
                  {a.status === 'changes_requested' && (
                    <Button size="sm" variant="secondary" loading={busy === a.page_id} onClick={() => request({ id: a.page_id } as PDoc)}>Request approval again</Button>
                  )}
                  <Button size="sm" variant="ghost" loading={busy === a.id} onClick={() => cancel(a.id)}>{a.status === 'awaiting' ? 'Withdraw' : 'Dismiss'}</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={pick} onOpenChange={setPick} size="sm" title="Request approval">
        <p className="mb-3 text-ui text-ink-500">Pick a document to send to the client for sign-off. It becomes visible in their portal.</p>
        {docs.length === 0 ? (
          <p className="text-ui text-ink-500">This project has no documents yet.</p>
        ) : (
          <div className="grid gap-1">
            {docs.map((d) => (
              <button key={d.id} disabled={busy === d.id || openPageIds.has(d.id)}
                onClick={() => request(d)}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-ui text-ink-800 transition-colors hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1 truncate">{d.title?.trim() || 'Untitled'}</span>
                {openPageIds.has(d.id) && <span className="text-caption text-ink-500">Awaiting</span>}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProjectTime({ times, onAdd, onInvoice }: { times: PTime[]; onAdd: (minutes: number, loggedAt: string | null) => void; onInvoice?: () => void }) {
  const [mins, setMins] = useState('');
  const [date, setDate] = useState('');
  const total = times.reduce((a, t) => a + (t.minutes ?? 0), 0);
  const billed = times.filter((t) => t.billed).reduce((a, t) => a + (t.minutes ?? 0), 0);
  const unbilled = total - billed;
  const unbilledCount = times.filter((t) => !t.billed && (t.minutes ?? 0) > 0).length;
  const submit = () => { const m = Math.round(parseFloat(mins) || 0); if (m <= 0) return; onAdd(m, date || null); setMins(''); setDate(''); };
  return (
    <div>
      <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
        <StatCard label="Total logged" value={fmtDur(total)} />
        <StatCard label="Unbilled" value={fmtDur(unbilled)} hint="not yet invoiced" />
        <StatCard label="Billed" value={fmtDur(billed)} hint="on an invoice" />
      </div>
      {onInvoice && unbilledCount > 0 && (
        <div className={cn(cardShell, 'mb-3 flex items-center gap-2.5 px-3.5 py-2.5')}>
          <Icon icon={Landmark} size={16} className="shrink-0 text-ink-500" />
          <span className="min-w-0 flex-1 text-ui text-ink-800">
            {fmtDur(unbilled)} unbilled across {unbilledCount} {unbilledCount === 1 ? 'entry' : 'entries'}.
          </span>
          <Button size="sm" variant="secondary" onClick={onInvoice}>Create invoice</Button>
        </div>
      )}
      <div className={cn(composerShell, 'mb-3 flex-wrap')}>
        <Icon icon={Timer} size={14} className="shrink-0 text-ink-500" />
        <input value={mins} onChange={(e) => setMins(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Minutes" inputMode="numeric" autoComplete="off" data-1p-ignore data-lpignore="true" className={cn(composerInput, 'w-24 flex-none')} />
        <DatePicker value={date ? new Date(date + 'T00:00:00') : null} onValueChange={(d) => setDate(d ? dateToISO(d) : '')} placeholder="When (optional)" className="w-44" />
        <span className="flex-1" />
        {parseFloat(mins) > 0 && <Button size="sm" variant="secondary" onClick={submit}>Log time</Button>}
      </div>
      {times.length === 0 ? <Empty title="No time logged yet" line="Add minutes above — it'll show up in Finance › Unbilled." /> : (
        <div className={cn(cardShell, 'overflow-hidden')}>
          {times.map((t, i) => (
            <div key={t.id} className={cn('flex items-center gap-2.5 px-3.5 py-3 text-ui', i > 0 && 'border-t border-line-soft')}>
              <span className="w-[70px] shrink-0 text-caption tabular-nums text-ink-500">{new Date(t.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              <span className="flex-1 tabular-nums text-ink-800">{fmtDur(t.minutes ?? 0)}</span>
              <Badge status={t.billed ? 'success' : 'neutral'}>{t.billed ? 'Billed' : 'Unbilled'}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ title, line }: { title: string; line?: string }) {
  return (
    <div className={cardShell}>
      <EmptyState size="inline" title={title} description={line} />
    </div>
  );
}

// ── Project create / edit modal (DS §4.36 Modal + §4.13 Field/TextInput) ──
function ProjectModal({ title, initial, showStatus, showDeadline, onClose, onSave }: {
  title: string; initial?: { name: string; color: string; status: string; deadline: string; deadline_label: string }; showStatus?: boolean; showDeadline?: boolean;
  onClose: () => void; onSave: (v: { name: string; color: string; status: string; deadline: string | null; deadline_label: string | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [status, setStatus] = useState(initial?.status === 'done' ? 'completed' : initial?.status ?? 'active');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [deadlineLabel, setDeadlineLabel] = useState(initial?.deadline_label ?? '');
  const submit = () => { if (!name.trim()) return; onSave({ name: name.trim(), color, status, deadline: deadline || null, deadline_label: deadlineLabel || null }); onClose(); };
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={submit}>{title === 'New project' ? 'Create' : 'Save'}</Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. Acme rebrand" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Color">
          <div className="flex gap-2" role="radiogroup" aria-label="Project color">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} onClick={() => setColor(c)}
                className={cn('focus-ring size-6 rounded-full border-2 transition-colors duration-fast', color === c ? 'border-ink-900' : 'border-transparent')}
                style={{ background: c }} />
            ))}
          </div>
        </Field>
        {showStatus && (
          <Field label="Status">
            <SegmentedControl aria-label="Status" value={status} onValueChange={setStatus}
              options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} />
          </Field>
        )}
        {showDeadline && (
          <Field label="Deadline">
            <div className="flex gap-2">
              <DatePicker value={deadline ? new Date(deadline + 'T00:00:00') : null} onValueChange={(d) => setDeadline(d ? dateToISO(d) : '')} placeholder="Date" className="w-40 shrink-0" />
              <TextInput value={deadlineLabel} onChange={(e) => setDeadlineLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="Label (e.g. Launch)" autoComplete="off" data-1p-ignore data-lpignore="true" />
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}

// ── Close-out moment (§7E) ──
// Marking a project Completed opens this: it surfaces any unbilled time with a
// one-tap invoice, and takes a short retro straight into the project's Activity.
// Nothing here is required — "Skip" (or Escape) closes without writing.
function CloseOutModal({ projectName, doneCount, totalTasks, loggedMinutes, unbilledMinutes, unbilledCount, activitySupported, onInvoice, onSaveRetro, onClose }: {
  projectName: string; doneCount: number; totalTasks: number; loggedMinutes: number;
  unbilledMinutes: number; unbilledCount: number; activitySupported: boolean;
  onInvoice: () => void; onSaveRetro: (note: string) => void; onClose: () => void;
}) {
  const [retro, setRetro] = useState('');
  const saveRetro = () => { const n = retro.trim(); if (n) onSaveRetro(n); };
  const finish = () => { saveRetro(); onClose(); };
  const invoice = () => { saveRetro(); onInvoice(); }; // saves the retro, then navigates to the draft
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title={`Wrap up ${projectName}`}
      description="Nice work. Bill any open time and jot a line for future you before it goes quiet."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Skip</Button>
          <Button variant="primary" onClick={finish}>Finish</Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <div className="text-caption tabular-nums text-ink-500">
          {doneCount}/{totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} done · {fmtDur(loggedMinutes)} logged
        </div>
        {unbilledMinutes > 0 ? (
          <div className={cn(cardShell, 'flex items-center gap-3 px-3.5 py-3')}>
            <div className="min-w-0 flex-1">
              <div className="text-ui text-ink-800"><span className="tabular-nums">{fmtDur(unbilledMinutes)}</span> unbilled</div>
              <div className="text-caption text-ink-500">across {unbilledCount} {unbilledCount === 1 ? 'entry' : 'entries'} — invoice it before you close.</div>
            </div>
            <Button size="sm" variant="secondary" icon={<Icon icon={Landmark} size={14} />} onClick={invoice}>Create invoice</Button>
          </div>
        ) : (
          <div className="text-caption text-ink-500">All logged time is invoiced.</div>
        )}
        {activitySupported && (
          <Field label="Retro">
            <Textarea value={retro} onChange={(e) => setRetro(e.target.value)} rows={3} autoFocus
              placeholder="What went well? What would you do differently next time? (saved to Activity)" />
          </Field>
        )}
      </div>
    </Modal>
  );
}

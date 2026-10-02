'use client';
// Projects hub — v3 two-pane: project rail (color dot · name · OPEN count) +
// selected-project detail (header · 4 real stat cards · 5-tab bar). Tabs follow
// MASTER_PRODUCT_PLAN §7E: Overview (progress · key tasks · activity log) ·
// Tasks (List/Board/Calendar) · Docs · Money (time → invoice) · Portal (share ·
// client requests). Optimistic writes via existing task/project actions.
//
// Built entirely from the design system: §4.30 Tabs (detail tabs), §4.19
// SegmentedControl (List/Board/Calendar), §4.54 Stat, §4.7 Badge, §4.36 Modal,
// §4.41 toast/§4.43 Progress, §4.45 EmptyState, §4.16 Checkbox, Panel
// cards. The only inline `style={}` left is sanctioned: user project colour and
// computed geometry (timeline bar left/width, dnd transforms).
import { useMemo, useRef, useState } from 'react';
import { todayISO, formatDay, formatAgo, formatMinutes, formatMonthYear, formatRelativeDay } from '@/lib/date';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Pencil, Share2, Eye, Kanban, Timer, Landmark, Circle, Target, Calendar, User, Clock, FileText, Trash, Activity, Sparkles, Highlight } from "@/components/ds/icons";
import {
  Icon, Button, IconButton, Badge, Stat, Tabs, SegmentedControl, Checkbox,
  EmptyState, ActivityFeed as DSActivityFeed, Modal, Field, TextInput, Textarea, DatePicker,
  toast, useConfirm, type BadgeStatus, type ActivityEntry, type TabItem,
  EmptyLine, RecordHeader, Progress, CARD_CLASS, inlineEditProps } from '@/components/ds/ui';
import { recordHref } from '@/lib/connected';
import { RecordIcon } from '@/components/ui/record-icon';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { HubLayout } from '@/components/ui/hub-layout';
import { SectionHeading } from '@/components/ui/section-heading';
import { TaskRow } from '@/components/tasks/task-row';
import { CompletedSection } from '@/components/tasks/completed-section';
import { useSettling, splitSettled } from '@/lib/use-settling';
import { SharePanel } from '@/components/projects/share-panel';
import { PreviewOverlay } from '@/components/projects/preview-overlay';
import { RequestsTab } from '@/components/projects/requests-tab';
import { SCOPE_COLORS } from '@/lib/task-scopes';
import { scopeFill } from '@/lib/entity-color';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';
import { ProjectDocs } from '@/components/projects/project-docs';
import { ShareToggle } from '@/components/sharing/share-toggle';
import { applyShare } from '@/components/sharing/apply-share';
import { readChannels, type ShareChannels } from '@/lib/visibility';
// THE one projection for Project → Workstream → Task. It had exactly one
// caller — the client PORTAL — while this file, the owner's own screen,
// re-derived grouping inline and showed no stream progress at all. Every
// rollup rule that file so carefully justifies was running for the client
// and not for the person doing the work.
import { groupByStream, progressOf, NO_STREAM, type Workstream } from '@/lib/workstreams';
import { nextDeadline, deadlineCandidates } from '@/lib/project-deadline';
import { setTaskClientVisible, setStreamClientVisible, setStreamTasksClientVisible, setUpdateClientVisible, deleteUpdate } from '@/lib/actions/portal';
import { allUpdates, isAddressedToClient, typeFor, CLIENT_UPDATE } from '@/lib/updates';
import { toggleTask, setHighlight, setTaskOrder } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import { addProjectTask, updateProject, logProjectActivity } from '@/lib/actions/projects';
import { addProjectMilestone, setMilestoneDate, deleteMilestone } from '@/lib/actions/milestones';
// `toggleMilestone` is shared with Horizon and lives in the goals actions; a
// 'use server' file cannot re-export, so it is imported from its home.
import { toggleMilestone } from '@/lib/actions/goals';
import { ProjectMilestones } from '@/components/projects/project-milestones';
import { ProjectWorkstreams } from '@/components/projects/project-workstreams';
import { WorkstreamFacts, WorkstreamDate, WorkstreamMenu, WorkstreamRename } from '@/components/projects/workstream-controls';
import { ProjectBoard } from '@/components/projects/project-board';
import { type Milestone } from '@/lib/milestones';
import { NewProjectModal } from '@/components/projects/new-project-modal';
import { createSection, renameSection, deleteSection, setSectionOrder, setSectionDate, setSectionStatus, setTaskSection } from '@/lib/actions/labels';
import { addTimeEntry, invoiceUnbilledTime } from '@/lib/actions/money';
import { requestApproval, cancelApproval } from '@/lib/actions/portal';
import { FormsPanel } from '@/components/forms/forms-panel';
import { useServerState } from '@/lib/use-server-state';
import { cn } from '@/lib/cn';
import type { RequestDecision } from '@/lib/request-status';
import { tempId } from '@/lib/temp-id';
import { useChanged } from "@/lib/use-changed";
import { useModeParam } from '@/lib/hub-url';
import { useListCursor, useListKeys } from '@/lib/list-keys';
import { PROJECT_CONTENT_PRESETS } from '@/lib/content';
import { createContentFromProject } from '@/lib/actions/content';
import { PropertyBlock, type RecordProperty } from '@/components/records/property-block';
import { EMPTY_LAYOUT, type PropLayout } from '@/lib/property-layout';
import { setPropertyLayout } from '@/lib/actions/property-layout';
import { taskOpenHref } from '@/lib/task-address';

export type PProject = {
  /** A page-icon value — emoji, `ph:Name`, or an image URL. 0042. */
  icon?: string | null;
  id: string; name: string; color: string | null; status: string; client_id: string | null; created_at: string; updated_at: string;
  deadline?: string | null; deadline_label?: string | null;
  portal_enabled?: boolean; portal_token?: string | null;
  share_progress?: boolean; share_completed_tasks?: boolean; share_open_tasks?: boolean;
  share_timeline?: boolean; share_files?: boolean; share_invoices?: boolean; allow_requests?: boolean; portal_intro?: string | null;
};
export type PTask = { id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high'; estimate_minutes: number | null; elapsed_minutes: number; scheduled_date: string | null; due_date?: string | null; highlight: boolean; completed_at: string | null; project_id: string | null; parent_task_id: string | null; created_at: string; sort_order?: number; section_id?: string | null };
/**
 * A workstream — `sections` (0014) plus 0040's columns. Kept named `PSection`
 * because that is still the table; the WORD the user reads is "workstream",
 * which is the client-facing name (see lib/workstreams.ts).
 */
export type PSection = { id: string; project_id: string; name: string; sort_order: number; client_visible?: boolean; status?: string | null; due_date?: string | null };
/** A project's dated checkpoint (§7E, migration 0036). See lib/milestones.ts. */
export type PMilestone = { id: string; project_id: string; title: string; done: boolean; due_date: string | null; sort_order: number };
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

// Five sections, per the plan's §7E cap. Forms used to be a sixth: it is folded
// into Docs, because a form IS a document you send someone — both tabs answered
// "what has this project produced that people read or fill in?", and splitting
// that across two tabs meant checking two places to answer one question. Money
// (time → invoice) and Portal (what the client sees) stay separate because they
// answer genuinely different ones.
export const DETAIL_TABS = ['overview', 'tasks', 'docs', 'files', 'money', 'portal'] as const;
/** Forms folded into Docs (§7E) — an old `?tab=forms` link still lands well.
 *  Lives beside the tabs it renames, not in the route, so every entry point
 *  into this hub resolves it the same way. */
export const MOVED_TABS = { forms: 'docs' } as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
// The one scope palette — see lib/task-scopes.ts. It was declared identically
// here and in new-project-modal.tsx; lists would have made a third copy.
const COLORS: readonly string[] = SCOPE_COLORS;
const STATUSES = ['active', 'paused', 'completed', 'archived'];
// §5 colour-as-meaning: paused → warning, completed → success; the rest neutral.
const STATUS_TONE: Record<string, BadgeStatus> = { active: 'neutral', paused: 'warning', completed: 'success', done: 'success', archived: 'neutral' };
const statusLabel = (s: string) => (s === 'done' ? 'Completed' : s.charAt(0).toUpperCase() + s.slice(1));

// (The private `dateToISO` that lived here is gone: <DatePicker> speaks ISO
// dates directly now, so nothing converts. It was one of FOUR copies of the
// same Date→YYYY-MM-DD helper in the codebase.)
const fmtDate = (iso: string) => formatDay(iso) ?? '';
const relTime = (iso?: string | null) => (iso ? formatAgo(iso, { precise: true }) ?? '' : 'no activity');

type Ev = { at: string; verb: string; title: string };
// Merge derived task events (created/completed) with manual project_activity rows.
function buildEvents(tasks: PTask[], activity: PActivity[]): Ev[] {
  const out: Ev[] = [];
  for (const t of tasks) {
    out.push({ at: t.created_at, verb: 'created', title: t.title });
    if (t.completed_at) out.push({ at: t.completed_at, verb: 'completed', title: t.title });
  }
  for (const a of activity) {
    // A client update is the same row as a note, so the log has to name the
    // difference — otherwise the activity feed prints the raw column value
    // ("client_update") and the one thing worth knowing about that entry, that
    // it went to the client, is the thing it fails to say.
    const verb = a.type === 'status_change' ? 'changed status'
      : a.type === 'note' ? 'noted'
      : a.type === CLIENT_UPDATE ? 'told the client'
      : a.type;
    out.push({ at: a.created_at, verb, title: a.body ?? '' });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

// One transient confirmation channel (§4.41) — replaces the per-page zen Toast.
const flash = (m: string) => { toast({ message: m, variant: 'info' }); };

// ── Shared class recipes (same row/composer language as tasks-view) ──
const railBtn = (on: boolean) => cn(
  'focus-ring flex h-[var(--row-nav)] w-full items-center gap-2 rounded-sm px-2 text-left text-ui transition-colors duration-fast',
  on ? 'bg-surface-selected font-medium text-ink-900' : 'font-normal text-ink-600 hover:bg-surface-hover hover:text-ink-800',
);
// The one composer shell (ds-theme.css `@utility composer-shell`) — it also
// carries the :focus-within ring these three copies each lacked.
const composerShell = 'composer-shell';
const composerInput = 'min-w-0 flex-1 border-0 bg-transparent py-2 text-ui text-ink-900 outline-none placeholder:text-ink-500';
const cardShell = CARD_CLASS;
// The section-label ROLE (CLAUDE.md), not a private 11px copy of it: seven files spelled their own.
const sectionLabel = 'text-overline text-ink-500';

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
const NO_CLIENT_NAMES: Record<string, string> = {};
// Module-level so an absent prop keeps the same identity across renders and the
// reconciling effect above does not fire on every one.
const NO_MILESTONES: PMilestone[] = [];
const NO_FORMS: PForm[] = [];

export function ProjectsWorkspace({ projects: initProjects, tasks: initTasks, times: initTimes, activity: initActivity = NO_ACTIVITY, requests = NO_REQUESTS, messages = NO_MESSAGES, approvals = NO_APPROVALS, docs: initDocs = NO_DOCS, forms = NO_FORMS, taskVisible = NO_TV, initialProjectId, sections: initSections = NO_SECTIONS, clientNames = NO_CLIENT_NAMES, milestones: initMilestones = NO_MILESTONES, milestonesSupported = false, deadlineSupported = false, activitySupported = false, portalSupported = false, sectionsSupported = false, iconSupported = false, propertyLayout = EMPTY_LAYOUT }: {
  projects: PProject[]; tasks: PTask[]; times: PTime[]; activity?: PActivity[]; requests?: PRequest[]; messages?: PRequestMessage[]; approvals?: PApproval[]; docs?: PDoc[]; forms?: PForm[]; taskVisible?: Record<string, boolean>; initialProjectId?: string; sections?: PSection[]; clientNames?: Record<string, string>; milestones?: PMilestone[]; milestonesSupported?: boolean; deadlineSupported?: boolean; activitySupported?: boolean; portalSupported?: boolean; sectionsSupported?: boolean;
  /** 0042 added `projects.icon`. Without it the tile renders but cannot be changed. */
  iconSupported?: boolean;
  /** How this person arranged the header's properties (lib/property-layout.ts).
   *  A per-user preference out of `profiles.preferences`, not project data. */
  propertyLayout?: PropLayout;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useServerState(initProjects);
  const [tasks, setTasks] = useServerState(initTasks);
  const [times, setTimes] = useServerState(initTimes);
  const [activity, setActivity] = useServerState(initActivity);
  const [milestones, setMilestones] = useState(initMilestones);
  // Prop reconciliation via React's documented adjust-state-during-render
  // pattern, NOT the `useEffect(() => setX(initX), [initX])` its five
  // neighbours use. Same behaviour in one render instead of two; those five
  // predate this sprint and are recorded rather than changed here, since they
  // reconcile data this sprint does not touch.
  const [lastMilestones, setLastMilestones] = useState(initMilestones);
  if (lastMilestones !== initMilestones) { setLastMilestones(initMilestones); setMilestones(initMilestones); }
  const [docs, setDocs] = useServerState(initDocs);
  const [sections, setSections] = useState(initSections);
  // Per-task client visibility, held here rather than only inside the share
  // drawer, because the drawer is no longer the only place it can be changed.
  const [taskVis, setTaskVis] = useServerState(taskVisible);
  const [confirm, confirmUI] = useConfirm();

  const [activeId, setActiveId] = useState<string | undefined>(initialProjectId ?? initProjects[0]?.id);
  if (useChanged(initialProjectId) && initialProjectId) setActiveId(initialProjectId);
  // The effective project, derived rather than synced. An effect used to write
  // `activeId` back whenever it fell out of the list (a project deleted, the
  // list refetched); deriving means it can never be stale in the first place.
  const activeKey = projects.find((p) => p.id === activeId)?.id ?? projects[0]?.id;

  // The tab is a MODE (lib/hub-url.ts): read from the URL *and written back to
  // it*. It used to be `useState` seeded from `initialTab`, which meant a
  // notification could deep-link to `?tab=portal` but you could not — clicking
  // Portal yourself changed nothing in the URL, so the tab was not linkable and
  // Back skipped straight out of the project. Reading and writing the same
  // place also retires the `useChanged(initialTab)` reconcile: there is one
  // copy of this fact now, so there is nothing to keep in step.
  const [tab, setTab] = useModeParam('tab', 'overview', DETAIL_TABS, MOVED_TABS);
  const [layout, setLayout] = useState<'list' | 'board' | 'calendar'>('list');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [closeOutOpen, setCloseOutOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  // patch the active project's portal settings locally (so header/preview reflect immediately)
  const patchActive = (patch: Partial<PProject>) => setProjects((ps) => ps.map((p) => (p.id === activeKey ? { ...p, ...patch } : p)));
  const [iconOpen, setIconOpen] = useState(false);
  /**
   * Choose (or clear) the project's icon.
   *
   * Optimistic and silent, like every other small edit here — the tile
   * changing IS the confirmation, and a toast for picking an emoji would be
   * the kind of noise this module has spent the week removing. Rolls back on
   * failure so the mark never claims a choice the database did not take.
   */
  async function setIcon(next: string | null) {
    const prev = projects.find((p) => p.id === activeKey)?.icon ?? null;
    if (prev === next) { setIconOpen(false); return; }
    patchActive({ icon: next });
    setIconOpen(false);
    const res = await updateProject(activeKey, { icon: next });
    if ('error' in res) { patchActive({ icon: prev }); flash(res.error); }
  }

  const subByParent = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const t of tasks) if (t.parent_task_id) { const e = m.get(t.parent_task_id) ?? { done: 0, total: 0 }; e.total++; if (t.done) e.done++; m.set(t.parent_task_id, e); }
    return m;
  }, [tasks]);
  // Same scope as `projTasks` below — a rail badge reading 14 above a list of
  // 6 is the kind of disagreement nobody reports and everybody distrusts.
  const openCount = (pid: string) => tasks.filter((t) => t.project_id === pid && !t.parent_task_id && !t.done).length;

  // ── Milestones (§7E) ── optimistic, because a checkpoint list is edited in
  // bursts — add three, date two — and a round trip between each one turns a
  // 20-second job into a minute of waiting.
  const addMile = async (title: string, dueDate: string | null) => {
    if (!active) return;
    const tmp = tempId();
    setMilestones((ms) => [...ms, { id: tmp, project_id: active.id, title, done: false, due_date: dueDate, sort_order: ms.length }]);
    const res = await addProjectMilestone(active.id, title, dueDate);
    if ('id' in res) setMilestones((ms) => ms.map((m) => (m.id === tmp ? { ...m, id: res.id } : m)));
    else { setMilestones((ms) => ms.filter((m) => m.id !== tmp)); toast({ message: res.error, variant: 'error' }); }
  };
  const toggleMile = async (id: string, done: boolean) => {
    setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, done } : m)));
    const res = await toggleMilestone(id, done);
    if ('error' in res) { setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, done: !done } : m))); toast({ message: res.error, variant: 'error' }); }
  };
  const dateMile = async (id: string, dueDate: string | null) => {
    const prev = milestones.find((m) => m.id === id)?.due_date ?? null;
    setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, due_date: dueDate } : m)));
    const res = await setMilestoneDate(id, dueDate);
    if ('error' in res) { setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, due_date: prev } : m))); toast({ message: res.error, variant: 'error' }); }
  };
  const removeMile = async (id: string) => {
    const prev = milestones;
    setMilestones((ms) => ms.filter((m) => m.id !== id));
    const res = await deleteMilestone(id);
    if ('error' in res) { setMilestones(prev); toast({ message: res.error, variant: 'error' }); }
  };

  const active = projects.find((p) => p.id === activeKey) ?? projects[0];

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
  /**
   * A card landed on the Board: its workstream, and its column's new order.
   *
   * The ARRAY is re-sorted, not just the numbers changed. The List and the
   * Board both draw `tasks` in array order — the loader's `sort_order, then
   * created_at` — so renumbering without re-sorting left the List showing the
   * old order until the next full load. Sorting by the loader's own key makes
   * this render agree with what a reload would show.
   *
   * The workstream is the write that matters and it rolls back on failure. The
   * order is cosmetic, so a failed renumber keeps the move and says so.
   */
  async function boardDrop(taskId: string, sectionId: string | null, orderedIds: string[]) {
    const refiled = (tasks.find((t) => t.id === taskId)?.section_id ?? null) !== sectionId;
    const pos = new Map(orderedIds.map((id, i) => [id, i]));
    // What these rows were, so a failure puts back THEM and nothing else — a
    // whole-array snapshot would also undo anything done in the meantime.
    const before = new Map(tasks.filter((t) => pos.has(t.id)).map((t) => [t.id, { sort_order: t.sort_order, section_id: t.section_id ?? null }]));
    const byLoaderOrder = (a: PTask, b: PTask) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at);
    setTasks((ts) => ts
      .map((t) => (pos.has(t.id)
        ? { ...t, sort_order: pos.get(t.id)!, ...(t.id === taskId ? { section_id: sectionId } : {}) }
        : t))
      .sort(byLoaderOrder));
    if (refiled) {
      // `applyShare` reverts on a THROWN failure too — an expired session
      // makes `requireSession` throw, and a bare await would leave the card
      // in a column the database never heard about.
      const ok = await applyShare(
        () => setTaskSection(taskId, sectionId),
        () => setTasks((ts) => ts.map((t) => (before.has(t.id) ? { ...t, ...before.get(t.id)! } : t)).sort(byLoaderOrder)),
        flash,
      );
      if (!ok) return;
    }
    await applyShare(() => setTaskOrder(orderedIds.map((id, i) => ({ id, sortOrder: i }))), () => {}, flash);
  }
  // Add a task to the active project, optionally into a section. Shared by the
  // top composer (loose) and each section's inline composer.
  async function addProjectTaskLocal(title: string, sectionId: string | null) {
    if (!active) return; const t = title.trim(); if (!t) return;
    const tmp = tempId();
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
  /**
   * Make a workstream — one handler for the List's "New workstream" and the
   * Board's last column, which had drifted into two inline copies, one of which
   * said nothing at all when the write failed.
   *
   * Not optimistic: a stream needs its real id before anything can be filed
   * into it, so it appears when the database has it. A throw (an expired
   * session) is caught and said, rather than becoming an unhandled rejection
   * and a click that silently did nothing.
   */
  async function createStream(name: string) {
    const clean = name.trim();
    if (!clean || !active) return;
    const projectId = active.id;
    try {
      const res = await createSection(projectId, clean);
      // The server appends after the project's current LAST stream (max + 1);
      // the old inline copies used the count of every project's streams, so a
      // new stream could sort above an existing one until the next load.
      if ('id' in res) setSections((ss) => [...ss, {
        id: res.id, project_id: projectId, name: clean,
        sort_order: Math.max(-1, ...ss.filter((x) => x.project_id === projectId).map((x) => x.sort_order)) + 1,
      }]);
      else flash(res.error);
    } catch {
      flash('Could not save that. Check your connection and try again.');
    }
  }
  // Section mutations (optimistic). Deleting a section keeps its tasks — the FK
  // is `on delete set null`, so removing it from state re-groups them as loose.
  async function renameSectionLocal(id: string, name: string) {
    const trimmed = name.trim(); if (!trimmed) return;
    const prev = sections.find((s) => s.id === id)?.name;
    if (prev === undefined || prev === trimmed) return;
    setSections((ss) => ss.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
    // It used to keep the new name on screen when the write failed — a heading
    // reading a name the database never stored.
    await applyShare(() => renameSection(id, trimmed), () => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, name: prev } : s))), flash);
  }
  async function deleteSectionLocal(id: string) {
    // The reassurance ("its tasks were kept") used to arrive AFTER the section
    // was already gone. It belongs before the decision, with the real count.
    const name = sections.find((s) => s.id === id)?.name?.trim() || 'this workstream';
    const n = tasks.filter((t) => t.section_id === id).length;
    const ok = await confirm({
      title: `Delete “${name}”?`,
      body: n === 0
        ? 'It has no tasks in it.'
        : `Its ${n} ${n === 1 ? 'task stays' : 'tasks stay'} in the project, ungrouped.`,
      actionLabel: 'Delete workstream',
    });
    if (!ok) return;
    const snapshot = sections;
    const filed = tasks.filter((t) => t.section_id === id).map((t) => t.id);
    setSections((ss) => ss.filter((s) => s.id !== id));
    setTasks((ts) => ts.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)));
    const deleted = await applyShare(() => deleteSection(id), () => {
      setSections(snapshot);
      setTasks((ts) => ts.map((t) => (filed.includes(t.id) ? { ...t, section_id: id } : t)));
    }, flash);
    if (!deleted) return;
    flash('Workstream deleted. Its tasks were kept.');
  }
  /**
   * File a task into a workstream, or out of one.
   *
   * THE fix for the measured 0-of-88. Optimistic and silent on success, for
   * the same reason marking a task client-facing is: it is a small frequent
   * act on a row you are already looking at, and the row jumping to its new
   * group IS the confirmation. A toast per move would be noise on the pass
   * where you finally sort a project out.
   *
   * Optimistic-then-rollback rather than the durable queue, deliberately: it
   * is the pattern every other mutation in this file uses, and one queued op
   * in a module with no `MUTATION_REVERTED` listener would roll back the
   * server and leave the screen showing the move. Adopting the queue here is
   * worth doing — for the whole file at once, not for one handler.
   */
  async function moveTaskToStream(taskId: string, sectionId: string | null) {
    const prev = tasks.find((t) => t.id === taskId)?.section_id ?? null;
    if (prev === sectionId) return;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, section_id: sectionId } : t)));
    await applyShare(
      () => setTaskSection(taskId, sectionId),
      () => setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, section_id: prev } : t))),
      flash,
    );
  }

  /**
   * Move a workstream one place up or down.
   *
   * Renumbers the whole list from 0 rather than swapping two values: sections
   * created before this existed can share a `sort_order`, and a swap between
   * two rows that both read 0 is a no-op that looks like a broken control.
   */
  async function moveSectionBy(id: string, delta: 1 | -1) {
    const mine = sections.filter((x) => x.project_id === active.id)
      .slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const i = mine.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= mine.length) return;
    const next = [...mine];
    [next[i], next[j]] = [next[j], next[i]];
    const order = new Map(next.map((x, k) => [x.id, k]));
    const snapshot = sections;
    setSections((ss) => ss.map((x) => (order.has(x.id) ? { ...x, sort_order: order.get(x.id)! } : x)));
    await applyShare(() => setSectionOrder(next.map((x, k) => ({ id: x.id, sortOrder: k }))), () => setSections(snapshot), flash);
  }

  /**
   * A workstream's deadline and its paused state — 0040's other two columns,
   * unwritable until now.
   *
   * Both optimistic and silent, like every other small edit in this file. Both
   * roll the local row back on failure rather than leaving the screen ahead of
   * the database, which is the one thing a date must never do: a phase that
   * says "12 Sep" when the server still says nothing is a commitment you think
   * you have made.
   */
  async function setStreamDate(id: string, date: string | null) {
    const prev = sections.find((x) => x.id === id)?.due_date ?? null;
    if (prev === date) return;
    setSections((ss) => ss.map((x) => (x.id === id ? { ...x, due_date: date } : x)));
    await applyShare(() => setSectionDate(id, date), () => setSections((ss) => ss.map((x) => (x.id === id ? { ...x, due_date: prev } : x))), flash);
  }
  async function setStreamPaused(id: string, paused: boolean) {
    const prev = sections.find((x) => x.id === id)?.status ?? null;
    const next = paused ? 'paused' : null;
    setSections((ss) => ss.map((x) => (x.id === id ? { ...x, status: next } : x)));
    await applyShare(() => setSectionStatus(id, next), () => setSections((ss) => ss.map((x) => (x.id === id ? { ...x, status: prev } : x))), flash);
  }

  // ── Client-facing marking, where the work is (S1) ──────────────────────────
  // Optimistic and silent on success: marking a task for the client is a small
  // frequent act on a row you are already looking at, and the chip changing IS
  // the confirmation. A toast per tick would be noise on a bulk pass.
  async function shareTask(id: string, next: boolean) {
    setTaskVis((m) => ({ ...m, [id]: next }));
    await applyShare(() => setTaskClientVisible(id, next), () => setTaskVis((m) => ({ ...m, [id]: !next })), flash);
  }
  async function shareStream(id: string, next: boolean) {
    const set = (v: boolean) => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, client_visible: v } : s)));
    set(next);
    await applyShare(() => setStreamClientVisible(id, next), () => set(!next), flash);
  }
  // The bulk pass, run from the stream header so the scope of "all" is the
  // group you are looking at. Loud (a toast with the count) precisely because
  // it changes rows that are not all on screen.
  async function shareStreamTasks(id: string, next: boolean) {
    const ids = tasks.filter((t) => t.section_id === id).map((t) => t.id);
    if (ids.length === 0) return;
    const snapshot = taskVis;
    setTaskVis((m) => ({ ...m, ...Object.fromEntries(ids.map((x) => [x, next])) }));
    const ok = await applyShare(() => setStreamTasksClientVisible(id, next), () => setTaskVis(snapshot), flash);
    if (!ok) return;
    const n = `${ids.length} ${ids.length === 1 ? 'task' : 'tasks'}`;
    flash(next ? `${n} shared with the client` : `${n} made internal`);
  }

  function logManual(projectId: string, body: string, type: 'note' | 'status_change' | 'client_update') {
    if (!activitySupported) return;
    const tmp = tempId();
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
  const logNote = (body: string, toClient = false) => {
    if (active && body.trim()) logManual(active.id, body.trim(), typeFor(toClient) as 'note' | 'client_update');
  };
  // Change an existing update's audience, from its own row.
  async function shareUpdate(id: string, next: boolean) {
    const set = (v: boolean) => setActivity((as) => as.map((a) => (a.id === id ? { ...a, type: typeFor(v) } : a)));
    set(next);
    await applyShare(() => setUpdateClientVisible(id, next), () => set(!next), flash);
  }
  async function removeUpdate(id: string) {
    const snapshot = activity;
    setActivity((as) => as.filter((a) => a.id !== id));
    await applyShare(() => deleteUpdate(id), () => setActivity(snapshot), flash);
  }
  async function addTime(minutes: number, loggedAt: string | null) {
    if (!active || minutes <= 0) return;
    const tmp = tempId();
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
  // Over the project, not instead of it: its tab stays put behind the task (lib/task-address.ts).
  const openTask = (id: string) => router.push(taskOpenHref(pathname, window.location.search, id));
  const newTask = () => { setTab('tasks'); setLayout('list'); setTimeout(() => addRef.current?.focus(), 60); };

  // ── Empty: no projects at all ──
  if (!projects.length || !active) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
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

  // TOP-LEVEL ONLY, and it is one filter doing five jobs.
  //
  // Subtasks now inherit their parent's project (lib/actions/tasks.ts), which
  // fixed a real bug — a broken-down task's pieces belonged to no project — but
  // it means every project-scoped read has to say what it counts. Without this
  // filter a task split into ten would appear ten more times in the list, ten
  // more cards on the board, and would drag the progress bar around on its own.
  //
  // The rule is `lib/workstreams.ts`'s, stated there and now obeyed here:
  // progress counts top-level tasks, because a stream with one fiddly
  // ten-subtask task must not read as more work than a stream with nine real
  // ones. `subByParent` still sees every subtask — it is built from the full
  // list — so each row keeps its own x/y.
  const projTasks = tasks.filter((t) => t.project_id === active.id && !t.parent_task_id);
  // Gate 1 of the visibility rule, read once for the whole detail pane so every
  // row's chip answers from the same switches the portal will read.
  const channels: ShareChannels = readChannels(active as unknown as Record<string, unknown>);
  const open = projTasks.filter((t) => !t.done);
  const projTimes = times.filter((t) => t.project_id === active.id);
  const today = todayISO();
  // THE next deadline, from lib/project-deadline.ts.
  //
  // A WORKSTREAM'S DEADLINE IS A PROJECT DEADLINE — that is the reason to date
  // a phase at all. "Discovery, 12 Sep" is a commitment, and one that only
  // appeared if you happened to be on the Tasks tab would be a commitment the
  // project's own header hid from you.
  //
  // Adding that third source is what made the rule worth extracting: it lived
  // here as eight lines with a comparator that never returns 0, so two dates on
  // the same day resolved in whatever order the database handed them over. The
  // rule now has a stated precedence and a test file; this component just asks.
  const nextDl = nextDeadline(deadlineCandidates({
    project: active,
    openTasks: open,
    streams: sections.filter((sec) => sec.project_id === active.id).map((sec) => {
      const p = progressOf(projTasks.filter((t) => t.section_id === sec.id));
      return { name: sec.name, due_date: sec.due_date, done: p.done, total: p.total };
    }),
  }), today);
  // The header's bar and the workstream headings must not compute progress two
  // different ways. `progressOf` is the one rule (empty is 0%, never 100%).
  const projProgress = progressOf(projTasks);
  const doneCount = projProgress.done;
  const projActivity = activity.filter((a) => a.project_id === active.id);
  const events = buildEvents(projTasks, projActivity);
  // Health = a calm, derived narrative signal (§7E). Only surfaces when the
  // project needs attention (overdue work, or gone quiet) — no news is good news.
  const health = projectHealth({ status: active.status, open, today, projActivity, projTasks, updatedAt: active.updated_at, createdAt: active.created_at });

  const detailTabs: TabItem[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'docs', label: 'Docs' },
    // Files, not "Attachments": the glossary keeps one plain word per concept,
    // and it sits beside Docs because that is the pair people think of together
    // — Docs is what you wrote, Files is what you were sent.
    { value: 'files', label: 'Files' },
    { value: 'money', label: 'Money' },
    { value: 'portal', label: 'Portal' },
  ];

  // The one header row, above BOTH panes. NO title: the rail highlights the
  // selected project and the detail leads with its name as an H1, so a third
  // copy here says the same thing a third time — the master/detail rule
  // Clients and Documents already follow (§2.4). Share / Preview-as-client
  // stay in the Portal tab (one home per action).
  return (
    <HubLayout
      railLabel="Projects"
      contentKey={active.id}
      rail={(
        <>
          {/* Quiet section label — the top bar already titles the page "Projects" */}
          <div className="mb-2 flex items-center gap-2 pl-0.5">
            <span className={cn(sectionLabel, 'flex-1')}>Projects</span>
            <IconButton size="xs" variant="ghost" onClick={() => setNewOpen(true)} label="New project" icon={<Icon icon={Plus} size={14} />} />
          </div>
          <div className="flex flex-col gap-[var(--nav-row-gap,2px)]">
            {projects.map((p) => (
              <RailRow key={p.id} project={p} open={openCount(p.id)} active={p.id === active.id} onClick={() => setActiveId(p.id)} />
            ))}
          </div>
        </>
      )}
      overlays={(
        <>
          {confirmUI}
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
              onMakeContent={async (presetIds) => {
                const res = await createContentFromProject(active.id, presetIds);
                if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
                setCloseOutOpen(false);
                toast({
                  message: `${res.ids.length} ${res.ids.length === 1 ? 'piece' : 'pieces'} added to Content`,
                  variant: 'success',
                });
              }}
              onSaveRetro={logNote}
              onClose={() => setCloseOutOpen(false)}
            />
          )}
          {shareOpen && (
            <SharePanel
              project={active}
              tasks={projTasks}
              docs={docs.filter((d) => d.project_id === active.id)}
              taskVisible={taskVis}
              onTaskVisible={shareTask}
              portalSupported={portalSupported}
              onClose={() => setShareOpen(false)}
              onPatch={patchActive}
              flash={flash}
            />
          )}
          {previewOpen && <PreviewOverlay projectId={active.id} onClose={() => setPreviewOpen(false)} />}
        </>
      )}
      actions={active ? (
        <>
          {/* The close-out is REOPENABLE on a finished project. Content is
              the reason: almost nobody thinks about marketing in the ten
              seconds after they tick a project done — they think about it
              three months later when they need something to post, and by
              then the only way back to that moment was to un-complete the
              project and complete it again. */}
          {active.status === 'completed' && (
            <Button size="sm" variant="ghost" icon={<Icon icon={Sparkles} size={16} />} onClick={() => setCloseOutOpen(true)}>Wrap up</Button>
          )}
          <Button size="sm" variant="ghost" icon={<Icon icon={Pencil} size={16} />} onClick={() => setEditOpen(true)}>Edit</Button>
          {/* THE VIEW'S ONE BRAND ACTION (2026-09-30). Every module had its `primary` only
          inside its EmptyState, so Zenboard showed colour exactly when it had no data and
          went fully grey the moment you used it. The two are never on screen together, so
          promoting the populated header's hero keeps the cap at one per view. */}
          <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={newTask}>New task</Button>
        </>
      ) : undefined}
    >
      {/* Header — a Notion page header: a large title, generous space, then
          a properties block. Status lives in the properties, not on the title. */}
      {/* The record's title block and properties, in the app's ONE entity-detail
          header (ds/ui/record-header.tsx). Its ACTIONS moved up into the page
          header row so they sit on the same axis as every other page's; the
          properties stay OUTSIDE the tab panel so a project's facts read without
          picking a section first. */}
      <RecordHeader
        identity={iconSupported ? (
          // The tile IS the control, which is Linear's arrangement and the
          // right one: the thing you want to change is the thing you click.
          // A separate "Change icon" button would be a second affordance for
          // an act the mark already advertises by being there.
          <span className="relative inline-flex">
            <button
              type="button"
              onClick={() => setIconOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={iconOpen}
              aria-label={active.icon ? `Change the icon for ${active.name}` : `Add an icon to ${active.name}`}
              className="focus-ring rounded-lg transition-opacity duration-fast hover:opacity-80"
            >
              <RecordIcon color={active.color} icon={active.icon} size="lg" />
            </button>
            {iconOpen && (
              <EmojiPicker
                onPick={(v) => setIcon(v)}
                onRemove={active.icon ? () => setIcon(null) : undefined}
                onClose={() => setIconOpen(false)}
              />
            )}
          </span>
        ) : <RecordIcon color={active.color} icon={active.icon} size="lg" />}
        title={active.name}
      >
        {/* ── THE PROJECT'S PROPERTIES, ALL OF THEM ─────────────────────────
            USER DIRECTIVE (2026-09-10): "this information is gone — I want it
            back as it was." An afternoon's pass had cut this block to one
            quiet line of three facts ("2/5 done · Due 12 Sep"), on the theory
            that anything stating a default (Status "Active") or a setting
            (Sharing) was clutter. The person using it disagreed: these are the
            facts they read a project BY, and a header that hides them makes you
            go looking. So the labelled block is back, every row of it.

            And now it is THEIRS to arrange. The cut was an attempt to answer
            "cluttered" by choosing for everyone, and no single list of rows can
            be right for both the person who reads a project by its progress and
            the one who bills by its dates. Every row here can be moved, hidden
            and brought back; the arrangement is saved per person, not per
            project (lib/property-layout.ts). The default is still all seven.

            `key` is what persists, so it must never be the label — renaming a
            row would otherwise lose everyone's arrangement. The list is filtered
            rather than spread-conditional so each row reads as one line. */}
        <PropertyBlock
          set="project"
          layout={propertyLayout}
          onSave={setPropertyLayout}
          properties={([
            {
              key: 'status', icon: Circle, label: 'Status',
              value: <Badge status={STATUS_TONE[active.status] ?? 'neutral'}>{statusLabel(active.status)}</Badge>,
            },
            // `projectHealth` only speaks when something needs attention, so this
            // row is absent on a project that is fine.
            health ? {
              key: 'health', icon: Activity, label: 'Health',
              value: <Badge status={health.tone}>{health.label}</Badge>,
            } : null,
            {
              key: 'progress', icon: Target, label: 'Progress',
              value: (
                <div className="flex items-center gap-3">
                  <div className="w-32"><Progress value={projProgress.pct} size="sm" valueText={`${doneCount} of ${projTasks.length} tasks done`} /></div>
                  <span className="text-caption tabular-nums text-ink-500">{doneCount}/{projTasks.length} done</span>
                </div>
              ),
            },
            nextDl ? {
              key: 'deadline', icon: Calendar, label: 'Deadline',
              value: (
                <>
                  <span className="tabular-nums text-ink-800">{fmtDate(nextDl.date)}</span>
                  {nextDl.label ? <span className="text-ink-500"> · {nextDl.label}</span> : null}
                </>
              ),
            } : null,
            {
              key: 'client', icon: User, label: 'Client',
              value: !active.client_id
                ? <span className="text-ink-500">Not linked</span>
                : clientNames[active.client_id]
                  ? (
                    <button type="button" onClick={() => router.push(recordHref('client', active.client_id!) ?? '/clients')}
                      className="focus-ring touch-min rounded-xs text-ink-800 underline-offset-2 transition-colors hover:text-ink-900 hover:underline">
                      {clientNames[active.client_id]}
                    </button>
                  )
                  : 'Linked',
            },
            {
              key: 'started', icon: Clock, label: 'Started',
              value: <span className="tabular-nums">{fmtDate(active.created_at)}</span>,
            },
            active.portal_enabled ? {
              key: 'sharing', icon: Share2, label: 'Sharing',
              value: (
                <button type="button" onClick={() => setTab('portal')}
                  className="focus-ring touch-min rounded-xs text-ink-800 transition-colors hover:text-ink-900">Portal on</button>
              ),
            } : null,
          ] as (RecordProperty | null)[]).filter((p): p is RecordProperty => p !== null)}
        />
      </RecordHeader>

      {/* Tab bar. The Tasks layout switcher rides the bar itself rather than
          owning a band of its own below it — it is a view control for the panel
          underneath, so it belongs on the panel's edge, and a 45px strip
          holding one three-way toggle was the fourth horizontal band between
          the title and the first task.

          Through the bar's END slot, not floated over it. Floated, it covered
          Docs, Files and Money on a phone — three of six sections untappable.
          In the slot it sits beside the tabs when there is room and drops
          below them when there is not (components/ds/ui/tabs.tsx). */}
      <div className="mb-4">
        <Tabs
          items={detailTabs} value={tab} onValueChange={(v) => setTab(v as DetailTab)} aria-label="Project detail"
          end={tab === 'tasks' ? (
            <SegmentedControl
              aria-label="Task layout" fit="content" value={layout}
              onValueChange={(v) => setLayout(v as 'list' | 'board' | 'calendar')}
              options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }, { value: 'calendar', label: 'Calendar' }]}
            />
          ) : undefined}
        />
      </div>

      {/* Tab body */}
      {tab === 'overview' && (
        <>
          <Overview tasks={projTasks} events={events} notes={activity.filter((a) => a.project_id === active.id)} onOpenTask={openTask} onToggle={toggle} canLog={activitySupported} onLog={logNote}
            updateSharing={portalSupported ? { channels, onShare: shareUpdate, onDelete: removeUpdate } : undefined}
            streams={sections.filter((sec) => sec.project_id === active.id) as Workstream[]}
            onOpenStreams={() => setTab('tasks')}
            /* 0041 folds checkpoints into workstreams. Until it has run for
               THIS project, its milestones are still un-stamped and the old
               list keeps rendering — fully editable, nothing lost. The loader
               filters stamped rows out, so this empties itself and the section
               disappears the moment the migration lands. No flag to remember
               to flip, and the product is correct on both sides of it. */
            milestones={milestonesSupported ? milestones.filter((m) => m.project_id === active.id) : null}
            onAddMilestone={addMile} onToggleMilestone={toggleMile} onDateMilestone={dateMile} onDeleteMilestone={removeMile} />

          {/* Memory's panel sat here (§7X §5.3) — HIDDEN 2026-09-07 with the rest
              of the module. */}
        </>
      )}
      {tab === 'tasks' && (
        <div>
          {layout === 'list' && (
            <TaskList tasks={projTasks} subByParent={subByParent} onToggle={toggle} onOpen={openTask} onHighlight={toggleHl}
              sections={sections.filter((s) => s.project_id === active.id)} sectionsSupported={sectionsSupported}
              onNewSection={createStream}
              onRenameSection={renameSectionLocal}
              onDeleteSection={deleteSectionLocal}
              onMoveSection={moveSectionBy}
              onDateSection={setStreamDate}
              onPauseSection={setStreamPaused}
              onMoveTask={moveTaskToStream}
              onAddTask={addProjectTaskLocal}
              composer={(
                <div className="flex h-[var(--row-task)] items-center gap-3 px-[var(--panel-px)]">
                  <Icon icon={Plus} size={16} className="shrink-0 text-ink-500" />
                  <input ref={addRef} value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTaskRow(); }}
                    placeholder="Add a task…" autoComplete="off" data-1p-ignore data-lpignore="true"
                    className="min-w-0 flex-1 bg-transparent text-ui text-ink-900 outline-none placeholder:text-ink-500" />
                  {draft.trim() && <Button size="sm" variant="secondary" onClick={addTaskRow}>Add</Button>}
                </div>
              )}
              sharing={portalSupported ? { channels, visible: taskVis, onTask: shareTask, onStream: shareStream, onStreamTasks: shareStreamTasks } : undefined} />
          )}
          {layout === 'board' && (
            <ProjectBoard tasks={projTasks} sections={sections.filter((sec) => sec.project_id === active.id)}
              subByParent={subByParent} sectionsSupported={sectionsSupported}
              onToggle={toggle} onOpen={openTask} onAdd={addProjectTaskLocal} onDrop={boardDrop}
              onNewSection={createStream}
              onRenameSection={renameSectionLocal} onDeleteSection={deleteSectionLocal} onMoveSection={moveSectionBy}
              onDateSection={setStreamDate} onPauseSection={setStreamPaused}
              onShareStreamTasks={portalSupported ? shareStreamTasks : undefined} />
          )}
          {layout === 'calendar' && <CalendarView tasks={projTasks} onOpen={openTask} />}
        </div>
      )}
      {tab === 'docs' && (
        <>
          <ProjectDocs
            projectId={active.id}
            projectName={active.name}
            docs={docs.filter((d) => d.project_id === active.id)}
            portalSupported={portalSupported}
            channels={channels}
            onChange={(next) => setDocs((prev) => [...next, ...prev.filter((d) => d.project_id !== active.id)])}
            flash={flash}
          />
          {/* Forms, folded in from their own tab — a separate section rather
              than mixed into the doc list, because they are a distinct KIND
              of document (one someone else fills in) with their own create
              flow. No section label here: FormsPanel already leads with its
              own "Forms" heading, count and + New, and a label above that
              would print the word twice in 24px. */}
          <div className="mt-8 border-t border-line-soft pt-6">
            <FormsPanel forms={forms.filter((f) => f.projectId === active.id)} projectId={active.id} className="mt-0" />
          </div>
        </>
      )}
      {tab === 'files' && <AttachmentsPanel owner={{ project_id: active.id }} channels={portalSupported ? channels : undefined} />}
      {tab === 'money' && <ProjectTime times={projTimes} onAdd={addTime} onInvoice={invoiceUnbilled} />}
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
    </HubLayout>
  );
}

function RailRow({ project, open, active, onClick }: { project: PProject; open: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={railBtn(active)}>
      {/* This painted `project.color` as a RAW HEX, which is precisely the
          theme-blindness lib/entity-color.ts was written to end — a stored
          `#9A1B6F` measures 1.86:1 on the dark rail, so the mark the user
          called "amateur" was also one you could barely see. RecordIcon
          resolves through the per-theme token and gives the row a tile. */}
      <RecordIcon color={project.color} icon={project.icon} size="sm" />
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
function TaskList({ tasks, subByParent, onToggle, onOpen, onHighlight, sections = [], sectionsSupported = false, onNewSection, onRenameSection, onDeleteSection, onMoveSection, onDateSection, onPauseSection, onMoveTask, onAddTask, composer, sharing }: {
  tasks: PTask[]; subByParent: Map<string, { done: number; total: number }>;
  onToggle: (id: string) => void; onOpen: (id: string) => void; onHighlight: (id: string) => void;
  sections?: PSection[]; sectionsSupported?: boolean; onNewSection?: (name: string) => void;
  onRenameSection?: (id: string, name: string) => void; onDeleteSection?: (id: string) => void;
  /** Reorder a workstream by one place. `sort_order` has existed since 0014
   *  and nothing has ever been able to change it. */
  onMoveSection?: (id: string, delta: 1 | -1) => void;
  /** 0040's `due_date`, finally writable. A calendar date or null. */
  onDateSection?: (id: string, date: string | null) => void;
  /** 0040's `status`. Only `paused` is offered — see setSectionStatus. */
  onPauseSection?: (id: string, paused: boolean) => void;
  /** File a task into a workstream, or out of one (`null`). THE fix for the
   *  measured 0-of-88: creating a stream cost two clicks and filling one cost
   *  a drawer round trip, so containers got made and never used. */
  onMoveTask?: (taskId: string, sectionId: string | null) => void;
  onAddTask?: (title: string, sectionId: string | null) => void;
  /**
   * The project-level composer, rendered as the card's FIRST ROW.
   *
   * It used to sit above the card in a `composer-shell` — a bordered, raised
   * panel — which made the heaviest element on the Tasks tab the one that
   * holds no work. Inside the card it reads as the line you type on rather
   * than as a second surface, and the tab strip now sits directly above the
   * list. It stays a slot rather than moving in here because the page header's
   * "New task" button focuses it, and that ref belongs to the page.
   */
  composer?: React.ReactNode;
  /**
   * Client-facing marking. Absent when the project has no portal (0006 not
   * applied) — there is no client to mark anything FOR, and a control that
   * cannot do anything is worse than no control.
   */
  sharing?: {
    channels: ShareChannels;
    visible: Record<string, boolean>;
    onTask: (id: string, next: boolean) => void;
    onStream: (id: string, next: boolean) => void;
    onStreamTasks: (id: string, next: boolean) => void;
  };
}) {
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null); // section id whose composer is open
  const [addDraft, setAddDraft] = useState('');
  const today = todayISO();
  const settling = useSettling();

  // Progress per stream, over the stream's WHOLE life. It has to be computed
  // from `tasks` rather than from the `active` list below, because `active`
  // has already had the finished work split out of it — a count taken there
  // reports every stream as 0 done, which is the most confidently wrong number
  // a heading could carry.
  const progressByKey = useMemo(
    () => new Map(groupByStream(tasks, sections as Workstream[]).map((g) => [g.key, g.progress])),
    [tasks, sections],
  );
  // Where a task can be filed. Offered on the row only when there is a real
  // choice to make — with no workstreams, "move to" has one destination and
  // that is a menu item that does nothing.
  // A stream can move down while there is another STREAM below it. The
  // unfiled group is always last and is not a workstream, so "move down" on
  // the final stream must be disabled even though a group follows it.
  const streamCount = sections.length;
  const canMoveDown = (gi: number) => gi < streamCount - 1;
  const moveTargets = useMemo(
    () => [...sections.map((x) => ({ id: x.id, name: x.name })), { id: NO_STREAM, name: 'No workstream' }],
    [sections],
  );

  // A finished task stays put for a beat, then settles into Completed below.
  const { active, completed } = splitSettled(tasks, settling.ids);
  // Ticking a row decides which way its beat runs BEFORE the parent's optimistic
  // update lands, so `t.done` here is still the pre-click value.
  const toggle = (t: PTask) => { if (t.done) settling.release(t.id); else settling.hold(t.id); onToggle(t.id); };

  // ── GROUPING COMES FROM lib/workstreams.ts, NOT FROM HERE ────────────────
  // This block used to derive its own groups, character for character a second
  // implementation of `groupByStream` — which the client portal was already
  // using. Two derivations of one idea is the state just before a divergence,
  // and it had already produced one: the portal knew each stream's progress and
  // the owner's screen did not.
  //
  // Streams group the ACTIVE tasks only. Completed work collects in one place
  // at the bottom rather than leaving a struck-through tail inside every
  // stream — you stop caring which stream a thing was in once it is done.
  //
  // ORDER CHANGED, deliberately: named streams lead and unfiled work comes
  // LAST, which is `groupByStream`'s order and Linear's and Notion's. Loose
  // tasks used to sit on top with no heading above them, so a project's first
  // block of work looked like preamble to the structure below it rather than
  // part of it. Unfiled now gets a heading of its own whenever there is
  // anything else to tell it apart from.
  const groups = groupByStream(active, sections as Workstream[]);

  // ── The list keyboard grammar (§6.3), shared with Tasks and Today ─────────
  // Third and last of the lists the recipe named. Same guard, same roving
  // cursor, same ↑ ↓ j k / ⏎ / Esc from lib/list-keys.ts.
  //
  // The cursor walks a FLAT order, not the groups: the eye reads down the card
  // across every section heading, so `j` at the end of Discovery must land on
  // the first row of Design rather than stopping at a boundary the reader does
  // not perceive. Completed rows are excluded — they sit behind a disclosure,
  // and a cursor that travels into rows nobody can see appears to vanish.
  //
  // `1 2 3` are NOT bound here, unlike Tasks and Today. Priority is not editable
  // from this list — no handler is plumbed for it — and a key that silently does
  // nothing is worse than a key that is absent. Recorded rather than faked.
  const flat = groups.flatMap((g) => g.tasks);
  const cursor = useListCursor(flat.length);
  useListKeys((e) => {
    if (cursor.arrows(e)) return;
    const t = flat[cursor.index];
    if (!t) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter' || k === 'o') { e.preventDefault(); onOpen(t.id); }
    else if (k === 'e') { e.preventDefault(); toggle(t); }
    else if (k === 'h') { e.preventDefault(); onHighlight(t.id); }
  }, {
    // Every inline composer and rename field on this card. The shared guard
    // already yields to a focused input; these cover the moment one is opening.
    suspended: addingSection || addingIn !== null || renamingId !== null,
  });

  // AFTER the hooks above, never before: this guard fires on precisely the
  // render where the list flips between empty and populated, which is the one
  // that would change the hook call order and crash.
  // A project with nothing in it is exactly when you decide how the work
  // splits — and until 2026-09-09 this early return meant the ONE control that
  // does that never rendered. A branding job is Identity, Motion and Web from
  // the first day; the composer above already covers "just add a task".
  if (tasks.length === 0 && sections.length === 0 && !addingSection) {
    return (
      <Empty
        title="No tasks yet"
        line="Bigger jobs split into workstreams: Identity, Motion, Web."
        action={sectionsSupported ? (
          <Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={14} />}
            onClick={() => setAddingSection(true)}>New workstream</Button>
        ) : undefined}
      />
    );
  }

  const submitSection = () => {
    const name = sectionName.trim();
    if (name) onNewSection?.(name);
    setSectionName(''); setAddingSection(false);
  };
  const submitAdd = (sectionId: string) => {
    const title = addDraft.trim();
    if (title) onAddTask?.(title, sectionId);
    setAddDraft(''); // keep the composer open so several tasks can be added in a row
  };

  return (
    <div>
      {/* The card is the QUERY CONTAINER its headings and rows compact
          against — the share pill's word, priority's word, "Add a date" and
          the shared-tally all give way under 28rem (`@max-md`). The card and
          not each row, because a row made a container can no longer size to
          its content and would collapse to nothing in any shrink-to-fit
          context; the card is always a full-width block. */}
      <div className={cn(cardShell, 'overflow-hidden @container')}>
        {composer}
        {groups.map((g, gi) => {
          // Rows carry their index in the FLAT order (see the cursor above), not
          // their index within this stream — `j` has to cross a heading.
          const offset = groups.slice(0, gi).reduce((n, x) => n + x.tasks.length, 0);
          const stream = g.stream;
          // The unfiled group is named only when there is something to tell it
          // apart FROM. On the many projects that use no workstreams at all it
          // is the only group, and a permanent heading reading "No workstream"
          // above every task would be a label for a decision nobody made.
          const showHeading = stream !== null || groups.length > 1;
          // Progress over the stream's WHOLE life, not just what is on screen:
          // `active` has already had the finished tasks split out of it, so a
          // count taken from it would report every stream as 0 done.
          const prog = progressByKey.get(g.key);
          const composerOpenHere = stream !== null && addingIn === stream.id;
          return (
          <div key={g.key}>
            {/* `group` as well as `group/sec`: the shared `reveal-on-hover`
                utility keys off the UNNAMED group, so leaving it named-only
                would make every quiet control in here permanently invisible. */}
            {showHeading && (
              // A HEADING, not another row. It measured 12px type above 14px
              // rows, so the container read as smaller than the things it
              // contained — which is most of why this list did not parse. Now
              // it is heavier (14/500, full ink) and SHORTER (--row-group, 32
              // against the row's 36): weight says "container", height says
              // "not the work". `px` is the panel's, so the name starts on the
              // same axis as the task titles under it. No top border on the
              // first one — the card's own edge is already there.
              <div className={cn(
                'group group/sec flex h-[var(--row-group)] items-center gap-2 px-[var(--panel-px)]',
                (gi > 0 || !!composer) && 'border-t border-line-soft',
              )}>
                {stream && renamingId === stream.id ? (
                  <WorkstreamRename stream={stream} onRename={(id, name) => onRenameSection?.(id, name)} onDone={() => setRenamingId(null)} />
                ) : (
                  <>
                    <span className={cn('truncate text-ui font-medium', stream ? 'text-ink-900' : 'text-ink-500')}>
                      {stream ? stream.name : 'No workstream'}
                    </span>
                    {/* Progress over the stream's whole life, and Paused only when
                        someone said so — see WorkstreamFacts. */}
                    <WorkstreamFacts stream={stream} progress={prog} />
                    {/* How much of this workstream the client is actually
                        getting. A stream can be client-facing while every task
                        inside it is internal — that is a legitimate state on
                        the way to sharing, and a silent one without this. */}
                    {stream && sharing?.channels && stream.client_visible === true && (() => {
                      const shared = g.tasks.filter((t) => sharing.visible[t.id] === true).length;
                      return shared < g.tasks.length ? (
                        // A narrow card drops the tally before it drops the name.
                        <span className="shrink-0 text-caption tabular-nums text-ink-500 @max-md:hidden">· {shared} shared</span>
                      ) : null;
                    })()}
                    <span className="flex-1" />
                    {stream && onDateSection && <WorkstreamDate stream={stream} today={today} onDate={onDateSection} />}
                    {stream && (
                      <>
                        {/* ADD INTO THIS STREAM, from the stream's own header.
                            It was a ghost row at the foot of each group — one
                            per workstream, permanently drawn, which is how a
                            two-stream project came to show four ways to add
                            something. Hiding that row until hover only traded
                            the clutter for a 32px HOLE between groups, because
                            a hidden row still occupies the flow. In the header
                            it costs no height at all, and it is where Notion
                            and Linear both put it. */}
                        <IconButton size="xs" variant="ghost"
                          label={`Add a task to ${stream.name}`}
                          icon={<Icon icon={Plus} size={14} />}
                          onClick={() => { setAddingIn(stream.id); setAddDraft(''); }}
                          // Same cluster rule as the task row's star: 24 of reach
                          // beside its neighbours, not 44 that overlaps them.
                          className="reveal-on-hover [@media(pointer:coarse)]:after:w-6" />
                        {sharing && (
                          <ShareToggle
                            kind="task"
                            item={{ client_visible: stream.client_visible, done: false }}
                            channels={sharing.channels}
                            name={stream.name}
                            onToggle={(next) => sharing.onStream(stream.id, next)}
                          />
                        )}
                        {sectionsSupported && (
                          <WorkstreamMenu stream={stream} axis="vertical"
                            canMoveBack={gi > 0} canMoveForward={canMoveDown(gi)}
                            onRename={() => setRenamingId(stream.id)}
                            onMove={(id, d) => onMoveSection?.(id, d)}
                            onPause={onPauseSection}
                            share={sharing && g.tasks.length > 0 ? { onAll: sharing.onStreamTasks } : undefined}
                            onDelete={(id) => onDeleteSection?.(id)} />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {g.tasks.map((t, i) => {
              // Border-free when whatever follows already draws a line: the
              // next group's heading and the Completed disclosure both carry
              // their own `border-t`, and the card's terminal row wants none.
              // The one exception is this stream's composer, which does not.
              const last = i === g.tasks.length - 1 && !composerOpenHere;
              return (
                <div key={t.id} ref={cursor.ref(offset + i)} className={cn(settling.ids.has(t.id) && 'animate-settle-out')}>
                  <TaskRow task={t} sub={subByParent.get(t.id)} last={last}
                    selected={offset + i === cursor.index}
                    onToggle={() => toggle(t)} onOpen={() => onOpen(t.id)} onHighlight={() => onHighlight(t.id)}
                    share={sharing && { visible: sharing.visible[t.id] === true, channels: sharing.channels, onToggle: (next) => sharing.onTask(t.id, next) }}
                    move={moveTargets.length > 1 ? { targets: moveTargets, current: t.section_id ?? NO_STREAM, onMove: (to) => onMoveTask?.(t.id, to === NO_STREAM ? null : to) } : undefined}
                    showHighlightToggle showElapsed />
                </div>
              );
            })}
            {/* The stream's composer, opened from the + in its header above.
                Nothing renders here when it is closed — the group ends on its
                last task. */}
            {composerOpenHere && stream && (
              <div className="flex h-[var(--row-group)] items-center gap-2 px-[var(--panel-px)]">
                <Icon icon={Plus} size={14} className="shrink-0 text-ink-500" />
                <input autoFocus value={addDraft} onChange={(e) => setAddDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(stream.id); if (e.key === 'Escape') { setAddDraft(''); setAddingIn(null); } }}
                  onBlur={() => { submitAdd(stream.id); setAddingIn(null); }}
                  placeholder="Add a task to this workstream…" autoComplete="off" data-1p-ignore data-lpignore="true"
                  className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
              </div>
            )}
          </div>
          );
        })}
        {/* Everything finished, in one collapsed group at the foot of the card.
            Un-ticking from in here returns the task to the active list at once —
            there is no beat on the way back, because you already know where it
            is going. */}
        <CompletedSection count={completed.length}>
          {completed.map((t, i) => (
            <TaskRow key={t.id} task={t} sub={subByParent.get(t.id)} last={i === completed.length - 1}
              onToggle={() => toggle(t)} onOpen={() => onOpen(t.id)} onHighlight={() => onHighlight(t.id)}
              share={sharing && { visible: sharing.visible[t.id] === true, channels: sharing.channels, onToggle: (next) => sharing.onTask(t.id, next) }}
              showHighlightToggle showElapsed />
          ))}
        </CompletedSection>
      </div>
      {sectionsSupported && (
        addingSection ? (
          <div className={cn(composerShell, 'mt-2 py-0.5')}>
            <input autoFocus value={sectionName} onChange={(e) => setSectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSection(); if (e.key === 'Escape') { setSectionName(''); setAddingSection(false); } }}
              placeholder="Motion, Web design, Identity…" autoComplete="off" data-1p-ignore data-lpignore="true"
              className={cn(composerInput, 'py-1.5')} />
            <Button size="sm" variant="secondary" onClick={submitSection}>Add</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-2" icon={<Icon icon={Plus} size={14} />} onClick={() => setAddingSection(true)}>
            New workstream
          </Button>
        )
      )}
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
  // The agenda's shape: only the days that have something, in date order.
  const dated = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <div className={cn(cardShell, 'p-3.5 @container')}>
      <div className="mb-2.5 text-title-4 text-ink-900">{formatMonthYear(now, { long: true })}</div>
      {scheduled === 0 && <EmptyLine className="mb-2.5 py-0">No tasks have a date yet. Set a date on a task to see it here.</EmptyLine>}
      {/* The month grid, for a card with room for seven columns. Weekday
          heads in sentence case: the `text-overline` role has been sentence
          case since 2026-09-08, and "MON" was the one place still shouting. */}
      <div className="@max-md:hidden">
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-1 text-overline text-ink-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className={cn('min-h-[76px] rounded-sm border p-1', d ? 'border-line-soft' : 'border-transparent', d === todayD && 'bg-surface-selected')}>
            {d && <div className={cn('mb-1 text-caption tabular-nums', d === todayD ? 'font-semibold text-ink-900' : 'text-ink-500')}>{d}</div>}
            {d && (byDay.get(d) ?? []).slice(0, 3).map((t) => (
              <button key={t.id} onClick={() => onOpen(t.id)} title={t.title}
                className={cn('focus-ring mb-1 block w-full truncate rounded-xs border border-line-soft px-1.5 py-0.5 text-left text-caption transition-colors duration-fast [@media(pointer:coarse)]:min-h-6',
                  t.done ? 'bg-surface-sunken text-ink-500 line-through' : 'bg-surface-fill text-ink-800 hover:bg-surface-fill-hover')}>
                {t.title}
              </button>
            ))}
            {d && (byDay.get(d)?.length ?? 0) > 3 && <div className="text-caption text-ink-500">+{byDay.get(d)!.length - 3} more</div>}
          </div>
        ))}
      </div>
      </div>
      {/* THE PHONE SHAPE. Under 28rem the month grid gives way to an agenda of
          the same tasks: seven columns in 375px left each chip ~30px ("S…") — a
          date you could see and a title you could not. Both shapes are in the
          markup and the card's own width picks one, so the right shape is there
          on first paint: no viewport hook, no flash. */}
      {dated.length > 0 && (
        <ol className="hidden list-none flex-col gap-3 p-0 @max-md:flex">
          {dated.map(([d, list]) => (
            <li key={d}>
              <div className={cn('mb-1 text-overline', d === todayD ? 'text-ink-900' : 'text-ink-500')}>
                {formatRelativeDay(new Date(year, month, d), { weekday: true })}
              </div>
              <div className="flex flex-col gap-1">
                {list.map((t) => (
                  <button key={t.id} type="button" onClick={() => onOpen(t.id)}
                    className={cn('focus-ring touch-row flex min-h-9 w-full items-center rounded-sm border border-line-soft px-2.5 text-left text-ui transition-colors duration-fast',
                      t.done ? 'bg-surface-sunken text-ink-500 line-through' : 'bg-surface-fill text-ink-800 hover:bg-surface-fill-hover')}>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Detail row for the Overview right rail (Linear-style properties sidebar):
// muted label left, value right, on one line.
// Notion-style property row: a fixed-width gray label with a leading icon, then
// the value in ink. Rows breathe (min-h-8) and carry no borders — the alignment
// and whitespace do the work, the way Notion lists page properties.
// PropRow is the DS `PropertyRow` — see components/ds/ui/record-header.tsx.
// This file used to carry a private, identical copy.

// ── Overview — the project's "memory surface" (MASTER_PRODUCT_PLAN §7E), as a
// Notion page: properties live under the title (in the header), so the body is
// pure content — a written status that leads (the sentence is the hill chart, not
// a percent tile), a light task list, and the activity log, separated by
// whitespace and quiet sentence-case headings, never boxed dashboard sections.
function Overview({ tasks, events, notes, onOpenTask, onToggle, canLog, onLog, updateSharing,
  streams, onOpenStreams,
  milestones, onAddMilestone, onToggleMilestone, onDateMilestone, onDeleteMilestone }: {
  tasks: PTask[]; events: Ev[]; notes: PActivity[];
  onOpenTask: (id: string) => void; onToggle: (id: string) => void; canLog: boolean;
  onLog: (body: string, toClient?: boolean) => void;
  /** Present when the project has a portal — the audience half of an update. */
  updateSharing?: {
    channels: ShareChannels;
    onShare: (id: string, next: boolean) => void;
    onDelete: (id: string) => void;
  };
  /** The project's workstreams — its shape and schedule, replacing the
   *  checkpoint list that owned nothing. */
  streams: Workstream[];
  onOpenStreams: () => void;
  /**
   * `null` ⇒ migration 0036 is not applied.
   * EMPTY ⇒ 0041 has folded them all into workstreams, and this section stops
   * rendering on its own. See the note at the call site.
   */
  milestones: Milestone[] | null;
  onAddMilestone: (title: string, dueDate: string | null) => void;
  onToggleMilestone: (id: string, done: boolean) => void;
  onDateMilestone: (id: string, dueDate: string | null) => void;
  onDeleteMilestone: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const submit = (toClient = false) => { const t = draft.trim(); if (!t) return; onLog(t, toClient); setDraft(''); };
  const open = tasks.filter((t) => !t.done);
  const key = [...open].sort((a, b) => Number(b.highlight) - Number(a.highlight) || (a.scheduled_date ?? '9999') < (b.scheduled_date ?? '9999') ? -1 : 1).slice(0, 5);
  // One list, both audiences (lib/updates.ts): "what did I last say about this
  // project?" must have one answer, so the newest update leads whether it went
  // to the client or not.
  const updates = allUpdates(notes as { id: string; type: string; body: string | null; created_at: string }[]);
  const statusNote = updates[0];
  const earlier = updates.slice(1, 5);
  const activityEntries: ActivityEntry[] = events.map((e) => ({ kind: 'action', actor: 'You', verb: e.verb, object: e.title, time: relTime(e.at) }));

  return (
    <div className="max-w-[720px]">
      {/* Update — the written status narrative leads and reads as prose.
          (Named "Update" so it doesn't collide with the Status property above.) */}
      <section className="@container">
        {/* A query container: on a phone the update rows' share pill drops its
            word, which was cutting the update text off mid-sentence. */}
        <SectionHeading>Update</SectionHeading>
        {statusNote ? (
          <div className="group mb-4">
            <p className="text-pretty text-body-lg leading-relaxed text-ink-800">{statusNote.body}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-caption text-ink-500">Updated {relTime(statusNote.created_at)}</span>
              {updateSharing && (
                <>
                  <ShareToggle kind="update" item={{ client_visible: isAddressedToClient(statusNote) }}
                    channels={updateSharing.channels} name="this update"
                    onToggle={(next) => updateSharing.onShare(statusNote.id, next)} />
                  <IconButton size="sm" variant="ghost" label="Delete update" className="reveal-on-hover"
                    icon={<Icon icon={Trash} size={14} />} onClick={() => updateSharing.onDelete(statusNote.id)} />
                </>
              )}
            </div>
          </div>
        ) : !canLog ? (
          <EmptyLine className="mb-1 py-0">No update yet.</EmptyLine>
        ) : null}
        {canLog && (
          <div className={composerShell}>
            <Icon icon={Pencil} size={14} className="shrink-0 text-ink-500" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(false); }}
              placeholder={statusNote ? 'Post an update…' : 'Write the first status update, where do things stand?'}
              autoComplete="off" data-1p-ignore data-lpignore="true" className={composerInput} {...inlineEditProps} />
            {/* TWO buttons rather than one button and a mode. A sticky "post to
                client" toggle would sooner or later send a private note to a
                client because it was still switched on from last time, and
                that is not a mistake you can take back. Enter posts the safe
                one; reaching the client is always a deliberate second target. */}
            {draft.trim() && (
              <>
                <Button size="sm" variant="ghost" onClick={() => submit(false)}>Post</Button>
                {updateSharing && (
                  <Button size="sm" variant="secondary" icon={<Icon icon={Eye} size={14} />} onClick={() => submit(true)}>
                    Post to client
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* What else you have told them, most recent first. The answer to "did
            I already say that?" belongs next to the box you would say it in. */}
        {earlier.length > 0 && (
          <div className="mt-3 border-t border-line-soft">
            {earlier.map((u) => (
              <div key={u.id} className="group flex items-center gap-2 border-b border-line-soft py-2">
                <span className="min-w-0 flex-1 truncate text-ui text-ink-600">{u.body}</span>
                <span className="shrink-0 text-caption text-ink-500">{relTime(u.created_at)}</span>
                {updateSharing && (
                  <>
                    <ShareToggle kind="update" item={{ client_visible: isAddressedToClient(u) }}
                      channels={updateSharing.channels} name="this update"
                      onToggle={(next) => updateSharing.onShare(u.id, next)} />
                    <IconButton size="sm" variant="ghost" label="Delete update" className="reveal-on-hover"
                      icon={<Icon icon={Trash} size={14} />} onClick={() => updateSharing.onDelete(u.id)} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* The project's SHAPE sits between the written update and the task
          list: §7E's Overview answers "where does this stand" before "what am
          I doing", and a phase with a date and a count is the whole of that
          answer — the checkpoint list it replaced could only give the date. */}
      <ProjectWorkstreams streams={streams} tasks={tasks} onOpen={onOpenStreams} />

      {/* TRANSITIONAL. Only rows migration 0041 has not folded in yet reach
          here, so this whole section vanishes once it runs. */}
      {milestones && milestones.length > 0 && (
        <ProjectMilestones
          milestones={milestones}
          onAdd={onAddMilestone}
          onToggle={onToggleMilestone}
          onSetDate={onDateMilestone}
          onDelete={onDeleteMilestone}
        />
      )}

      {/* Key tasks — a light hoverable list, no dividers (Notion). */}
      <section className="mt-10">
        <SectionHeading count={open.length}>Key tasks</SectionHeading>
        {key.length === 0
          ? <EmptyLine className="py-0">Nothing open, all clear.</EmptyLine>
          : <div className="flex flex-col">
              {key.map((t) => (
                <div key={t.id} className="group -mx-2 flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors hover:bg-surface-hover">
                  <Checkbox size="sm" checked={false} onCheckedChange={() => onToggle(t.id)} aria-label={`Complete ${t.title}`} className="shrink-0" />
                  <button onClick={() => onOpenTask(t.id)} className="focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui text-ink-800 [@media(pointer:coarse)]:min-h-6">{t.title}</button>
                  {t.highlight && <Icon icon={Highlight} size={14} weight="fill" className="shrink-0 text-ink-600" />}
                </div>
              ))}
            </div>}
      </section>

      {/* Activity */}
      <section className="mt-10">
        <SectionHeading>Activity</SectionHeading>
        {events.length === 0
          ? <EmptyLine className="py-0">No activity yet.</EmptyLine>
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
            ? 'Your client follows this project through a private link: progress, shared docs, and a place to send requests. Manage what they see, or preview it as they would.'
            : 'Share a curated, read-only view of this project: progress, deliverables, and a request inbox, through a private link. No account needed on their side.'}
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
  const [approvals, setApprovals] = useServerState(initial);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const openPageIds = new Set(approvals.filter((a) => a.status === 'awaiting').map((a) => a.page_id));

  async function request(d: PDoc) {
    setBusy(d.id);
    const res = await requestApproval(d.id);
    setBusy(null);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setPick(false);
    // Optimistic: show an awaiting card immediately (reconciles from realtime/refresh).
    if (!openPageIds.has(d.id)) {
      setApprovals((a) => [{ id: tempId(), project_id: '', page_id: d.id, title: d.title, status: 'awaiting', note: null, created_at: new Date().toISOString() }, ...a]);
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
            description={docs.length === 0 ? 'Add a document to this project, then send it to the client for sign-off.' : 'Send a document to the client for sign-off. You’ll see their decision here.'} />
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
                  <span className="text-overline text-ink-500">Client asked for</span>
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
        <StatCard label="Total logged" value={formatMinutes(total)} />
        <StatCard label="Unbilled" value={formatMinutes(unbilled)} hint="not yet invoiced" />
        <StatCard label="Billed" value={formatMinutes(billed)} hint="on an invoice" />
      </div>
      {onInvoice && unbilledCount > 0 && (
        <div className={cn(cardShell, 'mb-3 flex items-center gap-2.5 px-3.5 py-2.5')}>
          <Icon icon={Landmark} size={16} className="shrink-0 text-ink-500" />
          <span className="min-w-0 flex-1 text-ui text-ink-800">
            {formatMinutes(unbilled)} unbilled across {unbilledCount} {unbilledCount === 1 ? 'entry' : 'entries'}.
          </span>
          <Button size="sm" variant="secondary" onClick={onInvoice}>Create invoice</Button>
        </div>
      )}
      <div className={cn(composerShell, 'mb-3 flex-wrap')}>
        <Icon icon={Timer} size={14} className="shrink-0 text-ink-500" />
        <input value={mins} onChange={(e) => setMins(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Minutes" inputMode="numeric" autoComplete="off" data-1p-ignore data-lpignore="true" className={cn(composerInput, 'w-24 flex-none')} />
        <DatePicker aria-label="When" value={date || null} onValueChange={setDate} placeholder="When (optional)" className="w-44" />
        <span className="flex-1" />
        {parseFloat(mins) > 0 && <Button size="sm" variant="secondary" onClick={submit}>Log time</Button>}
      </div>
      {times.length === 0 ? <Empty title="No time logged yet" line="Add minutes above and it'll show up in Finance › Unbilled." /> : (
        <div className={cn(cardShell, 'overflow-hidden')}>
          {times.map((t, i) => (
            <div key={t.id} className={cn('flex items-center gap-2.5 px-3.5 py-3 text-ui', i > 0 && 'border-t border-line-soft')}>
              <span className="w-[70px] shrink-0 text-caption tabular-nums text-ink-500">{fmtDate(t.started_at)}</span>
              <span className="flex-1 tabular-nums text-ink-800">{formatMinutes(t.minutes ?? 0)}</span>
              <Badge status={t.billed ? 'success' : 'neutral'}>{t.billed ? 'Billed' : 'Unbilled'}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ title, line, action }: { title: string; line?: string; action?: React.ReactNode }) {
  return (
    <div className={cardShell}>
      <EmptyState size="inline" title={title} description={line} primary={action} />
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
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} onClick={() => setColor(c)}
                className={cn('focus-ring size-6 rounded-full border-2 transition-colors duration-fast', color === c ? 'border-ink-900' : 'border-transparent')}
                /* The TOKEN, never the stored value: a scope colour is a NAME
                   now, and three of the five names (plum, blue, indigo) are
                   also real CSS colours — so painting the raw value rendered
                   the wrong hue for those three and nothing at all for sage
                   and amber. It looked half-working and never threw. */
                style={{ background: scopeFill(c) }} />
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
              <DatePicker aria-label="Deadline" value={deadline || null} onValueChange={setDeadline} placeholder="Date" className="w-40 shrink-0" />
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
function CloseOutModal({ projectName, doneCount, totalTasks, loggedMinutes, unbilledMinutes, unbilledCount, activitySupported, onInvoice, onSaveRetro, onMakeContent, onClose }: {
  projectName: string; doneCount: number; totalTasks: number; loggedMinutes: number;
  unbilledMinutes: number; unbilledCount: number; activitySupported: boolean;
  onInvoice: () => void; onSaveRetro: (note: string) => void; onClose: () => void;
  /** Scenario D — the finished project becoming content. */
  onMakeContent: (presetIds: string[]) => Promise<void>;
}) {
  const [retro, setRetro] = useState('');
  // Nothing is pre-selected. Offering to make four things and having three of
  // them appear because nobody unticked them is how a pipeline fills with work
  // no one chose.
  const [picked, setPicked] = useState<string[]>([]);
  const [making, setMaking] = useState(false);
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
          {doneCount}/{totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} done · {formatMinutes(loggedMinutes)} logged
        </div>
        {unbilledMinutes > 0 ? (
          <div className={cn(cardShell, 'flex items-center gap-3 px-3.5 py-3')}>
            <div className="min-w-0 flex-1">
              <div className="text-ui text-ink-800"><span className="tabular-nums">{formatMinutes(unbilledMinutes)}</span> unbilled</div>
              <div className="text-caption text-ink-500">across {unbilledCount} {unbilledCount === 1 ? 'entry' : 'entries'} · invoice it before you close.</div>
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

        {/* ── THE PROJECT BECOMES CONTENT (PRODUCT_CONTEXT §15) ────────────
            Finished work is the best marketing a studio ever has, and this is
            the only moment it is fresh. Three months later the project is cold
            and the blank page wins — which is exactly why the offer lives here
            and not in Content, where you would have to remember to go.
            Each piece is created carrying the project and its client, so
            nothing is retyped. */}
        <div>
          <div className="mb-1.5 text-caption text-ink-500">Make content from it</div>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_CONTENT_PRESETS.map((preset) => {
              const on = picked.includes(preset.id);
              return (
                <button key={preset.id} type="button" aria-pressed={on}
                  onClick={() => setPicked((ps) => (on ? ps.filter((x) => x !== preset.id) : [...ps, preset.id]))}
                  className={cn(
                    'focus-ring rounded-full border px-2.5 py-1 text-caption transition-colors duration-fast',
                    on ? 'border-transparent bg-surface-active text-ink-900' : 'border-line text-ink-600 hover:bg-surface-hover',
                  )}>
                  {preset.label}
                </button>
              );
            })}
          </div>
          {picked.length > 0 && (
            <Button size="sm" variant="secondary" className="mt-2.5" loading={making}
              onClick={async () => { setMaking(true); try { await onMakeContent(picked); } finally { setMaking(false); } }}>
              Create {picked.length} {picked.length === 1 ? 'piece' : 'pieces'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

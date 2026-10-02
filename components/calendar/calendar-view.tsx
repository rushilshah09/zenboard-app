'use client';
// Calendar — a native Day / Week / Month calendar over calendar_events in the
// Notion-calendar idiom: a left rail (mini-month + colored calendar lists) beside
// the white grid canvas, a compact toolbar (month · week no. · Today · view · nav),
// and a rich floating event composer. Colored "calendars" come from the semantic
// palette; the rail's checkboxes show/hide events. Create/edit/delete go through
// the events server actions; Google-synced events are editable (edits write back).
// `demoEvents` renders the whole tool on staged local data (dev playground).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, PanelLeft } from "@/components/ds/icons";
import { Icon, Button, IconButton, ButtonGroup, SegmentedControl, toast } from "@/components/ds/ui";
import { CanvasLayout } from '@/components/ui/canvas-layout';
import { createClient } from '@/lib/supabase/client';
import { addEvent, updateEvent, deleteEvent } from '@/lib/actions/events';
import { toggleTask } from '@/lib/actions/tasks';
import { syncGoogleCalendar } from '@/lib/actions/google-calendar';
import {
  type CalEvent, MONTHS, monthCells, weekDays, addDays, addMonths,
  startOfDay, localISODate, isoFromLocal, weekNumber,
} from '@/lib/calendar';
import { calendarOf } from '@/lib/calendar-cats';
import { DEFAULT_EVENT_COLOR } from '@/lib/event-color';
import { formatDay } from '@/lib/date';
import { MonthGrid } from '@/components/calendar/month-grid';
import { WeekGrid } from '@/components/calendar/week-grid';
import { CalendarSidebar, type RailProject } from '@/components/calendar/calendar-sidebar';
import { TaskRail, railDayLabel, type RailTask } from '@/components/calendar/task-rail';
import { timeboxTask } from '@/lib/actions/timebox';
import { timeboxMinutes } from '@/lib/timebox';
import { todayISO } from '@/lib/date';
import { milestonesForCalendar, type CalendarMilestone } from '@/lib/milestones';
import { useRouter } from 'next/navigation';
import type { DateRange } from '@/components/calendar/mini-month';
import { EventComposer, type EditorValues } from '@/components/calendar/event-composer';
import { meetingFromEvent } from '@/lib/actions/meetings';
import { useNarrow } from '@/lib/use-narrow';

const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Write failures go through the app's one feedback channel (§2.5). They used to
// be a private `flash` string rendered inside the bespoke toolbar — a slot the
// shared header doesn't have, and an error that fades from a toolbar corner
// after 3 seconds is barely louder than failing silently.
const fail = (message: string) => toast({ message, variant: 'error' });

type View = 'day' | 'week' | 'month';
const VIEWS: { id: View; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }];
type Editing =
  | { mode: 'create'; values: EditorValues }
  | { mode: 'edit'; id: string; readOnly: boolean; values: EditorValues };

const DEMO_PROJECTS: RailProject[] = [
  { id: 'life', name: 'Life', color: '#D1453E' },
  { id: 'aurora', name: 'Aurora', color: '#3F82D6' },
];

export function CalendarView({ connected = false, spaceId, demoEvents, demoTasks, demoMilestones, demoProjects = DEMO_PROJECTS }: {
  connected?: boolean; spaceId?: string; demoEvents?: CalEvent[]; demoTasks?: RailTask[]; demoMilestones?: CalendarMilestone[];
  /** The rail's projects in demo mode. The website's demo passes its own studio's; the harness keeps the default. */
  demoProjects?: RailProject[];
}) {
  // THE VIEW IS A CHOICE OR A DEFAULT, never a stored guess. On a phone the
  // week grid squeezes seven days into 375px — measured, every event label was
  // cut to ~28px ("K…", "C.") — so a narrow screen opens on the Day view and a
  // wide one on the Week. Derived during render from the app's one viewport
  // hook; the moment you pick a view, that choice wins at every width.
  const narrow = useNarrow(640);
  const [picked, setPicked] = useState<View | null>(null);
  const view: View = picked ?? (narrow ? 'day' : 'week');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [projects, setProjects] = useState<RailProject[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [composerAnchor, setComposerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [rangeSel, setRangeSel] = useState<DateRange | null>(null); // custom range from the mini-month
  // §7D's task rail: open, un-timeboxed work docked beside the grid.
  const [railTasks, setRailTasks] = useState<RailTask[]>([]);
  const [tasksSupported, setTasksSupported] = useState(false);
  const [taskDrag, setTaskDrag] = useState<{ id: string; title: string; minutes: number } | null>(null);
  // Project checkpoints (§7E, 0036). Gated: without the migration the query
  // errors and the calendar renders exactly as it did before.
  const [miles, setMiles] = useState<CalendarMilestone[]>([]);
  const router = useRouter();
  const demo = !!demoEvents;

  // Track the pointer so the composer can open anchored near the click.
  const ptr = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => { ptr.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', onMove, true);

  return () => window.removeEventListener('pointerdown', onMove, true);
  }, []);

  // Collapse the rail on narrow viewports (still user-toggleable).
  useEffect(() => {
    const apply = () => setRailOpen(window.innerWidth >= 1040);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // A selected range overrides the day/week/month view with a custom N-day grid.
  const rangeDays = rangeSel
    ? (() => { const out: Date[] = []; let d = startOfDay(rangeSel.start); const end = startOfDay(rangeSel.end); while (d.getTime() <= end.getTime()) { out.push(d); d = addDays(d, 1); } return out; })()
    : null;
  const isMonth = view === 'month' && !rangeSel;
  const days = rangeDays ?? (view === 'day' ? [anchor] : view === 'week' ? weekDays(anchor) : []);

  const range = rangeSel
    ? { start: startOfDay(rangeSel.start), end: addDays(startOfDay(rangeSel.end), 1) }
    : view === 'month'
      ? (() => { const c = monthCells(anchor); return { start: c[0], end: addDays(c[41], 1) }; })()
      : view === 'week'
        ? (() => { const w = weekDays(anchor); return { start: w[0], end: addDays(w[6], 1) }; })()
        : { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };

  // Completing a task from its calendar block. Optimistic, because the block is
  // under the pointer and a 200ms round trip before the strike-through reads as
  // a missed click; the reload that follows is the correction if it failed.
  const toggleTwin = async (taskId: string, done: boolean) => {
    setEvents((cur) => cur.map((e) => (e.task_id === taskId ? { ...e, task_done: done } : e)));
    if (demoEvents) return;
    const res = await toggleTask(taskId, done);
    if ('error' in res) { fail(res.error); load(); }
  };

  const load = useCallback(async () => {
    if (demoEvents) {
      const s = range.start.getTime(), e = range.end.getTime();
      setEvents(demoEvents.filter((ev) => { const t = new Date(ev.starts_at).getTime(); return t >= s && t < e; }));
      return;
    }
    const sb = createClient();
    const query = (cols: string) => {
      let q = sb.from('calendar_events').select(cols)
        .gte('starts_at', range.start.toISOString())
        .lt('starts_at', range.end.toISOString());
      if (spaceId) q = q.eq('space_id', spaceId);
      return q.order('starts_at');
    };
    // `color` (0012) and `task_id` (0030) only exist after their migration. On a
    // missing column PostgREST names it in the message, so drop that one and
    // retry — one extra round trip per absent column, and only on a database
    // that lacks it. This replaced a hardcoded two-step fallback that could not
    // survive a second optional column.
    const BASE = 'id, title, starts_at, ends_at, all_day, source';
    const optional = ['color', 'task_id'];
    let data: unknown[] | null = null;
    let error: { message: string } | null = null;
    for (let i = 0; i <= optional.length; i++) {
      ({ data, error } = await query([BASE, ...optional].join(', ')) as { data: unknown[] | null; error: { message: string } | null });
      if (!error) break;
      const missing = optional.findIndex((c) => new RegExp(`\\b${c}\\b`, 'i').test(error!.message));
      if (missing < 0) break;
      optional.splice(missing, 1);
    }
    if (error) return;
    const rows = (data as unknown as CalEvent[]) ?? [];

    // A twin block renders the TASK's completion — the event has no `done` of
    // its own (see lib/timebox.ts). Fetched in one follow-up query rather than a
    // PostgREST embed: `tasks` and `calendar_events` reference each other from
    // BOTH sides since 0030, so an embed would be ambiguous and need the
    // constraint name, which is exactly the kind of string that rots silently.
    const twinIds = rows.map((r) => r.task_id).filter((v): v is string => !!v);
    if (twinIds.length) {
      const { data: tasks } = await sb.from('tasks').select('id, done').in('id', twinIds);
      const doneById = new Map((tasks ?? []).map((t) => [t.id, t.done]));
      for (const r of rows) if (r.task_id) r.task_done = doneById.get(r.task_id) ?? false;
    }
    setEvents(rows);
  }, [range.start.getTime(), range.end.getTime(), spaceId, demoEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Rail's PROJECTS list — the user's active projects (or demo samples).
  useEffect(() => {
    if (demo) { setProjects(demoProjects); return; }
    (async () => {
      const sb = createClient();
      let q = sb.from('projects').select('id, name, color').eq('status', 'active');
      if (spaceId) q = q.eq('space_id', spaceId);
      const { data } = await q.order('created_at');
      if (data) setProjects(data.map((p) => ({ id: p.id as string, name: p.name as string, color: (p.color as string) ?? '' })));
    })();
  }, [demo, spaceId, demoProjects]);

  // The rail's tasks: open, top-level, NOT already timeboxed — a task with a
  // block is on the grid, and showing it in both places would invite dragging a
  // second copy of something that already exists. Scheduled-for-a-day and Inbox
  // are the two buckets the app already thinks in (§7A/§7B).
  const loadTasks = useCallback(async () => {
    // The harness seeds the rail directly. Every network path below must stay
    // behind this — a dev-preview that reaches Supabase renders empty and looks
    // like a bug in the feature rather than an absent session.
    if (demoTasks) { setTasksSupported(true); setRailTasks(demoTasks); return; }
    if (demo) { setTasksSupported(false); return; }
    const sb = createClient();
    const day = todayISO();
    // Two LITERAL select strings rather than one built with a template — the
    // Supabase client parses the select at the type level, and an interpolated
    // string parses to an error type instead of a row type.
    const run = (cols: 'id, title, estimate_minutes, scheduled_date, is_inbox, event_id' | 'id, title, estimate_minutes, scheduled_date, is_inbox') => {
      let q = sb.from('tasks')
        .select(cols)
        .eq('done', false)
        .is('parent_task_id', null)
        .or(`scheduled_date.eq.${day},is_inbox.eq.true`)
        .order('sort_order')
        .limit(100);
      if (spaceId) q = q.eq('space_id', spaceId);
      return q;
    };
    // `event_id` arrives with 0030. Without it there are no twins at all, so
    // "not already timeboxed" is trivially true for every row — the rail still
    // works, it just cannot hide blocks that cannot exist.
    let res = await run('id, title, estimate_minutes, scheduled_date, is_inbox, event_id') as { data: unknown[] | null; error: unknown };
    if (res.error) res = await run('id, title, estimate_minutes, scheduled_date, is_inbox') as { data: unknown[] | null; error: unknown };
    const { data, error } = res;
    if (error) { setTasksSupported(false); return; }
    setTasksSupported(true);
    const rows = (data ?? []) as unknown as (RailTask & { event_id?: string | null })[];
    setRailTasks(rows.filter((t) => !t.event_id));
  }, [demo, spaceId, demoTasks]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Give a task a block. Optimistic: the row leaves the rail immediately,
  // because a task that visibly stays put after you drop it reads as a failed
  // drop and invites a second one.
  const dropTask = async (taskId: string, date: string, time: string) => {
    const task = railTasks.find((t) => t.id === taskId);
    setRailTasks((ts) => ts.filter((t) => t.id !== taskId));
    if (demoTasks) {
      // Same shape the real twin gets: the task's estimate as the block length,
      // `task_id` set so it renders with a checkbox like a real twin does.
      const mins = timeboxMinutes(task?.estimate_minutes ?? null);
      const startsAt = isoFromLocal(date, time);
      setEvents((es) => [...es, { id: `demo-twin-${taskId}`, title: task?.title ?? 'Task', starts_at: startsAt,
        ends_at: new Date(Date.parse(startsAt) + mins * 60_000).toISOString(), all_day: false, source: 'zenboard.timebox',
        color: null, task_id: taskId, task_done: false }]);
      toast({ message: `“${task?.title ?? 'Task'}” is on the calendar.` });
      return;
    }
    const res = await timeboxTask(taskId, isoFromLocal(date, time));
    if ('error' in res) {
      fail(res.error);
      loadTasks();
      return;
    }
    load();
    if (task) toast({ message: `“${task.title}” is on the calendar.` });
  };

  // Milestones for the visible window. One query with an embed rather than two:
  // `milestones.project_id` is a single unambiguous FK, so PostgREST can name
  // the relation without a constraint string — unlike the twin's two-way link,
  // where an embed would have needed one (see the loader above).
  //
  // TWO SOURCES, ONE SHAPE, for the length of migration 0041. A dated
  // checkpoint used to be a `milestone`; it is becoming a WORKSTREAM with a
  // date, and both have to render here or the calendar loses dates on
  // whichever side of the migration you are standing.
  //
  //   milestones  minus anything 0041 has stamped
  //   sections    every workstream that carries a due_date
  //
  // After 0041 the first list is empty on its own and this collapses to one
  // real query. `migrated_at` is asked for optimistically and dropped on
  // error, the same retry-instead-of-probe gate the loaders use — on a
  // database that has not run 0041 the column is absent and every checkpoint
  // still shows.
  const loadMilestones = useCallback(async () => {
    if (demoMilestones) { setMiles(demoMilestones); return; }
    if (demo) { setMiles([]); return; }
    const sb = createClient();
    const from = localISODate(range.start);
    const to = localISODate(range.end);
    const cols = 'id, title, done, due_date, sort_order, project_id, projects(name, color)';
    type Row = { id: string; title: string; done: boolean; due_date: string; sort_order: number; project_id: string; projects: { name: string; color: string | null } | null };
    type SecRow = { id: string; name: string; status: string | null; due_date: string; sort_order: number; project_id: string; projects: { name: string; color: string | null } | null };

    const [mRes, sRes] = await Promise.all([
      (async () => {
        const full = await sb.from('milestones').select(cols)
          .not('project_id', 'is', null).not('due_date', 'is', null).is('migrated_at', null)
          .gte('due_date', from).lt('due_date', to);
        if (!full.error) return full;
        return sb.from('milestones').select(cols)
          .not('project_id', 'is', null).not('due_date', 'is', null)
          .gte('due_date', from).lt('due_date', to);
      })(),
      sb.from('sections').select('id, name, status, due_date, sort_order, project_id, projects(name, color)')
        .not('due_date', 'is', null).gte('due_date', from).lt('due_date', to),
    ]);

    const fromMilestones: CalendarMilestone[] = mRes.error ? [] : ((mRes.data as unknown as Row[]) ?? []).map((r) => ({
      id: r.id, title: r.title, done: r.done, due_date: r.due_date, sort_order: r.sort_order,
      projectId: r.project_id,
      projectName: r.projects?.name ?? 'Project',
      projectColor: r.projects?.color ?? null,
    }));
    // `done` from the EXPLICIT status only. A workstream's real done-ness is
    // derived from its tasks (lib/workstreams.ts), and the calendar does not
    // hold them — counting them would cost a second wave for a strike-through.
    // 0041 sets the explicit status on everything it migrates, so a finished
    // checkpoint still reads as finished; a live phase whose last task was
    // just ticked reads as open here until someone says otherwise, which is
    // the conservative direction for a date.
    const fromStreams: CalendarMilestone[] = sRes.error ? [] : ((sRes.data as unknown as SecRow[]) ?? []).map((r) => ({
      id: r.id, title: r.name, done: r.status === 'completed', due_date: r.due_date, sort_order: r.sort_order,
      projectId: r.project_id,
      projectName: r.projects?.name ?? 'Project',
      projectColor: r.projects?.color ?? null,
    }));
    setMiles([...fromMilestones, ...fromStreams]);
  }, [demo, demoMilestones, range.start.getTime(), range.end.getTime()]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  // Bucketed by day through THE projection, so the two grids cannot disagree.
  const milesByDay = useMemo(
    () => milestonesForCalendar(miles, localISODate(range.start), localISODate(range.end)),
    [miles, range.start.getTime(), range.end.getTime()],   // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Pull Google → Zenboard. Runs once on open (if connected) and on demand.
  async function syncNow() {
    if (demo) return;
    setSyncing(true);
    try { await syncGoogleCalendar(); } finally { await load(); setSyncing(false); }
  }
  const didSync = useRef(false);
  useEffect(() => {
    if (!connected || demo || didSync.current) return;
    didSync.current = true;
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Visible events = not hidden by a calendar toggle.
  const visible = useMemo(() => events.filter((e) => !hidden.has(calendarOf(e).id)), [events, hidden]);
  const toggleCal = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Which day the rail's slot menu schedules INTO.
  //
  // A week view shows seven days, so "9:00 AM" alone does not say which one.
  // The rule: TODAY when today is one of the days on screen, otherwise the
  // first day on screen. Browsing this week you get today (what you meant);
  // browsing next week you get that Monday (what you are looking at). Naively
  // taking `days[0]` gave the week's SUNDAY — which on a Monday means the menu
  // offered to schedule into YESTERDAY.
  //
  // The menu prints this day in its header either way, so it is never a guess
  // the user has to make.
  const railDay = (() => {
    const today = todayISO();
    return days.some((d) => localISODate(d) === today) ? today : localISODate(days[0] ?? anchor);
  })();

  const fmtMD = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  const heading = rangeSel
    ? (rangeSel.start.getMonth() === rangeSel.end.getMonth() ? `${MONTHS[rangeSel.start.getMonth()]} ${rangeSel.start.getFullYear()}` : `${fmtMD(rangeSel.start)} – ${fmtMD(rangeSel.end)}`)
    : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const caption = rangeSel
    ? `${fmtMD(rangeSel.start)} – ${fmtMD(rangeSel.end)} · ${(rangeDays?.length ?? 0)} days`
    : view === 'day'
      ? formatDay(anchor, { weekday: 'long' })
      : view === 'week'
        ? `Week ${weekNumber(anchor)}`
        : null;

  // Navigation / view switches exit a custom range back to the normal grid.
  const pickView = (v: View) => { setRangeSel(null); setPicked(v); };
  const goToday = () => { setRangeSel(null); setAnchor(startOfDay(new Date())); };
  const step = (dir: number) => { setRangeSel(null); setAnchor((d) => (view === 'month' ? addMonths(d, dir) : view === 'week' ? addDays(d, dir * 7) : addDays(d, dir))); };

  // ── Editor openers ──
  const openCreate = (date: string, time?: string, allDay = false, endTime?: string) => {
    const start = time ?? '09:00';
    const [h, m] = start.split(':').map(Number);
    const end = endTime ?? `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setComposerAnchor({ ...ptr.current });
    setEditing({ mode: 'create', values: { title: '', date, start, end, allDay, color: DEFAULT_EVENT_COLOR } });
  };
  const openEvent = (e: CalEvent) => {
    const sd = new Date(e.starts_at);
    const ed = e.ends_at ? new Date(e.ends_at) : new Date(sd.getTime() + 3600000);
    setComposerAnchor({ ...ptr.current });
    setEditing({ mode: 'edit', id: e.id, readOnly: false,
      values: { title: e.title, date: localISODate(sd), start: hm(sd), end: hm(ed), allDay: e.all_day, color: e.color ?? DEFAULT_EVENT_COLOR } });
  };
  // Instant recolor while editing (optimistic + persist), like Google Calendar.
  async function recolor(id: string, color: string) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, color } : e)));
    if (demo) return;
    const res = await updateEvent(id, { color });
    if ('error' in res) fail(res.error);
  }

  // ── Mutations (optimistic-ish: act, then refetch; demo mutates locally) ──
  async function save(v: EditorValues) {
    const startsAt = isoFromLocal(v.date, v.allDay ? '00:00' : v.start);
    const endsAt = v.allDay ? null : isoFromLocal(v.date, v.end);
    const cur = editing;
    setEditing(null);
    const color = v.color ?? DEFAULT_EVENT_COLOR;
    if (cur?.mode === 'create') {
      if (demo) { setEvents((es) => [...es, { id: `demo-${Date.now()}`, title: v.title, starts_at: startsAt, ends_at: endsAt, all_day: v.allDay, source: null, color }]); return; }
      const res = await addEvent({ title: v.title, startsAt, endsAt, allDay: v.allDay, color });
      if ('error' in res) fail(res.error); else load();
    } else if (cur?.mode === 'edit') {
      if (demo) { setEvents((es) => es.map((e) => (e.id === cur.id ? { ...e, title: v.title, starts_at: startsAt, ends_at: endsAt, all_day: v.allDay, color } : e))); return; }
      const res = await updateEvent(cur.id, { title: v.title, startsAt, endsAt, allDay: v.allDay, color });
      if ('error' in res) fail(res.error); else load();
    }
  }
  async function remove() {
    const cur = editing;
    setEditing(null);
    if (cur?.mode === 'edit') {
      setEvents((es) => es.filter((e) => e.id !== cur.id)); // optimistic
      if (demo) return;
      const res = await deleteEvent(cur.id);
      if ('error' in res) { fail(res.error); load(); }
    }
  }

  async function moveEvent(id: string, startsAt: string, endsAt: string | null, allDay = false) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, starts_at: startsAt, ends_at: endsAt, all_day: allDay } : e)));
    if (demo) return;
    const res = await updateEvent(id, { startsAt, endsAt, allDay });
    if ('error' in res) { fail(res.error); load(); }
  }


  /**
   * The event's notes — PRODUCT_CONTEXT §14. Idempotent server-side, so a second
   * click opens the notes that already exist rather than starting a rival set;
   * either way it navigates, because the point of the action is to be writing.
   */
  async function takeNotes(eventId: string) {
    const res = await meetingFromEvent(eventId);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setEditing(null);
    router.push(`/clients?meeting=${res.id}`);
  }

  return (
    // Fills the shell's rounded content container directly (no nested panel /
    // outer padding) so the calendar aligns flush with its frame.
    <CanvasLayout
      className="bg-paper"
      title={heading}
      subtitle={caption}
      lead={(
        <>
          <IconButton size="sm" variant="ghost" onClick={() => setRailOpen((v) => !v)} label={railOpen ? 'Hide sidebar' : 'Show sidebar'} icon={<Icon icon={PanelLeft} size={16} />} />
          <ButtonGroup>
            <Button size="sm" variant="outline" iconOnly aria-label="Previous" onClick={() => step(-1)} icon={<Icon icon={ChevronLeft} size={14} />} />
            <Button size="sm" variant="outline" iconOnly aria-label="Next" onClick={() => step(1)} icon={<Icon icon={ChevronRight} size={14} />} />
          </ButtonGroup>
        </>
      )}
      actions={(
        <>
          {connected && !demo && (
            <IconButton size="sm" variant="ghost" onClick={syncNow} disabled={syncing} label="Sync with Google Calendar"
              icon={<Icon icon={RefreshCw} size={16} className={syncing ? 'zb-spin' : undefined} />} />
          )}
          <Button size="sm" variant="outline" onClick={goToday}>Today</Button>

          {/* View switch (Day / Week / Month) — the one DS toggle pattern */}
          <SegmentedControl
            aria-label="Calendar view"
            value={view}
            onValueChange={(v) => pickView(v as View)}
            options={VIEWS.map((vw) => ({ value: vw.id, label: vw.label }))}
          />
        </>
      )}
      overlays={(
        <>
        {editing && (
          <EventComposer
            mode={editing.mode}
            readOnly={editing.mode === 'edit' && editing.readOnly}
            initial={editing.values}
            anchor={composerAnchor}
            onSave={save}
            onDelete={remove}
            onClose={() => setEditing(null)}
            onColorChange={editing.mode === 'edit' ? (c) => recolor(editing.id, c) : undefined}
            onTakeNotes={editing.mode === 'edit' && editing.id ? () => takeNotes(editing.id!) : undefined}
          />
        )}
        </>
      )}
    >

      {/* ── Body: rail + white grid canvas ── */}
      <div className="flex min-h-0 flex-1">
        {railOpen && (
          <aside className="w-[232px] shrink-0 border-r border-line-soft">
            <CalendarSidebar selected={anchor} range={rangeSel}
              onPick={(d) => { setRangeSel(null); setAnchor(startOfDay(d)); if (view === 'month') setPicked(narrow ? 'day' : 'week'); }}
              onSelectRange={(s, e) => { setRangeSel({ start: startOfDay(s), end: startOfDay(e) }); setAnchor(startOfDay(s)); }}
              projects={projects} hidden={hidden} onToggle={toggleCal} onCreate={() => openCreate(localISODate(anchor))} />
          </aside>
        )}
        {/* The grid is the bright surface, so a neutral event card reads against it (on paper-2 the card and the
            grid were the same grey — 2026-09-21). */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper">
          {isMonth
            ? <MonthGrid anchor={anchor} events={visible} onCreateOn={(d) => openCreate(d)} onMove={moveEvent} onOpen={openEvent}
                milestones={milesByDay} onOpenProject={(id) => router.push(`/projects/${id}`)}
                onMore={(d) => { setAnchor(startOfDay(new Date(`${d}T00:00:00`))); setPicked('day'); }} />
            : <WeekGrid days={days} events={visible} onCreateAt={(d, t) => openCreate(d, t)} onCreateRange={(d, s, e) => openCreate(d, s, false, e)} onCreateAllDay={(d) => openCreate(d, undefined, true)} onMove={moveEvent} onOpen={openEvent} onToggleTask={toggleTwin}
                taskDrag={taskDrag} onTaskDrop={dropTask} onTaskDragEnd={() => setTaskDrag(null)}
                milestones={milesByDay} onOpenProject={(id) => router.push(`/projects/${id}`)} />}
        </div>

        {/* §7D's task rail. Month view is deliberately excluded: a month cell is
            a day, not a time, so there is no slot to drop onto and the gesture
            would have to mean something different — which is how a consistent
            interaction becomes two. Hidden below `xl` (drag is desktop-first,
            §7C) and whenever the tasks query is unavailable. */}
        {!isMonth && tasksSupported && (
          <div className="hidden xl:flex">
            <TaskRail
              tasks={railTasks}
              dayISO={railDay}
              dayLabel={railDayLabel(railDay)}
              dragging={taskDrag?.id ?? null}
              onDragStart={(t) => setTaskDrag({ id: t.id, title: t.title, minutes: timeboxMinutes(t.estimate_minutes) })}
              onSchedule={(t, startsAt) => { const d = new Date(startsAt); dropTask(t.id, localISODate(d), hm(d)); }}
              onOpen={(id) => router.push(`/calendar?task=${id}`)}
            />
          </div>
        )}
      </div>

    </CanvasLayout>
  );
}

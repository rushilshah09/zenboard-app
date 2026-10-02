'use client';
// Today — the app home. A single calm reading column on real hub data: the greeting and the day's load, the day's
// one prompt (morning plan / evening shutdown), the highlight, the plan, what is waiting on others, today's content,
// the schedule and habits. Each section handles its own empty/error state so one gap never blanks the page.
// Mutations go through shared server actions; lists update optimistically.
//
// Cards, one per section (the user's call, 2026-09-22: "I really like that card old Home screen"): each section is a
// `Panel` with its header band, so the page reads as a set of things you can act on. Inside the cards the rows share
// one surface and height (components/today/home-rows.ts — the task row's own geometry), a task's facts are the one
// `TaskMeta`, and the page's one filled primary is the plan's "Add", shown while you type.

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Moon, Sunrise, Check, Play, ChevronRight, X, Sun, Flame, type IconType, Highlight } from "@/components/ds/icons";
import { AnchorRow, Button, Icon, IconButton, Mark, TooltipProvider, addLine, toastReverted } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { HOME_SECTION } from '@/components/today/home-rows';
import { ParsedChips } from '@/components/ui/parsed-chips';
import { PageLayout } from '@/components/ui/page-layout';
import { HubLayout } from '@/components/ui/hub-layout';
import { ViewSwap } from '@/components/ds/ui';
import { AskHistoryRail } from '@/components/ask/ask-history-rail';
import { useAskHistory } from '@/components/ask/use-ask-history';
import { useModeParam } from '@/lib/hub-url';
import { formatDayWithWeekday, isoDateIn, todayISO } from '@/lib/date';
import { capacity, DEFAULT_WORK_HOURS, type Span, type WorkHours } from '@/lib/capacity';
import { CapacityLine } from '@/components/capacity/capacity-line';
import { parseTask, type ChipKind } from '@/lib/task-parse';
import { addTask, toggleTask, setHighlight, updateTask } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import { TaskRow } from '@/components/tasks/task-row';
import { TaskMeta } from '@/components/tasks/task-meta';
import { CompletedSection } from '@/components/tasks/completed-section';
import { useSettling, splitSettled } from '@/lib/use-settling';
import { useListCursor, useListKeys } from '@/lib/list-keys';
import { HabitsSection } from '@/components/today/habits-section';
import { ScheduleSection } from '@/components/today/schedule-section';
import { WaitingSection } from '@/components/today/waiting-section';
import { ContentToday } from '@/components/today/content-today';
import type { WaitingItem } from '@/lib/waiting';
import type { CalendarEntry } from '@/lib/content';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';
import { taskOpenHref } from '@/lib/task-address';
import { AskHome } from '@/components/ask/ask-home';
import { LayoutGrid, MessageSquare } from '@/components/ds/icons';
import { SegmentedControl } from '@/components/ds/ui';

/**
 * Home's two modes, as one list — `useModeParam` validates the URL against it and the toggle below
 * is built from the same two values, so a hand-edited `?view=` can never select a mode the control
 * cannot show.
 */
const HOME_MODES = ['dashboard', 'ask'] as const;
type HomeMode = (typeof HOME_MODES)[number];

export type TodayTask = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; elapsed_minutes: number;
  scheduled_date: string | null; project_id: string | null;
  parent_task_id: string | null; completed_at: string | null;
  created_at: string; sort_order: number;
};
export type ProjectChip = { id: string; name: string; color: string | null };
export type TodayHabit = { id: string; title: string; doneToday: boolean; streak: number };
export type TodayEvent = {
  id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean;
  source?: string | null;
  /** 0030's timebox twin. Non-null ⇒ this block IS a task, already counted. */
  task_id?: string | null;
};

/** Stable identity — a fresh `[]` default is a new array every render, which
 *  is the infinite-loop shape this codebase has already been bitten by. */
const NO_WAITING: WaitingItem[] = [];
// Module-level, not `= []`: a fresh array every render is the identity change
// that turns a reconciling hook into an infinite loop (lib/use-server-state.ts).
const NO_CONTENT: CalendarEntry[] = [];

export function TodayView({
  name, initialTasks, waiting = NO_WAITING, content = NO_CONTENT, projects, subByParent, blocked, initialHabits, events, errors, nowHour,
  leftovers = 0, planned = false, shutdown = false,
  meetings = [], workHours = DEFAULT_WORK_HOURS, onVacation = false,
}: {
  name: string;
  initialTasks: TodayTask[];
  /** What is sitting with somebody else (lib/waiting.ts). */
  waiting?: WaitingItem[];
  /** What is filmed and what goes out today — see lib/content.ts. */
  content?: CalendarEntry[];
  projects: Record<string, ProjectChip>;
  subByParent: Record<string, { done: number; total: number }>;
  /** Task ids waiting on something unfinished (§7B). Absent ⇒ nothing blocked. */
  blocked?: string[];
  initialHabits: TodayHabit[];
  events: TodayEvent[];
  errors: { tasks: boolean; habits: boolean; events: boolean };
  /** Override the current hour to stage the time-of-day phase (§7V). Prod leaves it undefined. */
  nowHour?: number;
  /** Open tasks still sitting on yesterday — the morning stage's one number. */
  leftovers?: number;
  /** Today's meetings as minute spans, twins excluded — resolved server-side. */
  meetings?: Span[];
  /** The hours the user says they work (§7C). */
  workHours?: WorkHours;
  /** Today's planning ritual is done. */
  planned?: boolean;
  /** Today's shutdown is done. */
  shutdown?: boolean;
  /** Away today (§7C) — the prompts go quiet; the rituals stay reachable. */
  onVacation?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const openTask = (id: string) => router.push(taskOpenHref(pathname, window.location.search, id));

  const [tasks, setTasks] = useServerState(initialTasks);

  const settling = useSettling();
  const [val, setVal] = useState('');
  // Dismissal is remembered per stage: waving off the morning nudge must not
  // also silence the evening shutdown.
  const [dismissedStage, setDismissedStage] = useState<'morning' | 'evening' | null>(null);
  const [ignored, setIgnored] = useState<Set<ChipKind>>(new Set());

  // The composer speaks the ONE unified grammar (lib/task-parse) — dates,
  // projects, priority, estimate, recurrence — with chips as confirmation.
  // A Set for the row loop — `blocked` arrives as an array because it crosses
  // the server→client boundary, where a Set does not survive serialisation.
  const blockedIds = useMemo(() => new Set(blocked ?? []), [blocked]);
  const projectRefs = useMemo(() => Object.values(projects).map((p) => ({ id: p.id, name: p.name })), [projects]);
  const parsed = useMemo(() => parseTask(val, projectRefs, ignored), [val, projectRefs, ignored]);

  const today = todayISO();
  const dayTasks = tasks.filter((t) => t.scheduled_date === today);
  // A just-ticked task stays in the open list for a beat before settling into
  // Completed — the same rule, and the same hook, as every other task list.
  const { active: open, completed: done } = splitSettled(dayTasks, settling.ids);

  // ── The list keyboard grammar (§6.3), shared with Tasks ───────────────────
  // Same guard, same roving cursor, same ↑ ↓ j k / Enter / Escape — from
  // lib/list-keys.ts, so learning it in Tasks makes it right here. Only the
  // ACTIONS differ, and they differ for a reason:
  //
  //   `e` completes · `h` highlights · `1 2 3` set priority — all meaningful.
  //   `t` (schedule for today) is NOT bound. Everything in this list is already
  //   today, so the key would either do nothing or silently mean something
  //   else; a key that is inert on one screen is better than a key that means
  //   two things.
  //
  // It walks the OPEN list only: the completed group is collapsed behind a
  // disclosure, and a cursor that can travel into rows nobody can see is a
  // cursor that appears to vanish.
  const highlights = tasks.filter((t) => t.highlight && !t.done).slice(0, 3);
  // The plan is the WHOLE day: every open task, the highlighted one included, with its filled star. A pass on
  // 2026-09-22 dropped it from the plan because the card above already held it; the user wanted the full list back
  // with the cards ("I really like that card old Home screen … not remove all").
  const plan = open;
  const cursor = useListCursor(plan.length);

  // Capacity (§7C/§7V) — THE rule, from lib/capacity.ts.
  //
  // This block used to be four local lines with `DAY_BUDGET = 8 * 60` at the
  // bottom of them, while the Week board beside it capped a day at 6h and
  // onboarding asked the user for a third answer that nothing read. Its meeting
  // sum also counted timebox twins, so a fully timeboxed day was charged twice
  // — once for each task's estimate and again for the block holding it.
  const cap = capacity({ tasks: open, meetings, hours: workHours });

  const h = nowHour ?? new Date().getHours();
  const greeting = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  // ── HOME'S TWO MODES (user wireframe, 2026-09-29) ─────────────────────────
  // The dashboard, or the conversation.
  //
  // IT IS IN THE URL, AND IT USED TO BE `useState`. The note here read: "a URL for it would be a
  // second address for the same page". That was right while Ask was one conversation that ended on
  // reload — and it stopped being right the moment chats were KEPT. A conversation is now a record
  // with an id in the address bar (`?chat=`, components/ask/use-ask-history.ts), and a link to a
  // conversation has to LAND in the conversation: with the mode held in a component, `?chat=x`
  // opened the dashboard and quietly ignored the thing the link was about.
  //
  // `useModeParam` is the app's own answer rather than a new one (lib/hub-url.ts): every hub in
  // Zenboard keeps "which mode am I in" in the URL, a MODE pushes history so Back returns you to
  // the dashboard you came from, and the default carries no param at all — so `/today` is still
  // the one address for Home, which is what the old note was protecting.
  const [mode, setMode] = useModeParam<HomeMode>('view', 'dashboard', HOME_MODES);
  const topHighlight = highlights[0] ?? null;

  // ── The day's stage (§7V) ────────────────────────────────────────────────
  // Home is Today staged by time of day, not a dashboard. Before today's plan
  // ritual (and only in the morning) it offers to plan; in the evening — or once
  // everything is done — it offers the shutdown; the rest of the day it just
  // shows the plan and gets out of the way. Previously `nowHour` only chose the
  // greeting, so "Wrap up your day" greeted you at 9am.
  const allDone = open.length === 0 && done.length > 0;
  const stage: 'morning' | 'day' | 'evening' =
    !planned && h >= 5 && h < 12 ? 'morning'
      : (h >= 17 || allDone) ? 'evening'
        : 'day';
  // The shutdown prompt is an evening affordance, and never twice in one day.
  // §7C: vacation "pause[s] rituals". Asking someone to plan a day they said
  // they are not working is the product failing to hear its own setting — so
  // the PROMPTS go quiet while /rituals stays perfectly reachable for anyone
  // who wants to plan a day mid-holiday.
  const showShutdown = stage === 'evening' && !shutdown && dismissedStage !== 'evening' && !onVacation;
  const showPlanPrompt = stage === 'morning' && dismissedStage !== 'morning' && !onVacation;

  // Optimistic, and reverted on failure — the same shape as `toggle`.
  async function setPriorityFor(id: string, priority: 'low' | 'med' | 'high') {
    const before = tasks.find((t) => t.id === id)?.priority;
    if (!before || before === priority) return;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, priority } : t)));
    const res = await updateTask(id, { priority });
    if ('error' in res) { setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, priority: before } : t))); toastReverted(res.error); }
  }


  async function add() {
    const spec = parsed;
    if (!spec.title) return;
    // "Add to today" is the default; an explicit date token (a `when` chip) wins.
    const sched = spec.scheduledDate ?? today;
    setVal('');
    setIgnored(new Set());
    const tmp = tempId();
    setTasks((ts) => [...ts, { id: tmp, title: spec.title, done: false, priority: spec.priority ?? 'low', highlight: false, estimate_minutes: spec.estimateMinutes, elapsed_minutes: 0, scheduled_date: sched, project_id: spec.projectId, parent_task_id: null, completed_at: null, created_at: new Date().toISOString(), sort_order: 9999 }]);
    const res = await addTask({
      title: spec.title,
      scheduledDate: sched,
      dueDate: spec.dueDate,
      priority: spec.priority ?? undefined,
      estimateMinutes: spec.estimateMinutes,
      projectId: spec.projectId,
      recurrence: spec.recurrence,
    });
    if ('id' in res) setTasks((ts) => ts.map((t) => (t.id === tmp ? { ...t, id: res.id } : t)));
    else setTasks((ts) => ts.filter((t) => t.id !== tmp));
  }

  async function toggle(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.done;
    // Start (or cancel) the settle beat before the optimistic write, so the row
    // holds its place instead of vanishing under the finger that just hit it.
    if (nextDone) settling.hold(id); else settling.release(id);
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: nextDone, completed_at: nextDone ? new Date().toISOString() : null } : t)));
    signalTaskToggle(nextDone);
    const res = await toggleTask(id, nextDone);
    if ('error' in res) { setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !nextDone } : t))); toastReverted(res.error); }
  }

  async function toggleHl(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextHl = !target.highlight;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, highlight: nextHl } : t)));
    const res = await setHighlight(id, nextHl);
    if ('error' in res) { setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, highlight: !nextHl } : t))); toastReverted(res.error); }
  }

  useListKeys((e) => {
    if (cursor.arrows(e)) return;
    const t = plan[cursor.index];
    if (!t) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter' || k === 'o') { e.preventDefault(); openTask(t.id); }
    else if (k === 'e') { e.preventDefault(); void toggle(t.id); }
    else if (k === 'h') { e.preventDefault(); void toggleHl(t.id); }
    else if (k === '1') { e.preventDefault(); void setPriorityFor(t.id, 'low'); }
    else if (k === '2') { e.preventDefault(); void setPriorityFor(t.id, 'med'); }
    else if (k === '3') { e.preventDefault(); void setPriorityFor(t.id, 'high'); }
  });

  const chipFor = (t: TodayTask) => (t.project_id ? projects[t.project_id] ?? null : null);

  // Home was one of four screens with no header row, so the shell floated its
  // ••• over the greeting. The scope is the DAY — the greeting says "Good
  // morning, Rushil" but never which day, and Home is Today staged by time of
  // day (§7V). Same shape Habits already uses for the same job. No title
  // duplication: the H1 below is the greeting, not the date.
  // The rail's list loads on FIRST ENTRY to Ask, never on Home's own render — Home's loader is one
  // wave of queries and a conversation list nobody asked for does not belong in front of it.
  const history = useAskHistory({ active: mode === 'ask' });

  // ── ONE PAGE, TWO ARCHETYPES ───────────────────────────────────────────────────────────────
  // Dashboard is a single column you read downward — `PageLayout`, the app's first archetype.
  // Ask, once it remembers its conversations, is a RAIL BESIDE A DETAIL, which is the second
  // archetype and already exists: `HubLayout` owns the two-pane geometry, the responsive stack
  // below `md`, both scroll regions, the rail's landmark — and the COLLAPSE the user asked for
  // by name ("left side of history chat collessable"). Drawing a collapsible column inside Home
  // would have been a third answer to a question the app has already answered twice.
  //
  // The toggle keeps its meaning: Ask is still a way of using Home rather than a different place,
  // which is why the greeting and the Dashboard/Ask control travel INTO the detail pane rather
  // than the page becoming somewhere else when you press it.
  const body = (
    <>
        {/* ── Greeting ── the mark, who and when, what the day holds, how full it is.
               CENTRED, on the toggle's axis (user, 2026-09-29). The toggle below has always been
               centred in the content column and the greeting has always sat on its left edge, so
               the page opened with two competing alignments and the control read as a thing that
               had drifted loose. One axis makes the two a HERO — the mark, the sentence and the
               two ways of using the day, stacked — and the cards below keep the left edge, which
               is where a left edge belongs: on rows you read down.
               `max-w-[58ch]`, because a centred line is read from BOTH ends: the greeting's
               sentence runs to 866px on a wide window, and a centred measure that long makes the
               eye hunt for the start of the next line. */}
        <header className="flex flex-col items-center px-[var(--panel-px)] text-center">
          <div className="mb-2 flex items-center gap-1.5">
            <Mark size={24} />
            <h1 className="font-editorial text-title-2 leading-none font-medium text-balance text-ink-800">{greeting}, {name}.</h1>
          </div>
          <p className="max-w-[58ch] text-ui text-balance text-ink-500">
            {open.length === 0 ? <>Nothing planned for today yet.</> : <>
            You’ve committed to{' '}
            <b className="font-medium text-ink-800">{open.length} {open.length === 1 ? 'task' : 'tasks'}</b>.</>}
            {topHighlight && (
              <>
                {' '}Highlight:{' '}
                <button onClick={() => openTask(topHighlight.id)}
                  className="focus-ring touch-min rounded-xs font-medium text-ink-800 underline-offset-2 hover:underline">
                  {topHighlight.title}.
                </button>
              </>
            )}
          </p>
          {/* Capacity line (§7C): the day's load, in the same words and against the same day as the morning ritual
              and the Week board. Prose here rather than the bar — Home is a glance, the ritual is where you act. */}
          {open.length > 0 && <CapacityLine c={cap} className="mt-2 items-center" />}
        </header>

        {/* ── Home's two modes ── the dashboard, or the conversation (user wireframe, 2026-09-29).
               `<SegmentedControl>` because this is a VIEW TOGGLE and that is what every view toggle
               in this product is — the same control as Month/Quarter/Year and List/Board/Calendar,
               so the gesture is already learned. It is NOT a nav item: Ask is a way of using Home,
               not a different place, and the greeting above stays the page's one title. */}
        <div className="flex justify-center px-[var(--panel-px)] pt-5">
          <SegmentedControl
            aria-label="Home view"
            size="lg"
            value={mode}
            onValueChange={(v) => setMode(v === 'ask' ? 'ask' : 'dashboard')}
            fit="content"
            options={[
              { value: 'dashboard', label: <span className="inline-flex items-center gap-1.5"><Icon icon={LayoutGrid} size={16} />Dashboard</span> },
              { value: 'ask', label: <span className="inline-flex items-center gap-1.5"><Icon icon={MessageSquare} size={16} />Ask</span> },
            ]}
          />
        </div>

        {/* ── THE PANE CHANGES, IT DOES NOT TELEPORT (user, 2026-09-30) ──────────────────────────
               This was a bare ternary: the toggle's thumb slid over 150ms and the entire page
               under it was replaced on the next frame. One half of the interaction animated, so
               the other half's absence was the thing you noticed.
               `<ViewSwap>` is the seam's primitive for it. `direction` is +1 going to Ask and -1
               coming back, because Ask is the RIGHT segment: the pane travels the way the thumb
               just travelled, which is Apple's spatial consistency and its "hint in the direction"
               in one — 8px, a hint rather than a journey, on a control pressed many times a day. */}
        <ViewSwap swapKey={mode} direction={mode === 'ask' ? 1 : -1} className="flex min-h-0 flex-1 flex-col">
        {mode === 'ask' ? <AskHome /> : <>

        {/* ── The day's prompt (§7V) ── only before the plan ritual in the morning, only in the evening for the
               shutdown; the rest of the day Home shows the plan and gets out of the way. */}
        {showPlanPrompt && (
          <StagePrompt icon={Sunrise} title="Plan your day" action="Plan" onAction={() => router.push('/rituals?type=daily_plan')} onDismiss={() => setDismissedStage('morning')}>
            {leftovers > 0
              ? <>{leftovers} {leftovers === 1 ? 'task' : 'tasks'} rolled over from yesterday. Three minutes now decides what today actually is.</>
              : <>Nothing carried over. Pick a highlight and commit to the day before it fills itself.</>}
          </StagePrompt>
        )}
        {showShutdown && (
          <StagePrompt icon={Moon} title="Wrap up your day" action="Shutdown" onAction={() => router.push('/rituals?type=daily_shutdown')} onDismiss={() => setDismissedStage('evening')}>
            {done.length} done, {open.length} still open. A three-minute shutdown decides what carries over and lets you actually stop.
          </StagePrompt>
        )}

        {/* ── Today's highlight ── the task to do first, with the three things you do to it. */}
        <section className={HOME_SECTION}>
          <Panel frame="shadow">
            <PanelHeader
              icon={<Icon icon={Flame} size={20} className={topHighlight ? 'text-[var(--accent)]' : undefined} />}
              title="Today’s highlight"
              summary="Do this first"
              action={topHighlight
                ? <IconButton label="Remove highlight" size="sm" icon={<Icon icon={Highlight} size={16} weight="fill" className="text-[var(--accent)]" />} onClick={() => toggleHl(topHighlight.id)} />
                : <IconButton label="View all tasks" size="sm" icon={<Icon icon={ChevronRight} size={16} />} onClick={() => router.push('/tasks')} />}
            />
            <PanelBody>
              {!topHighlight ? (
                // `<EmptyLine>`, not `<EmptyState>` — the DS says which, in states.tsx: nothing on
                // the screen → EmptyState; something on the screen but THIS PART of it is empty →
                // EmptyLine. Home is four sections, and every one of them used the page-sized
                // state, which is budgeted at 180px each. On a fresh account that is four
                // billboards saying nothing, stacked, instead of the plan the page is for.
                // The header's own "View all tasks" is the action; a Browse button here was the
                // same journey offered twice in one card.
                // An empty CARD still needs a body. One grey sentence in 60px of white is the
                // wireframe look (user, 2026-09-29: "this looks so empty… like a wireframe") — and
                // it is the 2026-09-22 note's own warning, that a card must have weight even when
                // nearly empty. `<AnchorRow>` is the references' row: a glyph to start at, a title,
                // and a line saying what will appear here. Weight at 64px, not at 180.
                <AnchorRow
                  className="px-[var(--panel-px)] py-3.5"
                  icon={<Icon icon={Highlight} size={16} />}
                  title="Nothing highlighted"
                  description="Highlight a task to make it today’s focus, and it surfaces here to tackle first."
                />
              ) : (() => {
                const t = topHighlight;
                return (
                  <>
                    <div className="flex w-full flex-col gap-2 px-[var(--panel-px)] py-4">
                      <button onClick={() => openTask(t.id)}
                        className="focus-ring min-w-0 self-start rounded-xs text-left text-title-3 font-medium text-ink-900 [@media(pointer:coarse)]:min-h-6">
                        {t.title}
                      </button>
                      {/* The same facts, marks and order as the task's row in the plan below. */}
                      <TaskMeta layout="card" project={chipFor(t)} priority={t.priority} sub={subByParent[t.id]}
                        estimate={t.estimate_minutes} blocked={blockedIds.has(t.id)} />
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 border-t border-line-soft px-[var(--panel-px)] py-3">
                      {/* HOME'S ONE BRAND ACTION (2026-09-30). The card above it says "Do this
                          first"; the button that does it was `secondary`, so the screen stated a
                          priority and then drew it in the same grey as "Details". The view's only
                          `primary` was the composer's Add below, which appears only while you are
                          typing — so Home's single spot of colour was transient and its hero action
                          had none. One filled accent per view, and on Home this is it. */}
                      <Button variant="primary" size="sm" icon={<Icon icon={Play} size={16} />} onClick={() => router.push('/focus')}>Start focus</Button>
                      <Button variant="ghost" size="sm" icon={<Icon icon={Check} size={16} />} onClick={() => toggle(t.id)}>Mark done</Button>
                      <Button variant="ghost" size="sm" iconRight={<Icon icon={ChevronRight} size={16} />} onClick={() => openTask(t.id)}>Details</Button>
                    </div>
                  </>
                );
              })()}
            </PanelBody>
          </Panel>
        </section>

        {/* ── Today's plan ── the add line, every open task on the shared row, and the day's Completed group inside
               the same card (it was a second grey box hanging under this one). */}
        <section className={HOME_SECTION}>
          <Panel frame="shadow">
            <PanelHeader
              icon={<Icon icon={Sun} size={20} />}
              title="Today’s plan"
              count={open.length > 0 ? open.length : undefined}
            />
            {/* The rows compact against THIS box: on a phone a row gives up where its task lives so the title keeps
                the width (components/tasks/task-meta.tsx). */}
            <PanelBody className="@container">
              {errors.tasks ? (
                <p className="px-[var(--panel-px)] py-3.5 text-ui text-danger-600">Couldn’t load your tasks. Try refreshing.</p>
              ) : (
                <>
                  {/* The add line in its FIELD shape: the + on the checkboxes' vertical, the caret where the titles
                      start. It speaks the ONE task grammar (lib/task-parse), with chips as confirmation. */}
                  <label className={cn(addLine({ as: 'field', lead: 'checkbox' }), 'border-b border-line-soft')}>
                    <Icon icon={Plus} size={14} className="mx-px shrink-0" />
                    <input
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                      data-chromeless
                      placeholder='Add to today. Try "Call Sam #acme !high 30m"'
                      aria-label="Add a task to today"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500"
                    />
                    {/* SECONDARY, not primary: the filled accent is spent on Start focus above.
                        A composer's submit is a fallback affordance — Enter already adds — so it
                        does not need to outrank the action the screen calls "do this first". */}
                    {parsed.title && <Button variant="secondary" size="sm" onClick={add}>Add</Button>}
                  </label>
                  {/* Parsed chips — the confirmation layer (§7A). One shared surface. */}
                  {parsed.chips.length > 0 && (
                    <div className="border-b border-line-soft px-[var(--panel-px)] py-2">
                      <ParsedChips chips={parsed.chips} onDismiss={(k) => setIgnored((s) => new Set(s).add(k))} />
                    </div>
                  )}
                  {plan.length === 0 && done.length === 0 ? (
                    // The add line is directly above this, so the invitation is already on screen.
                    <AnchorRow
                      className="px-[var(--panel-px)] py-3.5"
                      icon={<Icon icon={Sun} size={16} />}
                      title="Nothing on the plate"
                      description="Capture a task above to start shaping your day."
                    />
                  ) : plan.map((t, i) => (
                    <div key={t.id} ref={cursor.ref(i)} className={cn(settling.ids.has(t.id) && 'animate-settle-out')}>
                      <TaskRow task={t} sub={subByParent[t.id]} project={chipFor(t)} last={i === plan.length - 1 && done.length === 0}
                        blocked={blockedIds.has(t.id)} selected={i === cursor.index}
                        onToggle={() => toggle(t.id)} onOpen={() => openTask(t.id)} onHighlight={() => toggleHl(t.id)}
                        showHighlightBadge={false} showHighlightToggle />
                    </div>
                  ))}
                  {/* The one Completed group, shared with every other task list (components/tasks/completed-section.tsx). */}
                  <CompletedSection count={done.length} className={plan.length === 0 ? 'border-t-0' : undefined}>
                    {done.map((t, i) => (
                      <TaskRow key={t.id} task={t} sub={subByParent[t.id]} project={chipFor(t)} last={i === done.length - 1}
                        onToggle={() => toggle(t.id)} onOpen={() => openTask(t.id)} showHighlightBadge={false} />
                    ))}
                  </CompletedSection>
                </>
              )}
            </PanelBody>
          </Panel>
        </section>

        {/* ── Waiting on others (PRODUCT_THINKING §6) ──
               After the plan and before the schedule: what you can do, then what
               you cannot, then when. Absent entirely when nothing is waiting. */}
        <WaitingSection items={waiting} />

        {/* ── Content today (PRODUCT_THINKING §9) ──
               Beside "waiting", because it answers the same kind of question: what
               today holds that is not on the task list. Absent when nothing is
               being filmed and nothing goes out. */}
        <ContentToday entries={content} />

        {/* ── Schedule ── */}
        <ScheduleSection initialEvents={events} error={errors.events} />

        {/* ── Habits ── */}
        <HabitsSection initialHabits={initialHabits} error={errors.habits} />
        </>}
        </ViewSwap>
    </>
  );

  return (
    <TooltipProvider>
      {mode === 'ask' ? (
        <HubLayout
          // ── IN ASK MODE THE HEADER NAMES THE CHAT, NOT THE DAY ──────────────────────────────
          // Both references head the pane with the conversation's own name ("New chat", or the
          // first thing you said). The day is Dashboard's scope and means nothing to a chat you
          // opened from Tuesday's group in the rail — and CLAUDE.md allows the page ONE title, so
          // it has to be the one that describes what you are looking at.
          title={history.conversations.find((c) => c.id === history.selectedId)?.title ?? 'New chat'}
          subtitle={undefined}
          railLabel="Chats"
          rail={
            <AskHistoryRail
              conversations={history.conversations}
              selectedId={history.selectedId}
              today={todayISO()}
              dayOf={(iso) => isoDateIn(iso) ?? null}
              onSelect={(id) => { void history.select(id); }}
              onNew={history.start}
              onRename={(id, title) => { void history.rename(id, title); }}
              onPin={(id, pinned) => { void history.pin(id, pinned); }}
              onDelete={(id) => { void history.remove(id); }}
              busy={history.busy}
            />
          }
          railPadding={false}
          bleed
        >
          {/* The detail pane owns its own geometry (`bleed`), so the fold height and the column
              come from here rather than from the hub's reading column — the same
              `--page-fill` column Ask had before it gained a rail. */}
          <div className="mx-auto flex min-h-[var(--page-fill)] w-full max-w-[var(--view-maxw)] flex-col px-[var(--view-px)] pt-[var(--view-pt)] pb-[var(--view-pb)]">
            {body}
          </div>
        </HubLayout>
      ) : (
        <PageLayout
          title={formatDayWithWeekday(new Date()) ?? ''}
          subtitle={dayTasks.length > 0 ? `${done.length} of ${dayTasks.length} done` : undefined}
        >
          {body}
        </PageLayout>
      )}
    </TooltipProvider>
  );
}

/**
 * The day's one prompt (§7V) — plan in the morning, wrap up in the evening — in the same card shell as every section
 * on Home: its header names it and can dismiss it, its body says why and offers the ritual.
 */
function StagePrompt({ icon, title, action, onAction, onDismiss, children }: {
  icon: IconType; title: string; action: string; onAction: () => void; onDismiss: () => void; children: React.ReactNode;
}) {
  return (
    <section className={HOME_SECTION}>
      <Panel frame="shadow">
        <PanelHeader
          icon={<Icon icon={icon} size={20} />}
          title={title}
          action={<IconButton label="Dismiss" size="sm" icon={<Icon icon={X} size={16} />} onClick={onDismiss} />}
        />
        <PanelBody>
          <div role="status" className="flex w-full items-center justify-between gap-4 px-[var(--panel-px)] py-3">
            <p className="max-w-[600px] text-ui text-ink-600">{children}</p>
            <Button variant="secondary" size="sm" className="shrink-0" iconRight={<Icon icon={ChevronRight} size={16} />} onClick={onAction}>{action}</Button>
          </div>
        </PanelBody>
      </Panel>
    </section>
  );
}

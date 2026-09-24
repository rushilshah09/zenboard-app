// Tasks — the to-do hub, with two ways of drawing the same tasks: List and
// Board (columns of piles, or `?view=week` for columns of days).
//
// ── ONE WAVE ────────────────────────────────────────────────────────────────
// A round trip to Supabase is ~220ms, so the only number that matters on this
// page is HOW MANY OF THEM HAPPEN IN SERIES. This route used to run six waves,
// and two of them read the SAME whole table:
//
//   1. probe `tasks.list_id`          ← serial, blocked everything below it
//   2. counts: every task in the space (for the rail's three numbers)
//   3. tasks: every task in the space AGAIN (for the list)
//   4. subtask counts, keyed on the ids from (3)
//   5. labels
//   6. task_labels
//
// Now it is one wave. Three things made that possible:
//
//   · THE RAIL'S NUMBERS ARE ALREADY IN THE LIST. `TasksView` computes them
//     from `tasks` in a `useMemo` — the second full-table read was feeding a
//     prop the component then recalculated for itself. Only the WEEK board
//     needs the extra query, because it loads a seven-day window and genuinely
//     cannot derive them.
//   · SUBTASK COUNTS DON'T NEED THE PARENT IDS. "Every subtask in this space"
//     is the same answer as "every subtask of these parents" when the parents
//     are every task in the space, so it stopped waiting for (3).
//   · THE COLUMN PROBE BECAME A RETRY. Asking "does `list_id` exist?" before
//     every query put a whole round trip in front of the page. Selecting it and
//     falling back once on failure costs nothing after the migration is applied
//     and one extra trip before — the same shape `addTask` already uses for
//     `due_date`.
import { createClient } from '@/lib/supabase/server';
import { getWeekDays, weekRangeLabel, todayISO, addDaysISO } from '@/lib/date';
import { userTimezone } from '@/lib/user-tz';
import { TasksView, type TaskItem, type TaskProject } from '@/components/tasks/tasks-view';
import { WeekView, type WeekTask, type WeekProject } from '@/components/week/week-view';
import { TaskViewToggle, BoardGroupBy } from '@/components/tasks/task-view-toggle';
import type { RailCounts, SavedViewDef, ScopeCounts } from '@/components/tasks/types';
import { currentProfile } from '@/lib/profile';
import { readWorkHours } from '@/lib/capacity';
import { readHiddenScopes, taskScopes, type Scope } from '@/lib/task-scopes';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';

type TasksSearchParams = { view?: string; w?: string; scope?: string; list?: string; filter?: string; label?: string };
type DB = Awaited<ReturnType<typeof createClient>>;

export const dynamic = 'force-dynamic';

const TASK_COLUMNS = 'id, title, done, priority, highlight, estimate_minutes, scheduled_date, is_inbox, project_id, recurrence, parent_task_id, created_at';
const WEEK_COLUMNS = 'id, title, done, priority, highlight, estimate_minutes, scheduled_date, is_inbox, project_id, parent_task_id, sort_order, recurrence';

/**
 * Run a query that names `list_id`, falling back once if the column isn't there.
 *
 * The capability gate, without the round trip it used to cost. `supported` is
 * what the rail reads to decide whether to offer Lists at all — derived from
 * whether the optimistic query worked, so it can never disagree with the data
 * that came back beside it.
 */
async function withListColumn<T>(
  run: (cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  base: string,
): Promise<{ rows: T[]; supported: boolean }> {
  const first = await run(`${base}, list_id`);
  if (!first.error) return { rows: (first.data as T[]) ?? [], supported: true };
  const second = await run(base);
  return { rows: (second.data as T[]) ?? [], supported: false };
}

/** Every subtask in the space, tallied by parent. Deliberately NOT keyed on the
 *  ids of the tasks we just loaded — that dependency is what made it a second
 *  wave, and the answer is identical when the parents are the whole space. */
async function subtaskCounts(supabase: DB, sid: string) {
  const { data } = await supabase
    .from('tasks').select('parent_task_id, done')
    .eq('space_id', sid).not('parent_task_id', 'is', null);
  const byParent: Record<string, { done: number; total: number }> = {};
  for (const s of (data as { parent_task_id: string; done: boolean }[]) ?? []) {
    const e = byParent[s.parent_task_id] ?? { done: 0, total: 0 };
    e.total++; if (s.done) e.done++; byParent[s.parent_task_id] = e;
  }
  return byParent;
}

type CountRow = { done: boolean; is_inbox: boolean; scheduled_date: string | null; project_id: string | null; list_id?: string | null };

/** The rail's numbers, from tasks already in memory. No query — the list has
 *  every row it needs, and reading the whole table a second time to count it
 *  was the single most expensive thing this route did. */
function countsFrom(rows: CountRow[], today: string): { rail: RailCounts; scopes: ScopeCounts } {
  const scopes: ScopeCounts = {};
  let inbox = 0, todayCount = 0, completed = 0;
  for (const t of rows) {
    if (t.done) { completed++; continue; }
    if (t.is_inbox) inbox++;
    else if (t.scheduled_date === today) todayCount++;
    for (const k of taskScopes(t)) scopes[k] = (scopes[k] ?? 0) + 1;
  }
  return { rail: { inbox, today: todayCount, completed }, scopes };
}

/** Saved views (0015) and lists (0038) — both probed by their own SELECT, both
 *  inside the wave, both degrading to a hidden section. */
async function loadSavedViews(supabase: DB, sid: string) {
  const sv = await supabase.from('saved_views').select('id, name, filter').eq('space_id', sid).order('sort_order');
  if (sv.error) return { supported: false, views: [] as SavedViewDef[] };
  return { supported: true, views: (sv.data as SavedViewDef[]) ?? [] };
}

async function loadLists(supabase: DB, sid: string) {
  const res = await supabase.from('task_lists').select('id, name, color').eq('space_id', sid).order('sort_order').order('name');
  if (res.error) return { supported: false, lists: [] as Scope[] };
  const rows = (res.data as { id: string; name: string; color: string | null }[]) ?? [];
  return { supported: true, lists: rows.map((r): Scope => ({ kind: 'list', id: r.id, name: r.name, color: r.color })) };
}

/** Labels (0014) and their task assignments, asked for TOGETHER. The
 *  assignments used to wait for the labels so an account with none could skip
 *  the read, but an account with no labels has no assignments either: the wait
 *  saved one empty response and cost everyone else a round trip in series. */
async function loadLabels(supabase: DB, sid: string) {
  const [lab, tl] = await Promise.all([
    supabase.from('labels').select('id, name, color').eq('space_id', sid).order('sort_order').order('name'),
    supabase.from('task_labels').select('task_id, label_id'),
  ]);
  if (lab.error) return { labels: [] as { id: string; name: string; color: string | null }[], taskLabels: {} as Record<string, string[]> };
  const taskLabels: Record<string, string[]> = {};
  if ((lab.data ?? []).length === 0) return { labels: [], taskLabels };
  if (!tl.error) for (const r of tl.data ?? []) (taskLabels[r.task_id] ??= []).push(r.label_id);
  return { labels: lab.data ?? [], taskLabels };
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<TasksSearchParams> }) {
  const sp = await searchParams;
  const { supabase, sid } = await pageScope();
  // Free: both read rows the (app) layout already fetched on this request
  // (`currentProfile` is cache()d, and `userTimezone` reads it).
  const profile = await currentProfile();
  const today = todayISO(await userTimezone());

  const isWeek = sp.view === 'week';
  const offset = Number.parseInt(sp.w ?? '0', 10) || 0;
  // Anchored to `today`, which is already resolved in the USER's timezone — this
  // used to re-derive "now" from the clock and so could sit on a different day
  // than the rest of the page for anyone not on UTC.
  const days = getWeekDays(new Date(`${addDaysISO(today, offset * 7)}T00:00:00Z`));

  // ── THE WAVE ──
  const [taskRes, projectRes, subByParent, savedViewsData, listData, labelData, weekCountRes] = await Promise.all([
    isWeek
      ? withListColumn<WeekTask>(
        (cols) => supabase.from('tasks').select(cols)
          .eq('space_id', sid).is('parent_task_id', null)
          .or(`and(scheduled_date.gte.${days[0].id},scheduled_date.lte.${days[6].id}),is_inbox.eq.true`)
          .order('sort_order').order('created_at'),
        WEEK_COLUMNS,
      )
      : withListColumn<TaskItem>(
        // created_at is selected, not just ordered by: the Inbox view's Triage
        // drains oldest-first and shows each thought's age.
        (cols) => supabase.from('tasks').select(cols)
          .eq('space_id', sid).is('parent_task_id', null)
          .order('sort_order').order('created_at'),
        TASK_COLUMNS,
      ),
    supabase.from('projects').select('id, name, color').eq('space_id', sid),
    subtaskCounts(supabase, sid),
    loadSavedViews(supabase, sid),
    loadLists(supabase, sid),
    isWeek ? Promise.resolve({ labels: [], taskLabels: {} }) : loadLabels(supabase, sid),
    // The board loads a seven-day window, so it is the one branch that cannot
    // count the rail from what it already has.
    isWeek
      ? supabase.from('tasks').select('done, is_inbox, scheduled_date, project_id')
        .eq('space_id', sid).is('parent_task_id', null)
      : Promise.resolve(null),
  ]);

  // Both halves of 0038 have to be there before Lists are offered: a table with
  // no column would draw a rail section that cannot file anything into it.
  const listsSupported = listData.supported && taskRes.supported;
  const hiddenScopes = [...readHiddenScopes(profile?.preferences)];
  const projectRows = (projectRes.data as { id: string; name: string; color: string | null }[]) ?? [];

  if (isWeek) {
    const counts = countsFrom((weekCountRes?.data as CountRow[]) ?? [], today);
    const projMap: Record<string, WeekProject> = {};
    for (const p of projectRows) projMap[p.id] = p;
    return (
      <>
        <PageStamp />
        <WeekView days={days} initialTasks={taskRes.rows as WeekTask[]} projects={projMap} subByParent={subByParent}
          rangeLabel={weekRangeLabel(days)} offset={offset}
          viewSwitch={<><BoardGroupBy group="week" /><TaskViewToggle view="week" /></>}
          railCounts={counts.rail} scopeCounts={counts.scopes}
          lists={listData.lists} listsSupported={listsSupported} hiddenScopes={hiddenScopes}
          savedViews={savedViewsData.views} savedViewsSupported={savedViewsData.supported}
          workHours={readWorkHours(profile?.preferences)} />
      </>
    );
  }

  const items = taskRes.rows as TaskItem[];
  const projMap: Record<string, TaskProject> = {};
  for (const p of projectRows) projMap[p.id] = p;

  // NO `key`, and no view/scope/filter props.
  //
  // This component used to be keyed on the rail combo, which meant every rail
  // click remounted it and re-ran this whole loader — to redraw a subset of the
  // tasks the browser already had. The combo lives in the URL still, but the
  // component reads it itself with `useSearchParams` and changes it with
  // `pushState`, so those clicks never reach here. What the server sends is the
  // DATA; what the URL says about it is the client's business.
  return (
    <>
      <PageStamp />
      <TasksView
        initialTasks={items} projects={projMap} subByParent={subByParent}
        labels={labelData.labels} taskLabels={labelData.taskLabels}
        savedViews={savedViewsData.views} savedViewsSupported={savedViewsData.supported}
        lists={listData.lists} listsSupported={listsSupported} hiddenScopes={hiddenScopes}
      />
    </>
  );
}

// Loader for the Today home (/today). Pulls the day's top-level tasks (scheduled
// today, plus undated highlights), their subtask counts + project chips, today's
// calendar events, and active habits with today's check-off and current streak.
// Each source is fetched independently so one failure can't blank the page.
import { waitingOn, type WaitingItem, type WaitingSources } from '@/lib/waiting';
import { readContent, contentToday, type CalendarEntry, type Piece } from '@/lib/content';
import { createClient } from '@/lib/supabase/server';
import { userTimezone } from '@/lib/user-tz';
import { todayISO, addDaysISO, minutesOfDayIn, dayWindow } from '@/lib/date';
import { todaysPlanFilter } from '@/lib/todays-plan';
import { toSchedule, isDue, currentStreak } from '@/lib/habit-schedule';
import type { TodayTask, TodayHabit, TodayEvent, ProjectChip } from '@/components/today/today-view';
import { blockedSet } from '@/lib/task-links';
import { isTwin } from '@/lib/timebox';
import { currentProfile } from '@/lib/profile';
import { readWorkHours, type Span, type WorkHours } from '@/lib/capacity';
import { readVacationUntil, vacationDaysIn, onVacation } from '@/lib/vacation';
import { pageScope } from '@/lib/page-scope';

// One day, resolved once, in the USER's zone. This function used to disagree
// with itself: `today` came from `toISOString()` (UTC) while the event window
// came from `getFullYear()/getMonth()/getDate()` (the runtime's local time,
// which on Cloudflare is also UTC). So an IST user got yesterday's task list
// between midnight and 05:30 — every night — and the two halves of the same
// "day" could describe different dates.
async function dayBounds() {
  const tz = await userTimezone();
  const today = todayISO(tz);
  return { tz, today, ...dayWindow(today, tz) };
}

// Streaks are NOT computed here. `lib/habit-schedule.ts` is the one place that
// knows which days a habit was due, and therefore the only place that can say
// what an unbroken run is: a local copy of the walk would report a Mon/Wed/Fri
// habit's perfect record as a 1-day streak, which is exactly the bug the
// schedule module exists to kill. Home and /habits must agree — they are the
// same numbers about the same habits, forty pixels apart in the user's day.

export type TodayData = {
  tasks: TodayTask[];
  /** What is sitting with somebody else — see lib/waiting.ts. */
  waiting: WaitingItem[];
  /** What is being filmed and what goes out today (PRODUCT_THINKING §9). */
  content: CalendarEntry[];
  /** Today's meetings as minute spans, twins and all-day events excluded (§7C). */
  meetings: Span[];
  /** The hours the user says they work — the day the plan is measured against. */
  workHours: WorkHours;
  subByParent: Record<string, { done: number; total: number }>;
  /**
   * Task ids waiting on something unfinished (§7B, gated on 0032). An ARRAY,
   * not a Set: this crosses the server→client boundary, where a Set does not
   * survive serialisation.
   */
  blocked: string[];
  projects: Record<string, ProjectChip>;
  habits: TodayHabit[];
  events: TodayEvent[];
  today: string;
  /** Open tasks left scheduled on yesterday — the morning stage's one number (§7V). */
  leftovers: number;
  /** Has today's planning ritual been completed? Decides morning vs day stage. */
  planned: boolean;
  /** Has today's shutdown already run? Suppresses the evening prompt afterwards. */
  shutdown: boolean;
  /** Away today (§7C). Silences the plan/shutdown prompts without disabling them. */
  onVacation: boolean;
  errors: { tasks: boolean; habits: boolean; events: boolean };
};

// Active habits with today's check-off + current streak. Shared by the Today
// home and the dedicated Habits page so the two never drift.
type HabitRow = { id: string; title: string; schedule_kind?: string | null; schedule_days?: number[] | null; schedule_count?: number | null };

async function fetchHabits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sid: string,
  today: string,
  /**
   * Days away, which a streak must not judge (§7C, "without loss"). Home reads
   * the SAME streak numbers as /habits, so it has to be told the same thing —
   * that agreement is the whole reason `lib/habit-schedule.ts` exists.
   */
  vacationDays: string[] = [],
): Promise<{ habits: TodayHabit[]; error: boolean }> {
  // Schedule columns first (migration 0025 §3); fall back to the plain list so
  // Home keeps working before it's applied, with every habit read as daily.
  //
  // The logs go out WITH the list, not after it. They do not depend on it (RLS
  // scopes them to this user, and a log is only ever looked up by a listed
  // habit), so waiting for the list first put a whole round trip in series on
  // every Home load. An account with no habits has no logs to download.
  const since = addDaysISO(today, -120);
  const [firstHabits, logsRes] = await Promise.all([
    supabase
      .from('habits')
      .select('id, title, schedule_kind, schedule_days, schedule_count')
      .eq('space_id', sid)
      .eq('active', true)
      .order('created_at'),
    supabase
      .from('habit_logs')
      .select('habit_id, log_date, done')
      .gte('log_date', since)
      .eq('done', true),
  ]);
  let habitsRes = firstHabits;
  if (habitsRes.error) {
    habitsRes = await supabase
      .from('habits')
      .select('id, title')
      .eq('space_id', sid)
      .eq('active', true)
      .order('created_at') as typeof habitsRes;
  }
  const habitRows = (habitsRes.data as unknown as HabitRow[]) ?? [];
  let habits: TodayHabit[] = [];
  if (habitRows.length) {
    const byHabit = new Map<string, Set<string>>();
    for (const l of (logsRes.data as { habit_id: string; log_date: string }[]) ?? []) {
      const set = byHabit.get(l.habit_id) ?? new Set<string>();
      set.add(l.log_date);
      byHabit.set(l.habit_id, set);
    }
    habits = habitRows
      .map((h) => ({ row: h, schedule: toSchedule(h) }))
      // Only what's due today. A habit that doesn't happen on a Tuesday has no
      // business sitting unchecked in the morning ritual every Tuesday — an
      // unchecked row reads as a debt no matter what the arithmetic says.
      .filter(({ schedule }) => isDue(schedule, today))
      .map(({ row, schedule }) => {
        const dates = byHabit.get(row.id) ?? new Set<string>();
        return {
          id: row.id,
          title: row.title,
          doneToday: dates.has(today),
          streak: currentStreak(schedule, today, dates, new Set(vacationDays)).value,
        };
      });
  }
  return { habits, error: !!habitsRes.error };
}

// Loader for the dedicated Habits page (/habits).
export async function loadHabits(): Promise<{ habits: TodayHabit[]; error: boolean }> {
  const { supabase, sid } = await pageScope();
  const { today } = await dayBounds();
  const { today: day } = await dayBounds();
  return fetchHabits(supabase, sid, today, vacationDaysIn(addDaysISO(day, -120), day, readVacationUntil((await currentProfile())?.preferences)));
}

export async function loadTodayData(): Promise<TodayData> {
  const { supabase, sid } = await pageScope();
  const { tz, today, startISO, endISO } = await dayBounds();

  // Everything Home needs that does not depend on anything else goes out AT ONCE.
  // These four were awaited one after another, and at ~220ms per round trip to
  // Supabase that was most of a second of Home doing nothing but waiting for
  // answers it could have asked for together. Tasks, the day's events, habits and
  // the stage counters are independent questions.
  const yesterday = addDaysISO(today, -1);
  // STARTED, NOT AWAITED. `currentProfile()` used to be awaited INSIDE the
  // Promise.all argument list below (for the habits element's vacation window).
  // A Supabase query builder is a thenable that only issues its request when
  // `.then()` is called — which is what Promise.all does — so an `await` part
  // way through building that array suspends construction and NOT ONE query in
  // the wave had started. The whole of Home queued behind a single profile read.
  //
  // `cache()` does not save you here: it dedupes the request the layout also
  // makes, but a layout and a page render CONCURRENTLY, so the page still waits
  // for the answer. Kicking the promise off first turns (profile → wave) into
  // max(profile, wave) — one round trip off Home, measured at ~228ms median RTT.
  const profileP = currentProfile();
  const [tasksRes, evRes, habitsResult, [leftoverRes, ritualRes], waitingRes, contentRes] = await Promise.all([
    // ── Tasks: top-level tasks scheduled today, plus undated highlights ──
    supabase
      .from('tasks')
      .select('id, title, done, priority, highlight, estimate_minutes, elapsed_minutes, scheduled_date, project_id, parent_task_id, completed_at, created_at, sort_order')
      .eq('space_id', sid)
      .is('parent_task_id', null)
      .or(todaysPlanFilter(today))
      .order('sort_order')
      .order('created_at'),
    // ── Calendar events for today ──
    supabase
      .from('calendar_events')
      .select('id, title, starts_at, ends_at, all_day, source, task_id')
      .eq('space_id', sid)
      .gte('starts_at', startISO)
      .lt('starts_at', endISO)
      .order('starts_at'),
    // ── Habits: active habits + today's check-off + streak ──
    // The await now lives INSIDE this element, so it suspends only this branch
    // rather than the construction of the array around it.
    (async () => fetchHabits(
      supabase, sid, today,
      vacationDaysIn(addDaysISO(today, -120), today, readVacationUntil((await profileP)?.preferences)),
    ))(),
    // ── What stage of the day is this? (§7V) ──
    // Two cheap reads decide whether Home greets you with "plan the day", the
    // plan itself, or the shutdown. Both degrade to the neutral answer on error,
    // so a failed count can never strand Home in the wrong stage.
    Promise.all([
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('space_id', sid)
        .is('parent_task_id', null)
        .eq('scheduled_date', yesterday)
        .eq('done', false),
      supabase
        .from('rituals')
        .select('type, completed_at')
        .eq('ritual_date', today)
        .not('completed_at', 'is', null),
    ]),
    // ── What is waiting on somebody else? (PRODUCT_THINKING §3, §6) ──
    // Three reads that answer the one Today question the app could not:
    // an approval nobody has decided, a question the client has not answered,
    // an invoice issued and unpaid. Each already lived on its own screen.
    //
    // Every one degrades to an empty list on error — a missing migration or a
    // failed read must leave the section absent, never show a WRONG "nothing is
    // waiting", which is the one answer here that would actively mislead.
    (async () => {
      // FILTER IN SQL, NOT IN JS. `waitingOn()` keeps only `awaiting` approvals,
      // `needs_info` requests and `sent`/`overdue` invoices — every other row was
      // fetched across the wire and then dropped. For an established studio that
      // is every invoice ever paid and every approval ever decided, downloaded on
      // each Home load to show a handful of open items. The predicates below are
      // exactly the ones lib/waiting.ts applies; they must stay in step, which is
      // asserted in lib/today-data.test.ts.
      // The bound is defensive rather than expected to bite, so it is ordered:
      // a truncated set must drop the NEWEST items, never arbitrary ones, because
      // this list is read oldest-first.
      const [approvals, requests, invoices, projects] = await Promise.all([
        supabase.from('approvals').select('id, title, status, created_at, project_id')
          .eq('status', 'awaiting').order('created_at').limit(200),
        supabase.from('client_requests').select('id, title, body, status, created_at, project_id')
          .eq('status', 'needs_info').order('created_at').limit(200),
        supabase.from('invoices').select('id, number, status, due_date, issue_date, client_id')
          .in('status', ['sent', 'overdue']).order('issue_date').limit(200),
        // Every project this person can see, not only this space's: the same
        // read names today's project chips (below), which used to be a query
        // of its own that waited for the task list. Client names ride along as
        // an embed instead of a read that waited for this one.
        supabase.from('projects').select('id, name, color, client_id, space_id, client:clients(name)'),
      ]);
      return { approvals, requests, invoices, projects };
    })(),

    // ── What is happening with content today? (PRODUCT_THINKING §9) ──
    // A studio's own output has to reach the screen the day starts on, or the
    // module is a place you have to REMEMBER to visit — and the one thing Home
    // exists to remove is having to remember where to look. Degrades to nothing
    // on error, like every other source here.
    // `content` is the WHOLE DOCUMENT BODY — every block of every content piece.
    // `readContent()` reads exactly one key out of it (`content.pipeline`, a
    // ~30-byte object), so Home was pulling entire documents over the wire to
    // read a stage and two dates. PostgREST returns the sub-object directly,
    // aliased to `pipeline`.
    //
    // TRAP, verified against the live DB: a MISTYPED path does not error — it
    // returns 200 with the key set to `null` on every row, which `readContent`
    // would silently turn into a default 'idea' stage for the whole studio. The
    // exact select string is asserted in lib/today-data.test.ts for that reason.
    supabase.from('pages')
      .select('id, title, content->pipeline')
      .eq('space_id', sid).eq('type', 'content').is('archived_at', null),
  ]);

  // Filtering in JS rather than SQL: both dates live inside the content JSON,
  // and a jsonb path filter on a key that may be absent is the trap that made
  // the morning digest match no rows at all. The set is a studio's pieces, not
  // a feed.
  // `readContent` takes the content ROOT and reads `.pipeline` off it, so the
  // selected sub-object is handed back in that shape rather than reaching into
  // the function. Absent/!object pipelines fall through to its own defaults.
  const contentPieces: Piece[] = ((contentRes.data as { id: string; title: string | null; pipeline: unknown }[] | null) ?? [])
    .map((r) => ({ id: r.id, title: r.title, meta: readContent({ pipeline: r.pipeline }) }));

  const tasks = (tasksRes.data as TodayTask[]) ?? [];
  const events = (evRes.data as TodayEvent[]) ?? [];
  const { habits, error: habitsError } = habitsResult;
  const ritualRows = (ritualRes.data as { type: string }[]) ?? [];

  // The second and last wave: both of these need the task ids, and neither needs
  // the other, so they go together too. (Project chips used to be a third read
  // here; they come from the waiting section's project read now.)
  const parentIds = tasks.map((t) => t.id);
  const [subRes, linkRes] = await Promise.all([
    parentIds.length
      ? supabase.from('tasks').select('parent_task_id, done').in('parent_task_id', parentIds)
      : null,
    // Dependencies (0032, §7B). Scoped to today's tasks, so this is a handful
    // of rows or — for almost everyone — none. Errors when the migration is
    // absent, which is exactly the gate: no table, no blocked rows, no change.
    // Each blocker's completion rides along as an embed; it used to be one
    // more round trip in series, waiting for these rows to name the blockers.
    parentIds.length
      ? supabase.from('task_links').select('task_id, blocked_by_task_id, blocker:tasks!blocked_by_task_id(done)').in('task_id', parentIds)
      : null,
  ]);

  // Subtask counts for those parents (single query, scoped to the day's tasks).
  const subByParent: Record<string, { done: number; total: number }> = {};
  for (const s of (subRes?.data as { parent_task_id: string; done: boolean }[]) ?? []) {
    const e = subByParent[s.parent_task_id] ?? { done: 0, total: 0 };
    e.total++;
    if (s.done) e.done++;
    subByParent[s.parent_task_id] = e;
  }

  // Project chips for any tasks that belong to a project, from the projects the
  // waiting section already read. Only the chips today's tasks use are sent,
  // exactly as before: the read is wider than the payload.
  const allProjects = (waitingRes.projects.error ? [] : waitingRes.projects.data ?? []) as unknown as {
    id: string; name: string; color: string | null; client_id: string | null; space_id: string; client: { name: string } | null;
  }[];
  const projectById = new Map(allProjects.map((p) => [p.id, p]));
  const projects: Record<string, ProjectChip> = {};
  for (const t of tasks) {
    const p = t.project_id ? projectById.get(t.project_id) : undefined;
    if (p) projects[p.id] = { id: p.id, name: p.name, color: p.color };
  }

  // Which of today's tasks are waiting on something unfinished (§7B). Each
  // blocker's completion arrived with its link, so this costs no round trip. A
  // blocker that is gone embeds as null, reads as unfinished, and keeps the task
  // blocked, as it did when this was a separate read.
  let blocked: string[] = [];
  const links = ((linkRes?.data ?? []) as unknown as { task_id: string; blocked_by_task_id: string; blocker: { done: boolean | null } | null }[]);
  if (links.length) {
    const doneById = new Map(links.map((l) => [l.blocked_by_task_id, !!l.blocker?.done]));
    // `blockedSet` is THE rule (lib/task-links.ts) — the drawer's chip and this
    // list must never disagree about what "blocked" means.
    blocked = [...blockedSet(links, (id) => doneById.get(id) ?? false)];
  }

  // §7C capacity, resolved here rather than in the view. `minutesOfDayIn` needs
  // the user's zone, and Home is a `'use client'` component — server-rendered
  // first, where the runtime is UTC — so doing this after the boundary would
  // render one set of numbers on the server and another in the browser.
  const meetings: Span[] = events
    // An all-day event is a label on the day, not an hour of it. A TIMEBOX TWIN
    // is the task's own estimate placed on the clock (0030) — Home has been
    // counting both the task AND its block since twins shipped, charging a
    // timeboxed day twice.
    .filter((e) => !e.all_day && !!e.ends_at && !isTwin(e))
    .map((e) => ({ start: minutesOfDayIn(e.starts_at, tz), end: minutesOfDayIn(e.ends_at, tz) }))
    .filter((s): s is Span => s.start !== undefined && s.end !== undefined);

  // Client names for the waiting rows, from the embed on the projects read;
  // they used to be a read of their own that waited for it. Scoped to this
  // space's projects exactly as before: the same names serve the approvals and
  // requests (through their project) and the invoices (through their client).
  const w = waitingRes;
  const wProjects = allProjects.filter((p) => p.space_id === sid);
  const clientNames = new Map<string, string>();
  for (const p of wProjects) if (p.client_id && p.client?.name) clientNames.set(p.client_id, p.client.name);
  const clientOf: Record<string, string | null> = {};
  for (const pr of wProjects) clientOf[pr.id] = pr.client_id ? clientNames.get(pr.client_id) ?? null : null;

  const waiting = waitingOn({
    approvals: (w.approvals.error ? [] : w.approvals.data ?? []) as WaitingSources['approvals'],
    requests: (w.requests.error ? [] : w.requests.data ?? []) as WaitingSources['requests'],
    invoices: ((w.invoices.error ? [] : w.invoices.data ?? []) as (WaitingSources['invoices'][number] & { client_id?: string | null })[])
      .map((i) => ({ ...i, client_name: i.client_id ? clientNames.get(i.client_id) ?? null : null })),
    clientOf,
  }, today);

  return {
    tasks,
    waiting,
    content: contentToday(contentPieces, today),
    subByParent,
    projects,
    blocked,
    habits,
    events,
    meetings,
    workHours: readWorkHours((await currentProfile())?.preferences),
    today,
    leftovers: leftoverRes.count ?? 0,
    planned: ritualRows.some((r) => r.type === 'daily_plan'),
    shutdown: ritualRows.some((r) => r.type === 'daily_shutdown'),
    onVacation: onVacation(today, readVacationUntil((await currentProfile())?.preferences)),
    errors: { tasks: !!tasksRes.error, habits: habitsError, events: !!evRes.error },
  };
}

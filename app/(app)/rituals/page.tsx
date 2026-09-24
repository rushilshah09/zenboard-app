// Rituals — daily planning / shutdown / weekly review guided flows.
import { RitualFlow, type RitualType, type RTask, type RGoal, type RProject, type RHabit, type RMemory } from '@/components/rituals/ritual-flow';
import { loadReviewMemories } from '@/lib/memory-data';
import { recomputeGoalProgress, goalsV2Supported } from '@/lib/actions/goals';
import { userTimezone } from '@/lib/user-tz';
import { todayISO as todayIn, addDaysISO, minutesOfDayIn } from '@/lib/date';
import { toSchedule, isDue } from '@/lib/habit-schedule';
import { currentProfile } from '@/lib/profile';
import { readWorkHours, type Span } from '@/lib/capacity';
import { isTwin } from '@/lib/timebox';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';

export const dynamic = 'force-dynamic';

const TYPES: RitualType[] = ['daily_plan', 'daily_shutdown', 'weekly_review'];

export default async function RitualsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const type: RitualType = TYPES.includes(sp.type as RitualType) ? (sp.type as RitualType) : 'daily_plan';

  const { supabase, sid } = await pageScope();
  // Calendar dates in the USER's zone. These used to be
  // `new Date().toISOString().slice(0, 10)` — the UTC date — which was worse here
  // than anywhere else: `todayISO` both FILTERS the day's tasks and stamps the
  // `rituals` row, so in IST every ritual run between midnight and 05:30 planned
  // yesterday's list and recorded itself against yesterday. Shutdown then carried
  // tasks to a "tomorrow" that was actually today.
  const tz = await userTimezone();
  const todayISO = todayIn(tz);
  const tomorrowISO = addDaysISO(todayISO, 1);

  // ── EACH FLOW ASKS ITS QUESTIONS AT ONCE (2026-09-12) ───────────────────────
  // This page used to read one thing at a time: today's tasks, then the day's
  // events, then the goals, then the habits, then those habits' logs. That was
  // six round trips in series for the morning plan, and none of those reads needs
  // another's answer. The one real dependency stays: the weekly review's goals
  // glance must show the progress that review has just settled, so its goals
  // are read the moment the recompute lands, never before.
  const goalsQuery = () => supabase
    .from('goals').select('id, title, behind, progress, status').eq('space_id', sid)
    .eq('status', 'active').order('created_at');

  // ── §7C capacity: the day you said you have, and what is already in it ─────
  // Only the morning plan asks the question, so only the morning plan pays for
  // the query. The work hours cost NOTHING extra: `currentProfile` is request-
  // cached and `pageScope` has already read this exact row.
  const loadCapacity = async () => {
    const [profile, evRes] = await Promise.all([
      currentProfile(),
      supabase
        .from('calendar_events')
        .select('starts_at, ends_at, all_day, task_id')
        .eq('space_id', sid)
        .gte('starts_at', `${todayISO}T00:00:00`)
        .lt('starts_at', `${addDaysISO(todayISO, 1)}T00:00:00`),
    ]);
    type EvRow = { starts_at: string; ends_at: string | null; all_day: boolean; task_id: string | null };
    const meetings: Span[] = ((evRes.data as EvRow[]) ?? [])
      // An all-day event is a label on the day, not an hour of it — a birthday
      // does not consume working time. And a TIMEBOX TWIN is the task's own
      // estimate placed on the clock (0030), so counting it here would charge
      // the day twice for one piece of work. Home has been doing exactly that
      // since twins shipped.
      .filter((e) => !e.all_day && !!e.ends_at && !isTwin(e))
      .map((e) => ({
        start: minutesOfDayIn(e.starts_at, tz),
        end: minutesOfDayIn(e.ends_at, tz),
      }))
      .filter((s): s is Span => s.start !== undefined && s.end !== undefined);
    return { workHours: readWorkHours(profile?.preferences), meetings };
  };

  // Daily-plan extra: the habits DUE today (+ how far each already is), so the
  // morning ritual and Habits are one cadence instead of two (§5.3 / §7G).
  //
  // "Due today" is the part that was missing. This listed every active habit, so
  // a Mon/Wed/Fri habit sat unticked in Tuesday's ritual — the third copy of the
  // every-habit-is-daily assumption, after Home and /habits. It goes through the
  // same `lib/habit-schedule.ts` as both of them.
  //
  // Today's logs are asked for by DATE alongside the habits, not by the ids of
  // the due habits after them: RLS scopes them to this person, and only a due
  // habit's log is ever looked up.
  const loadHabits = async (): Promise<RHabit[]> => {
    const [firstHabits, firstLogs] = await Promise.all([
      supabase.from('habits')
        .select('id, title, goal_target, schedule_kind, schedule_days, schedule_count')
        .eq('space_id', sid).eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('habit_id, done, count').eq('log_date', todayISO),
    ]);
    let hs = firstHabits;
    // Pre-0025: no schedule or goal columns — read every habit as a daily,
    // once-a-day one, exactly as before.
    if (hs.error) {
      hs = await supabase.from('habits').select('id, title')
        .eq('space_id', sid).eq('active', true).order('created_at') as typeof hs;
    }
    type HRow = { id: string; title: string; goal_target?: number | null; schedule_kind?: string | null; schedule_days?: number[] | null; schedule_count?: number | null };
    const due = ((hs.data as unknown as HRow[]) ?? []).filter((h) => isDue(toSchedule(h), todayISO));
    if (!due.length) return [];
    let logs = firstLogs;
    if (logs.error) {
      logs = await supabase.from('habit_logs').select('habit_id, done')
        .eq('log_date', todayISO) as typeof logs;
    }
    type LRow = { habit_id: string; done: boolean; count?: number };
    const byId = new Map<string, LRow>();
    for (const l of ((logs.data as unknown as LRow[]) ?? [])) byId.set(l.habit_id, l);
    return due.map((h) => {
      const log = byId.get(h.id);
      return {
        id: h.id,
        title: h.title,
        done: !!log?.done,
        goalTarget: Math.max(1, h.goal_target ?? 1),
        count: log?.count ?? (log?.done ? 1 : 0),
      };
    });
  };

  // Settle goal progress at the start of the weekly review (the spec's "at
  // review time, not live") so the goals glance shows fresh numbers. The same
  // pass returns the per-goal linked-work tallies, so the glance can ask "still
  // true?" against real counts instead of a bare percentage (§7G). The facts
  // worth asking about this week (§7X §5.4) are loaded ONLY for the weekly
  // review, and gated, so a workspace without 0029 simply gets a shorter review.
  // Weekly-review extras: inbox depth + each active project's open-task count,
  // so the review can walk "clear the inbox" and "what needs a next action?".
  const loadReview = async () => {
    const recompute = recomputeGoalProgress();
    const [res, goalsV2, memories, inboxRes, projRes, openRes, goalsRes] = await Promise.all([
      recompute,
      goalsV2Supported(supabase),
      loadReviewMemories(),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('space_id', sid).eq('is_inbox', true).eq('done', false),
      supabase.from('projects').select('id, name').eq('space_id', sid).eq('status', 'active').order('created_at'),
      supabase.from('tasks').select('project_id').eq('space_id', sid).eq('done', false).not('project_id', 'is', null),
      recompute.then(() => goalsQuery()),
    ]);
    const openByProject = new Map<string, number>();
    for (const r of (openRes.data as { project_id: string }[]) ?? []) openByProject.set(r.project_id, (openByProject.get(r.project_id) ?? 0) + 1);
    return {
      tallies: 'tallies' in res ? res.tallies : {},
      goalsV2,
      memories,
      goalRows: goalsRes.data,
      inboxCount: inboxRes.count ?? 0,
      projects: ((projRes.data as { id: string; name: string }[]) ?? []).map((p): RProject => ({ id: p.id, name: p.name, openCount: openByProject.get(p.id) ?? 0 })),
    };
  };

  const [{ data: tasks }, capacity, habits, review, plainGoals] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, done, highlight, estimate_minutes, priority')
      .eq('space_id', sid)
      .eq('scheduled_date', todayISO)
      .order('sort_order'),
    type === 'daily_plan' ? loadCapacity() : null,
    type === 'daily_plan' ? loadHabits() : ([] as RHabit[]),
    type === 'weekly_review' ? loadReview() : null,
    type === 'weekly_review' ? null : goalsQuery(),
  ]);

  const workHours = capacity?.workHours ?? readWorkHours(null);
  const meetings: Span[] = capacity?.meetings ?? [];
  const tallies: Record<string, { done: number; total: number }> = review?.tallies ?? {};
  const goalsV2 = review?.goalsV2 ?? false;
  const memories: RMemory[] = review?.memories ?? [];
  const inboxCount = review?.inboxCount ?? 0;
  const projects: RProject[] = review?.projects ?? [];
  const goalRows = review ? review.goalRows : plainGoals?.data;
  const goals: RGoal[] = ((goalRows as { id: string; title: string; behind: boolean; progress: number }[] | null | undefined) ?? [])
    .map((g) => ({
      id: g.id, title: g.title, behind: g.behind, progress: g.progress,
      linkedDone: tallies[g.id]?.done ?? 0,
      linkedTotal: tallies[g.id]?.total ?? 0,
    }));

  return (
    <>
      <PageStamp />
      <RitualFlow
        type={type}
        todayTasks={(tasks as RTask[]) ?? []}
        goals={(goals as RGoal[]) ?? []}
        habits={habits}
        todayISO={todayISO}
        tomorrowISO={tomorrowISO}
        inboxCount={inboxCount}
        projects={projects}
        goalsV2={goalsV2}
        memories={memories}
        workHours={workHours}
        meetings={meetings}
      />
    </>
  );
}

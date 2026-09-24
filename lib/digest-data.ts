// ONE PERSON'S DAY, READ WITHOUT A SESSION.
//
// Two surfaces ask this question from the server with no cookie to ask with:
// the morning digest (a cron worker, for everyone who opted in) and the MCP
// `today` tool (an AI client, for the token's owner). They used to answer it
// separately, and the second answer was wrong three ways at once:
//
//   - it filtered on the Board's `tasks.status`, which is null on 78 of 88 rows
//     — and `status <> 'done'` is NULL, not true, for a null — so most open
//     work silently vanished from "what am I doing today";
//   - it asked the WORKER what day it was: UTC, so an IST evening got
//     yesterday's list until 05:30;
//   - it listed archived content as if it were being filmed.
//
// So this is the digest's loader, moved out of its route so both can call it,
// and both surfaces render what it returns through `digestBlocks`.
//
// It takes the client rather than making one: both callers hold a
// service-role client, which has NO RLS, so every query below scopes itself to
// `userId` explicitly. That is the load-bearing line in each of them.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { addDaysISO, dayWindow, minutesOfDayIn, formatClockRange } from '@/lib/date';
import { capacity, readWorkHours, type Span } from '@/lib/capacity';
import { isTwin } from '@/lib/timebox';
import { readContent, contentToday, type Piece } from '@/lib/content';
import { todaysPlanFilter, isOnTodaysPlan } from '@/lib/todays-plan';
import type { DigestInput, DigestTask, DigestRequest, DigestMeeting } from '@/lib/digest';

type DB = SupabaseClient<Database>;

export type DayReader = {
  userId: string;
  /** THEIR calendar date — `todayISO(tz)`, never the worker's. */
  today: string;
  /** Their zone, via `readTimeZone` (lib/date.ts). */
  tz: string;
  /** `profiles.preferences`, for work hours. */
  preferences: unknown;
};

/** Everything the day needs, in as few round trips as the shape allows. */
export async function loadDigest(db: DB, who: DayReader): Promise<DigestInput> {
  const { userId, today, tz, preferences } = who;
  // Real instants for the user's day, not naive `T00:00:00` strings: a
  // timestamptz compared with a zoneless literal is read in the DATABASE's
  // zone (UTC), so an IST user's "today" began at 05:30 their time.
  const day = dayWindow(today, tz);
  const since = dayWindow(addDaysISO(today, -1), tz).startISO;

  const [taskRes, reqRes, evRes, contentRes] = await Promise.all([
    // Today's plan and anything already late, in one query — same table, same
    // filters but the date, so two queries would be one round trip wasted.
    // Open means `done = false`: that is what the list writes. `status` is the
    // Board's column and is null on most rows.
    db.from('tasks')
      .select('id, title, due_date, scheduled_date, estimate_minutes, priority, highlight')
      .eq('user_id', userId)
      .eq('done', false)
      .is('parent_task_id', null)
      .or(`${todaysPlanFilter(today)},and(due_date.lt.${today},due_date.not.is.null)`)
      .limit(100),
    // Client requests still waiting that arrived since yesterday. The embed
    // reaches the owner through `projects` — one unambiguous FK, so no
    // constraint name is needed.
    db.from('client_requests')
      .select('id, title, body, project_id, projects!inner(user_id)')
      .eq('projects.user_id', userId)
      .eq('status', 'pending')
      .gte('created_at', since)
      .limit(50),
    db.from('calendar_events')
      .select('title, starts_at, ends_at, all_day, task_id')
      .eq('user_id', userId)
      .gte('starts_at', day.startISO)
      .lt('starts_at', day.endISO)
      .order('starts_at')
      .limit(100),
    // The same select Home uses: the pipeline sub-object only, never the whole
    // document body. `today-data.test.ts` pins that exact string, because a
    // mistyped jsonb path answers 200 with nulls rather than failing.
    db.from('pages')
      .select('id, title, content->pipeline')
      .eq('user_id', userId)
      .eq('type', 'content')
      .is('archived_at', null),
  ]);

  type TRow = {
    id: string; title: string; due_date: string | null; scheduled_date: string | null;
    estimate_minutes: number | null; priority: 'low' | 'med' | 'high'; highlight: boolean;
  };
  const tasks = (taskRes.data as TRow[] | null) ?? [];
  const todays = tasks.filter((t) => isOnTodaysPlan(t, today));
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && !isOnTodaysPlan(t, today));

  // §7B's "waiting on", gated on 0032 exactly as Home is: the query errors when
  // the table is absent, and an absent section is the correct answer for an
  // app that has no dependencies.
  let waitingOn: DigestTask[] = [];
  if (todays.length) {
    const { data: links } = await db
      .from('task_links')
      .select('task_id, blocked_by_task_id')
      .in('task_id', todays.map((t) => t.id));
    const edges = (links as { task_id: string; blocked_by_task_id: string }[] | null) ?? [];
    if (edges.length) {
      const { data: blockers } = await db
        .from('tasks').select('id, done')
        .eq('user_id', userId)
        .in('id', [...new Set(edges.map((e) => e.blocked_by_task_id))]);
      const doneById = new Map(((blockers ?? []) as { id: string; done: boolean }[]).map((b) => [b.id, b.done]));
      const stuck = new Set(edges.filter((e) => !doneById.get(e.blocked_by_task_id)).map((e) => e.task_id));
      waitingOn = todays.filter((t) => stuck.has(t.id)).map(toDigestTask);
    }
  }

  type ERow = { title: string; starts_at: string; ends_at: string | null; all_day: boolean; task_id: string | null };
  // A timebox twin IS a task already on the list; counting it again would put
  // the same hour of work in the plan twice.
  const events = ((evRes.data as ERow[] | null) ?? []).filter((e) => !isTwin(e));
  const spans: Span[] = events
    .filter((e) => !e.all_day && !!e.ends_at)
    .map((e) => ({ start: minutesOfDayIn(e.starts_at, tz), end: minutesOfDayIn(e.ends_at, tz) }))
    .filter((s): s is Span => s.start !== undefined && s.end !== undefined);
  const meetings: DigestMeeting[] = events.map((e) => ({
    title: e.title?.trim() || 'Untitled event',
    when: e.all_day ? 'All day' : formatClockRange(e.starts_at, e.ends_at, tz) ?? 'All day',
  }));

  const overnight: DigestRequest[] = ((reqRes.data as {
    id: string; title: string | null; body: string; project_id: string;
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    // A request need not be titled; the body's first line is what the portal
    // shows, so it is what this shows too.
    title: r.title?.trim() || r.body.split('\n')[0].slice(0, 80) || 'A new request',
    projectId: r.project_id,
  }));

  // `readContent` takes the content ROOT and reads `.pipeline` off it, so the
  // selected sub-object is handed back in that shape.
  const pieces: Piece[] = ((contentRes.data as { id: string; title: string | null; pipeline: unknown }[] | null) ?? [])
    .map((r) => ({ id: r.id, title: r.title, meta: readContent({ pipeline: r.pipeline }) }));

  return {
    today: todays.map(toDigestTask),
    overdue: overdue.map(toDigestTask),
    waitingOn,
    overnight,
    // The same rule the ritual and Home use — §7C, one projection.
    capacity: todays.length || spans.length
      ? capacity({ tasks: todays, meetings: spans, hours: readWorkHours(preferences) })
      : null,
    content: contentToday(pieces, today),
    meetings,
  };
}

const toDigestTask = (t: { id: string; title: string; due_date: string | null }): DigestTask =>
  ({ id: t.id, title: t.title, dueDate: t.due_date });

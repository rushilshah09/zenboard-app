'use server';
// The timebox twin, write side — master plan §7C/§7D. The rules live in
// lib/timebox.ts; this file only performs them.
//
// GATED. Migration 0030 adds `tasks.event_id` and `calendar_events.task_id`;
// until it is applied `taskEventsSupported()` reports false, every action here
// returns a clean "not available yet", and the UI hides the affordance. The app
// is correct before and after — nothing here can half-write a twin, because the
// two links are written in an order where a failure leaves no dangling half.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { userTimezone } from '@/lib/user-tz';
import { timeboxRange, timeboxDay, TWIN_SOURCE } from '@/lib/timebox';
import { requireSession } from '@/lib/auth';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0030 applied? A zero-row probe against the column, the same
 * fetch-time capability pattern as `mentionsSupported` / `goalsV2Supported`.
 * Probing the COLUMN rather than the table matters here — both tables already
 * exist, so `select('id')` would succeed on an unmigrated database and report
 * the feature as available.
 */
export async function taskEventsSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('tasks').select('event_id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = { error: 'Timeboxing needs migration 0030.' } as const;

export type TimeboxResult = { error: string } | { eventId: string; startsAt: string; endsAt: string };

/**
 * Give a task a place in the day.
 *
 * Idempotent by design: a task that is already timeboxed gets its existing
 * block MOVED rather than a second one created. Without that, double-clicking a
 * slot would leave an orphan block on the calendar that no longer belongs to
 * anything the task knows about — and the unique index would reject the second
 * link anyway, failing after the event row was already written.
 */
export async function timeboxTask(taskId: string, startsAtISO: string): Promise<TimeboxResult> {
  const { supabase, user } = await requireSession();
  if (!(await taskEventsSupported(supabase))) return NOT_READY;

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, estimate_minutes, event_id')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return { error: 'Task not found.' };

  const range = timeboxRange(startsAtISO, task.estimate_minutes);
  if (!range) return { error: 'That is not a valid time.' };

  const tz = await userTimezone();
  const day = timeboxDay(range.startsAt, tz);

  // Already timeboxed → move the block that exists.
  if (task.event_id) {
    const { error } = await supabase
      .from('calendar_events')
      .update({ starts_at: range.startsAt, ends_at: range.endsAt, title: task.title })
      .eq('id', task.event_id);
    if (error) return { error: error.message };
    await supabase.from('tasks').update({ scheduled_date: day, is_inbox: false }).eq('id', taskId);
    return { eventId: task.event_id, ...range };
  }

  const sid = await activeSpaceId(supabase, user.id);
  // The event is written first and carries the link immediately, so the only
  // possible failure state is an event with no task pointing back at it — a
  // plain calendar block, which is harmless and visible. The reverse order
  // could leave a task pointing at an event that was never created.
  const { data: ev, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: user.id, space_id: sid, title: task.title,
      starts_at: range.startsAt, ends_at: range.endsAt, all_day: false,
      // Twins never reach Google — see TWIN_SOURCE in lib/timebox.ts.
      source: TWIN_SOURCE, task_id: taskId,
    })
    .select('id')
    .single();
  if (error || !ev) return { error: error?.message ?? 'Could not add the block.' };

  const { error: linkErr } = await supabase
    .from('tasks')
    .update({ event_id: ev.id, scheduled_date: day, is_inbox: false })
    .eq('id', taskId);
  if (linkErr) {
    // Roll the half-written twin back rather than leaving a block the task does
    // not know about — the user did not ask for a bare calendar event.
    await supabase.from('calendar_events').delete().eq('id', ev.id);
    return { error: linkErr.message };
  }

  return { eventId: ev.id, ...range };
}

/**
 * Take a task's block off the calendar. The task itself is untouched apart from
 * the link — §7D: un-timeboxing is never deleting.
 *
 * `scheduled_date` deliberately SURVIVES. The block said "at 2pm on Thursday";
 * removing it should retract the time, not the day. Clearing the date too would
 * silently unschedule a task the user only meant to un-slot.
 */
export async function untimeboxTask(taskId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await taskEventsSupported(supabase))) return NOT_READY;

  const { data: task } = await supabase.from('tasks').select('event_id').eq('id', taskId).maybeSingle();
  if (!task?.event_id) return { ok: true };   // already un-timeboxed

  await supabase.from('tasks').update({ event_id: null }).eq('id', taskId);
  const { error } = await supabase.from('calendar_events').delete().eq('id', task.event_id);
  return error ? { error: error.message } : { ok: true };
}

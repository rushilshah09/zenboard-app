'use server';
// Meeting mutations — a meeting is a client conversation (call/notes/transcript)
// that feedback gets extracted from (the "2.2" card). RLS scopes everything to
// the user. See supabase/migrations/0016_feedback.sql and lib/actions/feedback.ts.
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';
import { mentionsSupported } from '@/lib/connected';
import { forgetMentionsFrom } from '@/lib/actions/mentions';
import { intakeTask } from '@/lib/task-intake';
import { actionKey, meetingDestination } from '@/lib/meeting-actions';

export async function addMeeting(
  input: { clientId?: string | null; title: string; notes?: string; metAt?: string },
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  const sid = await activeSpaceId(supabase, user.id);
  const { data, error } = await supabase.from('meetings')
    .insert({ user_id: user.id, space_id: sid, client_id: input.clientId ?? null, title: input.title.trim() || 'Meeting', notes: input.notes?.trim() || null, met_at: input.metAt ?? new Date().toISOString() })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add meeting.' };
  return { id: data.id };
}

export async function updateMeeting(
  id: string,
  patch: { title?: string; notes?: string | null; metAt?: string },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('meetings')
    .update({ ...(patch.title !== undefined && { title: patch.title }), ...(patch.notes !== undefined && { notes: patch.notes }), ...(patch.metAt !== undefined && { met_at: patch.metAt }) })
    .eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteMeeting(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) return { error: error.message };
  // The meeting is the SOURCE of its action-item edges, and 0027 only tombstones
  // the target direction — an edge out of a row that no longer exists would put
  // "Deleted" rows in the Connected panel of every task this call produced. The
  // tasks themselves stay: the work was still agreed to.
  await forgetMentionsFrom({ type: 'meeting', id });
  return { ok: true };
}

/**
 * An action item becomes a task — PRODUCT_THINKING.md §8, the write side.
 *
 * The link is a `mentions` edge (meeting → task), which is why this needs no
 * migration and why it lights up the Connected panel on both ends for free: the
 * task shows the meeting it was agreed in, the meeting shows what it produced.
 *
 * WITHOUT THAT EDGE THERE IS NO FEATURE, so this refuses rather than degrading.
 * A task created with nothing pointing back would be offered for promotion again
 * on the next render — the feature's one unacceptable failure is making two tasks
 * for one commitment, and a silent half-success is how you get there.
 */
export async function makeTaskFromMeeting(
  meetingId: string,
  title: string,
  // The row it wrote comes back, so the panel shows what was actually filed
  // rather than what it guessed would be — the destination is decided here.
): Promise<{ error: string } | { taskId: string; title: string; projectId: string | null }> {
  const { supabase, user } = await requireSession();
  if (!(await mentionsSupported(supabase))) {
    return { error: 'Linking needs migration 0027.' };
  }

  const { data: meetingData } = await supabase.from('meetings')
    .select('id, space_id, client_id, title').eq('id', meetingId).maybeSingle();
  const meeting = meetingData as { id: string; space_id: string | null; client_id: string | null; title: string } | null;
  if (!meeting) return { error: 'Meeting not found.' };

  // Idempotent, like every other intake path: same commitment, same task. The
  // client already hides a promoted item, so reaching here twice means a double
  // click or a stale tab — neither of which may produce a second task.
  const { data: edgeData } = await supabase.from('mentions')
    .select('target_id')
    .eq('source_type', 'meeting').eq('source_id', meetingId).eq('target_type', 'task');
  const existingIds = ((edgeData ?? []) as { target_id: string }[]).map((e) => e.target_id);
  if (existingIds.length) {
    const { data: taskRows } = await supabase.from('tasks')
      .select('id, title, project_id').in('id', existingIds);
    const key = actionKey(title);
    const hit = ((taskRows ?? []) as { id: string; title: string; project_id: string | null }[])
      .find((t) => actionKey(t.title) === key);
    if (hit) return { taskId: hit.id, title: hit.title, projectId: hit.project_id };
  }

  const spaceId = meeting.space_id ?? await activeSpaceId(supabase, user.id);

  // The client's projects, so the destination rule can be applied SERVER-SIDE
  // too. The panel shows where the task will go, but the browser's list of
  // projects is a snapshot; the row that is written must be decided against the
  // database. `meetingDestination`'s rule, in the one place it can be trusted.
  let projectId: string | null = null;
  if (meeting.client_id) {
    const { data: projRows } = await supabase.from('projects')
      .select('id, name, status').eq('client_id', meeting.client_id);
    projectId = meetingDestination((projRows ?? []) as { id: string; name: string; status: string }[]).projectId;
  }

  const { data: taskRow, error } = await supabase.from('tasks')
    .insert(intakeTask({
      userId: user.id, spaceId, projectId, title,
      fallbackTitle: `Follow up on \u201C${meeting.title}\u201D`,
    }))
    .select('id, title, project_id').single();
  if (error || !taskRow) return { error: error?.message ?? 'Could not create the task.' };
  const task = taskRow as { id: string; title: string; project_id: string | null };

  const { error: linkErr } = await supabase.from('mentions').insert({
    user_id: user.id,
    space_id: spaceId,
    source_type: 'meeting',
    source_id: meetingId,
    target_type: 'task',
    target_id: task.id,
    // The line as it was written, snapshotted like a document mention's sentence.
    context: title.trim().slice(0, 200),
    origin: 'mention' as const,
  });
  if (linkErr) {
    // Undo rather than leave a task the meeting cannot see. The alternative is
    // an item that reappears as un-promoted forever and duplicates on every click.
    await supabase.from('tasks').delete().eq('id', task.id);
    return { error: 'Could not link the task to this meeting.' };
  }

  return { taskId: task.id, title: task.title, projectId: task.project_id };
}

/**
 * Take notes on a calendar event — PRODUCT_CONTEXT §14's first arrow:
 * `calendar event → meeting → notes → decisions → tasks`.
 *
 * TWO OBJECTS, ON PURPOSE, and the distinction is real: the EVENT is the
 * appointment (it can be moved, declined, synced from Google) and the MEETING is
 * the record of what was said. Merging them would make deleting a calendar entry
 * delete your notes.
 *
 * What must NOT happen is two meetings for one event, so the link is written as
 * a `mentions` edge and checked first. That edge is also what makes the event's
 * Connected panel show the notes afterwards — the "previous meeting" line §13
 * asks the calendar for.
 *
 * The event's facts are COPIED ONCE at creation (title, when) and referenced
 * thereafter. A meeting has to keep the title it was held under even if the
 * calendar entry is later renamed or deleted.
 */
export async function meetingFromEvent(
  eventId: string,
): Promise<{ error: string } | { id: string; existing: boolean }> {
  const { supabase, user } = await requireSession();
  if (!(await mentionsSupported(supabase))) return { error: 'Linking needs migration 0027.' };

  const { data: ev } = await supabase.from('calendar_events')
    .select('id, title, starts_at, space_id').eq('id', eventId).maybeSingle();
  const event = ev as { id: string; title: string; starts_at: string; space_id: string | null } | null;
  if (!event) return { error: 'Event not found.' };

  // Already has notes? Open those. Idempotent like every other intake path.
  const { data: edges } = await supabase.from('mentions')
    .select('target_id')
    .eq('source_type', 'event').eq('source_id', eventId).eq('target_type', 'meeting');
  const existingIds = ((edges ?? []) as { target_id: string }[]).map((e) => e.target_id);
  if (existingIds.length) {
    const { data: live } = await supabase.from('meetings').select('id').in('id', existingIds).limit(1);
    const hit = ((live ?? []) as { id: string }[])[0];
    if (hit) return { id: hit.id, existing: true };
  }

  const spaceId = event.space_id ?? await activeSpaceId(supabase, user.id);
  const { data: row, error } = await supabase.from('meetings').insert({
    user_id: user.id,
    space_id: spaceId,
    client_id: null,
    title: event.title?.trim() || 'Meeting',
    // `met_at` is WHEN IT HAPPENED, so it is the event's start, not now.
    met_at: event.starts_at,
  }).select('id').single();
  if (error || !row) return { error: error?.message ?? 'Could not start notes.' };
  const id = (row as { id: string }).id;

  const { error: linkErr } = await supabase.from('mentions').insert({
    user_id: user.id, space_id: spaceId,
    source_type: 'event', source_id: eventId,
    target_type: 'meeting', target_id: id,
    context: event.title?.trim().slice(0, 200) || null,
    origin: 'mention' as const,
  });
  if (linkErr) {
    // Without the edge this event would offer to take notes again and make a
    // second set — the one failure this whole function exists to prevent.
    await supabase.from('meetings').delete().eq('id', id);
    return { error: 'Could not link the notes to this event.' };
  }
  return { id, existing: false };
}

'use server';
// Meeting mutations — a meeting is a client conversation (call/notes/transcript)
// that feedback gets extracted from (the "2.2" card). RLS scopes everything to
// the user. See supabase/migrations/0016_feedback.sql and lib/actions/feedback.ts.
import { notReady } from '@/lib/not-ready';
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';
import { mentionsSupported } from '@/lib/connected';
import { forgetMentionsFrom } from '@/lib/actions/mentions';
import { intakeTask } from '@/lib/task-intake';
import { actionKey, meetingDestination } from '@/lib/meeting-actions';
import { generateJSON } from '@/lib/ai/gateway';
import { userTimezone } from '@/lib/user-tz';
import { MIN_TRANSCRIPT_CHARS } from '@/lib/meeting-suggest';
import {
  MEETING_NOTES_SYSTEM, NOTES_MAX_TOKENS, NOTES_MESSAGES, meetingNotesSchema, notesMaterial,
  storedNotesSchema, verifyNotes, writeUpInput, type MeetingNotes, type NotesProblem,
} from '@/lib/meeting-notes';
import { transcriptSchema, transcriptText, type TranscriptSegment } from '@/lib/meeting-transcript';
import { readSegments } from '@/lib/meeting-data';

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
    return notReady('Linking isn’t available yet.', '0027');
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
 * The clerk writes the meeting up (lib/meeting-notes.ts, MEETINGS_PLAN.md M2): summary, decisions,
 * your action items, their promises and asks, open questions — from your notes and the recording.
 *
 * `notes` is what the panel holds, because the panel is AHEAD of the database (notes save on blur,
 * and pressing the button is what blurs the box); called without it — after a recording stops,
 * say — the saved notes are read instead. The meeting is always looked up, so this only runs for a
 * meeting the caller owns.
 *
 * The write-up is KEPT on the meeting (0047) — it is the meeting's own notes, and asking again
 * would spend the shared pool twice. What it proposes stays a proposal: nothing here makes a task,
 * a feedback item or an action line.
 */
export async function writeUpMeeting(
  meetingId: string,
  notes?: string | null,
): Promise<{ error: string; reason: NotesProblem } | { notes: MeetingNotes; kept: boolean }> {
  const { supabase, user } = await requireSession();
  // Title, client and any previous write-up come back in the SAME read: the context is what lets a
  // line name the client (lib/meeting-notes.ts `verifyNotes`), and the old dismissals are what stop
  // a second write-up asking again about a proposal already turned down.
  const { data: meeting } = await supabase.from('meetings')
    .select('id, notes, title, summary, clients(name)').eq('id', meetingId).maybeSingle();
  if (!meeting) return { error: NOTES_MESSAGES.missing, reason: 'missing' };
  const row = meeting as unknown as {
    notes: string | null; title: string | null; summary: unknown; clients: { name: string } | null;
  };
  const context = { title: row.title, clientName: row.clients?.name ?? null };
  const previous = storedNotesSchema.safeParse(row.summary);

  const typed = typeof notes === 'string' ? notes : (row.notes ?? '');
  const material = notesMaterial(typed, await recordedText(supabase, meetingId));
  if (material.length < MIN_TRANSCRIPT_CHARS) return { error: NOTES_MESSAGES.short, reason: 'short' };

  const { input, truncated } = writeUpInput(context, material);
  const res = await generateJSON({
    feature: 'meeting-notes',
    system: MEETING_NOTES_SYSTEM,
    input,
    schema: meetingNotesSchema,
    maxTokens: NOTES_MAX_TOKENS,
    userId: user.id,
    timeZone: await userTimezone(),
  });
  if (!res.ok) return { error: NOTES_MESSAGES[res.reason], reason: res.reason };

  const written = verifyNotes(res.data, material, {
    context,
    truncated,
    dismissed: previous.success ? previous.data.dismissed : [],
  });
  const { error } = await supabase.from('meetings')
    .update({ summary: written as unknown as Record<string, unknown>, summarized_at: written.at })
    .eq('id', meetingId);
  return { notes: written, kept: !error };
}

/** A meeting's kept write-up. `supported: false` when 0047 is not applied. */
export async function loadMeetingWriteUp(
  meetingId: string,
): Promise<{ supported: boolean; notes: MeetingNotes | null }> {
  const { supabase } = await requireSession();
  const { data, error } = await supabase.from('meetings').select('summary').eq('id', meetingId).maybeSingle();
  if (error) return { supported: false, notes: null };
  const parsed = storedNotesSchema.safeParse((data as { summary: unknown } | null)?.summary);
  return { supported: true, notes: parsed.success ? (parsed.data as MeetingNotes) : null };
}

/**
 * "Not this one": a proposal the person dismissed is remembered on the write-up, so the next visit
 * does not ask again. `key` is `list:key` (mine · asks · theirs).
 */
export async function dismissWriteUpItem(meetingId: string, key: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (typeof key !== 'string' || !/^(mine|asks|theirs):/.test(key) || key.length > 300) return { error: 'Nothing to dismiss.' };
  const { data, error } = await supabase.from('meetings').select('summary').eq('id', meetingId).maybeSingle();
  if (error || !data) return { error: 'That meeting isn’t available.' };
  const parsed = storedNotesSchema.safeParse((data as { summary: unknown }).summary);
  if (!parsed.success) return { error: 'This meeting has no write-up.' };
  const dismissed = [...new Set([...parsed.data.dismissed, key])].slice(-200);
  const { error: upd } = await supabase.from('meetings')
    .update({ summary: { ...parsed.data, dismissed } as unknown as Record<string, unknown> }).eq('id', meetingId);
  return upd ? { error: 'That didn’t save.' } : { ok: true };
}

/** Delete the write-up (not the meeting, notes or transcript). */
export async function clearMeetingWriteUp(meetingId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('meetings').update({ summary: null, summarized_at: null }).eq('id', meetingId);
  return error ? { error: 'The write-up couldn’t be removed.' } : { ok: true };
}

type DB = Awaited<ReturnType<typeof requireSession>>['supabase'];

/** A recorded meeting's words as text, or '' when there is no recording (or no 0046 yet). */
async function recordedText(supabase: DB, meetingId: string): Promise<string> {
  return transcriptText(await readSegments(supabase, meetingId));
}

/** A meeting's recorded transcript, as saved. `null` = never recorded. */
export type SavedTranscript = { segments: TranscriptSegment[]; language: string | null; duration: number };

/**
 * The transcript for a meeting being opened. `supported: false` when 0046 is not applied — the
 * panel then records and shows the live transcript but says it cannot keep it.
 */
export async function loadMeetingTranscript(
  meetingId: string,
): Promise<{ supported: boolean; transcript: SavedTranscript | null }> {
  const { supabase } = await requireSession();
  const { data, error } = await supabase.from('meeting_transcripts')
    .select('segments, language, duration_seconds').eq('meeting_id', meetingId).maybeSingle();
  if (error) return { supported: false, transcript: null };
  if (!data) return { supported: true, transcript: null };
  const row = data as { segments: unknown; language: string | null; duration_seconds: number };
  const parsed = transcriptSchema.safeParse(row.segments);
  return {
    supported: true,
    transcript: parsed.success ? { segments: parsed.data, language: row.language, duration: row.duration_seconds } : null,
  };
}

/**
 * Keep a meeting's transcript. The recorder calls this as the words arrive and once more when it
 * stops; each call carries the WHOLE transcript, so a save that is lost is repaired by the next.
 * Validated here, because this is a door any browser can knock on: segments are bounded in number
 * and length, and the meeting must be the caller's (RLS, and 0046's policy checks it again).
 */
export async function saveMeetingTranscript(
  meetingId: string,
  input: { segments: TranscriptSegment[]; language: string | null; duration: number },
): Promise<{ error: string; reason: 'invalid' | 'migration' | 'failed' } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const parsed = transcriptSchema.safeParse(input?.segments);
  if (!parsed.success) return { error: 'That transcript could not be saved.', reason: 'invalid' };
  const language = typeof input.language === 'string' && /^[a-z]{2,3}$/.test(input.language) ? input.language : null;
  const duration = Number.isFinite(input.duration) ? Math.max(0, Math.round(input.duration)) : 0;

  const { error } = await supabase.from('meeting_transcripts').upsert({
    meeting_id: meetingId,
    user_id: user.id,
    segments: parsed.data,
    language,
    duration_seconds: duration,
    source: 'recording',
  }, { onConflict: 'meeting_id' });
  if (!error) return { ok: true };
  const missing = /does not exist|schema cache|could not find the table/i.test(error.message);
  return missing
    ? { ...notReady('Transcripts can’t be saved yet.', '0046'), reason: 'migration' as const }
    : { error: 'The transcript didn’t save.', reason: 'failed' };
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
  if (!(await mentionsSupported(supabase))) return notReady('Linking isn’t available yet.', '0027');

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

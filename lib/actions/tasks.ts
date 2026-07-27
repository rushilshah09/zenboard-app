'use server';
// Shared task mutations (used by Today, Week, …). RLS scopes everything to the
// signed-in user. Writes go through here, never directly from the client.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { parseRecurrence, nextOccurrence } from '@/lib/recurrence';
import type { ImportedTask } from '@/lib/import-tasks';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

// Batch-import parsed tasks (§7S). Everything lands in the Inbox for triage —
// never floods Today — keeping title/notes/priority/due/done. Best-effort:
// due_date may predate migration 0009, so retry once without it. Capped for sanity.
export async function importTasks(specs: ImportedTask[]): Promise<{ error: string } | { count: number }> {
  const { supabase, user } = await requireUser();
  const spaceId = await activeSpaceId(supabase, user.id);
  const clean = specs.filter((s) => s.title.trim()).slice(0, 1000);
  if (!clean.length) return { count: 0 };
  const base = clean.map((s) => ({
    user_id: user.id,
    space_id: spaceId,
    title: s.title.trim(),
    notes: s.notes?.trim() || null,
    priority: s.priority,
    is_inbox: true,
    scheduled_date: null as string | null,
    done: s.done,
    completed_at: s.done ? new Date().toISOString() : null,
  }));
  const withDue = base.map((r, i) => ({ ...r, due_date: clean[i].dueDate }));
  let res = await supabase.from('tasks').insert(withDue).select('id');
  if (res.error && /due_date/.test(res.error.message)) res = await supabase.from('tasks').insert(base).select('id');
  if (res.error) return { error: res.error.message };
  return { count: res.data?.length ?? clean.length };
}

export async function addTask(input: {
  title: string;
  priority?: 'low' | 'med' | 'high';
  estimateMinutes?: number | null;
  highlight?: boolean;
  scheduledDate?: string | null; // ISO date; omit = today
  isInbox?: boolean;
  projectId?: string | null;
  dueDate?: string | null; // ISO date
  sortOrder?: number; // position within its day/inbox column
  recurrence?: Record<string, unknown> | null; // e.g. { freq: 'weekly' }
  notes?: string | null; // optional description (task composer)
}): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const spaceId = await activeSpaceId(supabase, user.id);

  // Base columns that always exist. `due_date` is only referenced when a due
  // date is actually set, so accounts without migration 0009 keep working; if
  // the column is missing we retry once without it (graceful degradation).
  const base = {
    user_id: user.id,
    space_id: spaceId,
    title: input.title.trim(),
    priority: input.priority ?? 'low',
    estimate_minutes: input.estimateMinutes ?? null,
    highlight: input.highlight ?? false,
    is_inbox: input.isInbox ?? false,
    scheduled_date: input.isInbox ? null : (input.scheduledDate ?? todayISO()),
    project_id: input.projectId ?? null,
    sort_order: input.sortOrder ?? 0,
    recurrence: input.recurrence ?? null,
    notes: input.notes?.trim() || null,
  };
  let result = input.dueDate
    ? await supabase.from('tasks').insert({ ...base, due_date: input.dueDate }).select('id').single()
    : await supabase.from('tasks').insert(base).select('id').single();
  if (result.error && input.dueDate && /due_date/.test(result.error.message)) {
    result = await supabase.from('tasks').insert(base).select('id').single();
  }
  const { data, error } = result;
  if (error || !data) return { error: error?.message ?? 'Could not add task.' };
  return { id: data.id };
}

// `completedOnISO` is the user's local date; the server can't know it (a
// 5pm PST completion is already tomorrow in UTC), so callers may pass it.
// Defaults to the server date when omitted — dates are dates, no TZ math.
export async function toggleTask(id: string, done: boolean, completedOnISO?: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return { error: error.message };

  // Recurrence contract (lib/recurrence.ts): completing a top-level recurring
  // task spawns the next occurrence exactly once — the completed row is
  // stamped `spawned` so re-toggling never duplicates, and the next date is
  // always strictly future (overdue completions never back-fill). Notes,
  // project, section, goal and labels carry over; ★ highlight, due date and
  // subtasks do not. Un-completing does not retract the spawned occurrence.
  if (done) {
    const { data: t } = await supabase
      .from('tasks')
      .select('user_id, space_id, title, notes, priority, estimate_minutes, project_id, goal_id, section_id, client_visible, scheduled_date, recurrence, parent_task_id')
      .eq('id', id).maybeSingle();
    const rec = t ? parseRecurrence(t.recurrence) : null;
    if (t && !t.parent_task_id && rec && !rec.spawned) {
      const spawn = nextOccurrence(rec, t.scheduled_date, completedOnISO ?? todayISO());
      if (spawn) {
        const { data: created } = await supabase.from('tasks').insert({
          user_id: t.user_id, space_id: t.space_id, title: t.title, notes: t.notes,
          priority: t.priority, estimate_minutes: t.estimate_minutes,
          project_id: t.project_id, goal_id: t.goal_id, section_id: t.section_id,
          client_visible: t.client_visible, recurrence: spawn.recurrence,
          scheduled_date: spawn.dateISO, is_inbox: false, done: false, highlight: false, sort_order: 0,
        }).select('id').single();
        if (created) {
          const { data: labels } = await supabase.from('task_labels').select('label_id, user_id').eq('task_id', id);
          if (labels?.length) {
            await supabase.from('task_labels').insert(
              labels.map((l) => ({ task_id: created.id, label_id: l.label_id, user_id: l.user_id })),
            );
          }
          await supabase.from('tasks').update({ recurrence: { ...rec, spawned: true } }).eq('id', id);
        }
      }
    }

    // Loop return-path (the "fabric" loop): if this task is the work that ships
    // a feedback item (feedback.task_id points here), completing it moves that
    // feedback to Shipped. Fire-and-forget; no-ops silently until migration
    // 0016 is applied, and never overrides a declined item. See
    // lib/actions/feedback.ts and components/feedback/feedback-board.tsx.
    await supabase.from('feedback').update({ status: 'shipped' }).eq('task_id', id).neq('status', 'declined');
  }
  return { ok: true };
}

// Set/clear a task's highlight flag (the day's one important thing).
export async function setHighlight(id: string, highlight: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks').update({ highlight }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Persist drag reordering / cross-day moves: each entry sets a task's day
// (scheduled_date / is_inbox) and its position (sort_order) within that day.
// Used by the Week board after a drag. RLS scopes updates to the owner.
export async function reorderTasks(
  updates: { id: string; scheduledDate: string | null; isInbox: boolean; sortOrder: number }[],
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  for (const u of updates) {
    const { error } = await supabase.from('tasks')
      .update({ scheduled_date: u.isInbox ? null : u.scheduledDate, is_inbox: u.isInbox, sort_order: u.sortOrder })
      .eq('id', u.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

// Board (kanban) status. Moving a card to/from the Done column keeps `done` (the
// authoritative completion flag) and `completed_at` in sync. Called only on an
// actual column change, so setting completed_at here is always a real transition.
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export async function setTaskStatus(id: string, status: TaskStatus): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const done = status === 'done';
  const { error } = await supabase.from('tasks')
    .update({ status, done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Persist within-column ordering on the Board (sort_order only — no status/done
// change). Used after a drag that reorders cards within a single column.
export async function setTaskOrder(updates: { id: string; sortOrder: number }[]): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  for (const u of updates) {
    const { error } = await supabase.from('tasks').update({ sort_order: u.sortOrder }).eq('id', u.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

// Delete a task. Subtasks cascade via parent_task_id (on delete cascade). RLS
// scopes this to the owner.
export async function deleteTask(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Add a subtask under a parent (infinite nesting via parent_task_id).
export async function addSubtask(parentId: string, title: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data: parent } = await supabase.from('tasks').select('space_id').eq('id', parentId).maybeSingle();
  if (!parent) return { error: 'Parent not found.' };
  const { data, error } = await supabase.from('tasks').insert({
    user_id: user.id, space_id: parent.space_id, parent_task_id: parentId, title: title.trim(), priority: 'low',
  }).select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add subtask.' };
  return { id: data.id };
}

// Patch editable fields on a task (title, notes, priority, estimate).
export async function updateTask(
  id: string,
  patch: { title?: string; notes?: string; priority?: 'low' | 'med' | 'high'; estimate_minutes?: number | null; project_id?: string | null; recurrence?: Record<string, unknown> | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Post a comment on a task (any node in the tree).
export async function addComment(taskId: string, body: string): Promise<{ error: string } | { id: string; created_at: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('task_comments')
    .insert({ user_id: user.id, task_id: taskId, body: body.trim() })
    .select('id, created_at').single();
  if (error || !data) return { error: error?.message ?? 'Could not post comment.' };
  return { id: data.id, created_at: data.created_at };
}

// Log a focus session: record a time entry and roll minutes into the task.
export async function logTime(taskId: string, minutes: number): Promise<{ error: string } | { ok: true }> {
  if (minutes <= 0) return { ok: true };
  const { supabase, user } = await requireUser();
  const now = Date.now();
  const { error: te } = await supabase.from('time_entries').insert({
    user_id: user.id, task_id: taskId, source: 'timer', minutes,
    started_at: new Date(now - minutes * 60000).toISOString(),
    ended_at: new Date(now).toISOString(),
  });
  if (te) return { error: te.message };
  const { data: task } = await supabase.from('tasks').select('elapsed_minutes').eq('id', taskId).maybeSingle();
  const { error: ue } = await supabase.from('tasks')
    .update({ elapsed_minutes: (task?.elapsed_minutes ?? 0) + minutes }).eq('id', taskId);
  return ue ? { error: ue.message } : { ok: true };
}

// Triage an inbox item into a project (leaves the inbox). Used by the Inbox view.
export async function moveTaskToProject(id: string, projectId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks').update({ project_id: projectId, is_inbox: false }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Return a task to a clean inbox state — the reversal for a triage decision
// (complete / today / schedule / file-to-project). Clears the day, the project,
// and completion so "Undo" restores exactly the captured thought. RLS-scoped.
export async function returnToInbox(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks')
    .update({ is_inbox: true, scheduled_date: null, project_id: null, done: false, completed_at: null })
    .eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Move a task to a day (ISO date) or back to the inbox.
export async function rescheduleTask(id: string, target: string | 'inbox'): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const patch = target === 'inbox'
    ? { is_inbox: true, scheduled_date: null }
    : { is_inbox: false, scheduled_date: target };
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

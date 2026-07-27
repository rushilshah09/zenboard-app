// Inbox — triage captured thoughts (tasks flagged is_inbox, not yet scheduled or
// filed). RLS scopes to the signed-in user; auth is enforced by the (app) layout.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { InboxView, type InboxTask, type InboxProject } from '@/components/inbox/inbox-view';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, priority, done, is_inbox, created_at, project_id')
      .eq('space_id', sid)
      .eq('is_inbox', true)
      .eq('done', false)
      .is('parent_task_id', null)
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, color').eq('space_id', sid).order('created_at'),
  ]);
  return <InboxView initialTasks={(tasks as InboxTask[]) ?? []} projects={(projects as InboxProject[]) ?? []} />;
}

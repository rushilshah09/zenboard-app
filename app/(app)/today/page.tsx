// Today — the app home. Loads the user's name + everything the day's surfaces
// need (tasks, subtask counts, project chips, calendar events, habits) via one
// RLS-scoped loader. Auth is enforced by the (app) layout.
import { createClient } from '@/lib/supabase/server';
import { loadTodayData } from '@/lib/today-data';
import { TodayView } from '@/components/today/today-view';
import { GoogleAutoSync } from '@/components/shell/google-auto-sync';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles').select('full_name, preferences').eq('id', user!.id).maybeSingle();

  const data = await loadTodayData();

  // v4 audit row 13: never greet with the raw email handle ("designdotrushil") —
  // a missing display name falls back to a friendly "there".
  const name = profile?.full_name?.trim().split(/\s+/)[0] || 'there';
  const gcalConnected = !!(profile?.preferences as Record<string, unknown> | null)?.gcal_connected;

  return (
    <>
      <GoogleAutoSync connected={gcalConnected} />
      <TodayView
        name={name}
        initialTasks={data.tasks}
        projects={data.projects}
        subByParent={data.subByParent}
        initialHabits={data.habits}
        events={data.events}
        errors={data.errors}
      />
    </>
  );
}

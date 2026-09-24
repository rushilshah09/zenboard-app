// Today — the app home. Loads the user's name + everything the day's surfaces
// need (tasks, subtask counts, project chips, calendar events, habits) via one
// RLS-scoped loader. Auth via `requireUser()` — the layout redirects too, but it
// renders concurrently with this page, so it cannot gate it.
import { loadTodayData } from '@/lib/today-data';
import { TodayView } from '@/components/today/today-view';
import { GoogleAutoSync } from '@/components/shell/google-auto-sync';
import { currentProfile } from '@/lib/profile';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  // Together, not in turn. The loader's first wave already reads this profile
  // (lib/page-scope.ts), so this shares it. Awaiting it FIRST held the loader,
  // and its space lookup, a whole round trip behind on every navigation to
  // Home. A signed-out visitor is redirected by the loader, which rejects this.
  const [profile, data] = await Promise.all([currentProfile(), loadTodayData()]);

  // v4 audit row 13: never greet with the raw email handle ("designdotrushil") —
  // a missing display name falls back to a friendly "there".
  const name = profile?.full_name?.trim().split(/\s+/)[0] || 'there';
  const prefs = profile?.preferences as Record<string, unknown> | null;
  const gcalConnected = !!prefs?.gcal_connected;
  const gcalLastSynced = typeof prefs?.gcal_last_synced === 'string' ? prefs.gcal_last_synced : null;

  return (
    <>
      <PageStamp />
      <GoogleAutoSync connected={gcalConnected} lastSynced={gcalLastSynced} />
      <TodayView
        name={name}
        initialTasks={data.tasks}
        // These two are passed EXPLICITLY like everything else here — the route
        // does not spread `data`, so a loader that returns a new key reaches
        // nothing until this list grows. `waiting` had been computed and thrown
        // away since it shipped.
        waiting={data.waiting}
        content={data.content}
        projects={data.projects}
        subByParent={data.subByParent}
        blocked={data.blocked}
        initialHabits={data.habits}
        events={data.events}
        meetings={data.meetings}
        workHours={data.workHours}
        errors={data.errors}
        leftovers={data.leftovers}
        planned={data.planned}
        shutdown={data.shutdown}
        onVacation={data.onVacation}
      />
    </>
  );
}

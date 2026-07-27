// Settings — account basics (display name, default hourly rate). The sidebar
// user menu links here; sign-out lives in that menu behind a confirm step.
import { createClient } from '@/lib/supabase/server';
import { SettingsView } from '@/components/settings/settings-view';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('full_name, hourly_rate, preferences').eq('id', user!.id).maybeSingle();

  const prefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const gcal = {
    connected: !!prefs.gcal_connected,
    lastSynced: typeof prefs.gcal_last_synced === 'string' ? prefs.gcal_last_synced : null,
    eventCount: typeof prefs.gcal_event_count === 'number' ? prefs.gcal_event_count : null,
  };

  return (
    <SettingsView
      email={user?.email ?? ''}
      initialName={profile?.full_name ?? ''}
      initialRate={profile?.hourly_rate ?? 0}
      gcal={gcal}
    />
  );
}

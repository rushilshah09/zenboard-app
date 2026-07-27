// Calendar — native Day/Week/Month calendar over calendar_events. Auth is enforced
// by the (app) layout; the view fetches its own events (RLS) per visible range and
// pulls fresh Google events on open when connected.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { CalendarView } from '@/components/calendar/calendar-view';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const { data: profile } = await supabase.from('profiles').select('preferences').eq('id', user!.id).maybeSingle();
  const connected = !!(profile?.preferences as Record<string, unknown> | null)?.gcal_connected;
  return <CalendarView connected={connected} spaceId={sid} />;
}

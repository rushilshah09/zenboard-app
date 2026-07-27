// GET /api/export/calendar — every calendar event the signed-in user owns, as an
// .ics file (principle 11: every object has an exit). RLS scopes the rows;
// serialization lives in lib/ics.ts where it's unit-tested. Mirrors the tasks/
// projects CSV export routes.
import { createClient } from '@/lib/supabase/server';
import { eventsToIcs, type IcsEvent } from '@/lib/ics';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in to export.', { status: 401 });

  const { data, error } = await supabase.from('calendar_events')
    .select('id, title, starts_at, ends_at, all_day')
    .order('starts_at', { ascending: true });
  if (error) return new Response(`Export failed: ${error.message}`, { status: 500 });

  const ics = eventsToIcs((data ?? []) as IcsEvent[]);
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="zenboard-calendar.ics"',
    },
  });
}

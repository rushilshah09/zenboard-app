// Calendar — native Day/Week/Month calendar over calendar_events. Auth via
// `requireUser()`; the view fetches its own events (RLS) per visible range and
// pulls fresh Google events on open when connected.
import { CalendarView } from '@/components/calendar/calendar-view';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';
import { currentProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const { sid } = await pageScope();
  // The page scope has already read this profile; asking again cost a round trip.
  const connected = !!((await currentProfile())?.preferences as Record<string, unknown> | null)?.gcal_connected;
  return (
    <>
      <PageStamp />
      <CalendarView connected={connected} spaceId={sid} />
    </>
  );
}

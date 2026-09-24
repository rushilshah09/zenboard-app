// GET /api/feed/<token>/calendar.ics — the subscribable plan.
//
// PUBLIC and unauthenticated by necessity: a calendar client sends no cookies,
// so the token in the path IS the credential. Same bearer-capability shape as
// the portal link, and the same discipline follows from it — only safe columns
// are ever selected, and every query is scoped to the token's owner EXPLICITLY
// rather than by RLS, because the service role has no RLS to lean on. (That
// exact assumption is what silently mis-numbered invoices once.)
//
// The path ends in `.ics` on purpose. Apple Calendar and Outlook both sniff the
// extension when the user pastes a URL, and a query string is the shape most
// likely to be mangled by the copy-paste-into-a-phone journey this URL takes.
import { createServiceClient } from '@/lib/supabase/server';
import { eventsToIcs, type IcsEvent } from '@/lib/ics';
import {
  FEED_TOKEN_KEY, looksLikeFeedToken, feedWindow, tasksAsIcsEvents, mergeFeed, type FeedTask,
} from '@/lib/calendar-feed';

// Never prerendered, never cached by the framework: the whole point is that a
// client fetching this an hour from now gets what is true an hour from now.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REFRESH_MINUTES = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!looksLikeFeedToken(token)) return new Response('Not found', { status: 404 });

  const svc = createServiceClient();

  // Find the owner by token. `preferences` is jsonb, so this is a containment
  // match on one key — no migration was needed to add the token at all.
  const { data: profile } = await svc
    .from('profiles')
    .select('id')
    .contains('preferences', { [FEED_TOKEN_KEY]: token })
    .maybeSingle();
  // 404 rather than 401: an unknown token should not confirm that the URL shape
  // is right, and a calendar client shows a friendlier failure for a missing
  // file than for a refused one.
  if (!profile) return new Response('Not found', { status: 404 });

  const win = feedWindow();
  const [eventsRes, tasksRes] = await Promise.all([
    // Titles and times ONLY. No notes, no estimates, no money — a feed URL ends
    // up in phone backups and third-party clients, so it carries the least that
    // still makes it useful.
    svc.from('calendar_events')
      .select('id, title, starts_at, ends_at, all_day')
      .eq('user_id', profile.id)
      .gte('starts_at', win.from)
      .lte('starts_at', win.to)
      .order('starts_at', { ascending: true }),
    svc.from('tasks')
      .select('id, title, scheduled_date, event_id, done')
      .eq('user_id', profile.id)
      .not('scheduled_date', 'is', null),
  ]);

  const events = (eventsRes.data ?? []) as IcsEvent[];
  // `event_id` arrives only once 0030 is applied; without it every scheduled
  // task is simply untwinned, which is exactly what the filter already assumes.
  const tasks = tasksAsIcsEvents((tasksRes.data ?? []) as FeedTask[], win);

  const ics = eventsToIcs(mergeFeed(events, tasks), 'Zenboard', new Date(), {
    refreshMinutes: REFRESH_MINUTES,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // INLINE, not attachment: a subscribing client is reading a document at a
      // URL, and `attachment` makes some of them offer a download instead.
      'Content-Disposition': 'inline; filename="zenboard.ics"',
      'Cache-Control': 'no-cache, must-revalidate',
      // The URL is a secret; keep it out of referrers and out of search results.
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

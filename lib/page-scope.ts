import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { activeSpaceId } from '@/lib/active-space';
import { currentProfile } from '@/lib/profile';
import { userTimezone } from '@/lib/user-tz';

// What every (app) page needs before it can ask its own questions: the
// request's Supabase client, who is signed in, and which space they are in.
// Once per request, and in ONE round trip.
//
// ── THE EXTRA WAVE ON EVERY CLICK (measured 2026-09-11) ─────────────────────
// Each page used to spell this out as three awaits in a row:
//
//     const supabase = await createClient();
//     const user = await requireUser();
//     const sid = await activeSpaceId(supabase, user.id);
//
// and then, further down, `await currentProfile()` or `await userTimezone()`.
// On a hard load that second read looked free, because the (app) layout had
// already started the profile read. But a CLIENT navigation does not render the
// layout, so there the profile read only began once the space list had come
// back: one more round trip in series on every sidebar click. Measured on a
// production build, a navigation cost exactly one more wave than a hard load
// of the same route, on every route.
//
// So the profile read starts HERE, alongside the space list. Nothing is
// returned for it on purpose: pages keep calling `currentProfile()` and
// `userTimezone()` where they need them, and those now resolve from the
// request cache instead of the network.
//
// Pages and their loaders only. A server action has no profile to read and
// must not pay for one: it uses `requireSession()` and `activeSpaceId()`.
export const pageScope = cache(async () => {
  const supabase = await createClient();
  const user = await requireUser();
  const [sid] = await Promise.all([activeSpaceId(supabase, user.id), currentProfile(), userTimezone()]);
  return { supabase, user, sid };
});

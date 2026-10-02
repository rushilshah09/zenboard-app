// Auth gate + app shell for every /(app) route. Unauthenticated users go to
// /login (RLS is the real security boundary). Loads the user's name + spaces and
// renders the sidebar / top bar around the page.
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { activeSpaceId, spaceList } from '@/lib/active-space';
import { currentProfile } from '@/lib/profile';
import { SIDEBAR_COOKIE, toSidebarMode } from '@/lib/sidebar-mode';
import { AppShell } from '@/components/shell/app-shell';
import { readPins } from '@/lib/pins';
import { readEnabledModules } from '@/lib/nav-modules';
import { ENTITY_TYPES } from '@/lib/connected';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // The layout still redirects — it is the right place to send a signed-out
  // visitor. It just is not a GATE: the page below renders concurrently, so
  // each page asks `requireUser()` for itself rather than trusting this line.
  const user = await requireUser();

  // Round trips are the whole cost of a navigation here (~220ms each to
  // Supabase), so nothing waits on anything it does not actually need.
  // `profile` and the space list are independent, and `spaceList()` is memoised,
  // so `activeSpaceId` rides along for free instead of issuing the second
  // `spaces` query this layout used to pay for.
  const [profile, spaces] = await Promise.all([currentProfile(), spaceList()]);
  const sid = await activeSpaceId(supabase, user.id);
  // The projects query that used to live here is GONE with the sidebar's
  // hard-coded Projects list. Every page load paid for it just to draw a few
  // nav rows; the pinned rail reads what it needs out of `profile.preferences`,
  // which was already loaded above.

  const name = profile?.full_name?.trim() || user.email?.split('@')[0] || 'there';
  // The server resolves day ids ("today") in this zone. It can't derive one —
  // on Cloudflare it runs in UTC — so <TimezoneSync> reports the browser's.
  const storedTz = (profile?.preferences as Record<string, unknown> | null)?.timezone;
  const timezone = typeof storedTz === 'string' ? storedTz : null;

  // The sidebar's pinned list. No extra round trip: `profile` is already loaded
  // above, and pins live in its `preferences` JSON (lib/pins.ts explains why
  // there and not in a table of their own).
  const pins = readPins(profile?.preferences, ENTITY_TYPES);

  // WHICH MODULES THIS PERSON USES. Same jsonb, same round trip as the pins
  // above — `profile` is already loaded, so this costs nothing.
  //
  // null means "never configured", and the shell renders ALL modules for it.
  // That is what keeps this migration-free: every account that onboarded before
  // the setting existed has no key, so nobody logs in to find six modules gone.
  // See lib/nav-modules.ts.
  const enabledModules = readEnabledModules(profile?.preferences);

  // The sidebar's saved mode, so the FIRST paint already has the right one.
  // Read here rather than in the shell because only the server sees cookies
  // before render — the shell used to start expanded and reflow one frame later.
  const sidebarMode = toSidebarMode((await cookies()).get(SIDEBAR_COOKIE)?.value);

  return (
    <AppShell name={name} email={user.email ?? ''} spaces={spaces} pins={pins} activeSpaceId={sid} timezone={timezone} initialSidebarMode={sidebarMode} enabledModules={enabledModules}>
      {children}
    </AppShell>
  );
}

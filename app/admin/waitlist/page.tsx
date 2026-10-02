// ── /admin/waitlist ─────────────────────────────────────────────────────────
//
// Everyone who has joined, for the one account that runs the platform.
//
// THE GATE IS THE FIRST STATEMENT IN THE PAGE, not a layout above it: a layout is not a gate — a
// route rendered under one can still be reached, which is the bug lib/auth.ts exists because of.
// `requireAdmin()` sends a signed-out visitor to log in and gives a signed-in stranger a 404,
// because whether this address exists is not something to confirm to someone with no business here.
//
// Nothing here is cached: `listWaitlist()` reads through the service role and the page is rendered
// per request, so the list is what the database holds at the moment it is asked.

import type { Metadata } from 'next';
import { adminOk } from '@/lib/admin';
import { listWaitlist, waitlistReady } from '@/lib/waitlist-data';
import { WAITLIST_SEED, joinedTotal } from '@/lib/waitlist';
import { WaitlistTable } from '@/components/admin/waitlist-table';
import { AdminGate } from '@/components/admin/admin-gate';
import { signOutAdmin } from '@/lib/actions/admin';
import { cardClass } from '@/components/ds/ui';

// An admin page is never a search result.
export const metadata: Metadata = { title: 'Waitlist · Zenboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Page() {
  // THE GATE IS THE FIRST STATEMENT, and it does not redirect: someone holding the password has no
  // Supabase account, so sending them to a login screen would be a door with no handle. The page
  // renders its own door instead.
  if (!(await adminOk())) return <AdminGate />;
  const [ready, rows] = await Promise.all([waitlistReady(), listWaitlist()]);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10">
      <header className="mb-8 flex h-12 items-center justify-between gap-4">
        <h1 className="text-title font-editorial text-ink-900">Waitlist</h1>
        <form action={signOutAdmin}>
          <button type="submit" className="text-caption text-ink-500 underline-offset-2 hover:underline">Lock</button>
        </form>
        <p className="text-caption tabular-nums text-ink-500">
          {joinedTotal(rows.length).toLocaleString('en-US')} counted
          <span className="text-ink-500"> · {WAITLIST_SEED} seeded + {rows.length.toLocaleString('en-US')} joined</span>
        </p>
      </header>

      {!ready ? (
        // The honest state. Migration 0048 has not been applied, so there is no table to read —
        // saying so beats an empty list that looks like nobody has joined.
        <div className={cardClass('p-6')}>
          <p className="text-body text-ink-900">The waitlist table isn’t there yet.</p>
          <p className="mt-1 text-body text-ink-600">
            Apply <code className="font-mono text-meta">supabase/migrations/0048_waitlist.sql</code> and this
            list will fill. Until then the site shows its ordinary call to action instead of the form.
          </p>
        </div>
      ) : (
        <WaitlistTable rows={rows} />
      )}
    </main>
  );
}

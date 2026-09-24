// Standalone focus-timer surface for the native desktop overlay (Tauri shell).
// It lives OUTSIDE the (app) route group on purpose: no sidebar, no top bar —
// just the timer filling a small always-on-top OS window. Auth is handled here
// (there is no shell layout to enforce it). Forced to the dark B&G theme, since
// the overlay is a single-look surface.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { FocusTimer } from '@/components/focus/focus-timer';

export const dynamic = 'force-dynamic';

export default async function FocusOverlayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)' }}>
      {/* Force the dark look regardless of the saved theme — the boot script
          stamps data-theme after paint, so this overrides it for the overlay. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.setAttribute('data-theme','dark')" }} />
      {user ? (
        <FocusTimer embedded activeSpaceId={await activeSpaceId(supabase, user.id)} />
      ) : (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--color-ink-900)', fontWeight: 500 }}>Sign in to Zenboard</span>
            <span style={{ fontSize: 12, color: 'var(--color-ink-500)', maxWidth: 240 }}>Log in once in this window to use the always-on-top focus timer.</span>
            <Link href="/login" style={{ marginTop: 4, fontSize: 13, color: 'var(--color-ink-900)', textDecoration: 'underline' }}>Log in</Link>
          </div>
        </div>
      )}
    </div>
  );
}

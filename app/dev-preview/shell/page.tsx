'use client';
// Dev-only harness for the app shell (sidebar + top bar + content), rendered with
// staged data so the nav/layout can be verified without a session. 404s in prod.
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';

const SPACES = [{ id: 's1', name: "Rushil shah's workspace", emoji: '✦', color: '#9A1B6F', tag: 'WORK' as const }];
const PROJECTS = [{ id: 'p1', name: 'New life', color: '#D1453E' }];

export default function ShellPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <AppShell name="Rushil shah" email="designdotrushil@gmail.com" spaces={SPACES} projects={PROJECTS} activeSpaceId="s1">
      <div style={{ padding: '32px 40px', color: 'var(--ink-3)', fontSize: 'var(--text-body-size)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-4)', fontSize: 'var(--text-small-size)' }}>
          <span>🔒 Private</span><span>›</span><span>Life</span><span>›</span><span>New page</span>
        </div>
      </div>
    </AppShell>
  );
}

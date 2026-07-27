// Public client portal — UNAUTHENTICATED, read-only. The token is validated
// server-side and only a fixed safe projection is returned (see lib/portal.ts).
// Always dynamic: the client sees current data on every load, never a stale cache.
import type { Metadata } from 'next';
import { loadPortalByToken } from '@/lib/portal';
import { PortalDocument } from '@/components/portal/portal-document';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Project portal',
  robots: { index: false, follow: false }, // tokenized links should never be indexed
};

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadPortalByToken(token);

  if (!view) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--canvas)' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-stat-size)', color: 'var(--ink)', marginBottom: 8 }}>This link isn’t available.</div>
          <p style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            The portal may have been turned off or the link may have changed. Please ask for an updated link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--canvas)' }}>
      <PortalDocument view={view} token={token} />
    </main>
  );
}

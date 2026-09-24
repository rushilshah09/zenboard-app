'use client';
// Dev-only mirror of the DS portal (/design) for auth-free visual verification.
// 404s in production.
import { notFound } from 'next/navigation';
import { DsPortal } from '@/components/design-system/ds-portal';

export default function DsPortalPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--canvas)', padding: 4 }}>
      <div style={{ height: '100%', overflow: 'hidden', background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 12 }}>
        <DsPortal />
      </div>
    </div>
  );
}

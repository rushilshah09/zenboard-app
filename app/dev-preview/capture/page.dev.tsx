'use client';
// Dev-only harness for Quick Capture — mounts the overlay and opens it so the
// natural-language chips can be verified without a session (saving will error
// here; the parse → chips layer is what's under test). 404s in prod.
import { useEffect } from 'react';
import { notFound } from 'next/navigation';
import { QuickCapture, CAPTURE_EVENT } from '@/components/shell/quick-capture';

export default function CapturePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  useEffect(() => { const t = setTimeout(() => window.dispatchEvent(new Event(CAPTURE_EVENT)), 80); return () => clearTimeout(t); }, []);
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)', display: 'grid', placeItems: 'center' }}>
      <button onClick={() => window.dispatchEvent(new Event(CAPTURE_EVENT))}
        style={{ height: 32, padding: '0 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink-2)', cursor: 'pointer' }}>
        Open capture (C)
      </button>
      <QuickCapture />
    </div>
  );
}

'use client';
// Dev-only harness simulating the native overlay window (Tauri): the timer in
// `embedded` mode, filling a 400px-wide always-on-top-sized frame. Tasks need
// auth so the list shows its empty state; the fill layout + dial are what's under
// test here. 404s in prod.
import { FocusTimer } from '@/components/focus/focus-timer';

export default function FocusOverlayHarness() {
  return (
    <div style={{ height: '100dvh', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
      <div style={{ width: 400, height: '100dvh', overflow: 'auto', boxShadow: '0 0 0 1px var(--line)' }}>
        <FocusTimer embedded />
      </div>
    </div>
  );
}

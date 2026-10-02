'use client';
// The demo's front door, and the reason it is safe: the sandbox is INSTALLED here, by name, before the
// product's views are even requested, and the views load on the client only, after it. See sandbox.ts
// for why this is a call and not a bare import (a bare import was tree-shaken away).
import dynamic from 'next/dynamic';
import { installSandbox } from './sandbox';

installSandbox();

const DemoApp = dynamic(() => import('./demo-app').then((m) => m.DemoApp), {
  ssr: false,
  // The desk, while the app loads: the same ground the shell lies on, so nothing flashes.
  loading: () => <div style={{ height: '100dvh', background: 'var(--color-surface-desk)' }} />,
});

export function DemoEntry() {
  return <DemoApp />;
}

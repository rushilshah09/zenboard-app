'use client';
// Dev-only harness proving <Drawer> and <PageView> side-peek share ONE chrome
// (§2.11 "one panel, not two that look alike"). Both dock to the right edge, so
// open one at a time and compare: border radius, header padding, resize handle.
// The point is the CHROME, not the content — the content region is deliberately
// identical filler in both.
import { useState } from 'react';
import { Drawer, PageView, Button } from '@/components/ds/ui';

function Filler({ label }: { label: string }) {
  return (
    <div className="p-4">
      <h2 className="text-title-2 text-ink-900">{label}</h2>
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="rounded-md border border-line-soft p-3 text-ui text-ink-700">Row {i + 1}</div>
        ))}
      </div>
    </div>
  );
}

export default function PanelParityHarness() {
  const [open, setOpen] = useState<null | 'drawer' | 'pageview'>(null);

  return (
    <div className="min-h-screen bg-paper p-8">
      <h1 className="text-title-3 text-ink-900">Panel parity harness</h1>
      <p className="mt-1 max-w-prose text-body text-ink-600">
        Open each, one at a time. The two shells must be indistinguishable: same
        rounded-lg corners, same header height (py-2.5), same ink resize bar on
        the inner edge (hover it), same bounds. Drag or arrow-key the handle.
      </p>

      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={() => setOpen('drawer')} data-testid="open-drawer">Open Drawer (detail)</Button>
        <Button variant="secondary" onClick={() => setOpen('pageview')} data-testid="open-pageview">Open PageView (side peek)</Button>
      </div>

      <Drawer
        open={open === 'drawer'}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Drawer — record detail"
        actions={<Button size="sm" variant="ghost">Share</Button>}
      >
        <Filler label="Drawer body" />
      </Drawer>

      {open === 'pageview' && (
        <PageView
          open
          onOpenChange={(o) => !o && setOpen(null)}
          contentType="task"
          mode="side-peek"
          title="PageView — side peek"
          actions={<Button size="sm" variant="ghost">Share</Button>}
        >
          <Filler label="PageView body" />
        </PageView>
      )}
    </div>
  );
}

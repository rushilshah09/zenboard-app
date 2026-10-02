'use client';
// Dev-only harness for <PageView> — the one opening system.
//
// It exists because the thing worth checking is the BEHAVIOUR, not one screen:
// that a task and an invoice open identically, that the mode menu switches
// between the three modes, that switching records replaces the content instead
// of closing the panel, that the width sticks, and that the shortcuts fire. None
// of that is visible in a screenshot of a single state.
import { useState } from 'react';
import { PageView, Button, DropdownMenuItem, type ContentType } from '@/components/ds/ui';

const RECORDS = [
  { id: 'r1', type: 'task' as ContentType, title: 'Ridgeline brand portal', crumbs: ['Projects', 'Ridgeline', 'Packaging', 'Ridgeline brand portal'] },
  { id: 'r2', type: 'task' as ContentType, title: 'Magazine design outline', crumbs: ['Projects', 'Ridgeline', 'Magazine design outline'] },
  { id: 'r3', type: 'invoice' as ContentType, title: 'INV-014 — Meridian Studio', crumbs: ['Finance', 'INV-014'] },
  { id: 'r4', type: 'document' as ContentType, title: 'Weekly and daily planning', crumbs: ['Docs', 'Weekly and daily planning'] },
];

export default function PageViewHarness() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const rec = openIdx === null ? null : RECORDS[openIdx];

  return (
    <div className="min-h-screen bg-paper p-8">
      <h1 className="text-title-3 text-ink-900">PageView harness</h1>
      <p className="mt-1 max-w-prose text-body text-ink-600">
        Open a record, then switch to another WITHOUT closing — the panel should stay
        put and only its contents change. ⌘↵ full page · ⌥↵ side peek · ⌘⇧↵ new tab ·
        ctrl+\ toggle · ← → move between records · Esc close.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {RECORDS.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setOpenIdx(i)}
            className="focus-ring flex h-9 w-full max-w-md items-center gap-2 rounded-sm px-2 text-left text-ui text-ink-800 hover:bg-surface-hover"
          >
            <span className="text-overline text-ink-500">{r.type}</span>
            <span className="truncate">{r.title}</span>
          </button>
        ))}
      </div>

      {rec && (
        <PageView
          open={openIdx !== null}
          onOpenChange={(o) => !o && setOpenIdx(null)}
          contentType={rec.type}
          title={rec.title}
          breadcrumbs={rec.crumbs.map((label, i) => ({ label, href: i < rec.crumbs.length - 1 ? '#' : undefined }))}
          href={`/dev-preview/page-view?r=${rec.id}`}
          history={{
            canBack: (openIdx ?? 0) > 0,
            canForward: (openIdx ?? 0) < RECORDS.length - 1,
            onBack: () => setOpenIdx((i) => Math.max(0, (i ?? 0) - 1)),
            onForward: () => setOpenIdx((i) => Math.min(RECORDS.length - 1, (i ?? 0) + 1)),
          }}
          actions={<Button size="sm" variant="ghost">Share</Button>}
          more={<>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem danger>Delete</DropdownMenuItem>
          </>}
        >
          <div className="p-4">
            <h2 className="text-title-2 text-ink-900">{rec.title}</h2>
            <p className="mt-2 text-body text-ink-600">
              Content for {rec.type} {rec.id}. Only this region differs between modules —
              the toolbar, breadcrumbs, modes and shortcuts above are shared.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="rounded-md border border-line-soft p-3 text-ui text-ink-700">
                  Row {i + 1} — scrolls inside the panel, so the toolbar stays reachable.
                </div>
              ))}
            </div>
          </div>
        </PageView>
      )}
    </div>
  );
}

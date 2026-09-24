'use client';
// Dev-only harness for the project Doc editor after its <Drawer> → <PageView>
// migration (§2.11). getPage is auth-gated, so this renders the SAME PageView
// shell DocEditor produces — contentType="document" (defaults full-page), the
// centered reading column, and the Saving…/Saved stamp in the toolbar `actions`
// slot — with static content, to confirm the chrome and reading measure. 404s in prod.
import { useState } from 'react';
import { PageView, Button } from '@/components/ds/ui';

export default function DocPeekHarness() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Kickoff brief');

  return (
    <div className="min-h-screen bg-paper p-8">
      <h1 className="text-title-3 text-ink-900">Doc peek harness</h1>
      <p className="mt-1 max-w-prose text-body text-ink-600">
        A document opens through PageView, defaulting to full page (same as
        /documents). The body must be a centered reading column, not full-bleed,
        and the “Saved” stamp sits in the toolbar. Switch to side peek via the
        view-mode menu — the column simply fills.
      </p>
      <Button className="mt-6" variant="secondary" onClick={() => setOpen(true)}>Open doc</Button>

      {open && (
        <PageView
          open
          onOpenChange={(o) => !o && setOpen(false)}
          contentType="document"
          title={title.trim() || 'Untitled'}
          href="/documents?page=demo"
          actions={<span role="status" className="px-1 text-meta text-ink-500">Saved</span>}
        >
          <div className="mx-auto w-full max-w-[720px] px-6 pb-16 pt-6">
            <input data-chromeless
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className="mb-4 w-full border-0 bg-transparent text-title-2 text-ink-900 outline-none placeholder:text-ink-500"
            />
            <p className="mb-3 text-body text-ink-700">This is the document body. In the real editor a BlockEditor renders here; the reading column keeps the measure comfortable even when the page is full-bleed.</p>
            {Array.from({ length: 8 }, (_, i) => (
              <p key={i} className="mb-3 text-body text-ink-700">Paragraph {i + 1}. The measure should stay ~720px and centered, matching how a document reads in the Documents module.</p>
            ))}
          </div>
        </PageView>
      )}
    </div>
  );
}

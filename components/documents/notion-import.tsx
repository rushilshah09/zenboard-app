'use client';
// Notion → Documents, from the place people actually look for it.
//
// The import already existed and worked — it was in Settings → Import, which is
// where you go to configure the app, not where you go when you have a folder of
// Notion pages and want them in Documents. This is the SAME parse and the SAME
// server action; only the door is new (user: "we give option in our document,
// import").
//
// ── WHY THIS ASKS FOR AN EXPORT, NOT A LINK ────────────────────────────────
// A Notion URL alone cannot fetch a private page. Notion's API needs an
// `Authorization` header and the page has to be shared with an integration; a
// page that is merely "published to web" can be read, but only through an
// undocumented internal endpoint that would break without warning and would
// still cover none of the pages that matter. The export is the path that works
// for a whole private workspace today, so it is the one offered, and the dialog
// says so instead of failing at the user later.
import { useRef, useState } from 'react';
import { Upload, Check } from '@/components/ds/icons';
import { Icon, Modal, Button, toast } from '@/components/ds/ui';
import { parseNotionMarkdown, isImportableDoc, type ImportedDoc } from '@/lib/import-docs';
import { importDocs } from '@/lib/actions/library';

export function NotionImportModal({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fires after a successful write so the host can refresh its list. */
  onImported?: (count: number) => void;
}) {
  const [docs, setDocs] = useState<ImportedDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setDocs(null); if (inputRef.current) inputRef.current.value = ''; };

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => isImportableDoc(f.name));
    if (!picked.length) { toast({ message: 'No Markdown files in that selection.', variant: 'error' }); return; }
    // Read in parallel: a 200-page export read one file at a time is a visibly
    // slow start to something that should feel instant.
    setDocs(await Promise.all(picked.map(async (f) => parseNotionMarkdown(f.name, await f.text()))));
  }

  async function run() {
    if (!docs?.length) return;
    setBusy(true);
    try {
      const res = await importDocs(docs);
      if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
      toast({ message: `${res.count} document${res.count === 1 ? '' : 's'} imported.`, variant: 'success' });
      onImported?.(res.count);
      reset();
      onOpenChange(false);
    } catch {
      toast({ message: 'Could not import those documents.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const blocks = docs?.reduce((n, d) => n + d.blocks.length, 0) ?? 0;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}
      size="sm"
      title="Import from Notion"
      description="In Notion: Settings → Import & export → Export content, as Markdown. Then pick the .md files here."
      footer={(
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!docs?.length} loading={busy} onClick={run}>
            {docs?.length ? `Import ${docs.length} document${docs.length === 1 ? '' : 's'}` : 'Import'}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="focus-ring flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-7 text-center transition-colors hover:bg-surface-hover"
        >
          <Icon icon={Upload} size={20} className="text-ink-500" />
          <span className="text-ui text-ink-800">Choose your exported .md files</span>
          <span className="text-caption text-ink-500">Select the whole folder, subfolders come across too.</span>
        </button>
        <input ref={inputRef} type="file" accept=".md,.markdown,.txt" multiple onChange={onFiles} className="sr" />

        {docs && (
          <div className="rounded-lg border border-line-soft bg-surface-sunken p-3.5">
            {/* What is about to happen, before it happens. An import that just
                says "12 files" tells you nothing about whether your document
                survived; the block count is the first evidence that it did. */}
            <p className="mb-2 text-ui text-ink-800">
              <b className="tabular-nums">{docs.length}</b> document{docs.length === 1 ? '' : 's'}
              {' · '}<b className="tabular-nums">{blocks}</b> block{blocks === 1 ? '' : 's'}
            </p>
            <ul className="flex flex-col gap-1">
              {docs.slice(0, 5).map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-caption text-ink-600">
                  <Icon icon={Check} size={12} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 truncate">{d.title}</span>
                  <span className="shrink-0 tabular-nums text-ink-500">{d.blocks.length}</span>
                </li>
              ))}
              {docs.length > 5 && <li className="ps-4 text-caption text-ink-500">+{docs.length - 5} more</li>}
            </ul>
          </div>
        )}

        <p className="text-caption text-ink-500">
          Headings, nested lists, to-dos, tables, images, callouts, toggles, quotes and code all come
          across with their structure. Page properties arrive as text.
        </p>
      </div>
    </Modal>
  );
}

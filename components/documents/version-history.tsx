'use client';
// Version history for a document — roadmap #4 / Phase 10.
//
// Opens through <PageView> like every other record surface (§2.11), so it
// inherits the peek/center/full modes, Escape, focus handling and the toolbar
// rather than inventing a panel. The list is grouped Today / Yesterday / Earlier
// by lib/version-policy's bucket rule.
import { useCallback, useEffect, useState } from 'react';
import { PageView, Button, EmptyState, EmptyLine, Icon, toast, useConfirm } from '@/components/ds/ui';
import { History } from '@/components/ds/icons';
import { listVersions, getVersion, restoreVersion, type PageVersion } from '@/lib/actions/versions';
import { versionBucket } from '@/lib/version-policy';
import { formatDayTime } from '@/lib/date';
import { toBlocks, type Block } from '@/lib/blocks';


/** A few lines of the snapshot, so a timestamp isn't the only thing to choose by. */
function previewOf(content: Record<string, unknown>): string {
  const blocks: Block[] = toBlocks(content);
  const text = blocks.map((b) => (b.text ?? "").trim()).filter(Boolean).join(" · ");
  return text.length > 240 ? text.slice(0, 239).trimEnd() + '…' : text;
}

export function VersionHistory({ pageId, open, onClose, onRestored }: {
  pageId: string;
  open: boolean;
  onClose: () => void;
  /** The host reloads the page body — this component never mutates local state. */
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<PageVersion[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [confirm, confirmUI] = useConfirm();

  const load = useCallback(async () => {
    // The action THROWS when there is no session (requireUser), so a bare await
    // would reject and leave this stuck on "Loading history…" forever. Every
    // await here is guarded for that reason — a failed load must say so and
    // settle, never spin (§2.5).
    let res: Awaited<ReturnType<typeof listVersions>>;
    try {
      res = await listVersions(pageId);
    } catch {
      toast({ message: 'Could not load history.', variant: 'error' });
      setVersions([]);
      return;
    }
    if ('error' in res) { toast({ message: 'Could not load history.', variant: 'error' }); setVersions([]); return; }
    setVersions(res.versions);
    setSelected((cur) => cur ?? res.versions[0]?.id ?? null);
  }, [pageId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!selected) { setPreview(''); return; }
    let alive = true;
    getVersion(selected)
      .then((r) => { if (alive) setPreview('error' in r ? '' : previewOf(r.content)); })
      .catch(() => { if (alive) setPreview(''); });   // a preview is never worth an unhandled rejection
    return () => { alive = false; };
  }, [selected]);

  const restore = async () => {
    if (!selected) return;
    const stamp = versions?.find((v) => v.id === selected)?.created_at;
    const ok = await confirm({
      title: 'Restore this version?',
      body: `The document goes back to how it was on ${stamp ? formatDayTime(stamp) : 'this version'}. Your current version is saved to history first, so you can undo this.`,
      actionLabel: 'Restore',
    });
    if (!ok) return;
    setBusy(true);
    let res: Awaited<ReturnType<typeof restoreVersion>>;
    try {
      res = await restoreVersion(selected);
    } catch {
      // Without this the button would stay disabled on "Restoring…" for good.
      setBusy(false);
      toast({ message: 'Could not restore this version.', variant: 'error' });
      return;
    }
    setBusy(false);
    if ('error' in res) { toast({ message: 'Could not restore this version.', variant: 'error' }); return; }
    toast({ message: 'Version restored. The previous one is in history.' });
    onRestored();
    onClose();
  };

  // Group for display without losing the newest-first order inside each bucket.
  const groups: { label: string; items: PageVersion[] }[] = [];
  for (const v of versions ?? []) {
    const label = versionBucket(v.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(v);
    else groups.push({ label, items: [v] });
  }

  return (
    <>
      <PageView
        open={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        contentType="document"
        mode="side-peek"
        title="Version history"
        actions={selected && versions?.length ? (
          <Button size="sm" variant="primary" disabled={busy} onClick={restore}>
            {busy ? 'Restoring…' : 'Restore'}
          </Button>
        ) : undefined}
      >
        <div className="p-4">
          {versions === null ? (
            <EmptyLine>Loading history…</EmptyLine>
          ) : versions.length === 0 ? (
            <EmptyState
              size="inline"
              illustration={<Icon icon={History} size={20} />}
              title="No versions yet"
              description="Zenboard saves a version as you write, about every ten minutes of editing."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((g, gi) => (
                <div key={`${g.label}-${gi}`}>
                  <div className="pb-1 text-overline text-ink-500">{g.label}</div>
                  <ul className="flex flex-col">
                    {g.items.map((v) => {
                      const on = v.id === selected;
                      return (
                        <li key={v.id}>
                          <button
                            onClick={() => setSelected(v.id)}
                            aria-current={on ? 'true' : undefined}
                            className={`focus-ring flex min-h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-ui ${on ? 'bg-surface-hover text-ink-900' : 'text-ink-700 hover:bg-surface-hover'}`}
                          >
                            <Icon icon={History} size={14} className="shrink-0 text-ink-500" />
                            <span className="min-w-0 flex-1 truncate">{formatDayTime(v.created_at) ?? v.created_at}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {preview && (
                <div className="rounded-md border border-line-soft p-3">
                  <div className="pb-1 text-overline text-ink-500">Preview</div>
                  <p className="text-caption text-ink-600">{preview}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </PageView>
      {confirmUI}
    </>
  );
}

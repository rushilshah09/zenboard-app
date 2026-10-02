'use client';
// CoverPicker — the document cover panel (Notion-benchmark structure in the
// Zenboard design language, sharing PickerPanel/PickerTabs with the icon
// picker):
//   tabs    · Gallery | Upload | Link + quiet Remove right
//   gallery · "Color & Gradient" section — the 20 curated Japanese gradients,
//             4-up 2:1 swatches, accent ring + check when current
//   upload  · UploadZone → downscaled image, stored as an ATTACHMENT (§7H)
//   link    · paste an image address → cover
// Controlled popover: the parent owns the trigger and open state.
import { useState } from 'react';
import { Icon, Button, TextInput } from "@/components/ds/ui";
import { Check } from "@/components/ds/icons";
import { cn } from '@/lib/cn';
import { PickerPanel, PickerTabs, PickerQuietAction } from '@/components/ui/picker-panel';
import { UploadZone } from '@/components/ui/upload-zone';
import { DOC_COVERS, attachmentCover } from '@/lib/covers';
import { fileToDataUrl, downscaleImage, reencodedName } from '@/lib/image';
import { useAttachmentUpload } from '@/lib/use-attachment';
import type { AttachmentOwner } from '@/lib/attachments';

type Tab = 'gallery' | 'upload' | 'link';

type CoverPickerProps = {
  current?: string;
  onPick: (cover: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  /**
   * The page the cover belongs to. Absent only for a page that has not been
   * saved yet (a `tmp-` row), which has no id to attach anything to — that case
   * falls back to the inline form rather than refusing to set a cover.
   */
  attachTo?: AttachmentOwner;
};

/** The editor's cover panel: the picker in its anchored PickerPanel, exactly as before. */
export function CoverPicker({ align = 'left', ...rest }: CoverPickerProps & { align?: 'left' | 'right' }) {
  return (
    <PickerPanel label="Choose a cover" width={560} align={align} onClose={rest.onClose}>
      <CoverPickerBody {...rest} />
    </PickerPanel>
  );
}

/**
 * The picker WITHOUT a surface (2026-09-30). The Documents gallery sets covers from a tile, and a
 * tile clips its overflow — PickerPanel is `position: absolute`, so a 560px panel opened there
 * would have been sliced at the tile's edge (the documented popover-clipping bug class). The
 * gallery hosts this same body in the DS's portalled Popover instead; the editor keeps its panel.
 * One picker, two hosts, no second copy of the tabs.
 */
export function CoverPickerBody({ current, onPick, onRemove, onClose, attachTo }: CoverPickerProps) {
  const [tab, setTab] = useState<Tab>('gallery');
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const { upload, busy } = useAttachmentUpload(attachTo);

  /**
   * Downscale first, then store the bytes as an attachment.
   *
   * Downscaling is not an optimisation here, it is the point: a cover band is
   * 279px tall, so a 12 MP phone photo is ~40× more pixels than any screen will
   * ever show, and re-encoding at 1600px turns a 6 MB upload into ~200 KB before
   * it leaves the browser.
   */
  async function intake(file: File) {
    setErr(null);
    try {
      if (!attachTo) {
        // Unsaved page: no owner row to hang a file off. Inline, as before.
        onPick(await fileToDataUrl(file, { max: 1600, quality: 0.82 }));
        onClose();
        return;
      }
      const { blob, mime } = await downscaleImage(file, { max: 1600, quality: 0.82 });
      const saved = await upload(new File([blob], reencodedName(file.name, mime), { type: mime }));
      if (!saved) { setErr('Upload failed'); return; }
      onPick(attachmentCover(saved.id));
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
  }

  function submitLink() {
    const raw = link.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    try { new URL(url); } catch { setErr('That doesn’t look like a link'); return; }
    onPick(url); onClose();
  }

  return (
    <>
      <PickerTabs<Tab>
        tabs={[{ id: 'gallery', label: 'Gallery' }, { id: 'upload', label: 'Upload' }, { id: 'link', label: 'Link' }]}
        active={tab} onTab={(t) => { setTab(t); setErr(null); }}
        right={onRemove ? <PickerQuietAction label="Remove" onClick={() => { onRemove(); onClose(); }} /> : undefined}
      />
      {tab === 'gallery' && (
        <div className="max-h-[348px] overflow-y-auto px-3 pb-3 [overscroll-behavior:contain]">
          <div className="pt-1.5 pb-2.5 text-caption font-medium text-ink-500">Color &amp; gradient</div>
          <div className="grid grid-cols-4 gap-2">
            {DOC_COVERS.map((c) => {
              const on = current === c.id;
              return (
                <button key={c.id} title={c.name} aria-label={`${c.name} cover`} aria-pressed={on}
                  onClick={() => { onPick(c.id); onClose(); }}
                  className={cn(
                    'relative aspect-[2/1] cursor-pointer rounded-sm transition-[box-shadow] duration-fast',
                    on
                      ? 'ring-2 ring-[var(--accent)]'
                      : 'ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-ink-900)_8%,transparent)] hover:ring-[color-mix(in_srgb,var(--color-ink-900)_22%,transparent)]',
                  )}
                  // Cover fill is user content — the sanctioned inline-style escape.
                  style={{ background: c.css }}>
                  {on && (
                    <span className="absolute right-[5px] top-[5px] grid size-4 place-items-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
                      <Icon icon={Check} size={12} weight="bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'upload' && (
        <div className="px-3 pb-3">
          <UploadZone hint={busy ? "Uploading…" : "Recommended 1500 × 400 px or larger · max 8 MB"} height={148} error={err} onFile={intake} />
        </div>
      )}
      {tab === 'link' && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TextInput size="sm" autoFocus value={link}
                onChange={(e) => { setLink(e.target.value); setErr(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') submitLink(); }}
                placeholder="Paste an image link…" autoComplete="off" data-1p-ignore data-lpignore="true" />
            </div>
            {/* sm to match the 28px TextInput beside it — md left the row's two
                controls at different heights. */}
            <Button size="sm" variant="primary" onClick={submitLink} disabled={!link.trim()}>Add cover</Button>
          </div>
          <div className={cn('pt-2 text-caption', err ? 'text-danger-600' : 'text-ink-500')}>{err ?? 'Works with any image link from the web.'}</div>
        </div>
      )}
    </>
  );
}

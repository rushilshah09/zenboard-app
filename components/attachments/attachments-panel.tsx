'use client';
// The ONE attachments surface — §7H, migration 0033.
//
// Owner-agnostic on purpose: it takes an `AttachmentOwner` and nothing else, so
// a project's Files tab, a task drawer and a document all render the same list
// with the same affordances. §7H says "files everywhere"; the way that stays
// true is one component, not three that drift.
//
// Gated: without 0033 `listAttachments` returns [] and the actions refuse, so
// the panel renders its empty state and the upload simply reports the reason.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Plus, FileText, Image as ImageIcon, Video, Volume2 } from '@/components/ds/icons';
import { Icon, Button, IconButton, EmptyLine, AddLine, useConfirm, toast } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { listAttachments, deleteAttachment } from '@/lib/actions/attachments';
import { setFileClientVisible } from '@/lib/actions/portal';
import { useAttachmentUpload, openAttachment } from '@/lib/use-attachment';
import { attachmentKind, formatBytes, type Attachment, type AttachmentOwner } from '@/lib/attachments';
import { ShareToggle } from '@/components/sharing/share-toggle';
import { applyShare } from '@/components/sharing/apply-share';
import type { ShareChannels } from '@/lib/visibility';

const GLYPH = { image: ImageIcon, pdf: FileText, video: Video, audio: Volume2, file: Paperclip } as const;

export function AttachmentsPanel({ owner, channels, quiet = false, className }: {
  owner: AttachmentOwner;
  /**
   * The project's share switches. Present only where a client is in the
   * picture — the project Files tab — so a file attached to a personal note
   * never grows a control that implies somebody is watching.
   */
  channels?: ShareChannels;
  /**
   * Say nothing about files that are not there — no loading line, no "No files yet", just the list's quiet add
   * line (DS `AddLine`) — and name the section only once it holds something. For a panel that already has a lot
   * to say, like a task's (2026-09-21: "so much cluttered"); a project's Files tab keeps the full empty state.
   */
  quiet?: boolean;
  className?: string;
}) {
  const [files, setFiles] = useState<Attachment[] | null>(null);   // null = still loading
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error, clearError } = useAttachmentUpload(owner);
  const [confirm, confirmDialog] = useConfirm();

  // `owner` is an object literal at most call sites, so depend on its VALUE
  // rather than its identity or this refetches on every parent render.
  const ownerKey = JSON.stringify(owner);
  const load = useCallback(() => {
    let gone = false;
    void listAttachments(JSON.parse(ownerKey) as AttachmentOwner).then((rows) => { if (!gone) setFiles(rows); });
    return () => { gone = true; };
  }, [ownerKey]);
  useEffect(load, [load]);

  async function take(list: FileList | null) {
    if (!list?.length) return;
    clearError();
    // Sequential, not parallel: each upload holds a one-shot ticket, and ten at
    // once would race for the same connection budget while the user watches a
    // spinner that means nothing. One at a time, each appearing as it lands.
    for (const file of Array.from(list)) {
      const saved = await upload(file);
      if (saved) setFiles((cur) => [...(cur ?? []), saved]);
    }
  }

  async function open(a: Attachment) {
    const res = await openAttachment(a.id);
    if ('error' in res) toast({ message: res.error, variant: 'error' });
  }

  async function share(a: Attachment, next: boolean) {
    const set = (v: boolean) => setFiles((cur) => (cur ?? []).map((f) => (f.id === a.id ? { ...f, client_visible: v } : f)));
    set(next);
    await applyShare(() => setFileClientVisible(a.id, next), () => set(!next), (m) => toast({ message: m, variant: 'error' }));
  }

  async function remove(a: Attachment) {
    // Deleting bytes is not reversible — the one action here that earns a dialog
    // (INTERACTION_STANDARDS §2.2: triage by reversibility).
    const ok = await confirm({
      title: `Delete “${a.filename}”?`,
      body: 'The file is removed permanently.',
      actionLabel: 'Delete file',
      tone: 'danger',
    });
    if (!ok) return;
    const before = files ?? [];
    setFiles(before.filter((f) => f.id !== a.id));
    const res = await deleteAttachment(a.id);
    if ('error' in res) { setFiles(before); toast({ message: res.error, variant: 'error' }); }
  }

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void take(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" multiple hidden aria-hidden tabIndex={-1}
        onChange={(e) => { void take(e.target.files); e.target.value = ''; }} />

      {quiet && files && files.length > 0 && <span className="text-overline px-2 pb-1">Files</span>}
      {files === null ? (
        quiet ? null : <EmptyLine>Loading…</EmptyLine>
      ) : files.length === 0 ? (
        quiet ? null : <EmptyLine>No files yet. Drag one in, or use Add file.</EmptyLine>
      ) : (
        <ul className="flex list-none flex-col gap-0.5 p-0 @container">
          {/* A query container, like every other list of share pills on the
              project page: on a phone the pill drops its word so the file name
              keeps the width. The list fills its parent, so containment is safe. */}
          {files.map((a) => {
            const kind = attachmentKind(a.mime_type, a.filename);
            return (
              <li key={a.id} className="group flex min-h-9 items-center gap-2 rounded-md px-2 transition-colors duration-fast hover:bg-surface-hover">
                {/* A list row's glyph (the DS icon scale's `sm`) and gap, so the name starts where Add file's word does. */}
                <Icon icon={GLYPH[kind]} size={14} className="shrink-0 text-ink-500" />
                <button onClick={() => void open(a)}
                  className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-ui text-ink-800">
                  {a.filename}
                </button>
                <span className="num shrink-0 text-caption text-ink-500">{formatBytes(a.size_bytes)}</span>
                {/* Deliverables are files. Marking one for the client happens
                    HERE, on the row you just uploaded it to — the whole point
                    of one visibility rule is that the task lesson transfers. */}
                {channels && (
                  <ShareToggle
                    kind="file"
                    item={{ client_visible: a.client_visible }}
                    channels={channels}
                    name={a.filename}
                    onToggle={(next) => void share(a, next)}
                  />
                )}
                {/* Row actions stay hidden until hover on a fine pointer, but the
                    `reveal-on-hover` utility keeps them reachable on touch. */}
                <span className="reveal-on-hover flex shrink-0 gap-0.5">
                  <IconButton size="sm" variant="ghost" label={`Download ${a.filename}`}
                    icon={<Icon icon={Download} size={14} />} onClick={() => void open(a)} />
                  <IconButton size="sm" variant="ghost" label={`Delete ${a.filename}`}
                    icon={<Icon icon={Trash2} size={14} />} onClick={() => void remove(a)} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {error && <div className="px-2 text-caption text-danger-600">{error}</div>}

      {quiet ? (
        // The list's own add line. While a file is held over the panel, the line that adds files says what
        // letting go will do — there is no room beside a full-width line for a second hint.
        <AddLine loading={busy} onClick={() => inputRef.current?.click()}>{dragOver ? 'Drop to upload' : 'Add file'}</AddLine>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            <Icon icon={Plus} size={14} /> Add file
          </Button>
          {dragOver && <span className="text-caption text-ink-500">Drop to upload</span>}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

'use client';
// The browser half of the attachment spine (§7H, migration 0033).
//
// Uploading is three steps and they are all here, so no surface has to remember
// the order: ask for a ticket → PUT the bytes STRAIGHT to storage → record the
// row. The middle step is the reason this exists: bytes that went through a
// server action would hit its body limit, and a 25 MB file would cost the
// server 25 MB of memory to forward. This way the server never sees them.
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  createAttachmentUploadUrl, recordAttachment, signAttachment, signAttachments,
} from '@/lib/actions/attachments';
import { createBatcher } from '@/lib/shared-cache';
import { rejectReason, type Attachment, type AttachmentOwner } from '@/lib/attachments';

const BUCKET = 'attachments';

export type UploadState = { busy: boolean; error: string | null };

/**
 * Upload a file to an owner and get back its recorded row — the three steps, in
 * order, as a plain function.
 *
 * The hook below wraps this for surfaces whose owner is known when they render.
 * A flow that CREATES its owner first — a screenshot dropped into the Content
 * inbox becomes a page, then that page's attachment — calls this directly
 * rather than growing a second copy of the steps.
 *
 * Refuses locally first (`rejectReason`) so an oversized file is declined in the
 * same instant it is dropped, rather than after a minute of upload the bucket
 * was always going to reject.
 */
export async function uploadAttachment(owner: AttachmentOwner, file: File): Promise<{ error: string } | { attachment: Attachment }> {
  const refusal = rejectReason(file);
  if (refusal) return { error: refusal };
  try {
    const ticket = await createAttachmentUploadUrl(owner, file.name, file.size);
    if ('error' in ticket) return ticket;

    // Direct to storage with the one-shot token. `upsert: false` so a replayed
    // ticket cannot overwrite an object that already landed.
    const { error } = await createClient().storage
      .from(BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.uploadToken, file, { upsert: false });
    if (error) return { error: error.message || 'Upload failed.' };

    return await recordAttachment(owner, {
      path: ticket.path, filename: file.name,
      mimeType: file.type || null, sizeBytes: file.size,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' };
  }
}

/** Upload a file and get back its recorded row, with busy/error state for the surface. */
export function useAttachmentUpload(owner: AttachmentOwner | null | undefined) {
  const [state, setState] = useState<UploadState>({ busy: false, error: null });

  const upload = useCallback(async (file: File): Promise<Attachment | null> => {
    // No owner ⇒ this surface has nothing to attach TO (a drawer with no page
    // context). Callers hide the affordance; this is the belt to that braces.
    if (!owner) return null;
    setState({ busy: true, error: null });
    const res = await uploadAttachment(owner, file);
    if ('error' in res) { setState({ busy: false, error: res.error }); return null; }
    setState({ busy: false, error: null });
    return res.attachment;
  }, [owner]);

  return { ...state, upload, clearError: () => setState((s) => ({ ...s, error: null })) };
}

/**
 * Open a stored attachment in a new tab.
 *
 * A signed URL is short-lived, so it is minted at the moment of the click and
 * used immediately — never stored, and never put in an `href` that then sits in
 * the DOM going stale. That timing rule is the whole behaviour, which is why it
 * lives here rather than being written out at each surface that lists files.
 *
 * Returns an error string for the caller to surface; it does not toast, because
 * where a failure should appear differs by surface.
 */
export async function openAttachment(id: string): Promise<{ error: string } | { ok: true }> {
  const res = await signAttachment(id);
  if ('error' in res) return res;
  window.open(res.url, '_blank', 'noopener,noreferrer');
  return { ok: true };
}

// Every URL asked for in the same moment is signed by ONE request. A Library
// page of image cards, or a gallery of uploaded covers, used to cost one server
// round trip per picture.
const signOne = createBatcher<string>(async (ids) => {
  const res = await signAttachments(ids);
  return new Map('error' in res ? [] : Object.entries(res.urls));
});

// Dev-preview harnesses have no session to sign with. A primed URL is answered
// without asking — the same escape hatch link previews have (`primeLinkMeta`).
const PRIMED = new Map<string, string>();

/** Answer an attachment's URL without the server. Harnesses only. */
export function primeAttachmentUrl(id: string, url: string): void {
  PRIMED.set(id, url);
}

/**
 * A usable URL for a stored attachment, minted on demand.
 *
 * Signatures are short-lived by design, so this resolves when the component
 * mounts rather than caching anything durable — and re-resolves if the id
 * changes. A component that held one of these across a long session would find
 * it expired exactly when the user finally clicked.
 */
export function useAttachmentUrl(id: string | null | undefined) {
  // Keyed by the id it belongs to, so a component pointed at a NEW attachment
  // never shows the previous one's URL for the frame before the fetch lands —
  // and so the "no id" case needs no state write at all.
  const [resolved, setResolved] = useState<{ id: string; url: string | null; error: string | null } | null>(null);
  const primed = id ? PRIMED.get(id) : undefined;

  useEffect(() => {
    if (!id || PRIMED.has(id)) return;
    let gone = false;
    void signOne(id).then((url) => {
      if (gone) return;
      setResolved(url ? { id, url, error: null } : { id, url: null, error: 'Could not open that file.' });
    });
    return () => { gone = true; };
  }, [id]);

  if (primed) return { url: primed, error: null };
  const hit = id && resolved?.id === id ? resolved : null;
  return { url: hit?.url ?? null, error: hit?.error ?? null };
}

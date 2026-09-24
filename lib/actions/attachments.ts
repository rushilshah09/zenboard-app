'use server';
// Attachments, write side — master plan §7H, migration 0033. The rules live in
// lib/attachments.ts; this file only performs them.
//
// THE SPINE, inherited from the form-upload path (0022) because it is proven:
//
//   1. `createAttachmentUploadUrl` proves you own the parent, then mints a
//      ONE-SHOT signed upload URL. The browser PUTs the bytes straight to
//      storage — they never pass through this server, so the server-action body
//      limit never applies and a 25 MB file costs us no memory.
//   2. `recordAttachment` writes the row once the bytes have landed. Two steps,
//      because a row written before the upload would describe a file that may
//      never arrive.
//   3. `signAttachment` mints a short-lived read URL, again only after RLS has
//      confirmed the row is yours. Nothing anywhere stores a URL.
//
// GATED on 0033 via `attachmentsSupported()`; without it the file blocks keep
// their paste-a-URL behaviour and nothing here is reachable.
import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { attachmentPath, unplacedUploads, ATTACHMENT_MAX_BYTES, type Attachment, type AttachmentOwner } from '@/lib/attachments';
import { requireSession } from '@/lib/auth';

const BUCKET = 'attachments';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is 0033 applied? A zero-row probe against the table — unlike the timebox
 * gate, `attachments` is a NEW table, so its absence is unambiguous and probing
 * the table is enough.
 */
export async function attachmentsSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('attachments').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = { error: 'Attachments need migration 0033.' } as const;

/**
 * Prove the caller owns the thing they are attaching to.
 *
 * Selected through the AUTHENTICATED client, so RLS does the work: a row you do
 * not own simply is not returned. This is the only ownership check in the file,
 * and every entry point runs it before the service role touches a byte.
 */
async function ownsParent(supabase: DB, owner: AttachmentOwner): Promise<boolean> {
  const [table, id] =
    'page_id' in owner ? ['pages', owner.page_id] as const
    : 'task_id' in owner ? ['tasks', owner.task_id] as const
    : ['projects', owner.project_id] as const;
  const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  return !!data;
}

export type UploadTicket = { path: string; uploadToken: string };

/**
 * Step 1 — a one-shot ticket the browser uploads to directly.
 *
 * The size is checked here as a courtesy so a doomed upload is refused before
 * it starts; the bucket's own `file_size_limit` is the real ceiling and holds
 * regardless of what this server was told.
 */
export async function createAttachmentUploadUrl(
  owner: AttachmentOwner,
  filename: string,
  sizeBytes?: number,
): Promise<{ error: string } | UploadTicket> {
  const { supabase, user } = await requireSession();
  if (!(await attachmentsSupported(supabase))) return NOT_READY;
  if (!(await ownsParent(supabase, owner))) return { error: 'Not found.' };
  if (typeof sizeBytes === 'number' && sizeBytes > ATTACHMENT_MAX_BYTES) {
    return { error: 'That file is too large.' };
  }

  const path = attachmentPath(user.id, randomBytes(9).toString('hex'), filename);
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: 'Could not start the upload.' };
  return { path: data.path ?? path, uploadToken: data.token };
}

/**
 * Step 2 — record the file now that its bytes exist.
 *
 * `path` is re-derived from the caller's own id prefix rather than trusted: a
 * crafted path pointing at somebody else's prefix would otherwise let one user
 * register another's object as their own attachment.
 */
export async function recordAttachment(
  owner: AttachmentOwner,
  file: { path: string; filename: string; mimeType?: string | null; sizeBytes?: number | null },
): Promise<{ error: string } | { attachment: Attachment }> {
  const { supabase, user } = await requireSession();
  if (!(await attachmentsSupported(supabase))) return NOT_READY;
  if (!(await ownsParent(supabase, owner))) return { error: 'Not found.' };
  if (!file.path.startsWith(`${user.id}/`)) return { error: 'Not found.' };

  const sid = await activeSpaceId(supabase, user.id);
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      user_id: user.id, space_id: sid, ...owner,
      path: file.path, filename: file.filename,
      mime_type: file.mimeType ?? null, size_bytes: file.sizeBytes ?? null,
    })
    .select('id, path, filename, mime_type, size_bytes, created_at')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not save that file.' };
  return { attachment: data as Attachment };
}

/** Every file on a record, oldest first — the order they were added. */
export async function listAttachments(owner: AttachmentOwner): Promise<Attachment[]> {
  try {
    const { supabase } = await requireSession();
    if (!(await attachmentsSupported(supabase))) return [];
    const [col, id] =
      'page_id' in owner ? ['page_id', owner.page_id] as const
      : 'task_id' in owner ? ['task_id', owner.task_id] as const
      : ['project_id', owner.project_id] as const;
    // `client_visible` (0039) is asked for optimistically and dropped on
    // refusal — the retry-instead-of-probe gate, so a migrated account pays for
    // one query and an unmigrated one still gets its files.
    const base = 'id, path, filename, mime_type, size_bytes, created_at';
    const full = await supabase.from('attachments').select(`${base}, client_visible`).eq(col, id).order('created_at');
    if (!full.error) return (full.data as Attachment[]) ?? [];
    const { data } = await supabase.from('attachments').select(base).eq(col, id).order('created_at');
    return (data as Attachment[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * A page's uploads that nothing on it shows any more (`unplacedUploads`) — what an empty image or file block offers
 * to put back. The stored row is read beside the files, in one round trip, because only the row knows every place
 * a file can be shown from: a block, the cover, a property. Asked only when the page has a block that could take one.
 *
 * Nothing is offered unless both reads succeed: an unread page would make every file look unplaced.
 */
export async function unplacedPageUploads(pageId: string): Promise<Attachment[]> {
  try {
    const { supabase } = await requireSession();
    const [page, files] = await Promise.all([
      supabase.from('pages').select('content, properties').eq('id', pageId).maybeSingle(),
      supabase.from('attachments').select('id, path, filename, mime_type, size_bytes, created_at').eq('page_id', pageId).order('created_at'),
    ]);
    if (page.error || !page.data || files.error || !files.data?.length) return [];
    return unplacedUploads(files.data as Attachment[], [page.data.content, page.data.properties]);
  } catch {
    return [];
  }
}

/**
 * Step 3 — a short-lived read URL. 5 minutes: long enough to open a PDF or
 * start a video, short enough that a URL copied out of the network tab is not a
 * lasting key to the object.
 */
export async function signAttachment(id: string): Promise<{ error: string } | { url: string }> {
  const { supabase } = await requireSession();
  if (!(await attachmentsSupported(supabase))) return NOT_READY;

  // RLS is the ownership check: someone else's attachment simply is not here.
  const { data: row } = await supabase.from('attachments').select('path').eq('id', id).maybeSingle();
  if (!row) return { error: 'Not found.' };

  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(row.path, 300);
  if (error || !data?.signedUrl) return { error: 'Could not open that file.' };
  return { url: data.signedUrl };
}

/**
 * Step 3, for many files at once — one RLS query and one signing call.
 *
 * A Library page of image cards, or a Documents gallery of uploaded covers,
 * asked `signAttachment` once per picture: dozens of round trips for what one
 * `in (...)` answers. Same rules as the single version: RLS decides which ids
 * are yours (someone else's simply do not come back), nothing is stored, and a
 * URL lives five minutes. An id that is not yours, or not there, is absent from
 * the result rather than an error for the whole batch.
 */
export async function signAttachments(ids: string[]): Promise<{ error: string } | { urls: Record<string, string> }> {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id))].slice(0, 100);
  if (!unique.length) return { urls: {} };
  const { supabase } = await requireSession();
  if (!(await attachmentsSupported(supabase))) return NOT_READY;

  const { data: rows } = await supabase.from('attachments').select('id, path').in('id', unique);
  const found = (rows as { id: string; path: string }[] | null) ?? [];
  if (!found.length) return { urls: {} };

  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrls(found.map((r) => r.path), 300);
  if (error || !data) return { error: 'Could not open those files.' };
  const byPath = new Map(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
  const urls: Record<string, string> = {};
  for (const row of found) {
    const url = byPath.get(row.path);
    if (url) urls[row.id] = url;
  }
  return { urls };
}

/**
 * Remove a file — row and bytes.
 *
 * The row goes first: it is the thing RLS protects and the thing the UI reads,
 * so if the storage delete fails the user still sees the file gone rather than
 * a row pointing at bytes we failed to remove. The reverse order would leave a
 * visible attachment whose object is already missing, which reads as data loss.
 */
export async function deleteAttachment(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await attachmentsSupported(supabase))) return NOT_READY;

  const { data: row } = await supabase.from('attachments').select('path').eq('id', id).maybeSingle();
  if (!row) return { ok: true };   // already gone

  const { error } = await supabase.from('attachments').delete().eq('id', id);
  if (error) return { error: error.message };

  try {
    await createServiceClient().storage.from(BUCKET).remove([row.path]);
  } catch { /* best-effort: the row is gone, the bytes are unreferenced */ }
  return { ok: true };
}

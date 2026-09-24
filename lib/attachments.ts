// Attachments — master plan §7H, migration 0033. Pure rules; the writes live in
// lib/actions/attachments.ts.
//
// THE MODEL: the app never holds a file's URL, only its `path` inside a private
// bucket. A private object's URL is a short-lived signature, so a stored one is
// already expired by the time anybody reads it — every read mints a fresh
// signature through a server action that has proven ownership first. Identical
// spine to the form-upload path (0022), which is why this reuses its filename
// rule rather than writing a second one.

/** Longest filename we keep. Beyond this the label is a paragraph, not a name. */
const MAX_FILENAME = 120;

/**
 * A filename safe to put in a storage key.
 *
 * Strips any directory part (a crafted `../../secret.pdf` must not escape the
 * bucket prefix), keeps a short alphanumeric extension so the browser still
 * knows what it opened, and flattens everything exotic to spaces. Was private
 * to `lib/actions/forms.ts`; attachments needed exactly the same rule, and two
 * copies of "what characters may reach storage" is the kind of duplication that
 * ends with one of them being wrong.
 */
export function safeFilename(raw: string): string {
  const name = (raw || 'file').split(/[\\/]/).pop() || 'file';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : '';
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9 ._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME) || 'file';
  return ext ? `${stem}.${ext}` : stem;
}

/**
 * Ceiling, in bytes. The bucket's own `file_size_limit` (0033) is the real
 * enforcement — it holds even for bytes uploaded straight to a signed URL this
 * server never sees. This constant exists so the browser can refuse BEFORE
 * spending someone's upload bandwidth.
 *
 * Decimal, matching `formatBytes` and the bucket. A binary 25 MiB here would
 * make the refusal read "the limit is 26 MB" — a number that appears nowhere
 * else and reads as a bug.
 */
export const ATTACHMENT_MAX_BYTES = 25 * 1000 * 1000;

export type AttachmentKind = 'image' | 'pdf' | 'video' | 'audio' | 'file';

const EXT_KIND: Record<string, AttachmentKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', svg: 'image',
  pdf: 'pdf',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', aac: 'audio',
};

/**
 * Which block should render this file.
 *
 * MIME first because it is what the browser actually reported, extension second
 * because plenty of real uploads arrive as `application/octet-stream`. Anything
 * unrecognised is a `file` — a download card, which is never wrong, only plain.
 */
export function attachmentKind(mime: string | null | undefined, filename?: string | null): AttachmentKind {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
  return EXT_KIND[ext] ?? 'file';
}

/**
 * "2.4 MB". One decimal below 10 units and none above, so a column of sizes
 * stays the same width and reads as a column rather than a ragged list.
 * Deliberately decimal (kB = 1000) — that is what every OS file browser and
 * every storage bill uses, so matching it avoids "but Finder said 25 MB".
 */
export function formatBytes(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
  if (n < 1000) return `${Math.round(n)} B`;
  const units = ['kB', 'MB', 'GB'];
  let v = n / 1000;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Why an upload was refused, as a sentence, or null when it is fine. */
export function rejectReason(file: { size: number; name: string }): string | null {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)} — the limit is ${formatBytes(ATTACHMENT_MAX_BYTES)}.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

/**
 * The object key. Prefixed with the owner's id so a path is self-describing and
 * a future per-user cleanup is a prefix delete; a random token so two files
 * called `scan.pdf` cannot collide, and so a key is never guessable from the
 * outside even if a signature leaks.
 */
export const attachmentPath = (userId: string, token: string, filename: string): string =>
  `${userId}/${token}-${safeFilename(filename)}`;

/**
 * A page's uploads that nothing on it shows.
 *
 * Every file uploaded into a document is an `attachments` row owned by the page, and the page points at it by id —
 * from a block (`fileId`), its cover (`attachment:<id>`) or a Files property. Until 2026-09-21 a reopened document
 * lost its blocks' ids and its next save wrote the loss down, while the files themselves were never touched: this is
 * how an empty image block finds them again.
 *
 * "Shows" is a plain substring test over the stored row (as JSON) plus the ids the editor holds right now — its
 * placements not yet saved — so a reference in any shape counts, including shapes this function has never heard of.
 * An attachment id is a uuid; it does not appear in a document by accident.
 */
export function unplacedUploads<T extends { id: string }>(files: readonly T[], stored: unknown, shown: Iterable<string | null | undefined> = []): T[] {
  const text = JSON.stringify(stored ?? null);
  const now = new Set(shown);
  return files.filter((f) => !now.has(f.id) && !text.includes(f.id));
}

/** The owner of an attachment — exactly one, matching 0033's CHECK constraint. */
export type AttachmentOwner =
  | { page_id: string } | { task_id: string } | { project_id: string };

export type Attachment = {
  id: string;
  path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  /**
   * 0039. Optional because the column post-dates the table, and every reader
   * treats a missing value as private (lib/visibility.ts).
   */
  client_visible?: boolean;
};

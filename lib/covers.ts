// Document cover collection — 20 curated gradients drawn from traditional
// Japanese color vocabulary (sakura, matcha, ai, sumi…). These are content
// assets (artwork, like a user-uploaded image), not UI chrome, so they carry
// fixed colors by design and render identically in light and dark themes.
// A cover value is one of these ids, an `attachment:<uuid>` reference to an
// uploaded image (§7H), a pasted http(s) URL, or — for anything uploaded before
// 2026-08-04 — an inline data-URL.

export type CoverDef = { id: string; name: string; css: string };

export const DOC_COVERS: CoverDef[] = [
  { id: 'sakura', name: 'Sakura', css: 'linear-gradient(135deg,#FBE5EA 0%,#F3C6D4 55%,#EBAFC4 100%)' },
  { id: 'momo', name: 'Momo', css: 'linear-gradient(135deg,#FCE9DD 0%,#F8CFB4 60%,#F2B694 100%)' },
  { id: 'yuhi', name: 'Yūhi', css: 'linear-gradient(135deg,#F9DCB8 0%,#EFA98A 60%,#DE8168 100%)' },
  { id: 'akane', name: 'Akane', css: 'linear-gradient(150deg,#F3C8B9 0%,#DE9187 60%,#BC6470 100%)' },
  { id: 'sango', name: 'Sango', css: 'linear-gradient(135deg,#FBE3DB 0%,#F2B5A7 60%,#E58F7F 100%)' },
  { id: 'kohaku', name: 'Kohaku', css: 'linear-gradient(135deg,#F6E3C0 0%,#E9C288 60%,#D9A05B 100%)' },
  { id: 'yamabuki', name: 'Yamabuki', css: 'linear-gradient(135deg,#F9ECC8 0%,#EFD489 60%,#E3BD5D 100%)' },
  { id: 'matcha', name: 'Matcha', css: 'linear-gradient(135deg,#EAF0DE 0%,#CBDCB2 60%,#A9C48C 100%)' },
  { id: 'wakatake', name: 'Wakatake', css: 'linear-gradient(135deg,#DFF0E4 0%,#ABD9BC 60%,#7CBF9A 100%)' },
  { id: 'uguisu', name: 'Uguisu', css: 'linear-gradient(135deg,#EDEEDC 0%,#CBCDA5 60%,#A6AB7F 100%)' },
  { id: 'asagi', name: 'Asagi', css: 'linear-gradient(135deg,#DFF0F0 0%,#A8D9D9 60%,#7BC1C7 100%)' },
  { id: 'mizu', name: 'Mizu', css: 'linear-gradient(135deg,#E3F1F7 0%,#BADDEC 60%,#92C8E0 100%)' },
  { id: 'ruri', name: 'Ruri', css: 'linear-gradient(150deg,#D8E4F5 0%,#93B3E0 60%,#5F87C5 100%)' },
  { id: 'ai', name: 'Ai', css: 'linear-gradient(155deg,#C4D0E0 0%,#8098BD 60%,#41608F 100%)' },
  { id: 'yoru', name: 'Yoru', css: 'linear-gradient(160deg,#A2ABC6 0%,#5D6994 60%,#2F3859 100%)' },
  { id: 'fujiiro', name: 'Fujiiro', css: 'linear-gradient(135deg,#ECE6F5 0%,#CDBDE5 60%,#AB96D1 100%)' },
  { id: 'ume', name: 'Ume', css: 'linear-gradient(140deg,#F2DDE9 0%,#DCAACA 60%,#C07EAB 100%)' },
  { id: 'sumi', name: 'Sumi', css: 'linear-gradient(150deg,#E8E6E1 0%,#BBB7AE 60%,#8C877C 100%)' },
  { id: 'gofun', name: 'Gofun', css: 'linear-gradient(135deg,#FAF7F0 0%,#EEE7D9 60%,#DFD4BF 100%)' },
  { id: 'tsuki', name: 'Tsuki', css: 'linear-gradient(135deg,#F4F1E4 0%,#E4DDC6 60%,#CDC3A2 100%)' },
];

// ── Uploaded covers ──────────────────────────────────────────────────────────
//
// A cover used to be base64'd straight into `pages.content`, which is the one
// place bytes must not go: that column is re-read on every page open, re-written
// on every autosave, and copied into `page_versions` on every save. An icon can
// afford it (180px square, its own column, ~10 KB); a 1600px cover cannot.
//
// So an uploaded cover is now a REFERENCE to an attachment row, and the bytes
// live in the private bucket like every other file. The prefix keeps the value a
// single string, so nothing about how a cover is stored, passed or compared had
// to change — the parse and format functions live next to each other because
// they are one rule read in two directions.
const ATTACHMENT_PREFIX = 'attachment:';

export const attachmentCover = (id: string): string => `${ATTACHMENT_PREFIX}${id}`;

/** The attachment id behind an uploaded cover, or null for every other kind. */
export const coverAttachmentId = (c?: string): string | null =>
  c?.startsWith(ATTACHMENT_PREFIX) ? c.slice(ATTACHMENT_PREFIX.length) || null : null;

/**
 * Is this cover a picture rather than one of the gradients?
 *
 * `data:` is still here and must stay: covers uploaded before the move are real
 * data-URLs sitting in real documents, and they render exactly as they always
 * did. There is nothing to migrate — the old form simply keeps working.
 */
export const isImageCover = (c?: string) =>
  !!c && (c.startsWith(ATTACHMENT_PREFIX) || c.startsWith('data:') || c.startsWith('http'));

export const coverCss = (id?: string) => DOC_COVERS.find((c) => c.id === id)?.css;

export function randomCover(exclude?: string): string {
  const pool = DOC_COVERS.filter((c) => c.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

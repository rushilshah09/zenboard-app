// What a collected item IS, read from its address (COLLECTION_PLAN K2; COLLECTION_VIEW_BRIEF §6–8, §33–35).
//
// A Collection turns anything someone saves into a picture, a name and a place it came
// from. These are the pure rules behind that: which
// source a link is from, what kind of thing it points at, the best picture it offers
// without asking anyone, and what to draw when it offers none. The network lives in
// `app/api/unfurl`; the platforms in `lib/platforms.ts`. Nothing here imports React.
import { hostOf } from './unfurl';
import { platformOf, platformThumbnail, PLATFORMS, type PlatformId } from './platforms';

/** What a collected thing can be — one fixed vocabulary, so every place that names a kind names it the same way. */
export const COLLECTION_TYPES = ['Website', 'Image', 'Video', 'PDF', 'Document', 'Social post', 'Audio', 'File', 'Other'] as const;
export type CollectionType = (typeof COLLECTION_TYPES)[number];


/** What a known platform publishes. A platform not named here is read as a Website. */
const PLATFORM_TYPE: Partial<Record<PlatformId, CollectionType>> = {
  youtube: 'Video', vimeo: 'Video', tiktok: 'Video', twitch: 'Video',
  instagram: 'Social post', x: 'Social post', threads: 'Social post', facebook: 'Social post',
  linkedin: 'Social post', reddit: 'Social post',
  pinterest: 'Image', dribbble: 'Image', behance: 'Image',
  spotify: 'Audio',
};

/** What the file at the end of an address is — checked before the platform, because a
 *  PDF is a PDF wherever it is hosted. */
const FILE_TYPE: readonly [RegExp, CollectionType][] = [
  [/\.pdf$/i, 'PDF'],
  [/\.(jpe?g|png|webp|gif|svg|avif|heic)$/i, 'Image'],
  [/\.(mp4|webm|mov|m4v|ogv)$/i, 'Video'],
  [/\.(mp3|wav|m4a|aac|ogg|flac)$/i, 'Audio'],
  [/\.(docx?|pages|key|pptx?|xlsx?|numbers|odt|rtf|txt|md)$/i, 'Document'],
];

/** Image files a browser can draw (HEIC is an Image by type, but not drawable). */
const SHOWABLE_IMAGE = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

/** The address as a web URL, or null when it is not one. */
function webUrl(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** Where an item is from: a known platform by name, "Website" for everywhere else, and
 *  null when there is no web address to read. */
export function collectionSource(url: string | null | undefined): string | null {
  if (!webUrl(url)) return null;
  const platform = platformOf(url);
  return platform ? PLATFORMS[platform].name : 'Website';
}

/** What kind of thing an item is, always from the Type vocabulary. */
export function collectionType(url: string | null | undefined): CollectionType {
  const u = webUrl(url);
  if (!u) return 'Other';
  const file = FILE_TYPE.find(([pattern]) => pattern.test(u.pathname));
  if (file) return file[1];
  const platform = platformOf(url);
  return (platform && PLATFORM_TYPE[platform]) || 'Website';
}

/**
 * The best picture a link offers without the user's own: the platform's thumbnail — a
 * fixed address, so no request (§7) — else the page's own image, https only, since a
 * page must not pull an insecure image into itself. Null means draw the tile.
 */
export function collectionPicture(url: string | null | undefined, meta: { url?: string; image?: string } | null | undefined): string | null {
  const thumbnail = platformThumbnail(url);
  if (thumbnail) return thumbnail;
  // An address that IS a picture is its own picture — a pin's PAGE is not, so this
  // reads the file at the end of the address, never the Type.
  const u = webUrl(url);
  if (u && u.protocol === 'https:' && SHOWABLE_IMAGE.test(u.pathname)) return u.href;
  const image = meta?.image;
  return image && /^https:\/\/\S+$/i.test(image) ? image : null;
}

// ── Shapes (COLLECTION_VIEW_PLAN C2) ──
// A shape is height over width. A card draws a picture at its own shape, within reason —
// no sliver, no skyscraper — and a tile at its type's natural one, so a Collection with
// no pictures still reads as a masonry rather than a grid of identical boxes.
export const SHAPE_MIN = 0.45;
export const SHAPE_MAX = 1.6;
const TILE_SHAPE: Record<string, number> = {
  Video: 9 / 16, Website: 0.525, 'Social post': 1, Image: 1.25,
  PDF: 1.3, Document: 1.3, Audio: 1, File: 0.75, Other: 0.75,
};

/** The shape of a type's tile — also the guess for a picture that has not loaded yet. */
export const collectionTileShape = (type: string): number => TILE_SHAPE[type] ?? 0.75;

/** A remembered shape as a card may draw it: a real positive number, clamped; else unknown. */
export function readPreviewShape(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.min(SHAPE_MAX, Math.max(SHAPE_MIN, raw));
}

/** A picture made of words, for an item with none (§8, §34–35): its type and its domain. */
export function collectionTile(url: string | null | undefined, type: string | null | undefined): { type: string; domain: string | null } {
  const u = webUrl(url);
  return { type: type || (u ? collectionType(url) : 'Other'), domain: u ? hostOf(u.href) : null };
}

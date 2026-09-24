// Link metadata — what a pasted URL turns out to be about, and which of the
// paste-as choices make sense for it.
//
// Shared by the client (the paste-as menu, the bookmark card, the mention) and
// the server route that does the fetching. Nothing here touches the network —
// `app/api/unfurl/route.ts` does — so this module stays importable from anywhere.
import { platformOf, PLATFORMS, type PlatformId } from './platforms';

export type LinkMeta = {
  url: string;
  title?: string;
  description?: string;
  /** Preview image — the bookmark card's thumbnail. */
  image?: string;
  /** "YouTube", "GitHub" — falls back to the hostname. */
  siteName?: string;
  /** Author/channel where the page names one. Notion shows this before the title. */
  author?: string;
  favicon?: string;
  /** The day the page says it was published (YYYY-MM-DD): a collected item's Published. */
  published?: string;
};

/** Hostname without `www.`, or the raw string when it isn't a URL at all. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/**
 * The day a page or a platform says something was published, as YYYY-MM-DD in the
 * publisher's own calendar. "2024-03-05T23:30:00-08:00" was published on the 5th where it
 * was written, whatever day that is in UTC, so the day is read as written and never
 * converted. Nothing for a day that does not exist, or for the zero date some systems
 * write when they have none.
 */
export function publishedDay(raw: string | undefined): string | undefined {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/.exec(raw ?? '');
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900) return undefined;
  const day = new Date(Date.UTC(y, mo - 1, d));
  return day.getUTCFullYear() === y && day.getUTCMonth() === mo - 1 && day.getUTCDate() === d ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** A URL and nothing else — the only paste that should offer a choice. Text with
 *  a link inside it stays plain text; interrupting that would be maddening. */
export function isBareUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

/** Can this be played inline? Only then is "Embed video" worth offering. */
export function isVideoUrl(url: string): boolean {
  const h = hostOf(url);
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia\.com)$/i.test(h)) return true;
  return /\.(mp4|webm|ogv|mov)(\?|$)/i.test(url);
}

export type PasteAs = 'mention' | 'video' | 'bookmark' | 'url';

/**
 * The choices for a URL, in Notion's order — and it is worth keeping that order,
 * because the first item is the one a keyboard user gets by pressing Enter.
 * "Embed video" only appears when the link can actually be played; offering it
 * for a blog post and rendering a broken frame is worse than not offering it.
 */
export function pasteOptions(url: string): { value: PasteAs; label: string }[] {
  return [
    { value: 'mention', label: 'Mention' },
    ...(isVideoUrl(url) ? [{ value: 'video' as const, label: 'Embed video' }] : []),
    { value: 'bookmark', label: 'Bookmark' },
    { value: 'url', label: 'URL' },
  ];
}

/**
 * The inline label a Mention shows: the page's own title, with the author or site
 * in front of it — "Brian Wiles · What's Your ENGLISH Level?". A mention whose
 * text is still the raw URL would be pointless, so with no metadata it falls back
 * to the hostname, which at least reads as a place.
 */
export function mentionLabel(meta: LinkMeta): string {
  const title = meta.title?.trim();
  const who = meta.author?.trim() || meta.siteName?.trim();
  if (title && who && !title.toLowerCase().includes(who.toLowerCase())) return `${who} · ${title}`;
  return title || who || hostOf(meta.url);
}

// ── oEmbed: platforms that describe themselves ───────────────────────────────
//
// YouTube, TikTok, Vimeo, Spotify and X each publish an oEmbed endpoint: a URL in,
// JSON out — the title, who made it, a thumbnail. Their PAGES are the hard part of
// unfurling: a login wall (Instagram has no open endpoint at all), a page that is
// all JavaScript (X, TikTok), or a consent interstitial. So for these the route
// asks the platform FIRST and falls back to reading the page. The endpoints are
// fixed hosts; the link travels as a query parameter, never as the address fetched.
const OEMBED: Partial<Record<PlatformId, (url: string) => string>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  vimeo: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  // publish.twitter.com now answers 301 → publish.x.com, and a redirect is a miss.
  x: (u) => `https://publish.x.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(u)}`,
};

/** The oEmbed endpoint for a link on a platform that has one, or null. */
export function oembedEndpoint(url: string): string | null {
  const platform = platformOf(url);
  const build = platform ? OEMBED[platform] : undefined;
  return build ? build(url) : null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
const decodeEntities = (s: string) => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);

/**
 * The words of an embedded post. X's oEmbed has no title — it answers with the
 * post as HTML — and a post's words ARE what it is called in a list. First
 * paragraph, tags gone, entities decoded, kept to a line's worth.
 */
function postText(html: string | undefined): string | undefined {
  const paragraph = html ? /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] : undefined;
  if (!paragraph) return undefined;
  const text = decodeEntities(paragraph.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
}

/**
 * LinkMeta from an oEmbed answer, or null when it says nothing usable. The site
 * is named by the PLATFORM, not the endpoint's `provider_name` ("Twitter" for a
 * post on X). A thumbnail is only kept over https — a page must not pull an
 * insecure image into itself.
 */
export function fromOembed(data: unknown, url: string): LinkMeta | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const platform = platformOf(url);
  const image = str(o.thumbnail_url);
  const meta: LinkMeta = {
    url,
    title: str(o.title) ?? postText(str(o.html)),
    author: str(o.author_name),
    siteName: platform ? PLATFORMS[platform].name : str(o.provider_name) ?? hostOf(url),
    image: image && /^https:\/\//i.test(image) ? image : undefined,
    // Vimeo says when a video went up; YouTube's oEmbed does not.
    published: publishedDay(str(o.upload_date)),
  };
  return meta.title || meta.image ? meta : null;
}

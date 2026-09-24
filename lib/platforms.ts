// Where a link lives, when that place is a PLATFORM — somewhere a creator
// publishes to or saves from. Pure rules; the marks are drawn by the DS
// `LinkMark` / `ChannelMark`, and the metadata comes from `app/api/unfurl`.
//
// WHY THIS EXISTS (2026-09-14). A saved link showed whatever favicon its site
// served, and in a black-and-white interface those read as coloured dots — the
// user's word. A creator recognises a link by WHERE it is from: the YouTube mark,
// the X, the Instagram camera. So a known platform is drawn as its own mark, and
// only an unknown site falls back to its favicon.

export const PLATFORM_IDS = [
  'youtube', 'x', 'instagram', 'tiktok', 'linkedin', 'threads', 'facebook', 'pinterest',
  'behance', 'dribbble', 'spotify', 'twitch', 'reddit', 'medium', 'figma', 'github', 'vimeo',
] as const;
export type PlatformId = typeof PLATFORM_IDS[number];

type Platform = {
  /** How the platform names itself — also what a channel field says. */
  name: string;
  /** Registrable domains; any subdomain matches (open.spotify.com, vm.tiktok.com). */
  hosts: readonly string[];
  /** Other names a person types for it as a channel. */
  aliases?: readonly string[];
};

export const PLATFORMS: Record<PlatformId, Platform> = {
  youtube: { name: 'YouTube', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] },
  // Twitter's domains still resolve, and "Twitter" is still what people type.
  x: { name: 'X', hosts: ['x.com', 'twitter.com'], aliases: ['twitter'] },
  instagram: { name: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  tiktok: { name: 'TikTok', hosts: ['tiktok.com'] },
  linkedin: { name: 'LinkedIn', hosts: ['linkedin.com', 'lnkd.in'] },
  threads: { name: 'Threads', hosts: ['threads.net', 'threads.com'] },
  facebook: { name: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.watch'] },
  pinterest: { name: 'Pinterest', hosts: ['pinterest.com', 'pin.it'] },
  behance: { name: 'Behance', hosts: ['behance.net'] },
  dribbble: { name: 'Dribbble', hosts: ['dribbble.com'] },
  spotify: { name: 'Spotify', hosts: ['spotify.com', 'spotify.link'] },
  twitch: { name: 'Twitch', hosts: ['twitch.tv'] },
  reddit: { name: 'Reddit', hosts: ['reddit.com', 'redd.it'] },
  medium: { name: 'Medium', hosts: ['medium.com'] },
  figma: { name: 'Figma', hosts: ['figma.com'] },
  github: { name: 'GitHub', hosts: ['github.com'] },
  vimeo: { name: 'Vimeo', hosts: ['vimeo.com'] },
};

/** The hostname of a URL, lower-case, or null when it is not a web address. */
function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Which platform a link is on, or null for everywhere else.
 *
 * A domain matches itself and every subdomain — never a lookalike: `youtube.com`
 * matches `m.youtube.com` and `music.youtube.com`, but not `notyoutube.com` or
 * `youtube.com.evil.example`.
 */
export function platformOf(url: string | null | undefined): PlatformId | null {
  const host = hostnameOf(url);
  if (!host) return null;
  for (const id of PLATFORM_IDS) {
    if (PLATFORMS[id].hosts.some((h) => host === h || host.endsWith(`.${h}`))) return id;
  }
  return null;
}

/**
 * Which platform a CHANNEL names — the free-text field a piece goes out on.
 *
 * Exactly the name or an alias ("YouTube", "twitter"), or the name followed by a
 * word ("Instagram Reels", "YouTube Shorts"). Never a prefix of a longer word:
 * "X" is X, "Xero" is not.
 */
export function platformOfChannel(channel: string | null | undefined): PlatformId | null {
  const c = (channel ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!c) return null;
  for (const id of PLATFORM_IDS) {
    const names = [PLATFORMS[id].name.toLowerCase(), ...(PLATFORMS[id].aliases ?? [])];
    if (names.some((n) => c === n || c.startsWith(`${n} `))) return id;
  }
  return null;
}

/**
 * A YouTube video's id, from any of the addresses YouTube gives out — watch,
 * youtu.be, shorts, embed, live. Only a real id (eleven characters) counts, so a
 * made-up address never becomes a request for a thumbnail that does not exist.
 */
export function youtubeId(url: string | null | undefined): string | null {
  if (platformOf(url) !== 'youtube') return null;
  const u = new URL(url!.trim());
  const ID = /^[A-Za-z0-9_-]{11}$/;
  const fromQuery = u.searchParams.get('v');
  if (fromQuery && ID.test(fromQuery)) return fromQuery;
  const parts = u.pathname.split('/').filter(Boolean);
  const candidate = u.hostname.endsWith('youtu.be')
    ? parts[0]
    : ['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? '') ? parts[1] : undefined;
  return candidate && ID.test(candidate) ? candidate : null;
}

/**
 * A picture for a link that needs no request to know. YouTube's thumbnails live
 * at a fixed address per video, so a card shows the video the moment it renders
 * rather than after the page has been fetched — and still shows it when the
 * fetch is refused. `hqdefault` exists for every public video; its letterbox
 * bars sit top and bottom and are cropped away by a 16:9 `object-cover`.
 */
export function platformThumbnail(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * The size YouTube answers with when a video has no thumbnail (deleted, private,
 * or an id that never existed) — a grey 120×90 placeholder, sent as an image, so
 * it LOADS rather than failing. A card that receives it treats it as missing.
 */
export const isMissingThumbnail = (img: { naturalWidth: number; naturalHeight: number }): boolean =>
  img.naturalWidth === 120 && img.naturalHeight === 90;

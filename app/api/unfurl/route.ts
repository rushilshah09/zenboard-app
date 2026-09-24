// GET /api/unfurl?url=… → the link's metadata, for the bookmark card and the
// inline mention. Both used to have nothing to show: a bookmark rendered the
// hostname and the raw URL, which is a link with a border around it.
//
// This is a server route because the browser can't read another origin's HTML,
// and because a URL the user pasted must never be fetched from inside our
// network. Guarded the same way outbound webhooks are (lib/webhook.ts): https
// only, no loopback/private/link-local hosts. Signed-in users only — an open
// fetch-any-URL endpoint is a proxy for whoever finds it.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSafeWebhookUrl } from '@/lib/webhook';
import { hostOf, oembedEndpoint, fromOembed, publishedDay, type LinkMeta } from '@/lib/unfurl';

export const dynamic = 'force-dynamic';

// Enough of the document to hold <head>. A 20MB page must not become 20MB of
// our memory, and everything we want is in the first few KB.
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 6000;
// Enough for the usual http→https / apex→www pair, few enough that a redirect
// loop cannot hold a worker open.
const MAX_REDIRECTS = 4;
// Same-process memo: a doc with the same link in five places shouldn't fetch it
// five times, and re-opening the doc shouldn't refetch at all.
const CACHE = new Map<string, { at: number; meta: LinkMeta }>();
const TTL_MS = 60 * 60 * 1000;

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim();
}

/** Pull one meta tag's content, tolerating attribute order and quote style. */
function meta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // content before the name/property, and after — both orders occur in the wild.
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]?.trim()) return decode(m[1]);
    }
  }
  return undefined;
}

function absolute(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return undefined; }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url') ?? '';

  // Auth first: this endpoint makes outbound requests on our behalf.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!isSafeWebhookUrl(raw)) {
    return NextResponse.json({ error: 'Unsupported URL' }, { status: 400 });
  }

  const hit = CACHE.get(raw);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.meta);

  // The fallback IS a valid answer: a site that blocks us, times out, or serves
  // no metadata still gets a card with its hostname rather than an error state.
  const fallback: LinkMeta = { url: raw, siteName: hostOf(raw), favicon: faviconFor(raw) };

  // THE PLATFORMS ANSWER FOR THEMSELVES. YouTube, TikTok, Vimeo, Spotify and X
  // return a title, the author and a thumbnail as JSON from a fixed endpoint —
  // where their pages refuse a scraper, need JavaScript, or sit behind consent.
  // Asked FIRST for those; a miss falls through to reading the page. The link is
  // only ever a query parameter here (lib/unfurl.ts), and a redirect is a miss,
  // so this path cannot be steered anywhere but the platform itself.
  const endpoint = oembedEndpoint(raw);
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
      const told = res.ok && /json/i.test(res.headers.get('content-type') ?? '') ? fromOembed(await res.json(), raw) : null;
      if (told) {
        const result: LinkMeta = { ...told, favicon: faviconFor(raw) };
        CACHE.set(raw, { at: Date.now(), meta: result });
        return NextResponse.json(result, { headers: { 'cache-control': 'private, max-age=3600' } });
      }
    } catch { /* the page itself is the next place to ask */ }
  }

  let html = '';
  try {
    // EVERY HOP IS CHECKED, not just the first. `redirect: 'follow'` validated
    // the URL the user pasted and then let the remote server choose the next
    // one — so `https://attacker.example` answering `302 → http://10.0.0.5/`
    // reached straight past the guard. Following by hand is the only way the
    // check applies to the address actually fetched.
    let target = raw;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeWebhookUrl(target)) { res = null; break; }
      const hopRes: Response = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Some sites serve a stub to unknown agents; say what we are and accept HTML.
          'user-agent': 'Mozilla/5.0 (compatible; ZenboardBot/1.0; +https://zenboard.app)',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      const location = hopRes.status >= 300 && hopRes.status < 400 ? hopRes.headers.get('location') : null;
      if (!location) { res = hopRes; break; }
      try { target = new URL(location, target).toString(); } catch { res = null; break; }
    }
    if (!res || !res.ok || !/text\/html/i.test(res.headers.get('content-type') ?? '')) {
      CACHE.set(raw, { at: Date.now(), meta: fallback });
      return NextResponse.json(fallback);
    }
    // Read with a hard cap rather than res.text(), which would buffer it all.
    const reader = res.body?.getReader();
    if (reader) {
      const dec = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        html += dec.decode(value, { stream: true });
        // </head> is all we need; stop the moment we have it.
        if (total >= MAX_BYTES || /<\/head>/i.test(html)) { void reader.cancel(); break; }
      }
    }
  } catch {
    CACHE.set(raw, { at: Date.now(), meta: fallback });
    return NextResponse.json(fallback);
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const iconHref = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i.exec(html)?.[0];
  const iconUrl = iconHref ? /href=["']([^"']+)["']/i.exec(iconHref)?.[1] : undefined;

  const result: LinkMeta = {
    url: raw,
    title: meta(html, ['og:title', 'twitter:title']) ?? (titleTag ? decode(titleTag) : undefined),
    description: meta(html, ['og:description', 'twitter:description', 'description']),
    image: absolute(meta(html, ['og:image', 'og:image:url', 'twitter:image']), raw),
    siteName: meta(html, ['og:site_name']) ?? hostOf(raw),
    // YouTube and friends name the channel here; it's what Notion shows in front
    // of a mention's title.
    author: meta(html, ['author', 'article:author', 'og:video:tag']) ?? undefined,
    favicon: absolute(iconUrl, raw) ?? faviconFor(raw),
    // A collected article's Published (COLLECTION_VIEW_PLAN C3): the tags most publishers
    // write, else the structured data news sites and newsletters put in <head>.
    published: publishedDay(
      meta(html, ['article:published_time', 'og:published_time', 'datePublished', 'publish-date', 'pubdate', 'parsely-pub-date', 'sailthru.date', 'date'])
        ?? /"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1],
    ),
  };

  CACHE.set(raw, { at: Date.now(), meta: result });
  // Let the browser cache it too — the same link pasted twice in a session
  // shouldn't reach us at all.
  return NextResponse.json(result, { headers: { 'cache-control': 'private, max-age=3600' } });
}

/** A site's own /favicon.ico, used when the HTML declares none. */
function faviconFor(url: string): string | undefined {
  try { const u = new URL(url); return `${u.origin}/favicon.ico`; } catch { return undefined; }
}

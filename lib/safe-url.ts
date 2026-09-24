// THE one rule for a URL that came from a person and is about to become an
// `href` or an iframe `src`.
//
// A document is not a trusted document. Its links arrive by paste, by Notion
// import, and by `liftText` reading `[label](url)` out of stored text — and the
// document is then shown to CLIENTS through the portal and through proposals.
// So "the owner typed it" is not a safety argument: the person who reads it is
// usually not the person who wrote it.
//
// TWO functions, because an anchor and an iframe are not the same risk:
//
//   `safeHref`      — what a click may follow. `javascript:` here runs script in
//                     OUR origin with the reader's session, which is stored XSS.
//   `safeEmbedSrc`  — what may be mounted as a frame. Strictly https, because a
//                     frame runs continuously rather than on a click, and
//                     `data:text/html` is a whole attacker-authored page.
//
// Both return null rather than a scrubbed string: a link nobody can vouch for
// should render as the text it is, not as a link to somewhere else.

/** Schemes a click may follow. Everything absent from this list is refused. */
const HREF_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * A URL safe to put in an `href`, or null.
 *
 * Relative paths pass: an internal mention IS a link (`/projects/<id>` — see
 * lib/connected.ts), it carries no scheme, and so it cannot carry a dangerous
 * one. `//host` does NOT pass — browsers read it as protocol-relative, which
 * makes it absolute and off-origin despite looking like a path.
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // Strip whitespace AND control characters first. `java\tscript:` is the oldest
  // way to hide a scheme from a naive prefix check, and the browser ignores those
  // bytes when it resolves the URL — so the check has to ignore them too.
  const s = raw.replace(/[\u0000-\u0020\u007f]/g, '');
  if (!s) return null;
  if (s.startsWith('#')) return s;                        // in-page anchor
  if (s.startsWith('/') && !s.startsWith('//')) return s; // internal route
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  return HREF_SCHEMES.has(u.protocol) ? u.toString() : null;
}

/**
 * A URL safe to mount in an iframe, or null. HTTPS only.
 *
 * http is refused for free — a frame on an https page is blocked as mixed
 * content anyway, so allowing it buys nothing and costs the argument.
 */
export function safeEmbedSrc(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let u: URL;
  try { u = new URL(raw.replace(/[\u0000-\u0020\u007f]/g, '')); } catch { return null; }
  return u.protocol === 'https:' ? u.toString() : null;
}

/**
 * Where to send someone after they sign in: a path on THIS site, or `fallback`.
 *
 * `?next=` is attacker-controlled — anyone can mail a login link carrying
 * `next=https://evil.example`, and a redirect in the moment after a person has
 * trusted us with a password is the most convincing phishing step there is.
 * So only a single-slash path passes. `//host` and `/\\host` are refused
 * because browsers read both as protocol-relative: absolute, and off-origin.
 * The value is then resolved against a placeholder origin and must still be
 * ON it, which catches any encoding trick a prefix check would miss.
 */
export function safeNextPath(raw: unknown, fallback = '/today'): string {
  if (typeof raw !== 'string') return fallback;
  const s = raw.replace(/[\u0000-\u0020\u007f]/g, '');
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return fallback;
  const HOME = 'https://next.invalid';
  try {
    const u = new URL(s, HOME);
    const out = `${u.pathname}${u.search}${u.hash}`;
    // The OUTPUT is checked as well as the input. Dot segments normalise away:
    // `/.//evil.example` and `/x/..//evil.example` pass every input check and
    // come out as `//evil.example` — protocol-relative again. Found by asking
    // what a prefix check lets through, not by a test that already existed.
    return u.origin === HOME && !out.startsWith('//') && !out.startsWith('/\\') ? out : fallback;
  } catch {
    return fallback;
  }
}

/**
 * What a third-party frame is allowed to do.
 *
 * `allow-top-navigation` is the one deliberately absent: with it, any embedded
 * page can replace the whole tab, and the page it would be replacing is often a
 * CLIENT PORTAL — an embed that redirects a client to a payment page that looks
 * like ours is the attack this closes. Scripts and same-origin stay, because
 * they refer to the EMBEDDED origin and every real embed (YouTube, Figma, maps)
 * needs them.
 */
export const EMBED_SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation';

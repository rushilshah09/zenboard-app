// The address of a BLOCK — master plan v2.3 §2, "blocks as addressable rows".
//
// WHAT THE AUDIT FOUND, and why there is no migration under this file.
//
// The plan calls the JSONB `pages.content` blob "the largest remaining
// structural debt in the product" and blames three features on it: block-level
// comments, block links, and synced blocks. Only some of that survives contact
// with the code. **A block has carried a stable id since the editor was
// written** — `Block.id`, minted by `genId()`, persisted inside the blob and
// round-tripped by `normalize()`. Every row already renders `data-block-id`,
// and the floating outline already scrolls to one. Nothing about addressing a
// block was ever waiting on a table.
//
// What the blob genuinely prevents is a block having an OWNER OTHER THAN ITS
// PAGE. That is precisely what a synced block is (one block, rendered in many
// pages) and what a comment thread would want a foreign key to. Those remain
// migration work. Addressing does not, so it ships today, unmigrated.
//
// WHY A FRAGMENT AND NOT A QUERY PARAM. The rest of the app addresses records
// with search params (`?page=`, `?task=`, `?c=`) because a record is a thing
// the SERVER has to resolve. A block is a position *inside* an already-resolved
// document — which is what fragments have always been for, which is why they
// are the one part of a URL the browser does not send. It also keeps
// `parseRecordHref` honest for free: a link to a block inside a doc still
// parses as a link to the doc, so the fabric records one backlink per document
// rather than one per paragraph.
//
// KEEP THIS BESIDE `recordHref` IN SPIRIT. A block address is a record address
// plus a fragment, and it is built by calling `recordHref` rather than by
// assembling `/documents?page=…` a second time — the mistake `share()` in
// documents-view had already made once.
import { recordHref } from '@/lib/connected';

/**
 * Namespaces the fragment. Block ids happen to begin with `b`, so an
 * unprefixed id would be indistinguishable from any other anchor the app might
 * one day want (a comment, a property, a heading slug for an exported page).
 */
export const BLOCK_FRAGMENT_PREFIX = 'block-';

/** Ids come out of `genId()`, but `normalize()` accepts any string it finds in
 *  stored JSON, so an id is encoded on the way out and decoded on the way in
 *  rather than trusted to be URL-safe. */
const MAX_ID = 128;

/**
 * Where a block lives: the page's own route, plus the block's fragment.
 *
 * `null` when the page has no route (which cannot happen for a doc today, but
 * `recordHref` is allowed to say "no page yet" and callers must handle it).
 */
export function blockHref(pageId: string, blockId: string): string | null {
  if (!pageId || !blockId) return null;
  const page = recordHref('doc', pageId);
  if (!page) return null;
  return `${page}#${BLOCK_FRAGMENT_PREFIX}${encodeURIComponent(blockId)}`;
}

/** The `#…` of an href, including the hash, or `''`. */
export function fragmentOf(href: string): string {
  const i = href.indexOf('#');
  return i < 0 ? '' : href.slice(i);
}

/**
 * The block id an href/fragment names, or `null`.
 *
 * Accepts a whole URL, a bare `#fragment`, or a bare fragment, because the
 * three callers hold it in those three shapes (a clipboard link, a
 * `location.hash`, a value pulled out of one).
 */
export function parseBlockFragment(input: string): string | null {
  if (!input) return null;
  const i = input.indexOf('#');
  const frag = i < 0 ? input : input.slice(i + 1);
  if (!frag.startsWith(BLOCK_FRAGMENT_PREFIX)) return null;
  const raw = frag.slice(BLOCK_FRAGMENT_PREFIX.length);
  if (!raw || raw.length > MAX_ID) return null;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // A malformed escape ("%zz") throws rather than returning the input.
    return null;
  }
  return id && id.length <= MAX_ID ? id : null;
}

/**
 * Carry a fragment across a re-derived href.
 *
 * `resolveLink` normalises an internal link back through `recordHref` so a
 * pasted absolute URL becomes a client-side route. That normalisation drops
 * everything the route does not encode — including the fragment, which would
 * have made every block link land at the top of its page. This is the one line
 * that stops that, and it is here rather than inline so the rule is testable.
 */
export function withFragment(to: string, source: string): string {
  if (to.includes('#')) return to;
  const frag = fragmentOf(source);
  return frag && frag !== '#' ? to + frag : to;
}

'use client';
// What clicking a link inside a document does.
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseRecordHref, recordHref } from '@/lib/connected';
import { parseBlockFragment, withFragment } from '@/lib/block-link';
import { requestBlockAnchor } from '@/lib/use-block-anchor';
import { safeHref } from '@/lib/safe-url';

/**
 * Follow a link from rich text: internal links navigate IN-APP, external ones
 * open in a new tab.
 *
 * THE PROBLEM THIS SOLVES. A mention is a link mark on ordinary text — that is
 * the design that let mentions exist without a new ProseMirror node type or a
 * migration (see `parseRecordHref`). But an idle block renders its spans as
 * static HTML that swaps to the live editor when clicked, so every plain click
 * was `preventDefault`ed to keep the caret placeable. The result: a mention
 * could only be followed with ⌘-click, and then only into a new tab. The one
 * thing a mention is for had no cheap way to happen.
 *
 * BENCHMARK. In Notion a page mention is an atomic inline node: a plain click
 * navigates, and you cannot put a caret inside it. Ours is a link mark on
 * editable text, so we cannot have that for free — but we can match the part
 * that matters, which is that **a plain click follows the link**. The cost is
 * the same one Notion pays: to edit the words of a link you put the caret
 * beside it and arrow in, rather than clicking the middle of it. ⌘-click still
 * does what the browser always does, so "open in a new tab" is never taken away.
 *
 * Internal links are re-derived through `recordHref` rather than followed
 * literally: that normalises an absolute URL from the clipboard
 * (`https://app…/documents?page=…`) down to the app route, so it becomes a
 * client-side navigation instead of a full page load.
 */
export type LinkTarget =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; to: string };

/**
 * WHERE a link goes — the whole decision, with no router and no `window`, so it
 * can be tested directly rather than through a rendered component.
 *
 * `null` for a link there is nothing sensible to do with (empty, or a record
 * route the app does not have a page for yet).
 */
export function resolveLink(href: string, origin?: string): LinkTarget | null {
  if (!href || !href.trim()) return null;
  // Depth, not the primary guard — `staticSpans` already refuses to build an
  // anchor for an unsafe href. But this function is what actually navigates
  // (`window.open` on a `javascript:` URL executes it in a fresh context with
  // OUR origin), so the last step before leaving checks for itself.
  if (!safeHref(href)) return null;
  const ref = parseRecordHref(href, origin);
  if (ref) {
    const to = recordHref(ref.type, ref.id);
    // A record type with no route yet (goal, meeting, feedback) parses but has
    // nowhere to go. Falling through to `window.open` would be worse than
    // doing nothing: it would leave the app for a URL we know is not a page.
    //
    // The fragment has to be carried across that re-derivation by hand. Without
    // `withFragment` every block link would normalise down to its page and land
    // at the top of it — the link would still "work", which is the kind of
    // silent wrongness that survives review.
    return to ? { kind: 'internal', to: withFragment(to, href) } : null;
  }
  return { kind: 'external', to: href };
}

export function useFollowLink() {
  const router = useRouter();

  return useCallback((href: string): void => {
    const origin = typeof window === 'undefined' ? undefined : window.location.origin;
    const target = resolveLink(href, origin);
    if (!target) return;
    if (target.kind === 'internal') {
      router.push(target.to);
      // `router.push` goes out as pushState, which does not fire `hashchange`,
      // so a link to a block in the document already open would otherwise
      // change the URL and nothing else. Announcing it covers both cases at
      // once: a same-page jump and a cross-page one that has to wait for the
      // target document to load.
      const block = parseBlockFragment(target.to);
      if (block) requestBlockAnchor(block);
      return;
    }
    // Anything else leaves the app. `noopener` is not optional — without it the
    // opened page can reach back through `window.opener`.
    window.open(target.to, '_blank', 'noopener,noreferrer');
  }, [router]);
}

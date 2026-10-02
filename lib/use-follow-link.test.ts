import { describe, it, expect } from 'vitest';
import { resolveLink } from './use-follow-link';
import { recordHref } from './connected';
import { blockHref, parseBlockFragment } from './block-link';

// A mention is a link mark on ordinary text, and an idle block renders its
// spans as static HTML that swaps to the editor when clicked — so every plain
// click was `preventDefault`ed to keep the caret placeable, and a mention could
// only be opened with ⌘-click, into a new tab. `resolveLink` is the decision
// that makes a plain click work: in-app for a record, new tab for the rest.

const ID = '9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d';
const ORIGIN = 'https://app.zenboard.com';

describe('internal links navigate in-app', () => {
  it('resolves every record type that has a route', () => {
    for (const type of ['task', 'client', 'doc', 'invoice', 'project', 'form'] as const) {
      const href = recordHref(type, ID)!;
      expect(resolveLink(href), type).toEqual({ kind: 'internal', to: href });
    }
  });

  it('normalises an absolute URL from the clipboard down to the app route', () => {
    // `share()` copies `${origin}/documents?page=…`. Followed literally that is
    // a full page load; re-derived through `recordHref` it is a client-side
    // navigation to the same place.
    expect(resolveLink(`${ORIGIN}/documents?page=${ID}`, ORIGIN))
      .toEqual({ kind: 'internal', to: `/documents?page=${ID}` });
  });

  it('keeps a block fragment through that normalisation', () => {
    // The normalisation above rebuilds the href from `recordHref`, which knows
    // nothing about fragments. Without `withFragment` a block link would still
    // "work" — it would open the right document, at the top, every time.
    expect(resolveLink(`${ORIGIN}/documents?page=${ID}#block-b7x`, ORIGIN))
      .toEqual({ kind: 'internal', to: `/documents?page=${ID}#block-b7x` });
  });

  it('keeps a block fragment on a relative link too', () => {
    expect(resolveLink(`/documents?page=${ID}#block-b7x`))
      .toEqual({ kind: 'internal', to: `/documents?page=${ID}#block-b7x` });
  });

  it('round-trips a copied block link back to the block it names', () => {
    // The composition `useFollowLink` performs: resolve, push, then announce
    // `parseBlockFragment(to)` — because `router.push` goes out as pushState and
    // pushState does not fire `hashchange`, so a jump inside the document you
    // are already reading would otherwise change the URL and nothing else.
    const copied = `https://app.zenboard.com${blockHref(ID, 'bq31k9x')}`;
    const target = resolveLink(copied, ORIGIN)!;
    expect(target.kind).toBe('internal');
    expect(parseBlockFragment(target.to)).toBe('bq31k9x');
  });
});

describe('external links open in a new tab', () => {
  it('treats another origin as external, even one that looks like ours', () => {
    expect(resolveLink(`https://evil.example/documents?page=${ID}`, ORIGIN))
      .toEqual({ kind: 'external', to: `https://evil.example/documents?page=${ID}` });
  });

  it('passes ordinary web and mail links straight through', () => {
    for (const href of ['https://linear.app/docs', 'http://example.com', 'mailto:hi@example.com']) {
      expect(resolveLink(href, ORIGIN), href).toEqual({ kind: 'external', to: href });
    }
  });
});

describe('links with nowhere to go do nothing', () => {
  it('refuses an empty or blank href rather than opening a blank tab', () => {
    for (const href of ['', '   ']) expect(resolveLink(href), JSON.stringify(href)).toBeNull();
  });

  it('refuses an app route that is not a record', () => {
    // `/documents` is a hub, not a page — `parseRecordHref` returns null and it
    // must NOT then be opened as an external URL, which would reload the app.
    for (const href of ['/documents', '/projects', `/documents?page=nope`]) {
      const out = resolveLink(href, ORIGIN);
      expect(out?.kind, href).not.toBe('internal');
    }
  });

  it('does not leave the app for a record type that has no page yet', () => {
    // Goals, meetings and feedback parse as records but `recordHref` returns
    // undefined for them. Opening a new tab on a URL we know is not a page is
    // worse than doing nothing.
    expect(recordHref('goal' as never, ID)).toBeUndefined();
  });
});

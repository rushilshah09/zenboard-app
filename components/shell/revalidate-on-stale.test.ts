import { describe, it, expect } from 'vitest';
import { isStalePaint, FRESH_MS } from './revalidate-on-stale';

// When the navigation showing the page began: the page load, or the moment a
// client navigation landed.
const NAV = 1_700_000_000_000;

describe('isStalePaint', () => {
  it('is fresh when the server rendered it for this navigation', () => {
    expect(isStalePaint(NAV + 50, NAV)).toBe(false);
  });

  it('is fresh however long the server took', () => {
    // A slow page is not a cached page. Judged against "now", a hard load that
    // took over two seconds would refresh itself: a second full render of
    // exactly the pages that can least afford one.
    expect(isStalePaint(NAV + 9_000, NAV)).toBe(false);
  });

  it('is stale when the payload predates the navigation', () => {
    // A page you visited a minute ago, served instantly from the Client Cache
    // and carrying the timestamp of that original render.
    expect(isStalePaint(NAV - 60_000, NAV)).toBe(true);
  });

  it('gives a clock that disagrees with the server the benefit of the doubt', () => {
    // Server and browser read different clocks. A render that appears to
    // predate the navigation by less than the window counts as its own.
    expect(isStalePaint(NAV - (FRESH_MS - 1), NAV)).toBe(false);
    expect(isStalePaint(NAV - (FRESH_MS + 1), NAV)).toBe(true);
  });

  it('treats a missing or broken stamp as fresh', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isStalePaint(bad, NAV)).toBe(false);
    }
    expect(isStalePaint(NAV - 60_000, Number.NaN)).toBe(false);
  });

  it('honours a custom window', () => {
    expect(isStalePaint(NAV - 500, NAV, 100)).toBe(true);
    expect(isStalePaint(NAV - 50, NAV, 100)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { wantedMode, resolveMode } from './page-view-mode';

// The order <PageView> settles on a mode in, before the viewport has its say. A
// database VIEW now owns a preference ("Open pages in", DATABASE_EXPERIENCE_PLAN T6),
// so where it sits in that order is the rule: above the per-type bucket — a board's
// pages open the way the board says, not the way every row does — and below anything
// chosen for this one opening.
describe('wantedMode — whose choice opens a page', () => {
  it('uses the per-type preference when nothing else speaks', () => {
    expect(wantedMode({ preferred: 'side-peek' })).toBe('side-peek');
  });

  it("lets the caller's own preference (a database view's) beat the per-type one", () => {
    expect(wantedMode({ owned: 'center-peek', preferred: 'side-peek' })).toBe('center-peek');
  });

  it('lets a pick for this opening (⌘↵, the menu) beat both', () => {
    expect(wantedMode({ session: 'full-page', owned: 'center-peek', preferred: 'side-peek' })).toBe('full-page');
  });

  it('lets a forced mode beat everything', () => {
    expect(wantedMode({ forced: 'side-peek', session: 'full-page', owned: 'center-peek', preferred: 'full-page' }))
      .toBe('side-peek');
  });

  it('treats a cleared pick (null) as no pick', () => {
    expect(wantedMode({ session: null, owned: 'full-page', preferred: 'side-peek' })).toBe('full-page');
  });
});

describe('resolveMode — the viewport still vetoes what does not fit', () => {
  // A view choosing side peek cannot put a 560px panel beside a board on a tablet.
  it('turns a side peek into a full page below 1100px, and anything into a full page on a phone', () => {
    expect(resolveMode(wantedMode({ owned: 'side-peek', preferred: 'center-peek' }), 1024)).toBe('full-page');
    expect(resolveMode(wantedMode({ owned: 'center-peek', preferred: 'side-peek' }), 1024)).toBe('center-peek');
    expect(resolveMode(wantedMode({ owned: 'center-peek', preferred: 'side-peek' }), 390)).toBe('full-page');
    expect(resolveMode(wantedMode({ owned: 'side-peek', preferred: 'full-page' }), 1440)).toBe('side-peek');
  });
});

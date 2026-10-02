import { describe, it, expect } from 'vitest';
import { bleedInsets } from './bleed';

// An inline database's table or board runs out to the page's edges while its
// first column stays on the text column (Notion; database brief §3 and §24). The
// distances are MEASURED from where the layout would sit without the bleed — its
// parent's box — to the page's content box, so indentation, row padding and a
// wide page need no special cases.
describe('bleedInsets', () => {
  it('reaches from the text column to both edges of the page', () => {
    // A 1200px page with a centred 708px column starting at 246.
    expect(bleedInsets({ left: 0, clientLeft: 0, clientWidth: 1200 }, { left: 246, right: 954 }))
      .toEqual({ start: 246, end: 246 });
  });

  it('stops at the scrollbar, not under it', () => {
    // clientWidth excludes a 15px gutter the page keeps for its scrollbar.
    expect(bleedInsets({ left: 100, clientLeft: 0, clientWidth: 985 }, { left: 346, right: 854 }))
      .toEqual({ start: 246, end: 231 });
  });

  it('carries an indented block\'s extra offset on the start side only', () => {
    expect(bleedInsets({ left: 0, clientLeft: 0, clientWidth: 1200 }, { left: 270, right: 954 }))
      .toEqual({ start: 270, end: 246 });
  });

  it('never goes negative when the column already touches an edge (a phone)', () => {
    expect(bleedInsets({ left: 0, clientLeft: 0, clientWidth: 375 }, { left: -2, right: 377 }))
      .toEqual({ start: 0, end: 0 });
  });

  it('rounds DOWN to whole pixels — never past the edge, never jittering by a fraction', () => {
    expect(bleedInsets({ left: 0.4, clientLeft: 1, clientWidth: 1000.2 }, { left: 247.7, right: 950.1 }))
      .toEqual({ start: 246, end: 51 });
  });
});

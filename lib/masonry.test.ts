import { describe, it, expect } from 'vitest';
import { cellsInView, dropIndex, masonryColumns, masonryLanding, placeMasonry, type CardBox } from './masonry';

// A Collection's masonry (COLLECTION_VIEW_BRIEF §13): cards at their own heights, placed row
// by row into the shortest column — so the DOM, the tab order and a manual order all read
// left to right, top to bottom, which CSS columns (column by column) would not.
describe('masonryColumns', () => {
  it('fits as many columns as the width allows, never fewer than one', () => {
    expect(masonryColumns(1200, 220, 12)).toBe(5);
    expect(masonryColumns(700, 220, 12)).toBe(3);
    expect(masonryColumns(200, 220, 12)).toBe(1);
    expect(masonryColumns(0, 220, 12)).toBe(1);
  });
});

describe('placeMasonry', () => {
  it('fills the first row in order, then sends each card to the shortest column', () => {
    const { positions, height } = placeMasonry([100, 50, 80, 30, 60], 3, 10);
    expect(positions).toEqual([
      { column: 0, top: 0 }, { column: 1, top: 0 }, { column: 2, top: 0 },
      { column: 1, top: 60 }, // column 1 ended first, at 50
      { column: 2, top: 90 }, // then column 2, at 80 (column 1 now ends at 90)
    ]);
    expect(height).toBe(150);
  });

  it('breaks a tie to the left, so the same heights always land the same way', () => {
    expect(placeMasonry([40, 40, 40], 2, 8).positions.map((p) => p.column)).toEqual([0, 1, 0]);
  });

  it('stacks everything in one column, and has no height with nothing to place', () => {
    expect(placeMasonry([10, 20], 1, 5)).toEqual({ positions: [{ column: 0, top: 0 }, { column: 0, top: 15 }], height: 35 });
    expect(placeMasonry([], 4, 12)).toEqual({ positions: [], height: 0 });
  });
});

// COLLECTION_PLAN K8 — arranging a Collection by hand: where a card carried over the masonry lands.
describe('masonryLanding — the place a carried card would take', () => {
  // Three columns 100 wide, 10 apart: a and b and c across the top, d under b.
  const BOXES: CardBox[] = [
    { id: 'a', left: 0, top: 0, width: 100, height: 100 },
    { id: 'b', left: 110, top: 0, width: 100, height: 60 },
    { id: 'c', left: 220, top: 0, width: 100, height: 80 },
    { id: 'd', left: 110, top: 70, width: 100, height: 50 },
  ];

  it('takes the side of the card it is over: its left half is before it, its right half after', () => {
    expect(masonryLanding(BOXES, { x: 20, y: 50 })).toBe(0);
    expect(masonryLanding(BOXES, { x: 80, y: 50 })).toBe(1);
    expect(masonryLanding(BOXES, { x: 230, y: 40 })).toBe(2);
    expect(masonryLanding(BOXES, { x: 310, y: 40 })).toBe(3);
  });

  it('goes after what it is below and before what it is above, so a column can be dropped into', () => {
    expect(masonryLanding(BOXES, { x: 160, y: 400 })).toBe(4); // under the last of the middle column
    expect(masonryLanding(BOXES, { x: 160, y: -40 })).toBe(1); // above the middle column
    expect(masonryLanding(BOXES, { x: 160, y: 65 })).toBe(3); // in the gap between b and d: after b
  });

  it('reads one column top to bottom, because that is the order it draws', () => {
    const column: CardBox[] = [
      { id: 'a', left: 0, top: 0, width: 200, height: 100 },
      { id: 'b', left: 0, top: 110, width: 200, height: 100 },
    ];
    expect(masonryLanding(column, { x: 180, y: 30 })).toBe(0);
    expect(masonryLanding(column, { x: 20, y: 90 })).toBe(1);
    expect(masonryLanding(column, { x: 20, y: 500 })).toBe(2);
    expect(masonryLanding([], { x: 0, y: 0 })).toBe(0);
  });

  it('dropIndex is the place among the OTHER cards, and nothing when it would not move', () => {
    expect(dropIndex(0, 0)).toBeNull();
    expect(dropIndex(1, 0)).toBeNull();
    expect(dropIndex(3, 0)).toBe(2);
    expect(dropIndex(0, 2)).toBe(0);
    expect(dropIndex(4, 1)).toBe(3);
  });
});

// COLLECTION_PLAN K12 — a Collection of hundreds draws only what is near the screen (§45).
describe('cellsInView', () => {
  const boxes: CardBox[] = [0, 100, 200, 300, 400].map((top, i) => ({ id: String(i), left: 0, top, width: 100, height: 90 }));

  it('is what meets the window, and a margin either side so a scroll shows no hole', () => {
    expect(cellsInView(boxes, 150, 320)).toEqual([1, 2, 3]);
    expect(cellsInView(boxes, 150, 320, 100)).toEqual([0, 1, 2, 3, 4]);
    expect(cellsInView(boxes, 0, 0)).toEqual([0]);
  });

  it('is nothing when the window is somewhere else, and nothing when there is nothing', () => {
    expect(cellsInView(boxes, -500, -400)).toEqual([]);
    expect(cellsInView(boxes, 2000, 2400)).toEqual([]);
    expect(cellsInView([], 0, 100)).toEqual([]);
  });
});

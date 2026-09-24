import { describe, it, expect } from 'vitest';
import { collectionTileShape, readPreviewShape, COLLECTION_TYPES } from './collection-item';

// COLLECTION_VIEW_PLAN C2. A Collection without pictures must still read as a masonry,
// not a grid — so a tile takes its type's natural shape — and a picture's shape, once
// known, is kept, so the masonry does not settle again every time it is shown.
describe('collectionTileShape — a tile is shaped like what it stands for', () => {
  it('is wide for a video or a website, square for a post, tall for a page', () => {
    expect(collectionTileShape('Video')).toBeCloseTo(9 / 16);
    expect(collectionTileShape('Website')).toBeLessThan(0.6);
    expect(collectionTileShape('Social post')).toBe(1);
    expect(collectionTileShape('PDF')).toBeGreaterThan(1.2);
    expect(collectionTileShape('Document')).toBe(collectionTileShape('PDF'));
  });

  it('gives every type a shape, and a plain one to a name it does not know', () => {
    for (const type of COLLECTION_TYPES) expect(collectionTileShape(type), type).toBeGreaterThan(0.4);
    expect(collectionTileShape('Mystery')).toBe(0.75);
  });
});

describe('readPreviewShape — a remembered shape is read, never trusted', () => {
  it('keeps a real height-over-width, clamped to what a card will draw', () => {
    expect(readPreviewShape(0.5625)).toBeCloseTo(0.5625);
    expect(readPreviewShape(9)).toBe(1.6);
    expect(readPreviewShape(0.1)).toBe(0.45);
  });

  it('reads anything else as unknown', () => {
    for (const bad of [undefined, null, '0.5', Number.NaN, -1, 0, Infinity, {}]) {
      expect(readPreviewShape(bad), String(bad)).toBeUndefined();
    }
  });
});

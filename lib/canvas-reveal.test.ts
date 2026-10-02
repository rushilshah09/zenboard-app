import { describe, it, expect } from 'vitest';
import { panToReveal, type Camera } from './canvas';

// A card reached by the keyboard is brought into sight by moving the camera — never by scrolling the
// canvas frame, which would shift everything under the pointer (COLLECTION_PLAN K5).
const cam = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

describe('panToReveal', () => {
  it('leaves the camera alone when the card is in sight', () => {
    const c = cam(0, 0, 1);
    expect(panToReveal(c, { x: 100, y: 100, w: 200 }, 150, 1000, 600)).toBe(c);
  });

  it('pans just far enough to show a card past an edge, with a margin', () => {
    expect(panToReveal(cam(0, 0, 1), { x: 900, y: 100, w: 200 }, 150, 1000, 600, 24)).toEqual(cam(-124, 0, 1));
    expect(panToReveal(cam(0, 0, 1), { x: -50, y: 500, w: 200 }, 150, 1000, 600, 24)).toEqual(cam(74, -74, 1));
  });

  it('works at any zoom, and keeps the start of a card bigger than the view in sight', () => {
    expect(panToReveal(cam(0, 0, 2), { x: 450, y: 0, w: 100 }, 50, 1000, 600, 0)).toEqual(cam(-100, 0, 2));
    expect(panToReveal(cam(0, 0, 1), { x: 10, y: 10, w: 2000 }, 100, 1000, 600, 24)).toEqual(cam(14, 14, 1));
  });
});

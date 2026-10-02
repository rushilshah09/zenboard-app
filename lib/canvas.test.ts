import { describe, it, expect } from 'vitest';
import {
  ZOOM_MIN, ZOOM_MAX, CARD_W_MIN, CARD_W_MAX, CANVAS_CARD_W, CANVAS_GAP,
  clampZoom, toWorld, toScreen, zoomAt, panBy, fitCamera, boundsOf, rectBetween, hitTest, viewRect,
  placeUnplaced, arrangement, moveBoxes, resizeBox, boxesToSave, readCanvasBox,
  type Camera, type CanvasBoxes,
} from './canvas';

// COLLECTION_PLAN K5 — a Collection's canvas: its items, arranged by hand on an infinite surface. Where
// a card sits is layout, kept on the item and never mixed with what it holds (COLLECTION_ITEM_BRIEF).
// This is the geometry; the surface only draws it.
const cam = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });
const H = () => 100; // every card 100 world px tall

describe('the camera', () => {
  it('keeps zoom between 10% and 400%', () => {
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it('maps screen and world both ways', () => {
    const c = cam(40, -20, 2);
    const w = toWorld(c, 140, 180);
    expect(w).toEqual({ x: 50, y: 100 });
    expect(toScreen(c, w.x, w.y)).toEqual({ x: 140, y: 180 });
  });

  it('zooms about the pointer: the point under it stays under it', () => {
    const c = cam(15, 30, 1);
    const before = toWorld(c, 300, 200);
    const next = zoomAt(c, 2.5, 300, 200);
    expect(next.zoom).toBe(2.5);
    const after = toWorld(next, 300, 200);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomAt(c, 99, 0, 0).zoom).toBe(ZOOM_MAX);
  });

  it('pans by what the pointer moved', () => {
    expect(panBy(cam(10, 10, 3), 5, -7)).toEqual(cam(15, 3, 3));
  });

  it('fits everything in view, centred, never enlarging past 100%', () => {
    const fit = fitCamera({ x: 0, y: 0, w: 2000, h: 1000 }, 1000, 600, 40);
    expect(fit.zoom).toBeCloseTo(0.46, 6); // (1000 − 2·40) / 2000
    const tl = toScreen(fit, 0, 0);
    const br = toScreen(fit, 2000, 1000);
    expect((tl.x + br.x) / 2).toBeCloseTo(500, 6);
    expect((tl.y + br.y) / 2).toBeCloseTo(300, 6);
    expect(fitCamera({ x: 100, y: 100, w: 200, h: 100 }, 1000, 600, 40).zoom).toBe(1);
    // Nothing to fit: the origin, inset by the padding.
    expect(fitCamera(null, 1000, 600, 40)).toEqual(cam(40, 40, 1));
  });
});

describe('the extent of the cards', () => {
  it('covers every box, a box with no height measured at its estimate', () => {
    const boxes: CanvasBoxes = { a: { x: -10, y: 5, w: 100, h: 50 }, b: { x: 200, y: 300, w: 40 } };
    expect(boundsOf(boxes, H)).toEqual({ x: -10, y: 5, w: 250, h: 395 });
    expect(boundsOf({}, H)).toBeNull();
  });
});

describe('a marquee', () => {
  it('spans its two corners, drawn in any direction', () => {
    expect(rectBetween({ x: 50, y: 10 }, { x: 10, y: 40 })).toEqual({ x: 10, y: 10, w: 40, h: 30 });
  });

  it('selects the cards it touches, and no others', () => {
    const boxes: CanvasBoxes = { a: { x: 0, y: 0, w: 100 }, b: { x: 200, y: 0, w: 100 }, c: { x: 0, y: 300, w: 100 } };
    expect(hitTest({ x: 90, y: 50, w: 130, h: 10 }, boxes, H).sort()).toEqual(['a', 'b']);
    expect(hitTest({ x: 101, y: 101, w: 50, h: 50 }, boxes, H)).toEqual([]);
  });
});

describe('where unplaced cards go', () => {
  it('opens AS a masonry from the origin: row by row, then into the shortest column', () => {
    const heights: Record<string, number> = { a: 300, b: 100, c: 100, d: 50 };
    const boxes = placeUnplaced(['a', 'b', 'c', 'd'], {}, (id) => heights[id], 3);
    const step = CANVAS_CARD_W + CANVAS_GAP;
    expect(boxes.a).toEqual({ x: 0, y: 0, w: CANVAS_CARD_W });
    expect(boxes.b).toEqual({ x: step, y: 0, w: CANVAS_CARD_W });
    expect(boxes.c).toEqual({ x: 2 * step, y: 0, w: CANVAS_CARD_W });
    // d goes under the shortest column: b's and c's tie, and the left one wins.
    expect(boxes.d).toEqual({ x: step, y: 100 + CANVAS_GAP, w: CANVAS_CARD_W });
  });

  it('lays new cards out to the right of everything placed, and never moves a placed card', () => {
    const placed: CanvasBoxes = { p: { x: -500, y: 40, w: 300, h: 200 } };
    const boxes = placeUnplaced(['n1', 'p', 'n2'], placed, H, 2);
    expect(boxes.p).toBeUndefined();
    const left = -500 + 300 + CANVAS_GAP * 2;
    expect(boxes.n1).toEqual({ x: left, y: 40, w: CANVAS_CARD_W });
    expect(boxes.n2).toEqual({ x: left + CANVAS_CARD_W + CANVAS_GAP, y: 40, w: CANVAS_CARD_W });
  });

  it('gives every row a box, a saved one exactly as saved', () => {
    const saved: CanvasBoxes = { a: { x: 7, y: 9, w: 150 } };
    const all = arrangement(['a', 'b'], saved, H, 3);
    expect(all.a).toBe(saved.a);
    expect(all.b).toBeDefined();
    expect(Object.keys(all)).toEqual(['a', 'b']);
  });
});

describe('moving and resizing', () => {
  it('moves only the cards that were dragged, never in place', () => {
    const boxes: CanvasBoxes = { a: { x: 0, y: 0, w: 100 }, b: { x: 10, y: 10, w: 100 } };
    const moved = moveBoxes(boxes, ['a'], 25.5, -4);
    expect(moved.a).toEqual({ x: 25.5, y: -4, w: 100 });
    expect(moved.b).toBe(boxes.b);
    expect(boxes.a).toEqual({ x: 0, y: 0, w: 100 });
  });

  it('resizes by width, within limits — the height follows the card', () => {
    expect(resizeBox({ x: 1, y: 2, w: 240, h: 300 }, 400)).toEqual({ x: 1, y: 2, w: 400 });
    expect(resizeBox({ x: 1, y: 2, w: 240 }, 10).w).toBe(CARD_W_MIN);
    expect(resizeBox({ x: 1, y: 2, w: 240 }, 5000).w).toBe(CARD_W_MAX);
  });
});

describe('what is saved, and what is read back', () => {
  it('keeps every row that still exists, rounded, and drops deleted rows', () => {
    const all: CanvasBoxes = { a: { x: 0.4, y: 10.6, w: 240.2, h: 180.7 }, gone: { x: 1, y: 1, w: 240 } };
    expect(boxesToSave(all, new Set(['a', 'b']))).toEqual({ a: { x: 0, y: 11, w: 240, h: 181 } });
  });

  it('reads only boxes that make sense', () => {
    expect(readCanvasBox(null)).toBeUndefined();
    expect(readCanvasBox([])).toBeUndefined();
    expect(readCanvasBox('x')).toBeUndefined();
    expect(readCanvasBox({ x: 1, y: 2, w: 300, h: 90 })).toEqual({ x: 1, y: 2, w: 300, h: 90 });
    expect(readCanvasBox({ x: 0, y: 0, w: 99999 })).toEqual({ x: 0, y: 0, w: CARD_W_MAX });
    expect(readCanvasBox({ x: Number.NaN, y: 0, w: 200 })).toBeUndefined();
    expect(readCanvasBox({ x: '1', y: 0, w: 200 })).toBeUndefined();
    expect(readCanvasBox({ x: 0, y: 0, w: 0 })).toBeUndefined();
    expect(readCanvasBox({ x: 5, y: 6, w: 200, h: -3 })).toEqual({ x: 5, y: 6, w: 200 });
  });
});

// COLLECTION_PLAN K12 — a canvas of hundreds draws only what the camera is looking at (§45).
describe('viewRect — the part of the world on screen', () => {
  it('is the frame in world terms, with a margin so a pan shows no hole', () => {
    expect(viewRect({ x: 0, y: 0, zoom: 1 }, 800, 600)).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    expect(viewRect({ x: 0, y: 0, zoom: 1 }, 800, 600, 100)).toEqual({ x: -100, y: -100, w: 1000, h: 800 });
    expect(viewRect({ x: 0, y: 0, zoom: 2 }, 800, 600, 100)).toEqual({ x: -50, y: -50, w: 500, h: 400 });
    // Panned right by 200 screen pixels: the world shifts left by the same, in world units.
    expect(viewRect({ x: -200, y: 0, zoom: 1 }, 800, 600)).toEqual({ x: 200, y: 0, w: 800, h: 600 });
  });

  it('is what hitTest takes to say which cards are worth drawing', () => {
    const boxes = { near: { x: 10, y: 10, w: 100, h: 100 }, far: { x: 5000, y: 5000, w: 100, h: 100 } };
    const seen = hitTest(viewRect({ x: 0, y: 0, zoom: 1 }, 800, 600, 200), boxes, () => 100);
    expect(seen).toEqual(['near']);
  });
});

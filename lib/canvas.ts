// A Collection's canvas — the pure geometry (COLLECTION_PLAN K5; COLLECTION_ITEM_BRIEF §5–8).
//
// The canvas is the second way to browse a Collection: its items arranged by hand on an infinite
// surface. Where each card sits is layout, kept on the item (`CollectionItem.canvas`) and never mixed
// with what the item holds, so moving a card changes nothing about it. This file is the arithmetic —
// camera, zoom about the pointer, fit, marquee, where an unplaced card goes, move, resize, and what is
// saved — with no DOM.
//
// World units are CSS pixels at 100%. A camera maps them to the screen: screen = world × zoom + (x, y).
import { placeMasonry } from './masonry';

/**
 * A card's place on the canvas: its top-left corner and its width, in world px, and the height it was
 * last measured at. A card's height follows its content, so `h` is a record, never an instruction.
 */
export type CanvasBox = { x: number; y: number; w: number; h?: number };
export type CanvasBoxes = Record<string, CanvasBox>;
export type Camera = { x: number; y: number; zoom: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
/** A card's width when it first lands on the canvas, and the gap between cards laid out together. */
export const CANVAS_CARD_W = 240;
export const CANVAS_GAP = 24;
/** How narrow and how wide a card may be resized. */
export const CARD_W_MIN = 120;
export const CARD_W_MAX = 960;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampWidth = (w: number) => Math.min(CARD_W_MAX, Math.max(CARD_W_MIN, w));
/** Whole pixels, and never a negative zero. */
const whole = (n: number) => Math.round(n) || 0;

export function clampZoom(zoom: number): number {
  return finite(zoom) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) : 1;
}

export const toWorld = (cam: Camera, sx: number, sy: number): Point => ({ x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom });
export const toScreen = (cam: Camera, wx: number, wy: number): Point => ({ x: wx * cam.zoom + cam.x, y: wy * cam.zoom + cam.y });

/** The camera at `zoom` (clamped) that keeps the world point under the screen point (sx, sy) where it is. */
export function zoomAt(cam: Camera, zoom: number, sx: number, sy: number): Camera {
  const z = clampZoom(zoom);
  const w = toWorld(cam, sx, sy);
  return { x: sx - w.x * z, y: sy - w.y * z, zoom: z };
}

/** The camera moved by what the pointer moved, in screen px. */
export const panBy = (cam: Camera, dx: number, dy: number): Camera => ({ x: cam.x + dx, y: cam.y + dy, zoom: cam.zoom });

/**
 * The camera that shows `rect` whole and centred in a `vw` × `vh` viewport, `pad` screen px in from
 * every edge — never enlarged past `maxZoom`, so fitting three cards does not blow them up. With
 * nothing to show, the origin, inset by the padding.
 */
export function fitCamera(rect: Rect | null, vw: number, vh: number, pad = 40, maxZoom = 1): Camera {
  if (!rect || rect.w <= 0 || rect.h <= 0) return { x: pad, y: pad, zoom: 1 };
  const zoom = clampZoom(Math.min(maxZoom, (vw - pad * 2) / rect.w, (vh - pad * 2) / rect.h));
  return { x: vw / 2 - (rect.x + rect.w / 2) * zoom, y: vh / 2 - (rect.y + rect.h / 2) * zoom, zoom };
}

/** The world rectangle covering every box. A box not measured yet stands at `heightOf`. */
export function boundsOf(boxes: CanvasBoxes, heightOf: (id: string) => number): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [id, b] of Object.entries(boxes)) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + (b.h ?? heightOf(id)));
  }
  return minX === Infinity ? null : { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** The rectangle between two corners — a marquee, dragged in any direction. */
export function rectBetween(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/**
 * The part of the world the camera is looking at, with a margin either side so a pan shows no hole. What
 * `hitTest` takes to say which cards are worth drawing at all (COLLECTION_VIEW_BRIEF §45).
 */
export function viewRect(cam: Camera, vw: number, vh: number, margin = 0): Rect {
  const a = toWorld(cam, -margin, -margin);
  const b = toWorld(cam, vw + margin, vh + margin);
  // `|| 0` only to turn -0 into 0: a rect that prints "-0" is noise in every diagnostic that reads one.
  return { x: a.x || 0, y: a.y || 0, w: b.x - a.x, h: b.y - a.y };
}

/** The cards a rectangle touches, in the order the boxes are given. Touching an edge is not touching. */
export function hitTest(rect: Rect, boxes: CanvasBoxes, heightOf: (id: string) => number): string[] {
  return Object.entries(boxes)
    .filter(([id, b]) => rect.x < b.x + b.w && b.x < rect.x + rect.w && rect.y < b.y + (b.h ?? heightOf(id)) && b.y < rect.y + rect.h)
    .map(([id]) => id);
}

/**
 * Boxes for the items in `order` that have none. The canvas opens AS the masonry — in the reference the
 * grid simply becomes a surface that pans — so they are `CANVAS_CARD_W` wide in `columns` columns,
 * placed row by row and then into the shortest column (lib/masonry.ts). When some cards are placed
 * already, the newcomers are laid out to the right of all of them, level with their top: never over a
 * card someone put somewhere.
 */
export function placeUnplaced(order: readonly string[], placed: CanvasBoxes, heightOf: (id: string) => number, columns: number): CanvasBoxes {
  const newcomers = order.filter((id) => !placed[id]);
  if (!newcomers.length) return {};
  const bounds = boundsOf(placed, heightOf);
  const left = bounds ? bounds.x + bounds.w + CANVAS_GAP * 2 : 0;
  const top = bounds ? bounds.y : 0;
  const { positions } = placeMasonry(newcomers.map(heightOf), columns, CANVAS_GAP);
  const out: CanvasBoxes = {};
  newcomers.forEach((id, i) => {
    out[id] = { x: left + positions[i].column * (CANVAS_CARD_W + CANVAS_GAP), y: top + positions[i].top, w: CANVAS_CARD_W };
  });
  return out;
}

/** Every item's box, in `order`: a saved box exactly as saved, and the rest laid out by `placeUnplaced`. */
export function arrangement(order: readonly string[], saved: CanvasBoxes, heightOf: (id: string) => number, columns: number): CanvasBoxes {
  const placed: CanvasBoxes = {};
  for (const id of order) if (saved[id]) placed[id] = saved[id];
  const laid = placeUnplaced(order, placed, heightOf, columns);
  const out: CanvasBoxes = {};
  for (const id of order) out[id] = placed[id] ?? laid[id];
  return out;
}

/** `boxes` with `ids` moved by (dx, dy) world px. A new object; every box not moved is the same object. */
export function moveBoxes(boxes: CanvasBoxes, ids: readonly string[], dx: number, dy: number): CanvasBoxes {
  const out: CanvasBoxes = { ...boxes };
  for (const id of ids) {
    const b = boxes[id];
    if (b) out[id] = { ...b, x: b.x + dx, y: b.y + dy };
  }
  return out;
}

/** A box resized from its corner to width `w`, within limits. The height is the card's to settle again. */
export function resizeBox(box: CanvasBox, w: number): CanvasBox {
  return { x: box.x, y: box.y, w: finite(w) ? clampWidth(w) : box.w };
}

/**
 * The arrangement to keep: a box for every item that still exists, in whole pixels. An item that has been
 * deleted takes its box with it.
 */
export function boxesToSave(all: CanvasBoxes, existing: ReadonlySet<string>): CanvasBoxes {
  const out: CanvasBoxes = {};
  for (const [id, b] of Object.entries(all)) {
    if (!existing.has(id)) continue;
    const box: CanvasBox = { x: whole(b.x), y: whole(b.y), w: whole(b.w) };
    if (b.h !== undefined) box.h = whole(b.h);
    out[id] = box;
  }
  return out;
}

/**
 * A stored box as a canvas may draw it. It is written from the browser, so the reader is the guard: a
 * box needs finite numbers and a positive width (held to the limits); an unreadable height is dropped
 * rather than the box. Anything else reads as no box at all.
 */
export function readCanvasBox(raw: unknown): CanvasBox | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const { x, y, w, h } = raw as Record<string, unknown>;
  if (!finite(x) || !finite(y) || !finite(w) || w <= 0) return undefined;
  const box: CanvasBox = { x, y, w: clampWidth(w) };
  if (finite(h) && h > 0) box.h = h;
  return box;
}

/**
 * The camera that brings a card fully into sight, `margin` screen px from the edges, moving no further
 * than it must — how the keyboard reaches a card that is off-screen. The same camera when the card is
 * already in sight; a card bigger than the view keeps its top-left corner in sight.
 */
export function panToReveal(cam: Camera, box: CanvasBox, height: number, vw: number, vh: number, margin = 24): Camera {
  const left = box.x * cam.zoom + cam.x;
  const top = box.y * cam.zoom + cam.y;
  const along = (start: number, end: number, size: number) => {
    if (start < margin) return margin - start;
    if (end > size - margin) return Math.max(size - margin - end, margin - start);
    return 0;
  };
  const dx = along(left, left + box.w * cam.zoom, vw);
  const dy = along(top, top + height * cam.zoom, vh);
  return dx || dy ? { x: cam.x + dx, y: cam.y + dy, zoom: cam.zoom } : cam;
}

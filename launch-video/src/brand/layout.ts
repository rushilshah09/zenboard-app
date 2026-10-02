/**
 * 12-column grid (§3): 1920 × 1080, 160px margins, 32px gutters.
 * Scenes position everything through these helpers and zones.
 */
export const FRAME = { w: 1920, h: 1080 } as const;
export const MARGIN = 160;
export const GUTTER = 32;
export const COL_W = (FRAME.w - MARGIN * 2 - GUTTER * 11) / 12; // 104

/** Left x of column n (1-based). */
export const col = (n: number) => MARGIN + (n - 1) * (COL_W + GUTTER);
/** Width of n columns including the gutters between them. */
export const span = (n: number) => n * COL_W + (n - 1) * GUTTER;

export type Rect = { x: number; y: number; w: number; h: number };

/** Named zones. A scene places each element in one zone; zones in use never intersect. */
export const ZONES = {
  /** Acts 1–3 headline: left six columns (a 72px line needs them to stay within 2 lines). */
  headlineLeft: { x: col(1), y: 336, w: span(6), h: 408 },
  /** Acts 1–3 visual: right six columns (IMG-01's figure sits in the right 55%). */
  visualRight: { x: col(7), y: 128, w: span(6), h: 824 },
  /** From the reveal: centred headline in the top third. */
  headlineTop: { x: col(1), y: 112, w: span(12), h: 128 },
  /** From the reveal: the product window, 96px under the headline zone. */
  window: { x: col(1), y: 336, w: span(12), h: 668 },
  /** Act 2–3 tab strip / tile row. */
  strip: { x: col(1), y: 96, w: span(12), h: 56 },
  /** The whole title-safe area. */
  centre: { x: col(1), y: 128, w: span(12), h: 824 },
} as const satisfies Record<string, Rect>;

/** Title-safe (90%) and UI-safe (93%) areas. */
export const SAFE = {
  title: { x: 96, y: 54, w: 1728, h: 972 },
  ui: { x: 67, y: 38, w: 1786, h: 1004 },
} as const;

export const centreOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

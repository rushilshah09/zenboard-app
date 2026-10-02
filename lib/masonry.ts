// Masonry placement — pure arithmetic, no DOM (COLLECTION_VIEW_PLAN C1).
//
// A Collection's cards keep their own heights (COLLECTION_VIEW_BRIEF §13: "do not make
// every card identical in height"). They are placed ROW BY ROW into the shortest column,
// so the document order, the tab order and a manual order all read left to right, top to
// bottom. CSS columns would read column by column instead.

/** How many columns of at least `minCard` px fit in `width`, never fewer than one. */
export function masonryColumns(width: number, minCard: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (minCard + gap)));
}

export type MasonrySpot = { column: number; top: number };

/**
 * Where each card goes, given the cards' heights in order: into the column whose next
 * free top is lowest, the leftmost on a tie, so the same heights always land the same way.
 * `height` is the tallest column, without a trailing gap.
 */
export function placeMasonry(heights: readonly number[], columns: number, gap: number): { positions: MasonrySpot[]; height: number } {
  const count = Math.max(1, Math.floor(columns));
  const bottoms = new Array<number>(count).fill(0);
  const used = new Array<boolean>(count).fill(false);
  const nextTop = (c: number) => (used[c] ? bottoms[c] + gap : 0);
  const positions = heights.map((h) => {
    let column = 0;
    for (let c = 1; c < count; c++) if (nextTop(c) < nextTop(column)) column = c;
    const top = nextTop(column);
    bottoms[column] = top + Math.max(0, h);
    used[column] = true;
    return { column, top };
  });
  return { positions, height: Math.max(0, ...bottoms) };
}

// ── Arranging by hand (COLLECTION_PLAN K8, COLLECTION_VIEW_BRIEF §29) ──

/** A card as drawn, in the grid's own coordinates. */
export type CardBox = { id: string; left: number; top: number; width: number; height: number };

/** How far a point is from a box — nothing at all when it is inside it. */
function distance(b: CardBox, x: number, y: number): number {
  const dx = Math.max(b.left - x, 0, x - (b.left + b.width));
  const dy = Math.max(b.top - y, 0, y - (b.top + b.height));
  return Math.hypot(dx, dy);
}

/**
 * The place a card carried over the masonry would take — an index among ALL the cards as drawn, 0…n.
 *
 * The nearest card decides, and which side of it the pointer is on: above it or below it first (so the
 * end of a column can be dropped into, and so one column reads top to bottom), and beside it otherwise,
 * where a masonry reads left to right. Nothing moves under the pointer while a card is carried — the
 * line moves instead, like a table's rows.
 */
export function masonryLanding(boxes: readonly CardBox[], at: { x: number; y: number }): number {
  if (!boxes.length) return 0;
  let nearest = 0;
  let best = Infinity;
  boxes.forEach((b, i) => {
    const d = distance(b, at.x, at.y);
    // A tie goes to the later card — the pointer is in the gap before it, which is where the line belongs.
    if (d <= best) { nearest = i; best = d; }
  });
  const b = boxes[nearest];
  const oneColumn = new Set(boxes.map((x) => x.left)).size === 1;
  const after = at.y > b.top + b.height ? true
    : at.y < b.top ? false
    : oneColumn ? at.y > b.top + b.height / 2 : at.x > b.left + b.width / 2;
  return nearest + (after ? 1 : 0);
}

/**
 * Which cards are worth drawing (COLLECTION_VIEW_BRIEF §45): the ones whose span meets the window, plus a
 * margin either side so a scroll never shows a hole. Indices, in the order given — a masonry's order is not
 * its vertical order, so this looks at every card rather than bisecting.
 */
export function cellsInView(boxes: readonly CardBox[], from: number, to: number, overscan = 0): number[] {
  const top = from - overscan;
  const bottom = to + overscan;
  const seen: number[] = [];
  boxes.forEach((b, i) => { if (b.top <= bottom && b.top + b.height >= top) seen.push(i); });
  return seen;
}

/**
 * That landing as a place among the OTHER cards — what `moveItem` takes. Null when the drop would leave
 * the card where it is: the two gaps either side of itself.
 */
export function dropIndex(landing: number, from: number): number | null {
  if (landing === from || landing === from + 1) return null;
  return landing > from ? landing - 1 : landing;
}

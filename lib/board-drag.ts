'use client';
// The one answer to "which column is this card over?" — shared by every board that
// drags (the content pipeline, the database board). Kept out of components/ds,
// which must never import dnd-kit (see board.tsx, "THE DRAG SEAM").
import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';

/**
 * Which column is being dropped into.
 *
 * `pointerWithin` first, because a column is a big target and a card a small
 * one, and the only question is which column the pointer is in — not which card
 * it is nearest, which is what `closestCenter` would answer.
 *
 * `rectIntersection` as the fallback, for the moment the pointer is NOT inside
 * any column: the 12px gutter between two of them, or the canvas under a short
 * one. `pointerWithin` alone returns nothing there, so a card released in the
 * gap silently went home — measured, 2026-09-12. The fallback asks which column
 * the held CARD overlaps instead, which is the same question asked of the card
 * rather than of the cursor.
 */
export const columnUnderPointer: CollisionDetection = (args) => {
  const hit = pointerWithin(args);
  return hit.length > 0 ? hit : rectIntersection(args);
};

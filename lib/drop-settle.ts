import { defaultDropAnimationSideEffects, type DropAnimation } from '@dnd-kit/core';
import { MOTION } from '@/components/ds/ui/motion';

/**
 * THE DROP, for every board that lifts a card.
 *
 * dnd-kit draws two objects: the overlay you are holding, and the card in the
 * list you are actually moving. With `dropAnimation={null}` they never meet —
 * the held one disappears under the cursor and the real one is simply already
 * somewhere else. Measured on the content board with a real pointer drag
 * (scripts/verify/verify-board-drag.mjs): released at x=478, the card read
 * x=340 on all fourteen samples over the 420ms after release. A 138px teleport
 * with nothing in between, which is the one thing a drag must never do — the
 * whole gesture is a claim about where the thing went.
 *
 * So the overlay flies to the dropped card's own rect and hands over there.
 * dnd-kit measures that rect itself, so this cannot drift from where the card
 * actually lands. The numbers are the app's: `--duration-slow` and
 * `--ease-out-quiet`, through the MOTION seam rather than spelled again.
 *
 * `null` under reduced motion, where the instant answer is the honest one.
 * This is a plain function, not a hook: it is read at render by DragOverlay and
 * consumed only on release, so there is no state to keep in step.
 */
export function dropSettle(): DropAnimation | null {
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (still) return null;
  return {
    duration: MOTION.slow * 1000,
    easing: `cubic-bezier(${MOTION.ease.join(', ')})`,
    // The card underneath is hidden while the overlay flies to it, so the drop
    // never shows the same card twice.
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } }),
  };
}

/**
 * The declared opposite: this overlay deliberately does NOT settle.
 *
 * Legitimate when what you are holding is not the thing that lands — a
 * `DragGhost` chip naming a row or a column, say, where flying the chip into a
 * table cell would animate a claim that is not true, and the `DropLine` has
 * already said where it goes. Spelled as a name rather than a bare `null` so
 * the choice is visible to a reader and to `app/design-system.test.ts`.
 */
export const NO_SETTLE = null;

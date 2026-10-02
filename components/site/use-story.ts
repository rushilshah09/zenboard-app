'use client';
// ── A PICTURE THAT TELLS ITS STORY ON A LOOP ────────────────────────────────
//
// The clock for the client portal's three pictures (portal-section.tsx; user, 2026-09-29: "make them
// proper animation, delightful animation, on loop"). A picture tells its card's sentence in STEPS, and
// this says which step it has reached; every part of the picture says from which step it shows
// (`data-on`), and the stylesheet moves it there with a transition (globals.css "a portal picture
// tells its story"). So the story is written in the markup that draws it, and the motion is CSS:
// interruptible, and off the main thread.
//
//   · It runs only while the picture is on screen, and from its first step the first time it is
//     seen, so a reader watches a story begin rather than arrive at it half told.
//   · Less motion asked for: the clock never starts, and the picture holds the step at which its
//     story is TOLD, a still that says the whole sentence.
//   · Nothing in it answers the pointer: a picture is looped or interactive, never both (user,
//     2026-09-28), and these loop.

import * as React from 'react';
import { useReducedMotion } from '@/components/ds/ui/motion';

/** One beat of a story, in milliseconds: `--site-swap`, the site's cross-fade, stated once for the one
 *  thing script needs it for. A step holds for a multiple of it, so a story keeps the page's pace. */
const BEAT_MS = 500;

/**
 * `holds` is how many beats each step holds before the next; after the last, the story starts again.
 * `told` is the step a still picture shows. Returns the ref for the picture and `on`, which a part
 * spreads as its `data-on`: `''` (the attribute is present) while the story is between the part's
 * two steps, `undefined` (absent) otherwise. One reader with both ends, because `''` is falsy and
 * two readers joined with `&&` would switch a part on at the wrong step.
 */
export function useStory(holds: readonly number[], told: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState(0);
  const [seen, setSeen] = React.useState(false);
  const still = useReducedMotion() === true;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (still || !seen) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % holds.length), holds[step] * BEAT_MS);
    return () => window.clearTimeout(id);
  }, [step, seen, still, holds]);

  const now = still ? told : step;
  /** On from step `from` until step `to`, or for the rest of the story when there is no `to`. */
  const on = (from: number, to = Infinity) => (now >= from && now < to ? '' : undefined);
  return { ref, on };
}

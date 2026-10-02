'use client';
// THE motion seam — the single place the app imports an animation library from.
//
// Same argument as the icon seam (components/ds/icons.ts): route every call
// through one module and the library becomes a one-file decision. It also keeps
// the VOCABULARY small on purpose — four primitives, because motion earns its
// place only when it answers one of four questions, and anything else is
// decoration that makes an interface feel busy rather than alive:
//
//   Did it hear me?      → the press (globals.css `.zb-press` / `.zb-tap`, CSS,
//                          because it must land in 20ms and never wait on JS)
//   Where did it come from? → <Appear>
//   Where did it go?        → <Presence>
//   What moved?             → <Move> (layout animation — the only one CSS cannot do)
//
// ── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────
// Measured on a live page: 77 of 326 elements animated, and 44 of those animated
// COLOUR ONLY — 7 moved. Zero long tasks, an idle main thread. The app was never
// slow; it was motionless, and a UI where nothing arrives, leaves or moves reads
// as static and, when you click it, as laggy.
//
// Everything here honours `prefers-reduced-motion` through Motion's own
// `useReducedMotion`, which returns the user's setting rather than guessing.
import * as React from 'react';
import {
  AnimatePresence, LayoutGroup, motion, useReducedMotion,
  type HTMLMotionProps, type Transition,
} from 'motion/react';
import { lastInput } from '@/lib/input-modality';

/**
 * The durations and easings, as JS — the same numbers `ds-theme.css` publishes
 * as tokens. Duplicated deliberately and narrowly: a CSS custom property cannot
 * be read by a JS animation without a layout read per frame, and two values
 * that must agree are better named in both places than silently re-derived.
 */
export const MOTION = {
  fast: 0.1,
  base: 0.15,
  slow: 0.2,
  /** The app's standard curve — `--ease-out-quiet`, a quiet decelerate. */
  ease: [0.23, 1, 0.32, 1] as const,
  /** For anything that should feel physical rather than switched. */
  spring: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } satisfies Transition,
  /**
   * ── THE TWO SPRINGS, SAID THE WAY APPLE SAYS THEM ─────────────────────────
   * User, 2026-09-30: "entire application ... intrection is so statics i want apple like
   * interaction". Apple's own answer is springs, described by TWO numbers rather than the physics
   * triplet — damping ratio (how much it overshoots) and response (how fast it gets there) —
   * because a person can reason about those and cannot reason about stiffness 520 / mass 0.7.
   * Motion's `bounce` + `duration` is that same pair.
   *
   * `calm` is critically damped: damping 1.0, response 0.4, NO overshoot. It is the default,
   * because an overshoot on something that merely appeared reads as a wobble. `carried` has
   * Apple's bounce and is allowed ONLY where the gesture itself carried momentum — a flick, a
   * throw, a drag release. Overshoot is the interface agreeing with your hand; with no hand it is
   * decoration.
   *
   * (`spring` above is ζ ≈ 0.89 — under-damped, so it belongs to the `carried` family. It is kept
   * because `Move` is FLIP for a dragged or reordered row, which is exactly a carried gesture.)
   */
  calm: { type: 'spring', bounce: 0, duration: 0.4 } satisfies Transition,
  carried: { type: 'spring', bounce: 0.2, duration: 0.4 } satisfies Transition,
  /** An icon changing with state (better-ui's contextual-icon values: no bounce, ever). */
  swap: { type: 'spring', duration: 0.3, bounce: 0 } satisfies Transition,
};

/** The reader's own setting, from the seam rather than a second matchMedia call. */
export { useReducedMotion };
/** The library's own primitives, for the few places that need them - through the
 *  seam, so the library stays a one-file decision (the Board and the content
 *  calendar imported it directly). */
export { AnimatePresence, LayoutGroup, motion };

const RISE = 4;   // px. Enough to read as arrival, small enough not to be a slide.

/**
 * Content ARRIVING. A fade with a 4px rise, which is the smallest movement that
 * reads as "this came from somewhere" rather than "this blinked into being".
 *
 * `index` staggers a list so it arrives AS a list. Capped, because past a
 * handful the stagger stops reading as sequence and starts reading as delay —
 * the tenth row should not wait 400ms to exist.
 */
export function Appear({ index = 0, className, children, ...rest }: HTMLMotionProps<'div'> & { index?: number }) {
  const still = useReducedMotion();
  // A key created it: it is simply there (Emil: never animate keyboard-initiated actions).
  const instant = still || lastInput() === 'keyboard';
  return (
    <motion.div
      className={className}
      // Full transform strings, not Motion's `y` shorthand: the shorthand runs on
      // requestAnimationFrame and drops frames while a page is loading, which is
      // exactly when Appear plays. A transform string is hardware accelerated.
      initial={instant ? false : { opacity: 0, transform: `translateY(${RISE}px)` }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: MOTION.base, ease: MOTION.ease, delay: Math.min(index, 6) * 0.03 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Something LEAVING. Wrap a conditional or a keyed list; children must be
 * `<Appear>` (or any motion element) and carry a stable `key`.
 *
 * Exit is the half CSS cannot do: an element removed from the DOM is simply
 * gone, so a deleted row vanishes mid-sentence unless something holds it on
 * screen long enough to leave.
 */
export function Presence({ children, initial = false }: { children: React.ReactNode; initial?: boolean }) {
  return <AnimatePresence initial={initial}>{children}</AnimatePresence>;
}

/**
 * Something MOVING to a new position — a reordered list, a card changing column.
 *
 * The one primitive here that genuinely needs the library: it measures the
 * element before and after the change and animates the difference (FLIP). CSS
 * has no way to know where a thing used to be.
 */
export function Move({ className, children, initial, animate, exit, ...rest }: HTMLMotionProps<'div'>) {
  const still = useReducedMotion();
  // Callers hand Move their own enter and exit (the tasks list rises 4px and
  // collapses a removed row's height). For a reduced-motion reader those keep
  // their fade and lose the movement - the same rule the CSS side follows.
  return (
    <motion.div
      layout={still ? false : 'position'}
      transition={MOTION.spring}
      className={className}
      // A key created it: it is simply there (Emil: never animate keyboard-initiated actions).
      initial={still ? onlyFades(initial) : lastInput() === 'keyboard' ? false : initial}
      animate={still ? onlyFades(animate) : animate}
      exit={still ? onlyFades(exit) : exit}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const MOVES = new Set(['transform', 'x', 'y', 'scale', 'rotate', 'height', 'width', 'marginTop', 'marginBottom']);
/** A motion target with everything that moves or resizes taken out. */
function onlyFades<T>(target: T): T {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return target;
  return Object.fromEntries(Object.entries(target as Record<string, unknown>).filter(([k]) => !MOVES.has(k))) as T;
}

/**
 * ONE VIEW BECOMING ANOTHER — a mode toggle, a tab whose whole pane changes.
 *
 * USER, 2026-09-30, looking at Home's Dashboard/Ask toggle: *"entire application ... intrection
 * is so statics"*. They were looking at the right thing. The toggle's own thumb slid, and then the
 * entire page under it was replaced by a bare ternary — no exit, no entrance, nothing. One half of
 * the interaction animated, which is what made the other half's absence visible.
 *
 * ── WHY IT MOVES SIDEWAYS, AND WHICH WAY ────────────────────────────────────
 * Apple's spatial consistency: a thing leaves the way it came, and the in-between frames point at
 * the outcome. The toggle is horizontal and the pane belongs to the segment you pressed, so the
 * pane travels the way the thumb just did — press the right-hand segment and the pane arrives from
 * the right. 8px, not 40: a HINT at direction. A full-page slide on something pressed many times a
 * day is a journey.
 *
 * ── THE SPRING IS CRITICALLY DAMPED ─────────────────────────────────────────
 * `MOTION.calm` — no overshoot, because no gesture carried momentum into this. A bounce here would
 * be the interface being pleased with itself.
 *
 * ── THE ENTRANCE IS WHAT THIS CAN PROMISE ───────────────────────────────────
 * `AnimatePresence initial` is TRUE, and that is not a default nobody thought about. An exit only
 * runs while the presence tree survives the change — and Home's two modes do not share a layout:
 * Dashboard is a `PageLayout`, Ask is a `HubLayout` with a rail, so switching replaces the whole
 * subtree and the outgoing pane is gone before anything could animate it out. Measured with
 * `getAnimations()`: with `initial={false}` the swap ran ZERO animations, exactly as before this
 * existed. So the honest contract is an ARRIVAL. Where a caller's layout does survive (a tab
 * inside one pane), the exit below runs too and the pair is symmetric.
 *
 * ── `wait`, AND WHY NOT `popLayout` ─────────────────────────────────────────
 * `popLayout` lifts the leaving pane out of flow so the two overlap, which is what Apple does —
 * but two panes here differ in height by hundreds of pixels, so the container collapses mid-swap
 * and the page jumps. `wait` keeps the layout honest.
 *
 * Reduced motion keeps the cross-fade and drops the travel; a keyboard arrival is instant, read
 * from the same seam every other entrance uses, so nothing here decides that twice.
 */
export function ViewSwap({ swapKey, direction = 1, className, children }: {
  /** Changing this is what swaps the view. */
  swapKey: string;
  /** +1 when the new view sits to the RIGHT of the old one in its control, -1 to the left. */
  direction?: 1 | -1;
  className?: string;
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  const instant = still || lastInput() === 'keyboard';
  const shift = instant ? 0 : 8 * direction;

  return (
    <AnimatePresence mode="wait" initial>
      <motion.div
        key={swapKey}
        className={className}
        initial={{ opacity: 0, transform: `translateX(${shift}px)` }}
        animate={{ opacity: 1, transform: 'translateX(0px)' }}
        // The exit carries its OWN transition: a leaving child animates with the props of its last
        // render and would otherwise take the entrance's spring — an exit as long as its entrance
        // is the half of a swap you wait through.
        exit={{
          opacity: 0,
          transform: `translateX(${-shift}px)`,
          transition: instant ? { duration: 0 } : { duration: MOTION.fast, ease: MOTION.ease },
        }}
        transition={instant
          ? { duration: 0 }
          : { transform: MOTION.calm, opacity: { duration: MOTION.base, ease: MOTION.ease } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * An icon that CHANGES with state — Copy becomes Check, Play becomes Pause. The old one
 * shrinks away as the new one grows in, blurred through the middle so the eye reads one
 * icon changing rather than two overlapping (Emil Kowalski: blur masks a crossfade).
 * Values are better-ui's for a contextual icon: scale 0.25 → 1, opacity 0 → 1, blur
 * 4px → 0, a spring of 0.3s with no bounce. A key did it: it simply changes. Reduced
 * motion keeps the crossfade and drops the scale and blur.
 */
export function IconSwap({ swapKey, children }: { swapKey: string; children: React.ReactNode }) {
  const still = useReducedMotion();
  const instant = lastInput() === 'keyboard';
  // Variants, and the hand passed as `custom`: a LEAVING child animates with the props
  // of its last render, so a key that swaps the icon would still play the exit the
  // previous click set up. AnimatePresence hands `custom` to leaving children fresh.
  const variants = {
    away: (keyboard: boolean) => (keyboard
      ? { opacity: 0, transition: { duration: 0 } }
      : still ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' }),
    shown: still ? { opacity: 1 } : { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
  };
  return (
    // popLayout lifts the leaving icon out of flow, so the button never changes width.
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false} custom={instant}>
        <motion.span
          key={swapKey}
          className="inline-flex items-center justify-center"
          custom={instant}
          variants={variants}
          initial={instant ? false : 'away'}
          animate="shown"
          exit="away"
          transition={MOTION.swap}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Exit variants for a row that is being removed rather than replaced. */
export const EXIT_ROW = {
  opacity: 0,
  height: 0,
  marginTop: 0,
  marginBottom: 0,
  // Was [0.4, 0, 1, 1] - an ease-in, which holds still while the reader watches.
  // Leaving is ease-out like everything else; the exit's asymmetry is its duration.
  transition: { duration: MOTION.fast, ease: MOTION.ease },
};

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

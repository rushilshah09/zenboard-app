'use client';
// ── A LIST THAT TURNS ITS OWN PAGES, UNTIL YOU TOUCH IT ────────────────────
//
// The one interaction grammar for everything on the website that moves on by itself (a product area's
// features, the loop's steps): an item holds for `--site-dwell`, shown as a berry rule filling under
// it, then the next takes over. The dwell is CSS (`site-dwell` in globals.css), so:
//   · pointer over the part, or focus inside it: it pauses (a reader is reading);
//   · the part off screen: it pauses (nothing turns over where nobody is looking);
//   · CHOOSING an item just turns to it and carries on from there;
//   · PRESSING INSIDE A PICTURE holds it, and then it carries on too. It used to stop for good,
//     which is the freeze the user described twice: "once I interact it stops at the same place,
//     not auto running, and this happens on all the screens", and then "when I click any
//     interaction the entire flow is frozen — I don't want that, it should still continue from
//     where I clicked automatically." A press is a reader saying "wait", not "never again", so it
//     buys one whole dwell of quiet and then the list goes on;
//   · NOTHING IS EVER UNMOUNTED to pause it. The dwell stays rendered and `[data-running='false']`
//     pauses its animation, so the fill holds exactly where it had got to and resumes from there.
//     Unmounting it (which is what `auto` used to do) restarted it from zero, which is the other
//     half of "continue from where I clicked";
//   · less motion asked for: there is no dwell at all, so nothing ever advances by itself.
// Pausing is one attribute, `data-running`, on the part's root; the stylesheet pauses every animation
// inside it, the dwell and whatever the part choreographs alongside.

import * as React from 'react';
import { cn } from '@/lib/cn';

/** One dwell, in milliseconds: the same `--site-dwell` the CSS uses, stated once for the one
 *  thing JavaScript needs it for. A press buys exactly this much quiet. */
const DWELL_MS = 6000;

export function useAutoAdvance(count: number) {
  const [active, setActive] = React.useState(0);
  /** When the reader last USED the picture. Zero means they are not. */
  const [usedAt, setUsedAt] = React.useState(0);
  const [held, setHeld] = React.useState(false);
  const [seen, setSeen] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);

  // A press buys ONE dwell of quiet, and then the list carries on. Long enough that a reader who
  // ticked a task is not interrupted mid-thought; short enough that walking away from the page
  // does not leave it stopped for good. The pointer resting on the section holds it for as long
  // as it rests there anyway (`held`), so this is only about the moment after a press.
  React.useEffect(() => {
    if (!usedAt) return;
    const id = window.setTimeout(() => setUsedAt(0), DWELL_MS);
    return () => window.clearTimeout(id);
  }, [usedAt]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !held && seen && !usedAt;
  /** Turn to an item and carry on from it. The dwell is keyed on `active`, so it restarts. */
  const choose = (i: number) => setActive(i);
  const next = () => setActive((a) => (a + 1) % count);
  /** The reader is USING the picture: hold, then carry on from where the dwell had got to. */
  const stop = () => setUsedAt(Date.now());
  const hold = {
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocusCapture: () => setHeld(true),
    onBlurCapture: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); },
  };
  // `auto` is gone from the API on purpose: every call site used it to decide whether to RENDER
  // the dwell, and not rendering it is what reset it to zero. The dwell is always rendered for the
  // active item now, and `data-running` decides whether it moves.
  return { ref, active, seen, running, choose, next, stop, hold };
}

/** HOW MANY DOTS go round a marker. An INTEGER, and the rect's `pathLength`, so one slot is
 *  exactly 1/18th of the perimeter at any size: the dots stay evenly spaced on a 28px box and on
 *  a 36px one with no arithmetic, AND the ring closes on itself with no odd gap at the seam. */
const DOTS = 18;

/**
 * THE DWELL: A MARKER THAT DRAWS ITS OWN DOTS, THEN RUNS A LINE ROUND THEM.
 *
 * One component, four states, because they are one thing (user, 2026-09-28, describing the whole
 * arc rather than a frame of it): "Default → dots draw themselves around the icon → accent stroke
 * travels around the perimeter → active state. Not: Default → instantly show a complete dotted
 * circle."
 *
 *   rest    nothing is drawn at all. No dots, no line — the icon on its tile and nothing else
 *           ("remove the dotted circle completely … no permanent dotted circle in the inactive
 *           state"). There is no SVG in the DOM either: the box only holds the room.
 *   in      the dots EASE IN one after another round the box, from one point, over
 *           `--site-dwell-draw`. This is the half that was missing: the dots used to be revealed
 *           by the timer itself, so they took the whole six seconds to arrive and the marker read
 *           as "empty, then suddenly complete". Drawing them is now an ENTRANCE, and the timer
 *           starts after it.
 *   active  the dotted loop stands, and the accent line runs round it over what is left of
 *           `--site-dwell`, converting dots into a solid stroke as it goes. Its end turns the page.
 *   out     the dots and the line go out the way they came in, from the same point, in half the
 *           time, and then the SVG leaves.
 *
 * WHY DOTS AT ALL, which is the part worth keeping in words: a faint track is decoration and the
 * eye skips it, where a DOTTED box is visibly unfinished — so the line joining the dots up reads
 * as completion rather than as a bar filling. And the box is the app's own corner, not a circle,
 * so the marker belongs to the same family as every other rounded thing on the page. It went bar →
 * segmented track → ring → this, each step moving the timer INTO the thing it times.
 *
 * ONE MASK DOES BOTH ENDS. A white line draws round the box inside a mask, softened at its head,
 * and the dots and the accent line show through it: what the reader sees is dots easing in, never
 * a drawn line and never a grey box waiting underneath. Leaving, a BLACK line draws over the white
 * one along the same path and eats it. That is why the exit is a second rect rather than the first
 * one reversed — an item deselected mid-entrance keeps drawing underneath while the erase catches
 * it up, instead of snapping to a complete ring to leave from.
 */
export function Dwell({ active, onEnd, size = 28, radius = 9, className, children }: {
  /** Is this the item being timed? Everything else follows from it. */
  active: boolean;
  onEnd: () => void;
  size?: number;
  /** The box's corner. Concentric with the marker inside it: a 28px tile with an 8px corner,
   *  4px in from a 36px box, takes 11 — the tile's corner plus the 3px between them. */
  radius?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const mask = `zb-dwell-${id}`;
  const soft = `zb-dwell-soft-${id}`;

  // The phase is reconciled DURING RENDER rather than in an effect, so the entrance is on the same
  // frame the item becomes active and there is never a frame of complete-dots-at-rest between the
  // two. `run` re-keys the SVG, which is what restarts the animations when an item is chosen again
  // while it is still leaving.
  const [phase, setPhase] = React.useState<'rest' | 'in' | 'out'>(active ? 'in' : 'rest');
  const [run, setRun] = React.useState(0);
  const [was, setWas] = React.useState(active);
  if (was !== active) {
    setWas(active);
    if (active) { setPhase('in'); setRun((r) => r + 1); }
    else if (phase === 'in') setPhase('out');
  }

  const box = { x: 1, y: 1, width: size - 2, height: size - 2, rx: radius, pathLength: DOTS };
  return (
    <span className={cn('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      {phase !== 'rest' && (
        <svg key={run} aria-hidden data-phase={phase} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="site-dwell-edge absolute inset-0">
          <defs>
            {/* Wider than the box on every side so the head's blur is not clipped at the rim, which
                is exactly where the dots' outer half sits. */}
            <filter id={soft} filterUnits="userSpaceOnUse" x={-4} y={-4} width={size + 8} height={size + 8}>
              <feGaussianBlur stdDeviation={1.2} />
            </filter>
            <mask id={mask} maskUnits="userSpaceOnUse" x={-4} y={-4} width={size + 8} height={size + 8}>
              <rect className="site-dwell-ring" filter={`url(#${soft})`} {...box} />
              {phase === 'out' && (
                <rect className="site-dwell-erase" filter={`url(#${soft})`} {...box} onAnimationEnd={() => setPhase('rest')} />
              )}
            </mask>
          </defs>
          <g mask={`url(#${mask})`}>
            <rect className="site-dwell-dots" {...box} />
            <rect className="site-dwell-line" {...box} onAnimationEnd={phase === 'in' ? onEnd : undefined} />
          </g>
        </svg>
      )}
      {children}
    </span>
  );
}

/**
 * THE SAME TIMER, AS A LINE, for a list whose rows already have a rule under them (the feature
 * lists: user, 2026-09-26, "here use the normal line fill animation"). The dotted box is right
 * where an item's marker is a tile or a number on a card; where the row itself is drawn with a
 * bottom border, the honest thing is to fill THAT border rather than to add a second mark beside
 * it. Same rule either way: the timer is part of the thing it times.
 *
 * Full width, 2px over the row's own hairline, filling left to right and paused by
 * `[data-running='false']` exactly as the box is.
 */
export function DwellLine({ onEnd, className }: { onEnd: () => void; className?: string }) {
  return (
    <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden', className)}>
      <span
        className="site-dwell block h-full bg-[var(--site-hue-ink,var(--accent))]"
        onAnimationEnd={onEnd}
      />
    </span>
  );
}


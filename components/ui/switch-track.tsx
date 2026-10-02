'use client';
// The switch TRACK on its own — no button, no state, no Radix.
//
// It exists because the DS `<Switch>` is a real Radix button, and the one place
// this is used (the shell's Focus toggle) is already a `<button role="switch">`
// wrapping a label. Nesting a button inside a button is invalid HTML and breaks
// the outer control's hit area, so that row needs the switch's LOOK without its
// behaviour. Anything that owns its own toggling should use `<Switch>` instead.
import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * How far the Focus pill slides, in px. ONE number, read by the CSS and by the drag math, so the
 * thumb cannot land somewhere the transform does not put it.
 *
 * It is also the width of each label's zone, which is what makes the geometry work: at rest the
 * pill sits flush against the far zone, so the label there is fully readable, and half way it
 * covers half of each — the partial occlusion in the user's reference.
 */
const TRAVEL_PX = 34;
/** Below this a pointer gesture is a PRESS, not a drag, and the button's click owns it. */
const DRAG_SLOP = 3;

/**
 * THE LABELLED, DRAGGABLE FORM (2026-09-28, the user's sketch and four rounds on it).
 *
 * A true horizontal slider, not a checkbox wearing a pill: the "Focus" thumb is the only
 * draggable thing, it follows the pointer exactly, and on release it snaps to the nearer
 * side. It is a SWITCH and not a segmented control — the user's correction, and the right
 * one twice over: a segmented is a radio group, so it would announce two peer options
 * where there is one thing that is on or off, and its two labels take peer weight, which
 * IS the "tabs" look they rejected.
 *
 * THE TWO WORDS NEVER MOVE OR CHANGE. "Off" sits leading, "on" trailing, and the thumb
 * slides OVER one of them — so the one you can read is always the side you are not on.
 * That is why they crossfade rather than swap: a word that is being uncovered should
 * appear as the pill leaves it, not blink into place when the state commits.
 *
 * EVERYTHING IS CONTINUOUS IN `p`, the 0..1 position. Colour mixes from ink to the brand
 * across the travel, both labels fade against it, and the thumb rides it — so a half-way
 * drag looks half-way, which is what stops it feeling like a click with extra steps. `p`
 * is held in STATE rather than derived from a measurement, because rendering may not read
 * a ref (React forbids it, and eslint caught exactly that here); the pointer handler does
 * the measuring, which is allowed, and stores the result already normalised.
 */
export function SwitchTrack({ on, size = 'md', labels, tone = 'accent', onToggle }: {
  on: boolean;
  size?: 'sm' | 'md';
  /** Render the wide, labelled, draggable pill. `name` rides the thumb; the other two stay put. */
  labels?: { name: string; off: string; on: string };
  /** `accent` mixes the thumb toward the brand as it travels; `neutral` keeps it ink. */
  tone?: 'accent' | 'neutral';
  /** Called when a DRAG lands on the other side. Clicks stay the parent's job. */
  onToggle?: () => void;
}) {
  const trackRef = React.useRef<HTMLSpanElement>(null);
  const startRef = React.useRef(0);
  const travelRef = React.useRef(0);
  const movedRef = React.useRef(false);
  /** 0..1 while a finger owns the thumb; null when it is resting or snapping. */
  const [dragP, setDragP] = React.useState<number | null>(null);

  if (labels) {
    const p = dragP ?? (on ? 1 : 0);
    const dragging = dragP !== null;
    // Ink at rest on the left, the brand at rest on the right, mixed across the travel.
    const fill = tone === 'accent'
      ? `color-mix(in oklab, var(--accent) ${p * 100}%, var(--color-ink-900))`
      : 'var(--color-ink-900)';

    const down = (e: React.PointerEvent<HTMLSpanElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      travelRef.current = TRAVEL_PX;
      startRef.current = e.clientX; movedRef.current = false; setDragP(on ? 1 : 0);
    };
    const move = (e: React.PointerEvent<HTMLSpanElement>) => {
      if (dragP === null) return;
      const travel = travelRef.current || 1;
      const dx = e.clientX - startRef.current;
      if (Math.abs(dx) > DRAG_SLOP) movedRef.current = true;
      // Clamped, so the thumb can never be dragged out of its own pill.
      setDragP(Math.min(1, Math.max(0, ((on ? travel : 0) + dx) / travel)));
    };
    const up = (e: React.PointerEvent<HTMLSpanElement>) => {
      // Half the travel is the threshold; short of it the thumb springs back to where it was.
      //
      // Recomputed from the RELEASE position rather than read off `dragP`. They are the same
      // whenever a pointermove preceded the up at the same coordinates, which is the normal
      // case — but "normal case" is not "always", and deciding a commit from a stale sample
      // means the switch can land on the opposite side from where the finger let go.
      if (dragP !== null && movedRef.current) {
        const travel = travelRef.current || 1;
        const landed = Math.min(1, Math.max(0, ((on ? travel : 0) + (e.clientX - startRef.current)) / travel));
        if ((landed > 0.5) !== on) onToggle?.();
        e.preventDefault();
      }
      setDragP(null);
    };
    // A drag must not ALSO fire the parent button's click, or the mode would toggle twice
    // and land back where it started.
    const click = (e: React.MouseEvent) => { if (movedRef.current) { e.stopPropagation(); movedRef.current = false; } };
    // Released, it SETTLES rather than arriving: `--ease-out-quiet` is Emil's ease-out
    // (0.23, 1, 0.32, 1), which decelerates hard into its stop, so it reads as a spring
    // without the overshoot the user ruled out. While a finger owns it there is no
    // transition at all — anything else is the thumb lagging the pointer.
    const settle = dragging ? 'none' : 'transform var(--duration-base) var(--ease-out-quiet), background-color var(--duration-base) var(--ease-hover)';

    return (
      // aria-hidden: the parent button owns role="switch" and aria-checked, and repeating
      // the state here would read the control out twice.
      <span
        ref={trackRef}
        aria-hidden
        data-slot="switch-pill"
        data-on={on || undefined}
        onClickCapture={click}
        style={{ ['--sw-travel' as string]: `${TRAVEL_PX}px` }}
        className="relative isolate inline-grid grid-cols-[max-content_var(--sw-travel)] items-center rounded-full border border-border bg-paper p-0.5"
      >
        {/* THE SIZER, and it is the whole fix.
            The track used to be sized by its two SHORT words while the thumb had to hold a third,
            longer one — so "Focus" overflowed its `calc(50% - 4px)` pill and ran out past the
            track's edge. Two widths with no relationship between them. Now the track is sized BY
            the thumb's own content plus one travel: an invisible copy of exactly what rides the
            pill sets the first column, so the pill always fits whatever word it is given, in any
            language, with nothing measured at runtime. Same hidden-mirror trick the DS Textarea
            uses to grow. */}
        {/* 1px above and below a 20px line: the pill is 28px tall overall, the height of every control in
            the header row it lives in (it was 34px, the one control in the row out of step). */}
        <span aria-hidden className="invisible flex items-center gap-1.5 whitespace-nowrap px-3 py-px text-ui font-medium">
          <span className="grid grid-cols-2 gap-[2px]">
            {Array.from({ length: 6 }, (_, d) => <span key={d} className="size-[2px]" />)}
          </span>
          {labels.name}
        </span>

        {/* THE FIXED LABELS. They do not move and they do not fade — they are the track, and the
            pill slides OVER them (user's spec: "Off and On remain fixed in the background, while
            the Focus pill slides horizontally between them… partially covering them as it moves").
            An earlier version crossfaded them; occlusion says the same thing without asking the
            eye to track two opacities at once, and it is what makes a half-drag read as half. */}
        {([['off', labels.off, 'start-0.5'], ['on', labels.on, 'end-0.5']] as const).map(([side, text, edge]) => (
          <span
            key={side}
            className={cn('pointer-events-none absolute inset-y-0 z-0 grid w-[var(--sw-travel)] place-items-center text-ui font-medium text-ink-500', edge)}
          >
            {text}
          </span>
        ))}

        <span
          data-slot="switch-pill-thumb"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDragP(null)}
          className={cn(
            // Its width is the track less one travel: the pill occupies everything the slide does
            // not, which is why the far label is exactly uncovered at each rest position.
            'absolute inset-y-0.5 start-0.5 z-10 flex w-[calc(100%-4px-var(--sw-travel))] items-center justify-center gap-1.5 rounded-full',
            'whitespace-nowrap touch-none select-none cursor-grab active:cursor-grabbing',
            'text-ui font-medium text-[var(--on-accent)]',
          )}
          // A transform, so no frame re-runs layout. It travels exactly `--sw-travel`, the same
          // number the pointer handler divides by.
          style={{ transform: `translateX(calc(${p} * var(--sw-travel)))`, background: fill, transition: settle }}
        >
          {/* The grip, and it is not decoration — the thumb really drags. */}
          <span className="grid grid-cols-2 gap-[2px] opacity-45">
            {Array.from({ length: 6 }, (_, d) => <span key={d} className="size-[2px] rounded-full bg-current" />)}
          </span>
          {labels.name}
        </span>
      </span>
    );
  }

  const geom = size === 'md'
    ? { track: 'w-9 h-5', thumb: 'size-4', off: 2, on: 18 }
    : { track: 'w-7 h-4', thumb: 'size-3', off: 2, on: 14 };
  return (
    // aria-hidden: the state is announced by the parent's role="switch" and
    // aria-checked. Repeating it here would read the control out twice.
    <span
      aria-hidden
      className={cn(
        'relative inline-block shrink-0 rounded-full transition-colors duration-fast',
        geom.track,
        on
          ? 'bg-[var(--accent)]'
          : 'bg-[color-mix(in_srgb,var(--color-ink-400)_28%,var(--color-paper-5))]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0 rounded-full bg-white transition-transform duration-fast ease-standard',
          'shadow-[0_1px_2px_rgb(30_28_26/0.20),0_0_0_0.5px_rgb(30_28_26/0.06)]',
          geom.thumb,
        )}
        // Moved, not re-positioned: `left` re-runs layout on every frame. The thumb and
        // the track colour share one `--duration-fast`, so they land on the same frame.
        style={{ transform: `translateX(${on ? geom.on : geom.off}px)` }}
      />
    </span>
  );
}

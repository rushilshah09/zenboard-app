'use client';
// The switch TRACK on its own — no button, no state, no Radix.
//
// It exists because the DS `<Switch>` is a real Radix button, and the one place
// this is used (the shell's Focus toggle) is already a `<button role="switch">`
// wrapping a label. Nesting a button inside a button is invalid HTML and breaks
// the outer control's hit area, so that row needs the switch's LOOK without its
// behaviour. Anything that owns its own toggling should use `<Switch>` instead.
//
// Moved out of the legacy `ui/primitives.tsx` so that file could be retired.
import { cn } from '@/lib/cn';

export function SwitchTrack({ on, size = 'md' }: { on: boolean; size?: 'sm' | 'md' }) {
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
        // the track colour share one 100ms, so they land on the same frame.
        style={{ transform: `translateX(${on ? geom.on : geom.off}px)` }}
      />
    </span>
  );
}

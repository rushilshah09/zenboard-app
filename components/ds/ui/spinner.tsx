import { Loader2 } from "@/lib/icons";
import { cn } from "@/lib/cn";

// ── THE ONE SPINNER ─────────────────────────────────────────────────────────
//
// The app had two. `components/ui/primitives.tsx` drew a bordered ring at 600ms
// linear; the DS's Button, Input, Switch and AddLine each wrote `animate-spin`,
// which is TAILWIND's 1000ms — so the same wait turned at two speeds depending on
// which control you were looking at, and neither number was written down.
//
// One component, one speed (`--duration-spin`, 600ms). Emil Kowalski: a
// faster-spinning spinner makes an app feel like it loads faster at an identical
// load time, which is the whole reason the number is 600 and not Tailwind's 1000.
//
// ── IT WAITS BEFORE IT SHOWS ───────────────────────────────────────────────
//
// `delayed` is the default, and it is the most important thing in this file. A
// spinner that appears for a 90ms fetch is a FLASH: the eye registers an
// interruption rather than a speed, and the interface feels SLOWER than it would
// with no indicator at all. So the spinner mounts immediately and stays invisible
// until `--delay-busy` (140ms) has passed — work that finishes first unmounts it
// unseen. It is CSS (`zb-busy`), not a timer: nothing to schedule, nothing to
// clean up, and no re-render at the moment the app is already busy.
//
// Pass `delayed={false}` only where the wait is known to be long and the control
// would otherwise look dead for its first 140ms — a full-page load, say, never a
// button.

export interface SpinnerProps {
  /** One of the icon scale's steps; matches the control it sits in. */
  size?: number;
  /** Held back by `--delay-busy` so a fast wait never flashes one. Default true. */
  delayed?: boolean;
  /** Spoken while it turns. Omit inside a control that already says it is busy. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 16, delayed = true, label, className }: SpinnerProps) {
  return (
    <Loader2
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      strokeWidth={2}
      className={cn("zb-spin shrink-0", delayed && "zb-busy", className)}
    />
  );
}

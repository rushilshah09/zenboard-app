import * as React from "react";
import * as RS from "@radix-ui/react-switch";
import { Loader2 } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md §4.18 — a switch takes effect IMMEDIATELY (needs a Save
// button? it's a checkbox). Label sits left; never render "On"/"Off".
// Capsule construction: a borderless fully-rounded track and a circular,
// softly-shadowed thumb (iOS/Notion), thumb slides with a smooth transform.
export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof RS.Root> {
  size?: "sm" | "md";
  label?: React.ReactNode;
  /** Pending write: thumb becomes a spinner, track shows pending colour at 50%. */
  loading?: boolean;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { size = "md", label, loading, className, disabled, ...props },
  ref,
) {
  const md = size === "md";
  const control = (
    <RS.Root
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring relative shrink-0 cursor-pointer rounded-full transition-colors duration-fast ease-hover",
        md ? "h-5 w-9" : "h-4 w-7",
        // Off: a quiet recessed capsule, PLUS a hairline that clears 3:1.
        //
        // This used to read "no hairline — the fill IS the edge", and measured
        // 1.1:1 in light and 1.26:1 in dark: the off state was invisible, so
        // the only thing marking the control was the knob floating in space.
        // A switch is one of the four places where the shape IS the control
        // (WCAG 1.4.11), and a fill quiet enough to read as "off" can never
        // also carry 3:1 — the two requirements pull opposite ways.
        //
        // Material 3 resolves it the same way: keep the recessed fill and put
        // the contrast in an outline. Drawn as an INSET shadow, not a border,
        // so the track's box and the thumb's travel are untouched.
        "bg-[color-mix(in_srgb,var(--color-ink-400)_28%,var(--color-paper-5))]",
        "shadow-[inset_0_0_0_1px_var(--color-border-control)]",
        "hover:bg-[color-mix(in_srgb,var(--color-ink-400)_38%,var(--color-paper-5))]",
        // On: the accent fills the track, so the outline has nothing left to
        // say — and an outline around a solid reads as a seam.
        "data-[state=checked]:shadow-none",
        // On: the user-selected accent (Appearance → Accent drives --accent).
        "data-[state=checked]:bg-[var(--accent)] data-[state=checked]:hover:bg-[var(--accent-deep)]",
        loading && "opacity-50",
        "disabled:cursor-not-allowed data-[disabled]:bg-surface-disabled",
        !label && className,
      )}
      {...props}
    >
      <RS.Thumb
        className={cn(
          "block rounded-full bg-white transition-transform duration-fast ease-standard motion-reduce:transition-none",
          "shadow-[0_1px_2px_rgb(30_28_26/0.20),0_0_0_0.5px_rgb(30_28_26/0.06)]",
          md
            ? "size-4 translate-x-0.5 data-[state=checked]:translate-x-[18px]"
            : "size-3 translate-x-0.5 data-[state=checked]:translate-x-[14px]",
          "data-[disabled]:bg-ink-300 data-[disabled]:shadow-none",
        )}
      >
        {loading && (
          <span className="grid size-full place-items-center">
            <Loader2 className={cn("animate-spin text-ink-500", md ? "size-3" : "size-2.5")} aria-hidden />
          </span>
        )}
      </RS.Thumb>
    </RS.Root>
  );

  if (!label) return control;
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-3", className)}>
      <span className="text-body text-ink-800">{label}</span>
      {control}
    </label>
  );
});

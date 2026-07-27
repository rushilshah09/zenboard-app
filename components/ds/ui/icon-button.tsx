import * as React from "react";
import { Button, type ButtonProps } from "./button";
import { Tooltip, type TooltipProps } from "./tooltip";
import { cn } from "@/lib/cn";

// design-system.md §4.3 — a Button with iconOnly and three extra laws: always an
// aria-label, always a tooltip (identical text), hit-area ≥ visual.
export interface IconButtonProps extends Omit<ButtonProps, "iconOnly" | "children" | "icon" | "aria-label"> {
  /** Accessible name AND tooltip text — kept identical by construction (§4.3). */
  label: string;
  icon: React.ReactNode;
  /** A richer tooltip that still leads with `label` (e.g. "Close · Esc"). */
  tooltip?: React.ReactNode;
  tooltipSide?: TooltipProps["side"];
  tooltipDisabled?: boolean;
  /** Toggled/active — neutral selected wash + full ink + aria-pressed (B&G monochrome). */
  selected?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tooltip, tooltipSide = "top", tooltipDisabled, selected, variant = "ghost", size = "md", className, ...props },
  ref,
) {
  return (
    <Tooltip content={tooltip ?? label} side={tooltipSide} disabled={tooltipDisabled}>
      <Button
        ref={ref}
        iconOnly
        variant={variant}
        size={size}
        aria-label={label}
        aria-pressed={selected || undefined}
        // Hit target ≥44px on touch even at 32/36px desktop visuals (§4.3, WCAG 2.5.5).
        // The base Button cva gives the VERTICAL reach on coarse pointers; a square
        // icon control also needs horizontal reach → recenter the ::after as 44×44.
        className={cn(
          "[@media(pointer:coarse)]:after:left-1/2 [@media(pointer:coarse)]:after:right-auto [@media(pointer:coarse)]:after:w-11 [@media(pointer:coarse)]:after:-translate-x-1/2 [@media(pointer:coarse)]:after:-translate-y-1/2",
          // `selected`: neutral selected wash + full ink, overriding the variant fill
          // (B&G monochrome — never berry).
          selected && "bg-surface-selected text-ink-900 hover:bg-surface-fill active:bg-surface-fill",
          className,
        )}
        {...props}
      >
        {icon}
      </Button>
    </Tooltip>
  );
});

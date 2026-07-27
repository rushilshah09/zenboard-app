import * as React from "react";
import { ChevronDown } from "@/lib/icons";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/cn";

// design-system.md §4.2 — adjacent buttons sharing an outline. A *segmented set
// of independent actions*, not a value selector (that's Segmented Control §4.19).
// Members share variant + size; borders collapse; the interacted one raises z.
export function ButtonGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-stretch",
        "[&>*]:relative [&>*]:rounded-none [&>*:first-child]:rounded-s-sm [&>*:last-child]:rounded-e-sm",
        "[&>*:not(:first-child)]:-ms-px [&>*:hover]:z-10 [&>*:focus-visible]:z-10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Divider between the two halves, per variant. B&G monochrome: on the ink-solid
// primary fill the seam is a dark hairline (border-line-onsolid); fill/outline
// variants use the neutral hairline; danger (the one color) darkens its own edge.
const SPLIT_DIVIDER: Record<string, string> = {
  primary: "border-line-onsolid",
  neutral: "border-line-onsolid", // legacy alias of primary
  secondary: "border-line-strong",
  outline: "border-line-strong",
  tinted: "border-line-strong",
  ghost: "border-line-soft",
  quiet: "border-line-soft",
  danger: "border-danger-700",
  dangerGhost: "border-line-danger",
  link: "",
};

export interface SplitButtonProps extends Omit<ButtonProps, "iconOnly"> {
  /** Accessible name for the chevron half (§4.2), e.g. "More new-item options". */
  menuLabel: string;
  onMenuOpen?: () => void;
  /** Open state of the disclosed menu — drives aria-expanded on the chevron half. */
  menuExpanded?: boolean;
  menuProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

// design-system.md §4.2 — the Double Action Button: one primary action + a
// disclosure half sharing a single fill. The halves are two real <button>s so
// each has its own name, focus ring, and hit target; only the seam is shared.
export const SplitButton = React.forwardRef<HTMLButtonElement, SplitButtonProps>(function SplitButton(
  { menuLabel, onMenuOpen, menuExpanded, menuProps, variant = "primary", size = "md", icon, children, className, disabled, ...props },
  ref,
) {
  return (
    <div role="group" className={cn("inline-flex items-stretch", className)}>
      <Button ref={ref} variant={variant} size={size} icon={icon} disabled={disabled} className="rounded-e-none" {...props}>
        {children}
      </Button>
      <Button
        variant={variant}
        size={size}
        iconOnly
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={menuExpanded ?? undefined}
        disabled={disabled}
        onClick={onMenuOpen}
        className={cn("w-7 rounded-s-none border-s", SPLIT_DIVIDER[variant ?? "primary"])}
        {...menuProps}
      >
        <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
      </Button>
    </div>
  );
});

// First-class DS name for the pattern (button-spec §"Double Action Button").
// `SplitButton` stays as the shadcn-idiom alias; both point at one implementation.
export const DoubleActionButton = SplitButton;
export type DoubleActionButtonProps = SplitButtonProps;

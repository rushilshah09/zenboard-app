import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import { cn } from "@/lib/cn";

// design-system.md §4.35 — small, NON-modal, interactive panel anchored to a
// trigger. The page behind stays live. Emerge from the anchor; auto-flip/shift
// to stay 12px inside the viewport. Nesting allowed exactly once.

export const Popover = RP.Root;
export const PopoverTrigger = RP.Trigger;
export const PopoverAnchor = RP.Anchor;
export const PopoverClose = RP.Close;

export interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof RP.Content> {
  /** p-0 when the panel holds a list (§4.35). */
  flush?: boolean;
  /** 8px arrow — only when the anchor is small/ambiguous (an avatar). */
  arrow?: boolean;
}

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(function PopoverContent(
  { flush, arrow, className, sideOffset = 6, collisionPadding = 12, children, ...props },
  ref,
) {
  return (
    <RP.Portal>
      <RP.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          // Canonical overlay chrome — matches MenuPanel/DropdownMenu (surface-raised
          // lifted gray, rounded-lg, line-strong). Content popovers keep p-3; list
          // popovers pass flush for p-0.
          "z-dropdown min-w-[200px] max-w-[360px] rounded-lg border border-line-strong bg-surface-raised shadow-lift-2",
          flush ? "p-0" : "p-3",
          "data-[state=open]:animate-emerge data-[state=closed]:animate-exit",
          "data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left",
          className,
        )}
        {...props}
      >
        {children}
        {arrow && <RP.Arrow width={16} height={8} className="fill-[var(--color-surface-raised)] drop-shadow-[0_1px_0_var(--color-border-default)]" />}
      </RP.Content>
    </RP.Portal>
  );
});

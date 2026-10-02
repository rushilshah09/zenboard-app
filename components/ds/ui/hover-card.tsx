import * as React from "react";
import * as HC from "@radix-ui/react-hover-card";
import { cn } from "@/lib/cn";
import { OVERLAY_CLASS } from "./menu";

// A panel that appears on HOVER rather than on click, for previewing what is on
// the other end of a link without going there.
//
// WHY THIS IS NOT <Popover> WITH A MOUSE HANDLER, and not <Tooltip> either. The
// three are genuinely different contracts and the DS keeps them apart:
//
//   Tooltip    names a control. One line, no interaction, appears fast.
//   Popover    is opened deliberately, by a click, and may be interacted with.
//   HoverCard  is glanced at. It opens on intent, closes on leaving, and can be
//              moved into — so a link inside it is reachable.
//
// Radix owns the part that is genuinely hard: the open/close intent timing, the
// safe triangle from trigger to card, focus behaviour, and the fact that it is
// deliberately NOT shown to keyboard/touch users — for whom a hover preview
// cannot exist, and who are given the link itself instead.
//
// Chrome is identical to PopoverContent on purpose. Two overlay vocabularies in
// one product is exactly what the constitution's §"Visual Consistency" forbids.

export const HoverCard = HC.Root;
export const HoverCardTrigger = HC.Trigger;

export interface HoverCardContentProps extends React.ComponentPropsWithoutRef<typeof HC.Content> {
  /** p-0 when the panel holds a list or its own padded rows. */
  flush?: boolean;
}

export const HoverCardContent = React.forwardRef<HTMLDivElement, HoverCardContentProps>(
  function HoverCardContent({ flush, className, sideOffset = 6, collisionPadding = 12, children, ...props }, ref) {
    return (
      <HC.Portal>
        <HC.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(
            "z-dropdown w-[280px] max-w-[320px]",
            OVERLAY_CLASS,
            flush ? "p-0" : "p-3",
            "zb-enter data-[state=open]:animate-emerge data-[state=closed]:animate-exit",
            "origin-(--radix-hover-card-content-transform-origin)",
            className,
          )}
          {...props}
        >
          {children}
        </HC.Content>
      </HC.Portal>
    );
  },
);

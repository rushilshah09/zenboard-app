import * as React from "react";
import * as RT from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

// design-system.md §4.9 — hover 400ms in / focus instant; a warm group opens
// others within 300ms instantly. Plain text, ≤8 words. Never the only name.
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RT.Provider delayDuration={400} skipDelayDuration={300}>
      {children}
    </RT.Provider>
  );
}

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: RT.TooltipContentProps["side"];
  align?: RT.TooltipContentProps["align"];
  /** Omit the arrow for tight toolbars (§4.9). */
  arrow?: boolean;
  /** Force-disable — e.g. on touch, where tooltips don't exist (§4.9). */
  disabled?: boolean;
}

export function Tooltip({ content, children, side = "top", align = "center", arrow = true, disabled }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-tooltip max-w-[240px] rounded-sm bg-ink-900 px-2 py-1 text-meta text-paper shadow-lift-2",
            "select-none [&_kbd]:ms-1.5",
            "data-[state=delayed-open]:animate-emerge data-[state=instant-open]:animate-emerge data-[state=closed]:animate-exit",
            "data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left",
          )}
        >
          {content}
          {arrow && <RT.Arrow width={10} height={5} className="fill-ink-900" />}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}

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

/**
 * Does this focus ARRIVE at the control, or is focus being handed back to it?
 *
 * A tooltip names a control for someone arriving at it — by Tab, from another
 * control. When a menu, dialog or listbox closes, Radix returns focus to the
 * control that opened it, and a tooltip opening THERE took the next Escape: in a
 * peek, after its mode menu, Escape closed the menu, then the tooltip, and only a
 * third press closed the page. `from` is the focus event's `relatedTarget` — the
 * element focus left — which is null once that element has unmounted.
 */
const HANDS_FOCUS_BACK =
  '[role="menu"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],'
  + '[role="dialog"],[role="alertdialog"],[role="listbox"],[role="option"]';
export function focusOpensTooltip(from: { closest(selectors: string): unknown } | null): boolean {
  return !!from && !from.closest(HANDS_FOCUS_BACK);
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
      {/* Radix skips its own open-on-focus once this handler prevents the event. */}
      <RT.Trigger asChild onFocus={(e) => { if (!focusOpensTooltip(e.relatedTarget as Element | null)) e.preventDefault(); }}>
        {children}
      </RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-tooltip max-w-[240px] rounded-sm bg-ink-900 px-2 py-1 text-meta text-paper shadow-lift-2",
            "select-none [&_kbd]:ms-1.5",
            "zb-enter data-[state=delayed-open]:animate-emerge data-[state=closed]:animate-exit",
            "origin-(--radix-tooltip-content-transform-origin)",
          )}
        >
          {content}
          {arrow && <RT.Arrow width={10} height={5} className="fill-ink-900" />}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}

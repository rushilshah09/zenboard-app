"use client";
// ── NAVIGATION MENU ────────────────────────────────────────────────────────
// A site navigation whose items open panels from the bar — Radix NavigationMenu, so hover and
// click both open it, arrow keys move through it, Escape closes it and focus goes back where it
// came from. The panel wears the one overlay chrome every menu in Zenboard wears (OVERLAY_CLASS)
// and grows from the bar; opened from the keyboard it is simply there (`zb-enter`).

import * as React from "react";
import { NavigationMenu as RNM } from "radix-ui";
import { ChevronDown } from "@/components/ds/icons";
import { cn } from "@/lib/cn";
import { button } from "./button";
import { Icon } from "./icon";
import { OVERLAY_CLASS } from "./menu";

export function NavigationMenu({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof RNM.Root>) {
  return (
    <RNM.Root className={cn("relative flex items-center", className)} {...props}>
      {children}
      <div className="absolute start-0 top-full z-dropdown flex">
        <RNM.Viewport
          className={cn(
            OVERLAY_CLASS,
            "zb-enter relative mt-2 origin-top-left overflow-hidden",
            "h-(--radix-navigation-menu-viewport-height) w-(--radix-navigation-menu-viewport-width)",
            "data-[state=open]:animate-emerge data-[state=closed]:animate-exit",
          )}
        />
      </div>
    </RNM.Root>
  );
}

export function NavigationMenuList({ className, ...props }: React.ComponentPropsWithoutRef<typeof RNM.List>) {
  return <RNM.List className={cn("flex items-center gap-1", className)} {...props} />;
}

export const NavigationMenuItem = RNM.Item;

export function NavigationMenuTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof RNM.Trigger>) {
  return (
    <RNM.Trigger className={cn(button({ variant: "ghost", size: "sm" }), "group gap-1", className)} {...props}>
      {children}
      <Icon
        icon={ChevronDown}
        size={14}
        aria-hidden
        className="text-ink-500 transition-transform duration-fast ease-standard group-data-[state=open]:rotate-180"
      />
    </RNM.Trigger>
  );
}

export function NavigationMenuContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof RNM.Content>) {
  return <RNM.Content className={cn("start-0 top-0 w-max p-1.5", className)} {...props} />;
}

/** A link inside a panel. Selecting it closes the menu. */
export const NavigationMenuLink = RNM.Link;

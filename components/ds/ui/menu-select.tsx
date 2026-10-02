"use client";

import * as React from "react";
import { ChevronDown } from "@/lib/icons";
import { cn } from "@/lib/cn";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "./dropdown-menu";
import { MENU_FIELD_CLASS } from "./menu";

// A choice made INSIDE a panel — a filter's condition, a sort's property, a rule's
// colour target. It was the browser's <select>: an OS list, different on every
// platform, opening in the middle of a Zenboard panel. Now the trigger is a menu
// field and the list is a DropdownMenu, so it wears the one overlay chrome, answers
// the menu keyboard, and marks the chosen option with the menu's trailing check.
//
// A page-level form keeps `Select` (the field tier); this is for panels, whose own
// edge is already the boundary (menu.tsx, "field").

export interface MenuSelectOption {
  value: string;
  label: React.ReactNode;
  /** A leading glyph — a property's type, say. */
  icon?: React.ReactNode;
}

export interface MenuSelectProps {
  value: string;
  options: MenuSelectOption[];
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
}

export function MenuSelect({ value, options, onValueChange, className, "aria-label": ariaLabel }: MenuSelectProps) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            MENU_FIELD_CLASS,
            // A button, so the keyboard's focus ring is the house one (globals.css); open, it
            // shows the menu's own active wash.
            "flex cursor-pointer items-center gap-2 text-left data-[state=open]:bg-surface-active",
            className,
          )}
        >
          {current?.icon && <span className="flex shrink-0 items-center text-ink-600 [&_svg]:size-4">{current.icon}</span>}
          <span className="min-w-0 flex-1 truncate">{current?.label}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.icon && <span className="flex shrink-0 items-center text-ink-600 [&_svg]:size-4">{o.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

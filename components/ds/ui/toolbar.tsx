"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

// Canonical editor / tool toolbar. Consolidates the hand-rolled TB_BTN / CODE_BTN
// patterns copy-pasted across documents/*. Chrome selection = INK (per the DS
// decision: the picked accent is reserved for data-entry controls, not chrome).

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Wrap the row in the floating-toolbar chrome (border + raised surface + lift). */
  floating?: boolean;
}

export function Toolbar({ className, floating = false, ...props }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      className={cn(
        "flex items-center gap-0.5",
        floating &&
          "rounded-lg border border-line-strong bg-surface-raised p-1 shadow-lift-2",
        className,
      )}
      {...props}
    />
  );
}

const TB_SIZE = {
  sm: "h-[22px] min-w-[22px]",
  md: "h-7 min-w-7",
} as const;

export interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggled/active state — ink selected wash. */
  active?: boolean;
  size?: "sm" | "md";
  /** Text/label buttons grow to their content instead of staying square. */
  wide?: boolean;
}

export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  ToolbarButtonProps
>(function ToolbarButton(
  { active = false, size = "md", wide = false, className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      data-active={active || undefined}
      className={cn(
        "zb-press inline-flex cursor-pointer items-center justify-center rounded-sm border-0 text-caption font-medium leading-none transition-colors duration-fast focus-ring",
        TB_SIZE[size],
        wide ? "w-auto gap-1 px-[7px]" : "aspect-square",
        active
          ? "bg-surface-selected text-ink-900"
          : "bg-transparent text-ink-600 hover:text-ink-900",
        "disabled:pointer-events-none disabled:text-ink-300",
        className,
      )}
      {...props}
    />
  );
});

export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("mx-0.5 h-4 w-px shrink-0 bg-line", className)}
    />
  );
}

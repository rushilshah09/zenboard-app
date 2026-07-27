"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ds/ui/icon";

// Presentational menu chrome — ONE source of truth for the panel / row / label /
// glyph styles that were hand-rolled (TB_PANEL / MENU_PANEL / MENU_ROW …) across
// documents/*. Behaviour (open state, positioning, keyboard nav) stays with the
// caller; for Radix-driven menus reach for <DropdownMenu> / <ContextMenu> instead.
// The row highlight is INK (surface-hover), per the DS accent decision.

// Shared panel class so callers that must render their own positioned <div>
// (nested editor menus) can reuse the exact chrome via cn(MENU_PANEL_CLASS, …).
// ── THE canonical overlay chrome ──────────────────────────────────────────
// One spec shared by MenuPanel, DropdownMenu, and Popover so every floating
// surface in the app is a sibling (Notion/Linear-grade consistency):
//   container → rounded-lg · border-line-strong · bg-surface-raised (#262626,
//   a real lifted gray, NOT bg-paper #121212) · p-1.5 · shadow-lift-2 · pop-in
//   item      → min-h-8 · gap-2 · rounded-sm · px-2 · text-ui (14px) · ink-800
//               · hover:bg-surface-hover
export const MENU_PANEL_CLASS =
  "rounded-lg border border-line-strong bg-surface-raised p-1.5 shadow-lift-2 [animation:zb-pop-in_120ms_var(--ease-standard)]";

// Shared item chrome — DropdownMenu (Radix) reuses this so a hand-positioned
// MenuItem and a Radix DropdownMenuItem are pixel-identical.
export const MENU_ITEM_CLASS =
  "flex min-h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-ui text-ink-800 outline-none";

export const MenuPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function MenuPanel({ className, ...props }, ref) {
    return <div ref={ref} role="menu" className={cn(MENU_PANEL_CLASS, className)} {...props} />;
  },
);

export function MenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2.5 pb-1 pt-2 text-overline uppercase text-ink-500", className)}
      {...props}
    />
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1.5 my-1 h-px bg-line-soft", className)} />;
}

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading icon or glyph node. */
  icon?: React.ReactNode;
  /** Right-aligned node (kbd, chevron). Overrides the auto check when present. */
  trailing?: React.ReactNode;
  /** Selected — shows a trailing check (unless `trailing` is set). */
  active?: boolean;
  /** Destructive action styling. */
  danger?: boolean;
}

export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  function MenuItem(
    { icon, trailing, active = false, danger = false, className, children, type, disabled, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        role="menuitem"
        type={type ?? "button"}
        disabled={disabled}
        className={cn(
          "zb-press border-0 bg-transparent transition-colors duration-fast hover:bg-surface-hover",
          MENU_ITEM_CLASS,
          danger && "text-danger-600 hover:bg-danger-100",
          disabled && "pointer-events-none text-ink-300",
          className,
        )}
        {...props}
      >
        {icon && <span className={cn("grid shrink-0 place-items-center [&_svg]:size-4", danger ? "text-danger-600" : "text-ink-500")}>{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {trailing ??
          (active ? <Icon icon={Check} size={14} className="text-ink-500" /> : null)}
      </button>
    );
  },
);

// The bordered 18px glyph box used for turn-into type icons and A/A colour
// swatches. Pass `style` for palette colour/background (a sanctioned inline).
export function MenuGlyph({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-xs text-caption font-semibold leading-none text-ink-800 shadow-[inset_0_0_0_1px_var(--color-line-soft)]",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

"use client";

import * as React from "react";
import { Check } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ds/ui/icon";

// Presentational menu chrome — ONE source of truth for the panel / row / label /
// glyph styles that were hand-rolled (TB_PANEL / MENU_PANEL / MENU_ROW …) across
// documents/*. Behaviour (open state, positioning, keyboard nav) stays with the
// caller; for Radix-driven menus reach for <DropdownMenu> / <ContextMenu> instead.
// The row highlight is INK (surface-hover), per the DS accent decision.

// ── THE canonical overlay chrome ──────────────────────────────────────────
// ONE chrome for every floating surface — dropdown and context menus, popovers,
// selects, comboboxes, hover cards, the text toolbar, a database's panels — so they
// are siblings wherever they open.
//
// It is the app's menus' chrome, by the user's direction (2026-09-15, with a
// screenshot of the "New ▾" menu beside a database's view list: "database uses old
// styling with outline — we have to use new styling"). Measured then, both themes:
// the menus drew the decorative edge (`--border`, #3D3D3D dark / #E9E9E7 light) and a
// soft shadow; every popover — and so every database panel — drew a 28% ink outline
// (`border-line-strong`) and the heavy lift. A popover is the lightest surface in dark
// and white over a tinted page in light: its tone floats it, and the edge only has to
// close it, as Notion's menus do. The FIELD tier (`line-strong`) stays on fields.
//
//   container → rounded-lg · border-border · bg-popover · shadow-md
//   list      → the container + p-1
//   item      → min-h-8 · px-2 · py-1.5 · gap-2 · rounded-md · text-ui · 16px glyphs
//               · hover/highlight bg-surface-hover (DropdownMenuItem's metrics)
//   label     → px-2 pt-2 pb-1 · text-overline · ink-500
//   separator → -mx-1 my-1 · 1px bg-border
//   field     → a text field inside a panel (MenuField): the hover wash as its ground,
//               no edge, and no ring when focused — its caret is its focus. A panel
//               opens with its search already focused, and any edge there read as the
//               old outline the moment it opened (the page field's double ring did,
//               in the user's screenshot; a 1px edge still did, measured after).
//
// Held by app/theme-bridge.test.ts ("every floating list paints the RAISED tier") and
// app/design-system.test.ts ("one overlay chrome").
export const OVERLAY_CLASS = "rounded-md border border-border bg-popover text-popover-foreground shadow-lift-2";

export const MENU_PANEL_CLASS = `${OVERLAY_CLASS} p-1 zb-enter [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]`;

// Shared item chrome — the same metrics as a Radix DropdownMenuItem, so a
// hand-positioned MenuItem and a DropdownMenuItem are pixel-identical.
export const MENU_ITEM_CLASS =
  "flex min-h-8 w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-ui text-ink-800 outline-none";

export const MENU_LABEL_CLASS = "px-2 pb-1 pt-2 text-overline text-ink-500";

export const MENU_SEPARATOR_CLASS = "-mx-1 my-1 h-px bg-border";

export const MENU_FIELD_CLASS =
  "h-8 w-full min-w-0 rounded-sm border-0 bg-surface-hover px-2 text-ui text-ink-900 caret-ink-900 outline-none placeholder:text-ink-500 " +
  "disabled:text-ink-500";

/**
 * A text field inside a floating panel — a menu's search, a view's name, a filter's
 * value. `icon` leads it (a search glyph). Declared chromeless for the edge sweep: the
 * panel is its boundary, and its ground is the wash.
 */
export const MenuField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }>(
  function MenuField({ icon, className, ...props }, ref) {
    const input = (
      // `data-autofocus` names the field a panel is for, so the panel can focus it itself: React's
      // autoFocus alone is taken back by a dialog the panel opens inside (components/documents/db-pop.tsx).
      <input ref={ref} autoComplete="off" data-1p-ignore data-lpignore="true" data-chromeless
        data-autofocus={props.autoFocus ? "" : undefined}
        {...props} className={cn(MENU_FIELD_CLASS, icon && "ps-8", className)} />
    );
    if (!icon) return input;
    return (
      <div className="relative w-full">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 start-2 flex items-center text-ink-500 [&_svg]:size-4">{icon}</span>
        {input}
      </div>
    );
  },
);

export const MenuPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function MenuPanel({ className, ...props }, ref) {
    return <div ref={ref} role="menu" className={cn(MENU_PANEL_CLASS, className)} {...props} />;
  },
);

export function MenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(MENU_LABEL_CLASS, className)} {...props} />;
}

export function MenuSeparator({ className }: { className?: string }) {
  return <div className={cn(MENU_SEPARATOR_CLASS, className)} />;
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
          "zb-press border-0 bg-transparent transition-colors duration-fast",
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

"use client"

import * as React from "react"
import { cn } from "@/lib/cn"
// The registry imports these from lucide-react. This app has one icon seam
// (components/ds/icons.ts → @/lib/icons) and no lucide dependency, so the
// glyphs come from there instead — switching icon sets stays a one-file change.
import { Check as CheckIcon, ChevronRight as ChevronRightIcon } from "@/lib/icons"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
// The one overlay chrome (menu.tsx): every floating surface shares it.
import { OVERLAY_CLASS } from "./menu"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  keepFocus = false,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  /**
   * Leave focus where it is — when the menu opens AND when it closes. For a menu
   * that was only pointed at (the breadcrumb trail opens on hover): the person's
   * caret is in the document, and moving the mouse across the header took it —
   * into the menu, then onto the crumb. Radix's focus-on-open is a prop its types
   * keep private (`onOpenAutoFocus`) but its Content passes through, so it is set
   * here, in one place, and guarded by dropdown-menu.test.ts.
   */
  keepFocus?: boolean
}) {
  const stayPut = keepFocus ? { onOpenAutoFocus: (e: Event) => e.preventDefault() } : {}
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto p-1 zb-enter data-[state=open]:animate-emerge data-[state=closed]:animate-exit",
          OVERLAY_CLASS,
          className
        )}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e)
          if (keepFocus) e.preventDefault()
        }}
        {...(stayPut as object)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItemBase({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:text-ink-500 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      // ONE GRAMMAR FOR "THIS ONE IS ON": a trailing check, as the radio rows and every
      // `DropdownMenuItem active` draw it. The registry's LEADING check indented these rows
      // 32px, so a menu holding both kinds had two label columns 24px apart.
      className={cn(
        "group/item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:text-ink-500 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="ms-auto">
        <CheckIcon className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      // TRAILING CHECK, not the registry's leading dot — and the reason is
      // cohesion, not taste. This menu system already says "this is the current
      // one" in one way: the account menu's workspace list, and every
      // `DropdownMenuItem active`, put a check on the right. A radio group that
      // says the same thing with a dot on the LEFT gives the same sentence two
      // grammars inside one menu. The radio SEMANTICS are untouched — this is
      // still Radix's RadioItem, still `role="menuitemradio"` with aria-checked;
      // only the glyph the indicator draws has changed.
      className={cn(
        "group/item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:text-ink-500 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="ms-auto">
        <CheckIcon className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        // The registry styles a label exactly like an item — same size, same weight,
// same padding — so a section heading is indistinguishable from something you
// can click. `text-overline` is Zenboard's one section-label role (12/500,
// tertiary ink, SENTENCE CASE) and it is what makes "Workspaces" read as a
// heading rather than a disabled row.
        "px-2 pt-2 pb-1 text-overline text-ink-500 data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-[highlighted]/item:text-ink-700",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  icon,
  value,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
  /** Leading glyph, like `DropdownMenuItem`'s. Styled by the row's own
   *  `[&_svg]:size-4`, so it needs no wrapper of its own. */
  icon?: React.ReactNode
  /** The current answer, right-aligned before the chevron — "Project · Ridgeline ›", as Linear's property
   *  submenus read. Secondary ink that steps up on the highlight wash, like an item's `description`. Put it
   *  here, never inside `children`: the label is one truncating span, so anything placed in it runs on
   *  ("ScheduleInbox"). */
  value?: React.ReactNode
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "group/item flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-surface-hover data-[inset]:pl-8 data-[state=open]:bg-surface-hover [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {value != null && value !== "" && (
        <span className="max-w-[50%] shrink truncate text-ink-500 group-data-[highlighted]/item:text-ink-700 group-data-[state=open]/item:text-ink-700">{value}</span>
      )}
      <ChevronRightIcon className="size-4 shrink-0" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden p-1 zb-enter data-[state=open]:animate-emerge data-[state=closed]:animate-exit",
        OVERLAY_CLASS,
        className
      )}
      {...props}
    />
  )
}


// ── Zenboard conveniences ───────────────────────────────────────────────────
// The registry component above is untouched in structure, spacing and
// behaviour; this is a thin pass-through so the 44 existing call sites keep
// working, and every prop maps onto a mechanism shadcn already ships:
//
//   icon   → the first child (its own `[&_svg]:size-4` styles it)
//   danger → `variant="destructive"` (shadcn's own prop)
//   keys   → `<DropdownMenuShortcut>` (shadcn's own component)
//   active → a trailing check, for an exclusive pick that is not a radio group
//
// Nothing here restyles the row. If a future prop needs to, it belongs in the
// registry component instead, so there is one place the chrome is decided.
export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  icon?: React.ReactNode;
  /** Platform-neutral key tokens, e.g. ["mod","D"]. */
  keys?: string[];
  danger?: boolean;
  inset?: boolean;
  /** Chosen — trailing check. */
  active?: boolean;
  /** A second line under the label, for menus that offer a CHOICE. */
  description?: string;
}

function DropdownMenuItem({
  icon, keys, danger, active, description, children, ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuItemBase variant={danger ? "destructive" : "default"} {...props}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {description && <span className="block truncate text-caption text-ink-500 group-data-[highlighted]/item:text-ink-700">{description}</span>}
      </span>
      {keys?.length ? <DropdownMenuShortcut>{keys.join(" ")}</DropdownMenuShortcut> : null}
      {active && <CheckIcon className="size-4 shrink-0" aria-hidden />}
    </DropdownMenuItemBase>
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuItemBase,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}

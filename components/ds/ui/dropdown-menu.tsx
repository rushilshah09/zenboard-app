import * as React from "react";
import * as RD from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

// design-system.md §4.34 — the action menu. Emerge from the trigger edge,
// origin follows placement. ONE highlight state shared by hover and keyboard.
// Danger last, after a separator. Submenus: safe-triangle (Radix built-in).

export const DropdownMenu = RD.Root;
export const DropdownMenuTrigger = RD.Trigger;
export const DropdownMenuGroup = RD.Group;
export const DropdownMenuSub = RD.Sub;
export const DropdownMenuRadioGroup = RD.RadioGroup;

// Chrome shared verbatim with MenuPanel (menu.tsx MENU_PANEL_CLASS / MENU_ITEM_CLASS)
// so a Radix DropdownMenu and a hand-positioned MenuPanel are pixel-identical.
// Keeps the placement-aware emerge/exit (superior to pop-in for anchored menus).
const PANEL =
  "z-dropdown min-w-[180px] max-w-[320px] rounded-lg border border-line-strong bg-surface-raised p-1.5 shadow-lift-2 " +
  "data-[state=open]:animate-emerge data-[state=closed]:animate-exit " +
  "data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left";

// min-h-8 row · 14px label · 16px leading glyph · 8px pad / 8px gap · 6px radius.
// Highlight = surface-hover wash (lifts above the surface-raised panel); label colour steady.
const ITEM =
  "group/item relative flex min-h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-ui text-ink-800 outline-none " +
  "data-[highlighted]:bg-surface-hover " +
  "data-[disabled]:pointer-events-none data-[disabled]:text-ink-300 " +
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-500 data-[highlighted]:[&_svg]:text-ink-700";

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RD.Content>
>(function DropdownMenuContent({ className, sideOffset = 4, collisionPadding = 12, ...props }, ref) {
  return (
    <RD.Portal>
      <RD.Content ref={ref} sideOffset={sideOffset} collisionPadding={collisionPadding} className={cn(PANEL, className)} {...props} />
    </RD.Portal>
  );
});

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof RD.Item> {
  icon?: React.ReactNode;
  /** Platform-neutral key tokens, e.g. ["mod","D"] — teaches the shortcut (§4.34). */
  keys?: string[];
  danger?: boolean;
  /** Reserve the 16px leading slot so labels align in check/radio menus. */
  inset?: boolean;
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(function DropdownMenuItem(
  { icon, keys, danger, inset, className, children, ...props },
  ref,
) {
  return (
    <RD.Item
      ref={ref}
      className={cn(
        ITEM,
        inset && "ps-8",
        danger &&
          "text-danger-600 data-[highlighted]:bg-danger-100 data-[highlighted]:text-danger-600 [&_svg]:text-danger-600 data-[highlighted]:[&_svg]:text-danger-600",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {keys && <Kbd keys={keys} className="border-transparent bg-transparent text-ink-400 shadow-none" />}
    </RD.Item>
  );
});

export const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RD.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <RD.CheckboxItem ref={ref} className={cn(ITEM, "ps-8", className)} {...props}>
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <RD.ItemIndicator>
          <Check className="size-3.5 text-berry-600" aria-hidden />
        </RD.ItemIndicator>
      </span>
      {children}
    </RD.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RD.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <RD.RadioItem ref={ref} className={cn(ITEM, "ps-8", className)} {...props}>
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <RD.ItemIndicator>
          <Circle className="size-1.5 fill-berry-600 text-berry-600" aria-hidden />
        </RD.ItemIndicator>
      </span>
      {children}
    </RD.RadioItem>
  );
});

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof RD.Label>) {
  return <RD.Label className={cn("px-2.5 pb-1 pt-2 text-overline uppercase text-ink-500", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof RD.Separator>) {
  return <RD.Separator className={cn("-mx-1.5 my-1 h-px bg-line-soft", className)} {...props} />;
}

export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RD.SubTrigger> & { icon?: React.ReactNode }
>(function DropdownMenuSubTrigger({ icon, className, children, ...props }, ref) {
  return (
    <RD.SubTrigger ref={ref} className={cn(ITEM, "data-[state=open]:bg-surface-hover", className)} {...props}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      <ChevronRight aria-hidden />
    </RD.SubTrigger>
  );
});

export const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RD.SubContent>
>(function DropdownMenuSubContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <RD.Portal>
      <RD.SubContent ref={ref} sideOffset={sideOffset} className={cn(PANEL, className)} {...props} />
    </RD.Portal>
  );
});

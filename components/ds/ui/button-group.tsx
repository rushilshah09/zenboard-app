import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"
import { ChevronDown } from "@/lib/icons"
import { Button, type ButtonProps } from "./button"
import { Slot } from "radix-ui"

import { Separator } from "@/components/ds/ui/separator"

const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        // `bg-input` until 2026-09-08, when --input became the CONTROL edge
        // (>=3:1). A separator between two buttons is decorative, not a
        // control boundary, so it takes the plain surface edge.
        "relative m-0! self-stretch bg-border data-[orientation=vertical]:h-auto",
        className
      )}
      {...props}
    />
  )
}


// ── Split / Double Action button ────────────────────────────────────────────
// design-system.md §4.2 — one primary action plus a disclosure half sharing a
// single fill. NOT the registry's `ButtonGroup` above, which groups peers: here
// the two halves are one control, and the seam between them is a real divider
// tuned per variant. Kept because the "+ New" control in the topbar is this
// pattern and there is no registry equivalent.
//
// The halves are two real <button>s so each keeps its own accessible name,
// focus ring and hit target; only the seam is shared.
const SPLIT_DIVIDER: Record<string, string> = {
  primary: "border-line-onsolid",
  neutral: "border-line-onsolid",
  secondary: "border-line-strong",
  outline: "border-line-strong",
  tinted: "border-line-strong",
  ghost: "border-line-soft",
  quiet: "border-line-soft",
  // A solid fill carrying the onsolid label, exactly like primary — so the seam
  // is the label's colour at 16%, the one divider made for a solid. It was
  // `border-danger-700`, a step the ramp does not have, so the seam took the
  // app's default border: a grey line through the red (4.79:1 in light).
  danger: "border-line-onsolid",
}

export interface SplitButtonProps extends Omit<ButtonProps, "iconOnly"> {
  /** Accessible name for the chevron half (§4.2), e.g. "More new-item options". */
  menuLabel: string
  onMenuOpen?: () => void
  /** Open state of the disclosed menu — drives aria-expanded on the chevron half. */
  menuExpanded?: boolean
  menuProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export const SplitButton = React.forwardRef<HTMLButtonElement, SplitButtonProps>(function SplitButton(
  { menuLabel, onMenuOpen, menuExpanded, menuProps, variant = "primary", size = "md", icon, children, className, disabled, ...props },
  ref,
) {
  return (
    <div role="group" className={cn("inline-flex items-stretch", className)}>
      <Button ref={ref} variant={variant} size={size} icon={icon} disabled={disabled} className="rounded-e-none" {...props}>
        {children}
      </Button>
      <Button
        variant={variant}
        size={size}
        iconOnly
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={menuExpanded ?? undefined}
        disabled={disabled}
        onClick={onMenuOpen}
        className={cn("w-7 rounded-s-none border-s", SPLIT_DIVIDER[variant ?? "primary"])}
        {...menuProps}
      >
        <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
      </Button>
    </div>
  )
})

// First-class DS name for the pattern; `SplitButton` is the shadcn-idiom alias.
export const DoubleActionButton = SplitButton
export type DoubleActionButtonProps = SplitButtonProps

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
}

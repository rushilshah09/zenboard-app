"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/cn"

// Themed to the Zenboard B&G design system. The "on" state is INK chrome
// (surface-selected + ink-900), NOT the picked accent — toggle-groups are view/
// segment chrome, and per the DS rule accent is reserved for data-entry controls
// (checkbox/radio/switch/slider). See [[zenboard-bg-redesign]] accent decision.
const toggleVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm text-body font-medium whitespace-nowrap text-ink-600 transition-colors duration-fast outline-none hover:bg-surface-hover hover:text-ink-900 focus-ring disabled:pointer-events-none disabled:text-ink-300 aria-invalid:ring-2 aria-invalid:ring-danger-600 data-[state=on]:bg-surface-selected data-[state=on]:text-ink-900 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-line bg-transparent hover:bg-surface-hover hover:text-ink-900",
      },
      size: {
        default: "h-8 min-w-8 px-2",
        sm: "h-7 min-w-7 px-1.5",
        lg: "h-9 min-w-9 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }

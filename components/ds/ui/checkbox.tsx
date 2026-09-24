"use client"

import * as React from "react"
import { cn } from "@/lib/cn"
// The registry imports these from lucide-react. One icon seam here.
import { Check as CheckIcon } from "@/lib/icons"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

export interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  /** The label BESIDE the box. */
  label?: React.ReactNode
  /** A second line under the label. */
  description?: React.ReactNode
  /** Box scale. A task row's box is smaller than a form's; the registry has one. */
  size?: "sm" | "md"
  /**
   * Per-instance checked colour — a list's own hue, so a task in the "Design"
   * list ticks in that list's colour. Set as a local `--accent` override rather
   * than a class, because the value comes from user data and cannot be a
   * Tailwind class at build time.
   */
  tint?: string | null
}

// The registry ships the box alone. Zenboard's takes a `label`, and that is not
// a convenience: wrapping both in one <label> makes the TEXT part of the hit
// target, which is the difference between a 16px tap target and a comfortable
// one — and `[@media(pointer:coarse)]:min-h-11` then meets WCAG 2.5.5 on a
// phone. A bare 16px box beside unlinked text is the single most common way a
// checkbox becomes unusable on touch.
function Checkbox({ className, label, description, size = "md", tint, style, ...props }: CheckboxProps) {
  const box = (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      style={tint ? ({ ...style, "--accent": tint, "--on-accent": "#fff" } as React.CSSProperties) : style}
      className={cn(
        // A bare checkbox (no label) is 16px, and it is the most-tapped control
        // in the product. The labelled form already gets a 44px row below;
        // this gives the box itself the 24px floor on touch.
        "touch-min",
        "peer shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary",
        size === "sm" ? "size-3.5" : "size-4",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none zb-enter animate-tick"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (!label) return box

  return (
    <label className="flex min-h-8 cursor-pointer items-start gap-2 py-1.5 [@media(pointer:coarse)]:min-h-11">
      {box}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body text-ink-800 peer-disabled:text-ink-500">{label}</span>
        {description && <span className="text-meta text-ink-500">{description}</span>}
      </span>
    </label>
  )
}

export { Checkbox }

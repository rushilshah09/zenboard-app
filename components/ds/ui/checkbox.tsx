import * as React from "react";
import * as RC from "@radix-ui/react-checkbox";
import { cn } from "@/lib/cn";

// design-system.md §4.16 — the tick DRAWS itself left-to-right (stroke-dashoffset,
// 140ms, ease-out-quiet): the system's one permitted flourish, on the most
// satisfying action in a task app. Label is part of the hit target.
// Handoff checkbox is 18px with a berry fill when checked.
const BOX: Record<"sm" | "md" | "touch", string> = {
  sm: "size-4",
  md: "size-[18px]",
  touch: "size-5",
};

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RC.Root>, "asChild"> {
  size?: "sm" | "md" | "touch";
  label?: React.ReactNode;
  /** Extra line under the label, meta ink-500. */
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { size = "md", label, description, className, checked, ...props },
  ref,
) {
  const box = (
    <RC.Root
      ref={ref}
      checked={checked}
      className={cn(
        "peer relative shrink-0 rounded-[5px] border transition-colors duration-instant focus-ring",
        BOX[size],
        "border-line-strong bg-surface-raised hover:border-ink-500",
        "data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]",
        "data-[state=indeterminate]:border-[var(--accent)] data-[state=indeterminate]:bg-[var(--accent)]",
        "aria-[invalid=true]:border-danger-500",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled",
        !label && className,
      )}
      {...props}
    >
      <RC.Indicator forceMount className="absolute inset-0 grid place-items-center text-[var(--on-accent)] data-[state=unchecked]:hidden">
        {checked === "indeterminate" ? (
          <span className="h-0.5 w-2 rounded-full bg-current" />
        ) : (
          <svg viewBox="0 0 12 12" fill="none" className="size-3" aria-hidden>
            <path
              d="M2.5 6.5 L5 9 L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              className="[stroke-dasharray:1] [stroke-dashoffset:1] data-[drawn]:[stroke-dashoffset:0] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-fast motion-safe:ease-out-quiet"
              // Draw on mount of the checked state: dashoffset 1 → 0.
              ref={(el) => {
                if (el) requestAnimationFrame(() => el.setAttribute("data-drawn", ""));
              }}
            />
          </svg>
        )}
      </RC.Indicator>
    </RC.Root>
  );

  if (!label) return box;
  return (
    <label className={cn("flex min-h-8 cursor-pointer items-start gap-2 py-1.5 [@media(pointer:coarse)]:min-h-11", className)}>
      <span className="flex h-5 items-center">{box}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-body text-ink-800 peer-disabled:text-ink-300">{label}</span>
        {description && <span className="text-meta text-ink-500">{description}</span>}
      </span>
    </label>
  );
});

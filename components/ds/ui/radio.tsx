import * as React from "react";
import * as RR from "@radix-ui/react-radio-group";
import { cn } from "@/lib/cn";

// design-system.md §4.17 + Zenboard handoff — checked is a berry ring with a berry
// centre dot (18px). Always in a radiogroup with a legend; one tab stop, arrows
// move AND select (native behaviour — don't fight it).
export const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RR.Root> & { legend?: string }
>(function RadioGroup({ legend, className, children, ...props }, ref) {
  const legendId = React.useId();
  return (
    <RR.Root
      ref={ref}
      aria-labelledby={legend ? legendId : undefined}
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      {legend && (
        <span id={legendId} className="mb-1 text-body font-medium text-ink-800">
          {legend}
        </span>
      )}
      {children}
    </RR.Root>
  );
});

export interface RadioProps extends React.ComponentPropsWithoutRef<typeof RR.Item> {
  label: React.ReactNode;
  description?: string;
}

export const Radio = React.forwardRef<HTMLButtonElement, RadioProps>(function Radio(
  { label, description, className, ...props },
  ref,
) {
  return (
    <label className={cn("flex min-h-8 cursor-pointer items-start gap-2 py-1.5 [@media(pointer:coarse)]:min-h-11", className)}>
      <span className="flex h-5 items-center">
        <RR.Item
          ref={ref}
          className={cn(
            "focus-ring grid size-[18px] shrink-0 place-items-center rounded-full border bg-surface-raised transition-[border-color] duration-fast",
            "border-line-strong hover:border-ink-500",
            "data-[state=checked]:border-2 data-[state=checked]:border-[var(--accent)]",
            "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled",
          )}
          {...props}
        >
          <RR.Indicator className="block size-2.5 rounded-full bg-[var(--accent)]" />
        </RR.Item>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-body text-ink-800">{label}</span>
        {description && <span className="text-meta text-ink-500">{description}</span>}
      </span>
    </label>
  );
});

// Radio card (§4.17) — the whole card is the label; for choices with
// consequences worth describing. Max 4.
export const RadioCard = React.forwardRef<HTMLButtonElement, RadioProps>(function RadioCard(
  { label, description, className, ...props },
  ref,
) {
  return (
    <RR.Item
      ref={ref}
      className={cn(
        "focus-ring group flex w-full items-start gap-3 rounded-md border p-3 text-start transition-colors duration-instant",
        "border-line bg-paper hover:bg-paper-3",
        "data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent-soft)]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 size-[18px] shrink-0 rounded-full border bg-surface-raised transition-[border-color] duration-fast",
          "border-line-strong group-data-[state=checked]:border-[5px] group-data-[state=checked]:border-[var(--accent)]",
        )}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-ink-900">{label}</span>
        {/* ink-600, not ink-500: on the checked card's berry tint, ink-500 drops
            under AA in dark (4.16:1). */}
        {description && <span className="text-meta text-ink-600">{description}</span>}
      </span>
    </RR.Item>
  );
});

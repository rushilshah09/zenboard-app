import * as React from "react";
import * as RA from "@radix-ui/react-accordion";
import { ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md §4.51 — leading chevron (a disclosure belongs BEFORE the
// thing it discloses), rotating 90°. Panel opens with Reveal. `icon` replaces the
// chevron where a surface leads with its own glyph (the website's questions lead
// with the mark); it reads the trigger's open state through `group-data-[state]`.
export const Accordion = RA.Root;

export function AccordionItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof RA.Item>) {
  return <RA.Item className={cn("border-b border-line-soft last:border-b-0", className)} {...props} />;
}

export function AccordionTrigger({ className, children, icon, ...props }: React.ComponentPropsWithoutRef<typeof RA.Trigger> & { icon?: React.ReactNode }) {
  return (
    <RA.Header asChild>
      <h3 className="flex">
        <RA.Trigger
          className={cn(
            "focus-ring group flex h-11 w-full items-center gap-2 rounded-sm px-3 text-start text-body font-medium text-ink-800",
            "transition-colors duration-instant hover:bg-surface-hover",
            className,
          )}
          {...props}
        >
          {icon ?? (
            <ChevronRight
              className="size-3.5 shrink-0 text-ink-500 transition-transform duration-fast ease-standard group-data-[state=open]:rotate-90"
              aria-hidden
            />
          )}
          {children}
        </RA.Trigger>
      </h3>
    </RA.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof RA.Content>) {
  return (
    <RA.Content
      className="overflow-hidden zb-enter data-[state=open]:animate-[reveal-down_var(--duration-slow)_var(--ease-out-quiet)] data-[state=closed]:animate-[reveal-up_var(--duration-fast)_var(--ease-out-quiet)]"
      {...props}
    >
      <div className={cn("px-3 pb-3 ps-8 text-body text-ink-700", className)}>{children}</div>
    </RA.Content>
  );
}

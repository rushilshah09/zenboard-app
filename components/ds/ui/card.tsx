import * as React from "react";
import { cn } from "@/lib/cn";

// Zenboard Design System handoff — Card is a RAISED content container (the kanban
// card, the settings panel): brightest surface (surface-raised), a hairline border,
// radius-lg, and a soft resting shadow. `interactive` adds a 1px hover lift; `flat`
// drops the shadow for cards nested inside another card; `selected` is a berry wash.
// (This supersedes the earlier flat, shadowless, surface-stepping card model.)
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover lift + pointer + keyboard focusability (role="button"). */
  interactive?: boolean;
  /** Berry-050 wash + berry border — e.g. a chosen kanban card. */
  selected?: boolean;
  /** Removes the resting shadow — for a card nested inside another card. */
  flat?: boolean;
  /** Override the default 16px padding (CSS length). */
  padding?: string;
  /** Parent-surface hint — retained for call-site compatibility; the card is always raised. */
  on?: "paper" | "paper-2";
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, selected, flat, padding, on, header, footer, className, children, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={padding ? { padding, ...style } : style}
      className={cn(
        "relative flex flex-col gap-3 rounded-lg border border-line-soft bg-surface-raised shadow-lift-1",
        padding ? undefined : "p-4",
        flat && "shadow-none",
        interactive &&
          "focus-ring cursor-pointer transition-[box-shadow,transform,border-color] duration-slow ease-standard " +
            "hover:-translate-y-px hover:border-line hover:shadow-lift-2 active:translate-y-0 active:shadow-lift-1",
        selected && "border-berry-300 bg-berry-050",
        className,
      )}
      {...props}
    >
      {header && <div className="flex items-start justify-between gap-2">{header}</div>}
      {children}
      {footer && <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3">{footer}</div>}
    </div>
  );
});

export function CardGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-stretch gap-4", className)} {...props} />;
}

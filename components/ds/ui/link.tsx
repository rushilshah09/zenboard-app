import * as React from "react";
import { ArrowUpRight } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md §4.4 — <a href> that navigates. If it does something instead
// of going somewhere, it's a <button>. Prose underlines; chrome doesn't (at rest).
export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: "prose" | "chrome";
  external?: boolean;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { variant = "prose", external, className, children, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      className={cn(
        "focus-ring rounded-xs",
        variant === "prose"
          ? "text-berry-600 underline decoration-berry-300 decoration-1 underline-offset-2 hover:decoration-berry-500"
          : "text-ink-700 hover:text-ink-900 hover:underline",
        className,
      )}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {children}
      {external && (
        <>
          <ArrowUpRight className="ms-0.5 inline size-3 align-[-0.1em] text-ink-400" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      )}
    </a>
  );
});

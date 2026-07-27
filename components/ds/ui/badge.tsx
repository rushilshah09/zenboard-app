import { cn } from "@/lib/cn";

// design-system.md §4.7 — a marker ATTACHED to something else. (Standalone
// metadata is a Tag, §4.8.) Count badges are positioned by the host, which
// carries the number in its aria-label; the badge itself is aria-hidden.
//
// Handoff Badge (status pill): 20px tall, radius-sm, 12px medium, a TINTED fill +
// hairline BORDER + coloured text — no leading dot. Six variants incl. `accent`.
export type BadgeStatus = "neutral" | "accent" | "success" | "warning" | "danger" | "error" | "info";

// `error` is the handoff's name for the danger family — same tokens.
const STATUS: Record<BadgeStatus, string> = {
  neutral: "bg-surface-sunken border-line-soft text-ink-600",
  accent: "bg-berry-050 border-berry-200 text-berry-600",
  success: "bg-success-100 border-success-300 text-success-600",
  warning: "bg-warning-100 border-warning-300 text-warning-600",
  danger: "bg-danger-100 border-danger-300 text-danger-600",
  error: "bg-danger-100 border-danger-300 text-danger-600",
  info: "bg-info-100 border-info-300 text-info-600",
};

export interface BadgeProps {
  variant?: "count" | "dot" | "status";
  count?: number;
  status?: BadgeStatus;
  /** Ring colour for the `dot` variant — the parent surface (§4.7). */
  surface?: "paper" | "paper-2" | "paper-3";
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "status", count = 0, status = "neutral", surface = "paper", children, className }: BadgeProps) {
  if (variant === "count") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-berry-500 px-1 text-caption font-semibold text-onsolid",
          className,
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }
  if (variant === "dot") {
    const ring = surface === "paper" ? "ring-paper" : surface === "paper-2" ? "ring-paper-2" : "ring-paper-3";
    return <span aria-hidden className={cn("inline-block size-1.5 rounded-full bg-berry-500 ring-2", ring, className)} />;
  }
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm border px-2 text-meta font-medium leading-none",
        STATUS[status],
        className,
      )}
    >
      {children}
    </span>
  );
}

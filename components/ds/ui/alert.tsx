import * as React from "react";
import { CircleCheck, Info, OctagonAlert, TriangleAlert, X } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md §4.39 — a static, in-flow message about the page or a
// section. The icon is mandatory: it's the colour-blind user's only signal.
// Body text is ink-700, never the variant colour.
export type AlertVariant = "info" | "success" | "warning" | "danger" | "neutral";

const STYLE: Record<AlertVariant, { box: string; icon: React.ReactNode; title: string }> = {
  info: { box: "border-info-300 bg-info-100", icon: <Info className="text-info-600" />, title: "text-info-600" },
  success: { box: "border-success-300 bg-success-100", icon: <CircleCheck className="text-success-600" />, title: "text-success-600" },
  warning: { box: "border-warning-300 bg-warning-100", icon: <TriangleAlert className="text-warning-600" />, title: "text-warning-600" },
  danger: { box: "border-danger-300 bg-danger-100", icon: <OctagonAlert className="text-danger-600" />, title: "text-danger-600" },
  neutral: { box: "border-line bg-paper-3", icon: <Info className="text-ink-500" />, title: "text-ink-800" },
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  /** Appeared after a user action → role=alert; present on load → role=status (§4.39). */
  live?: boolean;
  onDismiss?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = "info", title, live, onDismiss, actions, children, className }: AlertProps) {
  const s = STYLE[variant];
  const role = live && (variant === "warning" || variant === "danger") ? "alert" : "status";
  return (
    <div role={role} className={cn("flex gap-3 rounded-md border p-3", s.box, className)}>
      <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:size-4">
        {s.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className={cn("text-body font-medium", s.title)}>{title}</p>}
        <div className="text-body text-ink-700">{children}</div>
        {actions && <div className="mt-1 flex gap-3">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="focus-ring -m-1 grid size-6 shrink-0 place-items-center self-start rounded-xs text-ink-500 hover:text-ink-800"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ── Banner (§4.40) — app-level, one at a time, queued by severity ────────────
export interface BannerProps {
  variant?: Extract<AlertVariant, "info" | "warning" | "danger" | "success">;
  onDismiss?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Banner({ variant = "info", onDismiss, children, className }: BannerProps) {
  const s = STYLE[variant];
  return (
    <div role="status" className={cn("flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-4 text-ui", s.box, className)}>
      <span aria-hidden className="[&_svg]:size-4">{s.icon}</span>
      <span className="text-ink-800">{children}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="focus-ring ms-2 grid size-6 place-items-center rounded-xs text-ink-500 hover:text-ink-800"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

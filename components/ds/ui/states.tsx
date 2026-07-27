import * as React from "react";
import { CircleCheck } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "./button";

// design-system.md §3.8 + §4.46 — empty/error/success page states. Illustrations
// are aria-hidden; the text carries the information. No confetti, no "Oops!".

export interface EmptyStateProps {
  /** aria-hidden illustration / glyph slot (md 160px per §3.7). */
  illustration?: React.ReactNode;
  title: string; // ≤ 6 words
  description?: string; // ≤ 2 lines
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  /** inline = panel-sized (§4.56 tiles); page = space-12 breathing room. */
  size?: "page" | "inline";
  className?: string;
}

export function EmptyState({ illustration, title, description, primary, secondary, size = "page", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", size === "page" ? "gap-4 py-12" : "gap-2 py-6", className)}>
      {illustration && (
        <span aria-hidden className="text-ink-400">
          {illustration}
        </span>
      )}
      <h3 className={cn("text-ink-900", size === "page" ? "text-title-4" : "text-body font-medium")}>{title}</h3>
      {description && <p className="max-w-[42ch] text-body text-ink-500">{description}</p>}
      {(primary || secondary) && (
        <div className="mt-2 flex items-center gap-2">
          {primary}
          {secondary}
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Copyable reference id — support will ask (§4.46). */
  reference?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something broke on our end",
  description = "We've logged it. You can retry, or go back to your dashboard.",
  reference,
  onRetry,
  onBack,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-4 py-12 text-center", className)}>
      <h3 className="text-title-4 text-ink-900">{title}</h3>
      <p className="max-w-[42ch] text-body text-ink-500">{description}</p>
      <div className="mt-2 flex items-center gap-2">
        {onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>}
        {onBack && <Button variant="quiet" onClick={onBack}>Back to dashboard</Button>}
      </div>
      {reference && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(reference)}
          className="focus-ring rounded-xs font-mono text-mono-sm text-ink-400 hover:text-ink-600"
          title="Click to copy"
        >
          Reference: {reference}
        </button>
      )}
    </div>
  );
}

export function SuccessState({
  title,
  summary,
  actions,
  className,
}: {
  title: string;
  summary?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col items-center gap-4 py-12 text-center", className)}>
      <CircleCheck className="size-10 text-success-500" strokeWidth={1.5} aria-hidden />
      <h3 className="text-title-4 text-ink-900">{title}</h3>
      {summary && <p className="max-w-[42ch] text-body text-ink-500">{summary}</p>}
      {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

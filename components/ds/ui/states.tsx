import * as React from "react";
import { CircleCheck } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "./button";

// design-system.md §3.8 + §4.46 — empty/error/success page states. Illustrations
// are aria-hidden; the text carries the information. No confetti, no "Oops!".

// ── The shell all three states sit in ────────────────────────
// Empty, error and success are the same object — a centred column saying one
// thing — so they share one geometry and none of them re-declares it. They had
// drifted apart while looking identical: three copies of the same class string,
// which is how a spacing change lands in two of three places.
//
// MEASURED BUDGET (the reason the numbers are what they are). A page state is
// capped at 180px so it can never become a billboard that outshines the
// populated design it stands in for. `page` measures exactly that with a
// one-line description — 24 + 20 icon + 12 + 24 title + 12 + 20 text + 12 +
// 32 action + 24 — and 200px if the sentence wraps. It used to be 270px.
//
// ONE gap, no exceptions: the column's `gap` owns every vertical space in here.
// The action row used to add its own `mt-2` on top, making the rhythm
// 16/16/16/24 — a seam nobody could see without a ruler.
const SHELL = { page: "gap-3 py-6", inline: "gap-2 py-6" } as const;
type StateSize = keyof typeof SHELL;

function CenteredState({
  size = "page",
  role,
  className,
  children,
}: {
  size?: StateSize;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role={role} className={cn("flex flex-col items-center text-center", SHELL[size], className)}>
      {children}
    </div>
  );
}

/** The action row. Never carries its own vertical margin — see SHELL. */
function StateActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export interface EmptyStateProps {
  /** aria-hidden illustration / glyph slot (md 160px per §3.7). */
  illustration?: React.ReactNode;
  title: string; // ≤ 6 words
  description?: string; // ≤ 2 lines
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  /** inline = a panel/tile has nothing in it (§4.56); page = the whole surface is empty. */
  size?: StateSize;
  className?: string;
}

export function EmptyState({ illustration, title, description, primary, secondary, size = "page", className }: EmptyStateProps) {
  return (
    <CenteredState size={size} className={className}>
      {illustration && (
        <span aria-hidden className="text-ink-500">
          {illustration}
        </span>
      )}
      <h3 className={cn("text-ink-900", size === "page" ? "text-title-4" : "text-body font-medium")}>{title}</h3>
      {/* 52ch, not 42ch: one centred sentence was being broken across two lines
          by a measure narrower than the readable floor, costing 20px to say
          nothing extra. */}
      {description && <p className="max-w-[52ch] text-body text-ink-500">{description}</p>}
      {(primary || secondary) && (
        <StateActions>
          {primary}
          {secondary}
        </StateActions>
      )}
    </CenteredState>
  );
}

/**
 * The other empty shape: a *section* of a populated page has nothing in it yet
 * — Notes on a client, Payments on an invoice, Forms on a project.
 *
 * `<EmptyState>` is wrong here. It centres, it leads with a heading, and it
 * takes 180px even at `inline` — this comment claimed ~100px and was wrong by
 * enough to matter. A section inside a left-aligned detail column wants one
 * quiet left-aligned sentence. Seven places had worked that out independently and
 * written it three different ways (`text-ui` vs `text-caption`, `py-1` vs
 * `py-1.5` vs `px-0.5`), which is exactly the drift this file exists to stop.
 *
 * Rule of thumb: nothing on the screen → `<EmptyState>`. Something on the
 * screen but this part of it is empty → `<EmptyLine>`.
 */
export function EmptyLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("py-2 text-ui text-ink-500", className)}>{children}</p>;
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
    <CenteredState role="alert" className={className}>
      <h3 className="text-title-4 text-ink-900">{title}</h3>
      <p className="max-w-[52ch] text-body text-ink-500">{description}</p>
      {(onRetry || onBack) && (
        <StateActions>
          {onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>}
          {onBack && <Button variant="quiet" onClick={onBack}>Back to dashboard</Button>}
        </StateActions>
      )}
      {reference && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(reference)}
          className="focus-ring rounded-xs font-mono text-mono-sm text-ink-500 hover:text-ink-600"
          title="Click to copy"
        >
          Reference: {reference}
        </button>
      )}
    </CenteredState>
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
    <CenteredState role="status" className={className}>
      <CircleCheck className="size-10 text-success-500" strokeWidth={1.5} aria-hidden />
      <h3 className="text-title-4 text-ink-900">{title}</h3>
      {summary && <p className="max-w-[52ch] text-body text-ink-500">{summary}</p>}
      {actions && <StateActions>{actions}</StateActions>}
    </CenteredState>
  );
}

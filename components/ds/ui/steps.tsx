import { Check, TriangleAlert } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md §4.32 — a linear, committed flow. Completed steps are
// clickable (go back); upcoming ones are not. <ol> + aria-current="step".

export type StepState = "complete" | "current" | "upcoming" | "error";

export interface Step {
  label: string;
  state: StepState;
}

export interface StepIndicatorProps {
  steps: Step[];
  onStepClick?: (index: number) => void;
  className?: string;
}

// The current step's halo is its dot's own ink as a WASH, so it reads on any
// ground (measured 1.17:1 light, 1.23:1 dark). It was `ring-berry-alpha-20`, a
// Paper-OS name Tailwind never had: the ring drew currentColor — the onsolid
// label, which is nearly the page itself (1.04:1 light, 1.08:1 dark) — so the
// current step had no halo at all.
const CIRCLE: Record<StepState, string> = {
  complete: "bg-ink-800 text-paper",
  current: "bg-berry-500 text-onsolid ring-4 ring-surface-active",
  upcoming: "bg-paper-5 text-ink-500",
  error: "bg-danger-500 text-onsolid",
};

export function StepIndicator({ steps, onStepClick, className }: StepIndicatorProps) {
  return (
    <ol className={cn("flex items-center", className)}>
      {steps.map((s, i) => {
        const clickable = s.state === "complete" && onStepClick;
        const circle = (
          <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full text-caption font-semibold", CIRCLE[s.state])}>
            {s.state === "complete" ? (
              <Check className="size-3.5" strokeWidth={2.5} />
            ) : s.state === "error" ? (
              <TriangleAlert className="size-3" strokeWidth={2} />
            ) : (
              i + 1
            )}
          </span>
        );
        return (
          <li key={i} aria-current={s.state === "current" ? "step" : undefined} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-0.5 w-10 rounded-full",
                  s.state === "complete" || s.state === "current" ? "bg-berry-500" : "bg-paper-5",
                )}
              />
            )}
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="focus-ring flex items-center gap-2 rounded-sm p-0.5"
              >
                {circle}
                <span className="text-ui text-ink-600 hover:text-ink-900">{s.label}</span>
              </button>
            ) : (
              <span className="flex items-center gap-2 p-0.5">
                {circle}
                <span
                  className={cn(
                    "text-ui",
                    s.state === "current" ? "font-medium text-ink-900" : s.state === "error" ? "text-danger-600" : "text-ink-500",
                  )}
                >
                  {s.label}
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── StepDots — progress for a flow you are IN, not a map of it ─────────────
//
// `StepIndicator` above labels every step, which is right for a checkout where
// the names ("Address", "Payment") are information. A first-run flow has no such
// map: the steps are questions, naming them ahead of time is noise, and the only
// thing worth showing is how much is left. So: a dash per step, filled as far as
// you have come, and the count.
//
// The dashes are `aria-hidden` and the count carries the accessible name in
// WORDS ("Step 2 of 3") — a screen reader saying "two slash three" is a worse
// sentence than the eye needs it to be short.
export function StepDots({ current, total, className }: {
  /** 1-based. */
  current: number;
  total: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)} aria-label={`Step ${current} of ${total}`} role="group">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] w-6 rounded-full transition-colors duration-fast ease-hover",
              i < current ? "bg-[var(--accent)]" : "bg-line",
            )}
          />
        ))}
      </span>
      <span aria-hidden className="text-caption tabular-nums text-accent-text">{current}/{total}</span>
    </span>
  );
}

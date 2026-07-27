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

const CIRCLE: Record<StepState, string> = {
  complete: "bg-ink-800 text-paper",
  current: "bg-berry-500 text-onsolid ring-4 ring-berry-alpha-20",
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

import { cn } from "@/lib/cn";

// design-system.md §4.44 — prefer the FRACTION over a percentage in a task app.
// Complete → success fill; error → danger fill that stays.

export interface ProgressProps {
  value?: number; // 0–100; omit for indeterminate
  label?: string; // "12 of 20 tasks"
  state?: "active" | "complete" | "error";
  size?: "sm" | "md"; // h-1 / h-2 (labelled)
  /** Human value for SRs, e.g. "12 of 20 tasks complete". */
  valueText?: string;
  className?: string;
}

export function Progress({ value, label, state = "active", size = "sm", valueText, className }: ProgressProps) {
  const indeterminate = value === undefined;
  const fill = state === "complete" ? "bg-success-500" : state === "error" ? "bg-danger-500" : "bg-berry-500";
  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {label && (
        <span className="self-end text-meta text-ink-500" data-numeric>
          {label}
        </span>
      )}
      <div
        role="progressbar"
        aria-label={valueText ?? label ?? "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(value!)}
        aria-valuetext={valueText ?? label}
        className={cn("relative w-full overflow-hidden rounded-full bg-paper-5", size === "sm" ? "h-1" : "h-2")}
      >
        {indeterminate ? (
          <span className={cn("absolute h-full w-[30%] rounded-full", fill, "animate-[indeterminate_1.2s_ease-in-out_infinite]")} />
        ) : (
          <span
            className={cn("block h-full rounded-full transition-[width] duration-base ease-standard", fill)}
            style={{ width: `${Math.min(100, Math.max(0, value!))}%` }}
          />
        )}
      </div>
    </div>
  );
}

// Segmented — multi-part progress (§4.44): each part a status colour, 2px gaps.
export function SegmentedProgress({
  segments,
  className,
}: {
  segments: { value: number; color: "success" | "warning" | "danger" | "info" | "berry"; label: string }[];
  className?: string;
}) {
  const COLORS = { success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500", info: "bg-info-500", berry: "bg-berry-500" };
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  return (
    <div
      role="progressbar"
      aria-label="Progress by stage"
      aria-valuetext={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-paper-5", className)}
    >
      {segments.map((s, i) => (
        <span key={i} className={cn("h-full first:rounded-s-full last:rounded-e-full", COLORS[s.color])} style={{ width: `${(s.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

// Circular — Habits/Goals rings (§4.44).
export function CircularProgress({ value, size = 40, className }: { value: number; size?: 32 | 40 | 48; className?: string }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      role="progressbar"
      aria-label={`${Math.round(value)} percent`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={2} className="stroke-paper-5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="stroke-berry-500 transition-[stroke-dashoffset] duration-base ease-standard"
        />
      </svg>
      <span className="absolute font-mono text-mono-sm text-ink-700" data-numeric>
        {Math.round(value)}
      </span>
    </span>
  );
}

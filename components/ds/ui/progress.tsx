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
            // Full width and slid into place, not resized: `width` re-runs layout on every
            // frame, `transform` does not (Emil: animate transform and opacity only). The
            // track clips, so the fill's rounded leading edge is what shows.
            className={cn("block h-full w-full rounded-full transition-transform duration-base ease-standard", fill)}
            style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value!))}%)` }}
          />
        )}
      </div>
    </div>
  );
}

// Segmented — multi-part progress (§4.44): each part a status colour, 2px gaps.
// `ink` and `neutral` are the two UNCOLOURED weights, for bars whose segments
// are not statuses — a day's load is not success or danger, it is just how full
// it is. They also keep such a bar out of the accent budget (one filled-accent
// element per view), which a `berry` fill would spend.
export type SegmentColor = "success" | "warning" | "danger" | "info" | "berry" | "ink" | "neutral";

export interface SegmentedProgressProps {
  segments: { value: number; color: SegmentColor; label: string }[];
  /**
   * A fixed capacity to measure the segments against, instead of measuring them
   * against their own sum.
   *
   * Without it the bar is a BREAKDOWN — parts of a whole, always filling the
   * track — which is what a pipeline or a task-status split wants. With it the
   * bar is a LOAD against a limit, and the segments are allowed to EXCEED it:
   * the track scales to whichever is larger, a marker is drawn at the capacity,
   * and everything past that marker is the overflow.
   *
   * That distinction is the reason this prop exists rather than the caller
   * passing a "free space" segment. Normalising by the sum would rescale an
   * over-capacity plan to exactly full — so the one state the bar exists to
   * show would be the one state it could not draw.
   */
  total?: number;
  /** Names the capacity for screen readers — "8h day". Requires `total`. */
  totalLabel?: string;
  className?: string;
}

export function SegmentedProgress({ segments, total, totalLabel, className }: SegmentedProgressProps) {
  const COLORS: Record<SegmentColor, string> = {
    success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500",
    info: "bg-info-500", berry: "bg-berry-500", ink: "bg-ink-800", neutral: "bg-ink-400",
  };
  const sum = segments.reduce((n, s) => n + s.value, 0);
  const capacity = total != null && total > 0 ? total : null;
  // The track holds whichever is bigger, so an overrun has somewhere to go.
  const scale = (capacity != null ? Math.max(capacity, sum) : sum) || 1;
  const over = capacity != null && sum > capacity;

  return (
    <div
      role="progressbar"
      aria-label={capacity != null ? "Load against capacity" : "Progress by stage"}
      aria-valuemin={0}
      aria-valuemax={capacity ?? sum}
      aria-valuenow={sum}
      aria-valuetext={[
        ...segments.map((s) => `${s.label}: ${s.value}`),
        capacity != null ? `capacity: ${totalLabel ?? capacity}` : null,
      ].filter(Boolean).join(", ")}
      className={cn("relative flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-paper-5", className)}
    >
      {segments.map((s, i) => (
        <span key={i} className={cn("h-full first:rounded-s-full last:rounded-e-full", COLORS[s.color])} style={{ width: `${(s.value / scale) * 100}%` }} />
      ))}
      {over && (
        <>
          {/* The overrun, washed rather than filled: §7C calls for a warning,
              and the plan's notification diet (§7O) is explicit that ordinary
              overload is a planning signal, not an alarm. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 bg-warning-500/25"
            style={{ left: `${(capacity! / scale) * 100}%`, right: 0 }}
          />
          {/* Where the day ends. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-ink-800"
            style={{ left: `${(capacity! / scale) * 100}%` }}
          />
        </>
      )}
    </div>
  );
}

// Circular — Habits/Goals rings (§4.44).
/**
 * A ring for a fraction. 32–48px carries its number inside; 16px is a GLYPH set beside a name, the way Linear marks a
 * project's progress — a figure does not fit, and the row it sits in already says it ("3/5 tasks"). One progress mark
 * per thing: the Goals card drew a 52px ring AND a bar for the same percentage.
 */
export function CircularProgress({ value, size = 40, className }: { value: number; size?: 16 | 32 | 40 | 48; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const label = { role: 'progressbar' as const, 'aria-label': `${Math.round(v)} percent`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v) };
  if (size === 16) {
    // A GLYPH: an outline with a filled pie, as Linear draws a project's progress. A 16px ARC — the large ring
    // scaled down — read as a loading spinner beside a goal's name (measured by eye on Goals, 2026-09-22): a
    // partial circle that small says "wait", not "60% there". The pie is a circle whose stroke is its own
    // diameter, so its dash draws a sector.
    const pie = 2.25;
    const c = 2 * Math.PI * pie;
    return (
      <span {...label} className={cn('inline-grid size-4 place-items-center', className)}>
        <svg width={16} height={16} viewBox="0 0 16 16" className="-rotate-90" aria-hidden>
          <circle cx={8} cy={8} r={6.75} fill="none" strokeWidth={1.5} className="stroke-ink-400" />
          <circle cx={8} cy={8} r={pie} fill="none" strokeWidth={pie * 2} strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)} className="stroke-ink-700 transition-[stroke-dashoffset] duration-base ease-standard" />
        </svg>
      </span>
    );
  }
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <span {...label} className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
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
          strokeDashoffset={c * (1 - v / 100)}
          className="stroke-berry-500 transition-[stroke-dashoffset] duration-base ease-standard"
        />
      </svg>
      <span className="absolute font-mono text-mono-sm text-ink-700" data-numeric>
        {Math.round(v)}
      </span>
    </span>
  );
}

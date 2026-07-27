import { ArrowDownRight, ArrowUpRight } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Skeleton } from "./skeleton";

// design-system.md §4.54 — label first (you scan labels), then the value in
// SANS tabular figures. Per the enforced constitution (CLAUDE.md): "Numbers in
// stats and tables: tabular-nums" and "NEVER monospace, except invoice/ID
// strings like INV-001" — monospace at display size also spaces the thousands
// comma into a full cell ("$4 , 300"), so tabular sans reads tighter and truer.
// Direction is not sentiment: the caller passes `sentiment` explicitly.
export interface StatProps {
  label: string;
  /** Formatted value. null = no data → "—" in ink-300 (never "0"). */
  value: string | null;
  delta?: { text: string; direction: "up" | "down"; sentiment: "positive" | "negative" | "neutral" };
  /** 0–1 normalised sparkline points. */
  sparkline?: number[];
  loading?: boolean;
  className?: string;
}

export function Stat({ label, value, delta, sparkline, loading, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-caption font-medium uppercase tracking-wide text-ink-500">{label}</span>
      {loading ? (
        <Skeleton shape="line" className="h-8 w-32" />
      ) : value === null ? (
        <span className="text-title-1 text-ink-300">—</span>
      ) : (
        <span className="text-title-1 tabular-nums text-ink-900" data-numeric>
          {value}
        </span>
      )}
      {delta && !loading && (
        <span
          className={cn(
            "flex items-center gap-0.5 text-meta",
            delta.sentiment === "positive" && "text-success-600",
            delta.sentiment === "negative" && "text-danger-600",
            delta.sentiment === "neutral" && "text-ink-500",
          )}
        >
          {delta.direction === "up" ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
          {delta.text}
        </span>
      )}
      {sparkline && sparkline.length > 1 && !loading && (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-1 h-8 w-full" aria-hidden>
          <polyline
            fill="none"
            stroke="var(--color-berry-500)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            points={sparkline.map((v, i) => `${(i / (sparkline.length - 1)) * 100},${30 - v * 28}`).join(" ")}
          />
        </svg>
      )}
    </div>
  );
}

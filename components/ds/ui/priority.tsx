import { cn } from "@/lib/cn";

// design-system.md §4.9 — task priority is one of the few places colour is allowed
// to carry MEANING in the B&G system (status / warning / error). One canonical
// representation app-wide (Tasks list, Today, Projects, portal, composer) so the
// signal never drifts. Glyph = three ascending "signal-strength" bars (Figma
// PriorityTags 23:7402): bars fill UP TO the level and take the level's semantic
// hue — low = neutral ink, med = warning, high = danger. Everything token-driven.

export type PriorityLevel = "low" | "med" | "high";

const RANK: Record<PriorityLevel, number> = { low: 1, med: 2, high: 3 };
// Active-bar fill + matching label ink, per level (semantic tokens only).
const FILL: Record<PriorityLevel, string> = {
  low: "fill-ink-400",
  med: "fill-warning-500",
  high: "fill-danger-500",
};
const LABEL_INK: Record<PriorityLevel, string> = {
  low: "text-ink-500",
  med: "text-warning-600",
  high: "text-danger-600",
};
const LABEL: Record<PriorityLevel, string> = { low: "Low", med: "Medium", high: "High" };

// Three ascending bars; bar i (1-based) is coloured when i ≤ the level's rank,
// otherwise it sits back as a faint ink-200 rest state.
export function PriorityBars({ level, size = 12, className }: { level: PriorityLevel; size?: number; className?: string }) {
  const rank = RANK[level];
  const bar = (i: number) => (i <= rank ? FILL[level] : "fill-ink-200");
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <rect x="1" y="8" width="3" height="5" rx="1" className={bar(1)} />
      <rect x="5.5" y="5" width="3" height="8" rx="1" className={bar(2)} />
      <rect x="10" y="2" width="3" height="11" rx="1" className={bar(3)} />
    </svg>
  );
}

export interface PriorityBadgeProps {
  level: PriorityLevel;
  /** `bars` — inline glyph (+ optional label) for dense rows; `chip` — the
   *  surface-fill tag used on roomy rows and in the composer. */
  variant?: "bars" | "chip";
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export function PriorityBadge({ level, variant = "chip", showLabel = true, size = 12, className }: PriorityBadgeProps) {
  const glyph = <PriorityBars level={level} size={size} />;
  if (variant === "bars") {
    return (
      <span className={cn("inline-flex items-center gap-1", className)} title={`${LABEL[level]} priority`}>
        {glyph}
        {showLabel && <span className={cn("text-caption font-medium", LABEL_INK[level])}>{LABEL[level]}</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-tag bg-surface-fill p-1", className)}>
      {glyph}
      {showLabel && <span className="text-meta leading-none text-ink-600">{LABEL[level]}</span>}
    </span>
  );
}

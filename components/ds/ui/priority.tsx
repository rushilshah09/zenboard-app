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
  showLabel?: boolean;
  /**
   * Classes for the WORD alone. How a dense row drops "Medium" in a narrow
   * container (`@max-md:sr-only`) while keeping the bars, which carry the
   * level on their own — the `title` still names it on hover.
   */
  labelClassName?: string;
  size?: number;
  className?: string;
}

/**
 * The glyph and its word. The COLOUR is the glyph's alone: a red "High" beside
 * red bars said the level twice, and the word is the larger area — the chroma
 * rule puts a hue on the smallest thing that can carry it (2026-09-22). The
 * word is meta ink, like every other fact beside it (components/tasks/task-meta.tsx).
 *
 * There was also a `chip` variant — the bars in a grey capsule, for the Tasks
 * page's old two-line row. That row is gone and so is the capsule: a task's
 * facts are glyph-and-word, never filled chips.
 */
export function PriorityBadge({ level, showLabel = true, labelClassName, size = 12, className }: PriorityBadgeProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-caption text-ink-500", className)} title={`${LABEL[level]} priority`}>
      <PriorityBars level={level} size={size} />
      {showLabel && <span data-fact-word className={labelClassName}>{LABEL[level]}</span>}
    </span>
  );
}

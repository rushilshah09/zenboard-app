import { X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { LABEL_FILL, type LabelColor } from "@/lib/labelColor";

// design-system.md §4.8 — user-assigned metadata. Rectangles read as labels
// (pills read as filters), so a small radius, not a pill. Colour is meaning: the
// user picks it; new tags default to `stone` (no hashing, unlike avatars).
// Superset of the handoff Tag: the handoff's plain removable chip is `color="stone"`;
// the colour system (LabelColor) is retained. Radius follows the handoff (radius-sm).
export interface TagProps {
  color?: LabelColor;
  size?: "sm" | "md";
  /** Optional leading glyph (e.g. a 12px <Icon />), rendered before the label. */
  icon?: React.ReactNode;
  onRemove?: () => void;
  /** aria-label for the remove control, e.g. "Remove tag Design". */
  removeLabel?: string;
  children: React.ReactNode;
  /** Classes for the LABEL alone — how a dense row drops the word in a narrow
   *  container (`@max-md:sr-only`) and keeps the glyph. It styles the label's
   *  own box, so the gap after the glyph leaves with it; a hidden span nested
   *  INSIDE the label would leave that box at zero width and 4px of lopsided
   *  padding behind. Same prop, same meaning, as PriorityBadge's. */
  labelClassName?: string;
  className?: string;
}

export function Tag({ color = "stone", size = "md", icon, onRemove, removeLabel, children, labelClassName, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[160px] items-center rounded-sm font-medium",
        size === "sm" ? "h-5 gap-1 px-1.5 text-caption" : "h-6 gap-1 px-2 text-meta",
        onRemove && "-me-0.5 pe-1",
        LABEL_FILL[color],
        className,
      )}
    >
      {icon && <span className="grid shrink-0 place-items-center">{icon}</span>}
      <span className={cn("truncate", labelClassName)}>{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? "Remove"}
          onClick={onRemove}
          className="focus-ring relative -me-0.5 grid size-4 shrink-0 place-items-center rounded-xs opacity-60 transition-opacity hover:opacity-100 after:absolute after:-inset-1 after:content-['']"
        >
          <X className="size-3" strokeWidth={2} aria-hidden />
        </button>
      )}
    </span>
  );
}

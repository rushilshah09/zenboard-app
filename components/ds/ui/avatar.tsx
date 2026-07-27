import * as React from "react";
import { cn } from "@/lib/cn";
import { labelColorFor, LABEL_FILL, type LabelColor } from "@/lib/labelColor";

// design-system.md §4.6 — circles are humans, squares are entities. Fallback
// initials sit on a deterministic label fill; never grey-on-grey.
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type AvatarStatus = "online" | "away" | "focus" | "offline";

const BOX: Record<AvatarSize, string> = {
  xs: "size-5 text-caption",
  sm: "size-6 text-caption",
  md: "size-8 text-caption",
  lg: "size-10 text-meta",
  xl: "size-16 text-title-4",
  "2xl": "size-24 text-title-2",
};
const DOT: Record<AvatarSize, string> = {
  xs: "size-1.5",
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
  xl: "size-3",
  "2xl": "size-3.5",
};
const STATUS_COLOR: Record<AvatarStatus, string> = {
  online: "bg-success-500",
  away: "bg-warning-500",
  focus: "bg-berry-500",
  offline: "bg-ink-300",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  /** People are circles; entities (a company, a workspace) are rounded squares. */
  shape?: "circle" | "square";
  status?: AvatarStatus;
  /** Ring marks the current user / active speaker (§4.6). */
  ring?: boolean;
  /** Seed for the deterministic fallback fill; defaults to `name`. */
  seed?: string;
  /** Surface the avatar sits on, for the status-dot ring (default paper). */
  surface?: "paper" | "paper-2" | "paper-3";
  className?: string;
  /** Hide from the a11y tree when the name is already adjacent in text. */
  decorative?: boolean;
}

export function Avatar({
  name,
  src,
  size = "md",
  shape = "circle",
  status,
  ring,
  seed,
  surface = "paper",
  className,
  decorative,
}: AvatarProps) {
  const [broken, setBroken] = React.useState(false);
  const color: LabelColor = labelColorFor(seed ?? name);
  const round = shape === "circle" ? "rounded-full" : "rounded-sm";
  const ringSurface = surface === "paper" ? "ring-paper" : surface === "paper-2" ? "ring-paper-2" : "ring-paper-3";

  return (
    <span
      className={cn("relative inline-flex shrink-0 align-middle", className)}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden bg-paper-5 font-semibold ring-1 ring-inset ring-line-soft",
          BOX[size],
          round,
          ring && "outline outline-2 outline-offset-2 outline-berry-500",
        )}
      >
        {src && !broken ? (
          <img src={src} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className={cn("flex size-full items-center justify-center", LABEL_FILL[color])} aria-hidden>
            {initials(name)}
          </span>
        )}
      </span>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 end-0 rounded-full ring-2",
            DOT[size],
            STATUS_COLOR[status],
            ringSurface,
          )}
          aria-hidden
        />
      )}
    </span>
  );
}

// Avatar group — overlap 25%, each ringed in the surface to cut the one behind.
// Max shown, then a +N chip. The whole group is ONE focusable element (§4.6).
export interface AvatarGroupProps {
  people: { name: string; src?: string; seed?: string }[];
  size?: AvatarSize;
  max?: number;
  onOpen?: () => void;
  className?: string;
}

export function AvatarGroup({ people, size = "md", max = 4, onOpen, className }: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const overlap = size === "xs" || size === "sm" ? "-ms-1.5" : "-ms-2";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${people.length} people: ${people.map((p) => p.name).join(", ")}`}
      className="focus-ring inline-flex items-center rounded-full"
    >
      <span className={cn("flex items-center", className)}>
        {shown.map((p, i) => (
          <span key={i} className={cn("rounded-full ring-2 ring-paper", i > 0 && overlap)}>
            <Avatar name={p.name} src={p.src} seed={p.seed} size={size} decorative />
          </span>
        ))}
        {extra > 0 && (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-paper-4 font-semibold text-ink-600 ring-2 ring-paper",
              BOX[size],
              overlap,
            )}
            aria-hidden
          >
            +{extra}
          </span>
        )}
      </span>
    </button>
  );
}

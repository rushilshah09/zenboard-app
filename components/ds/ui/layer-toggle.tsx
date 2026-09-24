"use client";

import * as React from "react";
import { Check } from "@/lib/icons";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";
import { paletteFor } from "@/lib/palette";
import { scopeColorName } from "@/lib/entity-color";

// ── LayerToggle — "is this coloured pile showing?" ──────────────────────────
//
// A rail row that turns one layer on or off: a project in the tasks rail, a
// calendar in the calendar rail, a list, a label. The swatch carries the
// ENTITY'S OWN COLOUR, which is the whole point — it says "this layer, and it
// is on", not "this thing is finished".
//
// ── WHY IT EXISTS (user audit, 2026-09-08) ─────────────────────────────────
// Two modules had each solved this separately and one of them was wrong:
//
//   · Calendar hand-rolled a coloured 18px box with a check (`CalRow`) — right
//     idea, but a private implementation with its own height and radius.
//   · Tasks used the task `Checkbox` with a `tint` prop, and `tint` was NULL
//     for a project with no colour set. So it fell back to `--primary` and
//     rendered a BLACK TICKED BOX — pixel-identical to the "Mark done"
//     checkboxes four rows below it on the same screen. One glyph, two
//     opposite meanings: in the sidebar it meant "visible", in the list it
//     meant "completed".
//
// Hence: the colour is never optional. When the entity has none, `paletteFor`
// derives a stable one from its id, the same way the calendar rail already did.
// A layer toggle can never be black, so it can never be read as a task.
//
// It is a real `role="checkbox"` — the state IS binary and checked/unchecked is
// what a screen reader should hear — but it is deliberately NOT the `Checkbox`
// component, because they answer different questions and must not look alike.
export interface LayerToggleProps {
  /** The layer's name — the row's visible label and part of its accessible name. */
  name: string;
  /** Stable id, used to derive a colour when the entity has none. */
  id: string;
  /** The entity's own colour, if it has one. */
  color?: string | null;
  /** Is the layer currently showing? */
  on: boolean;
  onToggle: () => void;
  /** Right-aligned count. Omitted when zero — a "0" is not information. */
  count?: number;
  /** Clicking the LABEL selects the layer, rather than toggling it. */
  onSelect?: () => void;
  /** The label reads as the current scope. */
  selected?: boolean;
  /** Row-end actions (a menu), revealed on hover. */
  actions?: React.ReactNode;
  className?: string;
}

export function LayerToggle({
  name, id, color, on, onToggle, count, onSelect, selected, actions, className,
}: LayerToggleProps) {
  // A stored colour is read back as a NAME, so it resolves through a per-theme
  // token instead of being painted as the literal hex someone chose in light
  // mode — on a dark rail those measured 1.66-2.53:1 and the box vanished.
  // Anything unrecognised (or absent) still falls back to the palette, which
  // has always been theme-aware. See lib/entity-color.ts.
  const named = scopeColorName(color);
  const hue = named ? `var(--scope-${named})` : color || paletteFor(id).dot;
  // The tick's colour is NOT white. It is white on a deep fill and near-black
  // on a light one, and which of those applies flips with the theme: white on
  // dark-mode yellow measures 1.88:1. Both branches resolve to a token that
  // already knows the theme, so this stays a pure render.
  const onHue = named ? `var(--scope-${named}-on)` : "var(--pal-on)";
  const label = `${on ? "Hide" : "Show"} ${name}`;

  return (
    <div
      className={cn(
        "group/layer flex h-8 w-full items-center gap-2 rounded-sm px-2 transition-colors duration-fast",
        selected ? "bg-surface-selected" : "hover:bg-surface-hover",
        !on && "text-ink-500",
        className,
      )}
    >
      {/* The name says what the click DOES, not what the box is — "show this
          pile" is not guessable from a tick. */}
      <button
        type="button" role="checkbox" aria-checked={on} aria-label={label}
        onClick={onToggle}
        className="focus-ring grid size-[18px] shrink-0 place-items-center rounded-xs border transition-colors duration-fast"
        // OFF takes the control tier (>=3:1), not the field tier: an 18px box
        // with no text inside is the whole control, so its edge is the only
        // thing saying it is there. -strong is the edge for things that also
        // carry a label — see the tier note in app/tokens-light.css.
        style={on ? { background: hue, borderColor: hue } : { borderColor: "var(--color-border-control)" }}
      >
        {on && <Icon icon={Check} size={12} weight="bold" style={{ color: onHue }} />}
      </button>

      {onSelect ? (
        <button
          type="button" onClick={onSelect} aria-current={selected ? "true" : undefined}
          className="focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui [@media(pointer:coarse)]:min-h-6"
        >
          {name}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-ui">{name}</span>
      )}

      {count ? <span className="shrink-0 text-caption tabular-nums text-ink-500">{count}</span> : null}
      {actions}
    </div>
  );
}

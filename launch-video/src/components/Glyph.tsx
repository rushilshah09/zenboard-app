import React from "react";
import { interpolateColors } from "remotion";
import { GLYPHS, GlyphName } from "../brand/glyphs.generated";
import { CATEGORY, Category, colour } from "../brand/tokens";

/** Zenboard's sidebar icon family (Phosphor) mapped to the film's categories. */
export const GLYPH_OF: Record<Category, GlyphName> = {
  tasks: "list-checks",
  projects: "kanban",
  docs: "file-text",
  notes: "notepad",
  calendar: "calendar-blank",
  money: "receipt",
  clients: "users",
  life: "sun-horizon",
};

/**
 * A category glyph on its tile: the solid (filled) icon from the product's
 * icon family, with no inner white. Before S10 it is burgundy on Soft Sand;
 * `colourProgress` turns the tile to the category accent and the icon to the
 * category's dominant colour.
 */
export const Glyph: React.FC<{ category: Category; size: number; colourProgress?: number; dark?: number; style?: React.CSSProperties }> = ({
  category,
  size,
  colourProgress = 0,
  dark = 0,
  style,
}) => {
  const g = GLYPHS[GLYPH_OF[category]];
  const pair = CATEGORY[category];
  const tile = interpolateColors(dark, [0, 1], [interpolateColors(colourProgress, [0, 1], [colour.hairline, pair.accent]), "rgba(255, 255, 255, 0.09)"]);
  const icon = interpolateColors(dark, [0, 1], [interpolateColors(colourProgress, [0, 1], [colour.ink, pair.dominant]), "rgba(255, 255, 255, 0.9)"]);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: tile,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 256 256">
        {g.solid.map((d, i) => (
          <path key={i} d={d} fill={icon} />
        ))}
      </svg>
    </div>
  );
};

/** A plain line icon from the same family (regular weight), recoloured per state. */
export const Icon: React.FC<{ name: GlyphName; size: number; tint?: string; style?: React.CSSProperties }> = ({
  name,
  size,
  tint = colour.ink,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 256 256" style={{ flexShrink: 0, ...style }}>
    {GLYPHS[name].regular.map((d, i) => (
      <path key={i} d={d} fill={tint} />
    ))}
  </svg>
);
